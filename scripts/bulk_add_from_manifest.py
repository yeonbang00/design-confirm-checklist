"""Bulk-add reference images from a JSON manifest (used when source files
have no {카테고리}_{브랜드}_{번호}.jpg naming, e.g. a raw folder dump like
image1.jpg, image2.jpg, ... that needs per-image visual classification
first).

Manifest format (JSON array):
[
  { "path": "/abs/path/to/image1.jpg", "category": "fashion",
    "brand": "안다르", "note": "시즌오프 세일", "type": "benefit",
    "ownWork": true },
  ...
]

category must be one of the ids already in api/_referenceLibrary.js
(fashion, finance, shopping, beauty, telecom, food, travel, electronics,
automotive, education, healthcare, realestate, gaming). "type" is optional
(the 14 유형별 ids — problem, beforeafter, comparison, numbers, testimonial,
authority, benefit, usage, product, list, question, seasonal, character,
event); omit it if not classified. "ownWork" is optional and defaults to
true (NHN AD 자체 제작) for backward compatibility — set it to false per
entry for competitor material.

Usage: python3 scripts/bulk_add_from_manifest.py manifest.json
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blob_lib import resize_image, upload_to_blob
from js_array_insert import insert_into_array

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA_FILE = os.path.join(_REPO_ROOT, "api", "_referenceLibrary.js")


def valid_category_ids():
    text = open(_DATA_FILE, "r").read()
    import re
    return set(re.findall(r"'([a-z]+)':\s*\{\s*name:", text))


def slugify(name: str) -> str:
    keep = [c if c.isalnum() else "-" for c in name]
    slug = "".join(keep).strip("-").lower()
    return slug or "img"


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/bulk_add_from_manifest.py <manifest.json>", file=sys.stderr)
        sys.exit(1)

    manifest_path = sys.argv[1]
    with open(manifest_path, "r") as f:
        entries = json.load(f)

    # Resumability: every successfully-inserted path is appended to a sidecar
    # <manifest>.done file (one path per line, flushed immediately). If the
    # process dies partway (killed, crashed), re-running the same command
    # skips everything already recorded there instead of re-uploading/
    # duplicating entries.
    done_path = manifest_path + ".done"
    already_done = set()
    if os.path.exists(done_path):
        with open(done_path, "r") as f:
            already_done = set(line.rstrip("\n") for line in f if line.strip())
    done_file = open(done_path, "a")

    valid_ids = valid_category_ids()
    added, skipped = 0, 0

    for i, entry in enumerate(entries):
        path = entry["path"]
        category_id = entry["category"]
        brand = entry.get("brand", "") or ""
        note = entry.get("note", "") or ""
        type_id = entry.get("type", "") or ""
        own_work = entry.get("ownWork", True)

        if path in already_done:
            skipped += 1
            continue
        if category_id not in valid_ids:
            print(f"건너뜀 (알 수 없는 카테고리 '{category_id}'): {path}", flush=True)
            skipped += 1
            continue
        if not os.path.exists(path):
            print(f"건너뜀 (파일 없음): {path}", flush=True)
            skipped += 1
            continue

        print(f"[{i+1}/{len(entries)}] 처리 중: {os.path.basename(path)} -> {category_id} / {brand or '(브랜드 미상)'}", flush=True)

        thumb_bytes, full_bytes = resize_image(path)
        base = os.path.splitext(os.path.basename(path))[0]
        prefix = "nhnad-" if own_work else ""
        slug = slugify(f"{prefix}{brand}-{base}") if brand else slugify(f"{prefix}{base}")
        thumb_url = upload_to_blob(f"reference/{category_id}/{slug}-thumb.jpg", thumb_bytes)
        full_url = upload_to_blob(f"reference/{category_id}/{slug}-full.jpg", full_bytes)

        brand_escaped = brand.replace('"', '\\"')
        note_escaped = note.replace('"', '\\"')
        type_field = (", type: \"" + type_id + "\"") if type_id else ""
        own_work_field = ", ownWork: true" if own_work else ""
        new_item = (
            "{ brandName: \"" + brand_escaped + "\", note: \"" + note_escaped + "\", "
            "mimeType: \"image/jpeg\", thumbUrl: \"" + thumb_url + "\", fullUrl: \"" + full_url + "\""
            + type_field + own_work_field + " }"
        )

        text = open(_DATA_FILE, "r").read()
        text = insert_into_array(text, category_id, "items", new_item)
        open(_DATA_FILE, "w").write(text)

        done_file.write(path + "\n")
        done_file.flush()

        added += 1

    done_file.close()
    print(f"\n완료: {added}장 추가, {skipped}장 건너뜀(이미 처리됨 포함).", flush=True)


if __name__ == "__main__":
    main()
