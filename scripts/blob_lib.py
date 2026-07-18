"""Shared helpers for uploading images to Vercel Blob Storage.

No @vercel/blob SDK / no Node.js needed — the PUT contract below was
verified against the open-source `vercel_blob` Python wrapper, which
mirrors what the official SDK sends. Uses `curl` for the actual HTTP
request (not Python's urllib): this machine's python.org install doesn't
have a working local CA bundle for TLS, while curl uses the system trust
store and just works.

Requires BLOB_READ_WRITE_TOKEN in a local `.env.local` file (repo root,
gitignored). Get it from the Vercel dashboard: project -> Storage tab ->
your Blob store -> ".env.local" tab.
"""

import json
import os
import re
import subprocess
import tempfile
import urllib.parse

_BLOB_API_BASE = "https://blob.vercel-storage.com"
_API_VERSION = "10"

THUMB_MAX_PX = 700
THUMB_QUALITY = 74
FULL_MAX_PX = 2000
FULL_QUALITY = 92

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ENV_LOCAL = os.path.join(_REPO_ROOT, ".env.local")


def _load_token() -> str:
    token = os.environ.get("BLOB_READ_WRITE_TOKEN")
    if token:
        return token
    if os.path.exists(_ENV_LOCAL):
        with open(_ENV_LOCAL, "r") as f:
            for line in f:
                m = re.match(r"^BLOB_READ_WRITE_TOKEN=(.+)$", line.strip())
                if m:
                    return m.group(1).strip().strip('"').strip("'")
    raise RuntimeError(
        "BLOB_READ_WRITE_TOKEN not found. Create .env.local in the repo root "
        "with a line like BLOB_READ_WRITE_TOKEN=... (see Vercel dashboard -> "
        "Storage -> your Blob store -> .env.local tab)."
    )


def resize_image(src_path: str) -> tuple[bytes, bytes]:
    """Resize src_path into (thumb_bytes, full_bytes) JPEGs via macOS `sips`."""
    with tempfile.TemporaryDirectory() as tmp:
        thumb_path = os.path.join(tmp, "thumb.jpg")
        full_path = os.path.join(tmp, "full.jpg")

        subprocess.run(
            ["sips", "-Z", str(THUMB_MAX_PX), "-s", "format", "jpeg",
             "-s", "formatOptions", str(THUMB_QUALITY), src_path, "--out", thumb_path],
            check=True, capture_output=True,
        )
        subprocess.run(
            ["sips", "-Z", str(FULL_MAX_PX), "-s", "format", "jpeg",
             "-s", "formatOptions", str(FULL_QUALITY), src_path, "--out", full_path],
            check=True, capture_output=True,
        )

        with open(thumb_path, "rb") as f:
            thumb_bytes = f.read()
        with open(full_path, "rb") as f:
            full_bytes = f.read()

    return thumb_bytes, full_bytes


def upload_to_blob(pathname: str, data: bytes, mime_type: str = "image/jpeg") -> str:
    """Upload raw bytes to Vercel Blob at pathname, return the public URL."""
    token = _load_token()
    url = f"{_BLOB_API_BASE}/?pathname={urllib.parse.quote(pathname)}"

    result = subprocess.run(
        [
            "curl", "-sS", "-X", "PUT", url,
            "-H", "access: public",
            "-H", f"authorization: Bearer {token}",
            "-H", f"x-api-version: {_API_VERSION}",
            "-H", f"x-content-type: {mime_type}",
            "-H", "x-add-random-suffix: 1",
            "--data-binary", "@-",
            "-w", "\n%{http_code}",
        ],
        input=data,
        capture_output=True,
        timeout=30,
    )

    if result.returncode != 0:
        raise RuntimeError(f"curl failed (exit {result.returncode}): {result.stderr.decode('utf-8', 'replace')}")

    output = result.stdout.decode("utf-8", "replace")
    body_text, _, status_code = output.rpartition("\n")
    if status_code.strip() != "200":
        raise RuntimeError(f"Blob upload failed ({status_code.strip()}): {body_text}")

    body = json.loads(body_text)
    return body["url"]
