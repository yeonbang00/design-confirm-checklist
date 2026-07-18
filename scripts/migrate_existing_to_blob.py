"""One-time migration: move existing base64 image data in
api/_referenceBanners.js and api/_referenceLibrary.js to Vercel Blob
Storage, rewriting `data`/`fullData` fields to `thumbUrl`/`fullUrl`.

Existing base64 is already correctly sized/compressed (700px q74 thumb,
2000px q92 full) from when it was added, so this just re-uploads the
bytes as-is — no resizing here.

Usage: python3 scripts/migrate_existing_to_blob.py
"""

import base64
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blob_lib import upload_to_blob

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FILES = [
    (os.path.join(_REPO_ROOT, "api/_referenceBanners.js"), "brands"),
    (os.path.join(_REPO_ROOT, "api/_referenceLibrary.js"), "reference"),
]

# Matches `data: "BASE64"` or `fullData: "BASE64"` (double-quoted, base64
# alphabet only — never matches mimeType/brandName/note/guideline fields).
FIELD_RE = re.compile(r'(?P<key>\bdata|\bfullData):\s*"(?P<b64>[A-Za-z0-9+/=]+)"')


def migrate_file(path: str, path_prefix: str) -> int:
    with open(path, "r") as f:
        text = f.read()

    counter = {"n": 0}

    def replace(m: re.Match) -> str:
        key = m.group("key")
        b64 = m.group("b64")
        counter["n"] += 1
        kind = "thumb" if key == "data" else "full"
        pathname = f"{path_prefix}/migrated-{counter['n']:03d}-{kind}.jpg"
        data = base64.b64decode(b64)
        url = upload_to_blob(pathname, data, "image/jpeg")
        print(f"  uploaded {pathname} ({len(data)} bytes) -> {url}")
        new_key = "thumbUrl" if key == "data" else "fullUrl"
        return f'{new_key}: "{url}"'

    new_text = FIELD_RE.sub(replace, text)

    with open(path, "w") as f:
        f.write(new_text)

    return counter["n"]


def main():
    total = 0
    for path, prefix in FILES:
        print(f"Migrating {path} ...")
        n = migrate_file(path, prefix)
        print(f"  {n} field(s) migrated in {path}")
        total += n
    print(f"Done. {total} field(s) migrated total.")


if __name__ == "__main__":
    sys.exit(main())
