"""Builds text-position statistics per 이미지 레퍼런스 category by running
CLOVA OCR against every image in api/_referenceLibrary.js and aggregating
normalized (0-100%) bounding boxes. This is a one-time/periodic batch job —
NOT called live per checklist analysis, so it lives here as a local script
(same pattern as bulk_add_reference_images.py, migrate_existing_to_blob.py)
rather than a Vercel serverless function.

WHY A LOCAL SCRIPT INSTEAD OF A NEW API ENDPOINT:
- The project is already at Vercel Hobby's 12-serverless-function cap
  (see api/ directory — files not prefixed with `_` count).
- This job touches ~290 images across 13 categories; running it inside a
  single HTTP request risks the platform's execution time limit. A local
  script has no such ceiling and can be re-run per-category as the library
  grows, without needing new server infra.
- The reference images live at public Vercel Blob URLs (not behind the
  site's login gate), so this script talks to Blob Storage directly and
  never needs a logged-in session.

REQUIRES (add to .env.local — get the values from the Vercel dashboard,
Project Settings -> Environment Variables; NOT committed to git):
  CLOVA_OCR_INVOKE_URL=...
  CLOVA_OCR_SECRET_KEY=...
  BLOB_READ_WRITE_TOKEN=...   (already in .env.local for image uploads)

USAGE:
  python3 scripts/build_layout_stats.py                    # all 13 categories
  python3 scripts/build_layout_stats.py --category fashion  # just one
  python3 scripts/build_layout_stats.py --dry-run           # parse + fetch dimensions only, no OCR/upload (sanity check)

OUTPUT: uploads layout-stats/<categoryId>.json to Blob Storage (stable
pathname, overwritten each run) with per-category aggregated stats:
{
  "categoryId": "fashion", "categoryName": "패션", "sampleCount": 13,
  "mainCopyTopPct": {"avg":.., "median":.., "min":.., "max":.., "n":..},
  "ctaBottomPct": {...}, "textDensityPct": {...}, "smallestTextHeightPct": {...}
}
These are DESCRIPTIVE statistics over a curated-but-informal library (team
scraps of competitor ads + NHN's own work) — "common practice", not
"correct practice". Say so wherever this data is surfaced.
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


def aggregate_category_stats(per_image_fields):
    main_tops, cta_bottoms, densities, small_heights = [], [], [], []
    for fields in per_image_fields:
        if not fields:
            continue
        # rightPct-leftPct와 bottomPct-topPct는 각각 0-100 스케일 퍼센트라, 그냥
        # 곱하면 퍼센트x퍼센트라 100배 부풀려짐(20%*10%=실제 2%인데 200이 나옴).
        # /100으로 나눠야 "캔버스 면적 대비 실제 %"가 된다.
        area = sum(max(0, f["rightPct"] - f["leftPct"]) * max(0, f["bottomPct"] - f["topPct"]) for f in fields) / 100
        densities.append(min(area, 100))
        main_tops.append(min(f["topPct"] for f in fields))
        cta_bottoms.append(max(f["bottomPct"] for f in fields))
        heights = [f["heightPct"] for f in fields if f["heightPct"] > 0]
        if heights:
            small_heights.append(min(heights))

    return {
        "sampleCount": len(per_image_fields),
        "mainCopyTopPct": summarize(main_tops),
        "ctaBottomPct": summarize(cta_bottoms),
        "textDensityPct": summarize(densities),
        "smallestTextHeightPct": summarize(small_heights),
    }


def build_for_category(cid, cat, dry_run=False):
    print(f"--- {cid} ({cat['name']}) : {len(cat['items'])}장 ---")
    per_image_fields = []
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
            per_image_fields.append(normalized)
            print(f"  OK: {label} (텍스트 박스 {len(normalized)}개)")
        except Exception as e:
            print(f"  에러: {label} - {e}")
            continue
    if dry_run:
        return None
    return aggregate_category_stats(per_image_fields)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--category", help="특정 카테고리 id만 처리 (예: fashion)")
    parser.add_argument("--dry-run", action="store_true", help="OCR/업로드 없이 파싱+이미지 접근만 확인")
    args = parser.parse_args()

    load_env_local()
    if not args.dry_run and (not os.environ.get("CLOVA_OCR_INVOKE_URL") or not os.environ.get("CLOVA_OCR_SECRET_KEY")):
        print(
            "CLOVA_OCR_INVOKE_URL / CLOVA_OCR_SECRET_KEY가 .env.local에 없습니다.\n"
            "Vercel 대시보드(Project Settings -> Environment Variables)에서 값을 복사해 .env.local에 추가한 뒤 다시 실행해주세요.\n"
            "(파싱/이미지 접근만 먼저 확인하려면 --dry-run으로 실행하세요.)"
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
        stats = build_for_category(cid, cat, dry_run=args.dry_run)
        if stats is None:
            continue
        stats["categoryId"] = cid
        stats["categoryName"] = cat["name"]
        print(json.dumps(stats, ensure_ascii=False, indent=2))
        out_json = json.dumps(stats, ensure_ascii=False, indent=2).encode("utf-8")
        url = upload_to_blob(f"layout-stats/{cid}.json", out_json, "application/json", allow_overwrite=True)
        print(f"업로드 완료: {url}\n")


if __name__ == "__main__":
    main()
