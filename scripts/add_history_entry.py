"""Add one entry to the "히스토리" log shown on history.html.

Claude runs this after shipping a substantive change (checklist logic,
brand/media guide additions or removals, new features) — NOT for cosmetic
polish (spacing, alignment, colors). There's no "add" UI on the site on
purpose; history.html only lets the team delete entries.

Usage:
  python3 scripts/add_history_entry.py \\
      --category "체크리스트" \\
      --description "13번 판정에 OTT 로고 컬러 정확성 체크 추가"
"""

import argparse
import json
import subprocess
import sys
import uuid
from datetime import datetime, timezone, timedelta

sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from blob_lib import upload_to_blob

HISTORY_URL = "https://oeiquwo26iglgctf.public.blob.vercel-storage.com/history.json"
KST = timezone(timedelta(hours=9))


def fetch_current_entries():
    result = subprocess.run(
        ["curl", "-sS", HISTORY_URL],
        capture_output=True, timeout=15,
    )
    if result.returncode != 0 or not result.stdout:
        return []
    try:
        data = json.loads(result.stdout)
        return data.get("entries", []) if isinstance(data, dict) else []
    except json.JSONDecodeError:
        return []


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--category", required=True, help="예: 체크리스트, 브랜드 가이드, 매체 가이드, 이미지 레퍼런스, 기획안 헬퍼")
    parser.add_argument("--description", required=True, help="한 줄 설명 (사용자에게 보이는 문구)")
    args = parser.parse_args()

    entries = fetch_current_entries()
    entry = {
        "id": uuid.uuid4().hex[:12],
        "date": datetime.now(KST).isoformat(timespec="seconds"),
        "category": args.category,
        "description": args.description,
    }
    entries.append(entry)

    bytes_data = json.dumps({"entries": entries}, ensure_ascii=False).encode("utf-8")
    url = upload_to_blob("history.json", bytes_data, "application/json", allow_overwrite=True)
    print(f"추가됨: [{entry['category']}] {entry['description']} ({entry['date']})")
    print(f"저장 위치: {url}")


if __name__ == "__main__":
    main()
