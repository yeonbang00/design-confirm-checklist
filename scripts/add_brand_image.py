"""Add one reference banner image to a brand in _referenceBanners.js.

Resizes the source image (700px/q74 thumb, 2000px/q92 full — same spec as
the rest of the library), uploads both to Vercel Blob, and inserts a new
item into the advertiser's `images` array.

Usage:
  python3 scripts/add_brand_image.py --advertiser uplus --file ~/Desktop/banner.jpg
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blob_lib import resize_image, upload_to_blob
from js_array_insert import insert_into_array

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA_FILE = os.path.join(_REPO_ROOT, "api/_referenceBanners.js")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--advertiser", required=True, help="e.g. uplus, brand-b")
    parser.add_argument("--file", required=True, help="원본 이미지 파일 경로")
    args = parser.parse_args()

    src = os.path.expanduser(args.file)
    if not os.path.exists(src):
        print(f"파일을 찾을 수 없습니다: {src}", file=sys.stderr)
        sys.exit(1)

    print(f"Resizing {src} ...")
    thumb_bytes, full_bytes = resize_image(src)

    thumb_url = upload_to_blob(f"brands/{args.advertiser}/thumb.jpg", thumb_bytes)
    print(f"  thumb -> {thumb_url}")
    full_url = upload_to_blob(f"brands/{args.advertiser}/full.jpg", full_bytes)
    print(f"  full  -> {full_url}")

    new_item = (
        "{ mimeType: \"image/jpeg\", thumbUrl: \"" + thumb_url + "\", fullUrl: \"" + full_url + "\" }"
    )

    with open(_DATA_FILE, "r") as f:
        text = f.read()
    new_text = insert_into_array(text, args.advertiser, "images", new_item)
    with open(_DATA_FILE, "w") as f:
        f.write(new_text)

    print(f"Added to advertiser '{args.advertiser}' in {_DATA_FILE}")


if __name__ == "__main__":
    main()
