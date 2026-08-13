"""Builds text-position statistics AND alignment-type groupings per 이미지
레퍼런스 category by running CLOVA OCR against every image in
api/_referenceLibrary.js. One-time/periodic batch job — NOT called live per
checklist analysis (see module docstring history in git log for why this is
a local script, not a Vercel endpoint: 12-function cap, execution-time risk,
no login needed since Blob URLs are public).

REQUIRES (add to .env.local — get values from Vercel dashboard, Project
Settings -> Environment Variables; NOT committed to git):
  CLOVA_OCR_INVOKE_URL=...
  CLOVA_OCR_SECRET_KEY=...
  BLOB_READ_WRITE_TOKEN=...   (already there for image uploads)

USAGE:
  python3 scripts/build_layout_stats.py                    # all categories
  python3 scripts/build_layout_stats.py --category fashion  # just one
  python3 scripts/build_layout_stats.py --dry-run           # parse + fetch dimensions only, no OCR/upload
  python3 scripts/build_layout_stats.py --reaggregate-only  # re-run aggregation from cached layout-raw/*.json
                                                              # WITHOUT calling OCR again (fast iteration on the
                                                              # aggregation logic itself)

WHAT CHANGED FROM V1 (both were real bugs, caught by a human review of the
actual output — see git log):
- "메인카피 위치"는 원래 "OCR이 감지한 가장 위쪽 텍스트"였는데, 이러면 로고나
  코너 뱃지처럼 작은 텍스트를 메인카피로 잘못 잡는 경우가 많았다(실제로 3.8%
  같은 비현실적인 값이 나옴 — 그 위치는 보통 로고 자리). 지금은 "가장 큰
  글자 크기 계층(높이 기준 클러스터링, 3번 항목의 위계 판정과 같은 방식)에
  속한 텍스트"로 재정의 — 로고 텍스트는 보통 메인카피보다 작아서 이 계층에
  안 걸린다.
- 카테고리당 평균 마커 2개짜리 요약만 보여주면 모든 카테고리가 "위에 선
  하나, 아래에 선 하나"로 똑같아 보여서 실제 레이아웃 다양성이 안 보였다.
  지금은 메인카피 텍스트 블록의 가로 중심 위치로 좌측형/중앙형/우측형을
  분류하고, 각 유형에서 실제 레퍼런스 이미지를 예시로 골라 보여준다.

OUTPUT (per category):
- layout-raw/<id>.json: 원본에 가까운 이미지별 OCR 정규화 좌표(재계산용 캐시,
  사이트에서 직접 쓰지 않음)
- layout-stats/<id>.json: 사이트가 실제로 읽는 집계 결과 — 숫자 통계 +
  alignmentGroups(좌측/중앙/우측형별 예시 이미지 URL과 장수)

이 통계는 "정답"이 아니라 팀이 그때그때 모은 경쟁사·자사 소재 모음에서 뽑은
경향입니다 — 사이트에 노출할 때 항상 이 점을 명시하세요.
"""

import argparse
import base64
import json
import os
import re
import statistics as st
import sys
import time
import uuid
from io import BytesIO

import requests
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blob_lib import upload_to_blob

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB_PATH = os.path.join(REPO_ROOT, "api", "_referenceLibrary.js")
ENV_LOCAL = os.path.join(REPO_ROOT, ".env.local")
MIN_IMAGE_BYTES = 15 * 1024
RAW_CACHE_DIR = os.path.join(REPO_ROOT, ".layout_raw_cache")
EXAMPLES_PER_GROUP = 4


def load_env_local():
    if not os.path.exists(ENV_LOCAL):
        return
    with open(ENV_LOCAL) as f:
        for line in f:
            m = re.match(r"^([A-Z_]+)=(.+)$", line.strip())
            if m and m.group(1) not in os.environ:
                os.environ[m.group(1)] = m.group(2).strip().strip('"').strip("'")


def parse_reference_library():
    text = open(LIB_PATH, encoding="utf-8").read()
    cat_re = re.compile(r"'([\w-]+)':\s*\{\s*name:\s*\"([^\"]+)\",\s*items:\s*\[(.*?)\]\s*\}", re.DOTALL)
    item_re = re.compile(
        r'\{\s*brandName:\s*"((?:[^"\\]|\\.)*)",\s*note:\s*"((?:[^"\\]|\\.)*)",'
        r'\s*mimeType:\s*"([^"]+)",\s*thumbUrl:\s*"([^"]+)",\s*fullUrl:\s*"([^"]+)"'
        r'(?:,\s*ownWork:\s*true)?\s*\}'
    )
    categories = {}
    for cid, name, body in cat_re.findall(text):
        items = []
        for brand, note, mime, thumb, full in item_re.findall(body):
            own_work = bool(re.search(re.escape(full) + r'"\s*,\s*ownWork:\s*true', text))
            items.append(
                {"brandName": brand, "note": note, "mimeType": mime, "thumbUrl": thumb, "fullUrl": full, "ownWork": own_work}
            )
        categories[cid] = {"name": name, "items": items}
    return categories


def run_clova_ocr(image_bytes, mime_type):
    invoke_url = os.environ.get("CLOVA_OCR_INVOKE_URL")
    secret_key = os.environ.get("CLOVA_OCR_SECRET_KEY")
    if not invoke_url or not secret_key:
        return None
    fmt = (mime_type.split("/")[-1] or "jpg").lower()
    if fmt not in ("jpg", "jpeg", "png"):
        fmt = "jpg"
    payload = {
        "version": "V2",
        "requestId": str(uuid.uuid4()),
        "timestamp": int(time.time() * 1000),
        "lang": "ko",
        "images": [{"format": fmt, "name": "ref", "data": base64.b64encode(image_bytes).decode("ascii")}],
    }
    try:
        resp = requests.post(invoke_url, json=payload, headers={"X-OCR-SECRET": secret_key}, timeout=25)
    except requests.RequestException:
        return None
    if resp.status_code != 200:
        return None
    try:
        data = resp.json()
    except ValueError:
        return None
    images = data.get("images") or [{}]
    fields = images[0].get("fields")
    return fields if isinstance(fields, list) else None


def normalize_fields(fields, width, height):
    out = []
    for f in fields or []:
        verts = ((f.get("boundingPoly") or {}).get("vertices")) or []
        if not verts or not width or not height:
            continue
        xs = [v.get("x", 0) for v in verts]
        ys = [v.get("y", 0) for v in verts]
        left, right = min(xs), max(xs)
        top, bottom = min(ys), max(ys)
        out.append(
            {
                "leftPct": left / width * 100,
                "rightPct": right / width * 100,
                "topPct": top / height * 100,
                "bottomPct": bottom / height * 100,
                "heightPct": (bottom - top) / height * 100,
            }
        )
    return out


# 3번 항목 위계 판정(api/_clovaOcr.js의 clusterHeightTiers)과 같은 방식 —
# 높이가 서로 15% 이내로 가까우면 같은 계층으로 묶는다. tiers[0]이 가장 큰 계층.
def cluster_height_tiers(fields):
    heights = sorted((f for f in fields if f["heightPct"] > 0), key=lambda f: -f["heightPct"])
    tiers = []
    for f in heights:
        h = f["heightPct"]
        if tiers and h >= tiers[-1]["min"] * 0.85:
            tiers[-1]["fields"].append(f)
            tiers[-1]["min"] = min(tiers[-1]["min"], h)
        else:
            tiers.append({"min": h, "fields": [f]})
    return tiers


def classify_alignment(center_x_pct):
    if center_x_pct < 40:
        return "left"
    if center_x_pct > 60:
        return "right"
    return "center"


def summarize(values):
    if not values:
        return None
    return {
        "avg": round(st.mean(values), 1),
        "median": round(st.median(values), 1),
        "min": round(min(values), 1),
        "max": round(max(values), 1),
        "n": len(values),
    }


def aggregate_category_stats(raw_items):
    main_tops, cta_bottoms, densities, small_heights = [], [], [], []
    alignment_groups = {"left": [], "center": [], "right": []}

    for item in raw_items:
        fields = item["fields"]
        if not fields:
            continue

        area = sum(max(0, f["rightPct"] - f["leftPct"]) * max(0, f["bottomPct"] - f["topPct"]) for f in fields) / 100
        densities.append(min(area, 100))
        cta_bottoms.append(max(f["bottomPct"] for f in fields))
        heights = [f["heightPct"] for f in fields if f["heightPct"] > 0]
        if heights:
            small_heights.append(min(heights))

        tiers = cluster_height_tiers(fields)
        if not tiers:
            continue
        main_fields = tiers[0]["fields"]  # 가장 큰 글자 계층 = 메인카피로 취급
        main_top = min(f["topPct"] for f in main_fields)
        main_center_x = st.mean((f["leftPct"] + f["rightPct"]) / 2 for f in main_fields)
        main_tops.append(main_top)

        alignment = classify_alignment(main_center_x)
        alignment_groups[alignment].append(
            {"brandName": item["brandName"], "thumbUrl": item["thumbUrl"], "fullUrl": item["fullUrl"]}
        )

    for key in alignment_groups:
        alignment_groups[key] = {
            "count": len(alignment_groups[key]),
            "examples": alignment_groups[key][:EXAMPLES_PER_GROUP],
        }

    return {
        "sampleCount": len(raw_items),
        "mainCopyTopPct": summarize(main_tops),
        "ctaBottomPct": summarize(cta_bottoms),
        "textDensityPct": summarize(densities),
        "smallestTextHeightPct": summarize(small_heights),
        "alignmentGroups": alignment_groups,
    }


def fetch_raw_for_category(cid, cat, dry_run=False):
    print(f"--- {cid} ({cat['name']}) : {len(cat['items'])}장 ---")
    raw_items = []
    for item in cat["items"]:
        label = item["brandName"] or item["fullUrl"]
        try:
            resp = requests.get(item["fullUrl"], timeout=20)
            resp.raise_for_status()
            img_bytes = resp.content
            if len(img_bytes) < MIN_IMAGE_BYTES:
                print(f"  스킵(너무 작음): {label}")
                continue
            width, height = Image.open(BytesIO(img_bytes)).size
            if dry_run:
                print(f"  OK(dry-run): {label} {width}x{height}")
                continue
            fields = run_clova_ocr(img_bytes, item["mimeType"])
            if fields is None:
                print(f"  OCR 실패/스킵: {label}")
                continue
            normalized = normalize_fields(fields, width, height)
            raw_items.append(
                {
                    "brandName": item["brandName"],
                    "thumbUrl": item["thumbUrl"],
                    "fullUrl": item["fullUrl"],
                    "width": width,
                    "height": height,
                    "fields": normalized,
                }
            )
            print(f"  OK: {label} (텍스트 박스 {len(normalized)}개)")
        except Exception as e:
            print(f"  에러: {label} - {e}")
            continue
    return raw_items


def cache_path(cid):
    return os.path.join(RAW_CACHE_DIR, f"{cid}.json")


def save_raw_cache(cid, cat_name, raw_items):
    os.makedirs(RAW_CACHE_DIR, exist_ok=True)
    payload = {"categoryId": cid, "categoryName": cat_name, "items": raw_items}
    with open(cache_path(cid), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)


def load_raw_cache(cid):
    p = cache_path(cid)
    if not os.path.exists(p):
        return None
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def process_category(cid, cat, dry_run=False, reaggregate_only=False):
    if reaggregate_only:
        cached = load_raw_cache(cid)
        if not cached:
            print(f"{cid}: 캐시된 원본 데이터 없음 — 먼저 --dry-run 없이 한 번 실행해야 합니다.")
            return
        raw_items = cached["items"]
    else:
        raw_items = fetch_raw_for_category(cid, cat, dry_run=dry_run)
        if dry_run:
            return
        save_raw_cache(cid, cat["name"], raw_items)
        raw_upload = json.dumps({"categoryId": cid, "categoryName": cat["name"], "items": raw_items}, ensure_ascii=False).encode("utf-8")
        url = upload_to_blob(f"layout-raw/{cid}.json", raw_upload, "application/json", allow_overwrite=True)
        print(f"원본 캐시 업로드 완료: {url}")

    stats = aggregate_category_stats(raw_items)
    stats["categoryId"] = cid
    stats["categoryName"] = cat["name"]
    out_json = json.dumps(stats, ensure_ascii=False, indent=2).encode("utf-8")
    url = upload_to_blob(f"layout-stats/{cid}.json", out_json, "application/json", allow_overwrite=True)
    print(f"통계 업로드 완료: {url}")
    print(
        f"  좌측형 {stats['alignmentGroups']['left']['count']} · "
        f"중앙형 {stats['alignmentGroups']['center']['count']} · "
        f"우측형 {stats['alignmentGroups']['right']['count']}\n"
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--category", help="특정 카테고리 id만 처리 (예: fashion)")
    parser.add_argument("--dry-run", action="store_true", help="OCR/업로드 없이 파싱+이미지 접근만 확인")
    parser.add_argument("--reaggregate-only", action="store_true", help="OCR 재호출 없이 캐시된 layout-raw로 통계만 재계산")
    args = parser.parse_args()

    load_env_local()
    if not args.dry_run and not args.reaggregate_only and (
        not os.environ.get("CLOVA_OCR_INVOKE_URL") or not os.environ.get("CLOVA_OCR_SECRET_KEY")
    ):
        print(
            "CLOVA_OCR_INVOKE_URL / CLOVA_OCR_SECRET_KEY가 .env.local에 없습니다.\n"
            "Vercel 대시보드(Project Settings -> Environment Variables)에서 값을 복사해 .env.local에 추가한 뒤 다시 실행해주세요."
        )
        sys.exit(1)

    categories = parse_reference_library()
    if args.category:
        if args.category not in categories:
            print(f"알 수 없는 카테고리: {args.category} (사용 가능: {', '.join(categories)})")
            sys.exit(1)
        targets = {args.category: categories[args.category]}
    else:
        targets = categories

    for cid, cat in targets.items():
        if not cat["items"]:
            print(f"{cid}: 이미지 없음, 건너뜀")
            continue
        process_category(cid, cat, dry_run=args.dry_run, reaggregate_only=args.reaggregate_only)


if __name__ == "__main__":
    main()
