"""Add one competitor reference image to a category in _referenceLibrary.js.

Resizes the source image (700px/q74 thumb, 2000px/q92 full — same spec as
the rest of the library), uploads both to Vercel Blob, and inserts a new
item into the category's `items` array.

Usage:
  python3 scripts/add_reference_image.py \\
      --category finance --brand "신한카드" --note "여름 프로모션 배너" \\
      --file ~/Desktop/금융_신한_01.jpg
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blob_lib import resize_image, upload_to_blob
from js_array_insert import insert_into_array

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA_FILE = os.path.join(_REPO_ROOT, "api/_referenceLibrary.js")


def slugify(name: str) -> str:
    keep = [c if c.isalnum() else "-" for c in name]
    slug = "".join(keep).strip("-").lower()
    return slug or "img"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--category", required=True, help="e.g. finance, fashion, healthcare")
    parser.add_argument("--brand", required=True, help="브랜드명, e.g. 신한카드")
    parser.add_argument("--note", default="", help="한 줄 메모")
    parser.add_argument("--file", required=True, help="원본 이미지 파일 경로")
    parser.add_argument("--own-work", action="store_true", help="NHN이 직접 제작한 소재면 지정 (카드에 NHN 배지 표시)")
    args = parser.parse_args()

    src = os.path.expanduser(args.file)
    if not os.path.exists(src):
        print(f"파일을 찾을 수 없습니다: {src}", file=sys.stderr)
        sys.exit(1)

    print(f"Resizing {src} ...")
    thumb_bytes, full_bytes = resize_image(src)

    slug = slugify(args.brand)
    thumb_url = upload_to_blob(f"reference/{args.category}/{slug}-thumb.jpg", thumb_bytes)
    print(f"  thumb -> {thumb_url}")
    full_url = upload_to_blob(f"reference/{args.category}/{slug}-full.jpg", full_bytes)
    print(f"  full  -> {full_url}")

    note_escaped = args.note.replace('"', '\\"')
    brand_escaped = args.brand.replace('"', '\\"')
    new_item = (
        "{ brandName: \"" + brand_escaped + "\", note: \"" + note_escaped + "\", "
        "mimeType: \"image/jpeg\", thumbUrl: \"" + thumb_url + "\", fullUrl: \"" + full_url + "\""
        + (", ownWork: true" if args.own_work else "") + " }"
    )

    with open(_DATA_FILE, "r") as f:
        text = f.read()
    new_text = insert_into_array(text, args.category, "items", new_item)
    with open(_DATA_FILE, "w") as f:
        f.write(new_text)

    print(f"Added to category '{args.category}' in {_DATA_FILE}")


if __name__ == "__main__":
    main()
