"""Shared helper: insert a new object literal into a JS array literal
inside one of the _*.js data files, without a full JS parser.

Used by add_reference_image.py / add_brand_image.py to append entries to
`items: [...]` (_referenceLibrary.js) / `images: [...]` (_referenceBanners.js)
for a specific category/brand key, identified by its quoted id.
"""

import re


def _find_matching_bracket(text: str, open_idx: int) -> int:
    """Given the index of a '[', return the index of its matching ']'."""
    depth = 0
    i = open_idx
    while i < len(text):
        if text[i] == '[':
            depth += 1
        elif text[i] == ']':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError("No matching ']' found")


def insert_into_array(text: str, key_id: str, array_field: str, new_item_literal: str) -> str:
    """Insert new_item_literal as the last element of `<array_field>: [...]`
    that belongs to the `'<key_id>': { ... }` block.

    new_item_literal should be a bare object literal, e.g. "{ ... }" with
    no trailing comma.
    """
    key_pattern = re.compile(r"['\"]" + re.escape(key_id) + r"['\"]\s*:\s*\{")
    key_match = key_pattern.search(text)
    if not key_match:
        raise ValueError(f"Could not find key '{key_id}' in data file")

    array_pattern = re.compile(re.escape(array_field) + r"\s*:\s*\[")
    array_match = array_pattern.search(text, key_match.end())
    if not array_match:
        raise ValueError(f"Could not find '{array_field}: [' after key '{key_id}'")

    open_idx = array_match.end() - 1  # index of the '['
    close_idx = _find_matching_bracket(text, open_idx)

    inner = text[open_idx + 1:close_idx]
    if inner.strip():
        insertion = "\n      " + new_item_literal + ","
        new_inner = inner.rstrip() + insertion + "\n    "
    else:
        new_inner = "\n      " + new_item_literal + ",\n    "

    return text[:open_idx + 1] + new_inner + text[close_idx:]
