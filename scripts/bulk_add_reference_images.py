"""Bulk-add competitor reference images from a folder.

Drop image files named {카테고리}_{브랜드}_{번호}.jpg (e.g. 금융_DB_01.jpg)
into a folder and run this once — each file is resized, uploaded to Blob,
and inserted into api/_referenceLibrary.js under the matching category.
카테고리 must match one of the Korean category names already in
_referenceLibrary.js (금융, 패션, 화장품/뷰티, 통신, 식품/외식, 쇼핑/커머스,
여행, 가전/IT, 자동차, 교육, 헬스케어/제약, 부동산, 게임/엔터).

Usage: python3 scripts/bulk_add_reference_images.py ~/Desktop/새배너모음/
"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blob_lib import resize_image, upload_to_blob
from js_array_insert import insert_into_array

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA_FILE = os.path.join(_REPO_ROOT, "api", "_referenceLibrary.js")
_IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp")


def load_category_name_to_id():
    """Map Korean category names to their ids. Names with a slash (e.g.
    '쇼핑/커머스', '가전/IT') also register each half separately, since a
    '/' can't appear in a filename — so '쇼핑_..." or "커머스_...' both work.
    """
    text = open(_DATA_FILE, "r").read()
    pairs = re.findall(r"'([a-z-]+)':\s*\{\s*name:\s*\"([^\"]+)\"", text)
    mapping = {}
    for id_, name in pairs:
        mapping[name] = id_
        if "/" in name:
            for part in name.split("/"):
                mapping.setdefault(part, id_)
    return mapping


def slugify(name: str) -> str:
    keep = [c if c.isalnum() else "-" for c in name]
    slug = "".join(keep).strip("-").lower()
    return slug or "img"


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/bulk_add_reference_images.py <folder>", file=sys.stderr)
        sys.exit(1)

    folder = os.path.expanduser(sys.argv[1])
    if not os.path.isdir(folder):
        print(f"폴더를 찾을 수 없습니다: {folder}", file=sys.stderr)
        sys.exit(1)

    name_to_id = load_category_name_to_id()
    files = sorted(f for f in os.listdir(folder) if f.lower().endswith(_IMAGE_EXTS))

    if not files:
        print("폴더에 이미지 파일이 없습니다.")
        return

    added, skipped = 0, 0
    for fname in files:
        stem = os.path.splitext(fname)[0]
        parts = stem.split("_")
        if len(parts) < 2:
            print(f"건너뜀 (파일명 규칙 안 맞음, {{카테고리}}_{{브랜드}}_{{번호}} 형식 필요): {fname}")
            skipped += 1
            continue

        category_name, brand = parts[0], parts[1]
        category_id = name_to_id.get(category_name)
        if not category_id:
            print(f"건너뜀 (알 수 없는 카테고리 '{category_name}'): {fname}")
            skipped += 1
            continue

        path = os.path.join(folder, fname)
        print(f"처리 중: {fname} (카테고리: {category_name} -> {category_id}, 브랜드: {brand})")

        thumb_bytes, full_bytes = resize_image(path)
        slug = slugify(stem)
        thumb_url = upload_to_blob(f"reference/{category_id}/{slug}-thumb.jpg", thumb_bytes)
        full_url = upload_to_blob(f"reference/{category_id}/{slug}-full.jpg", full_bytes)

        brand_escaped = brand.replace('"', '\\"')
        new_item = (
            "{ brandName: \"" + brand_escaped + "\", note: \"\", "
            "mimeType: \"image/jpeg\", thumbUrl: \"" + thumb_url + "\", fullUrl: \"" + full_url + "\" }"
        )

        text = open(_DATA_FILE, "r").read()
        text = insert_into_array(text, category_id, "items", new_item)
        open(_DATA_FILE, "w").write(text)

        print(f"  -> 추가 완료 ({thumb_url})")
        added += 1

    print(f"\n완료: {added}장 추가, {skipped}장 건너뜀.")
    print("주의: note는 빈 값으로 들어갔습니다 — 필요하면 _referenceLibrary.js에서 직접 채워주세요.")


if __name__ == "__main__":
    main()
