"""Collapse the significance vocabulary onto one enum.

Four places disagreed about what this field could contain -- the editor's
dropdown, the NPC template, the wizard prompt, and the values actually on disk
-- so the campaign accumulated seven spellings of four ideas, including
"2 Supporting" and "Supporting" side by side.

Types are cleared rather than mapped: a bestiary entry has no narrative weight
of its own, and `kind` now says what it is.

    python scripts/migrate_significance.py
    python scripts/migrate_significance.py --apply
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

CANONICAL = {"core", "supporting", "featured", "background"}

# Everything seen in the wild, plus the near-misses the four vocabularies invited.
SYNONYMS = {
    "core": "core", "keystone": "core", "major": "core", "main": "core", "boss": "core",
    "supporting": "supporting", "secondary": "supporting",
    "featured": "featured", "recurring": "featured",
    "background": "background", "extra": "background", "minor": "background",
    "common variant": "background", "variant": "background", "common": "background",
}

_LEADING_RANK = re.compile(r"^\s*\d+\s*[.:)-]?\s*")   # "1 Core", "2. Supporting"
_WRAPPING = re.compile(r"^[\('\"\s]+|[\)'\"\s]+$")


def normalize_significance(raw: str) -> str | None:
    """Map a legacy value onto the enum. None means unrecognised."""
    text = (raw or "").strip()
    if not text:
        return ""
    text = _LEADING_RANK.sub("", text)
    text = _WRAPPING.sub("", text).strip().lower()
    if not text:
        return ""
    if text in CANONICAL:
        return text
    if text in SYNONYMS:
        return SYNONYMS[text]
    # "0 (Common Variant)" -> the parenthetical is the real answer
    inner = re.search(r"\(([^)]*)\)", raw or "")
    if inner:
        candidate = inner.group(1).strip().lower()
        if candidate in CANONICAL:
            return candidate
        if candidate in SYNONYMS:
            return SYNONYMS[candidate]
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("campaign", nargs="?", default="AnomalyHuntersCampaign")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    campaign = (ROOT / args.campaign).resolve()
    if not campaign.is_dir():
        print(f"No such campaign directory: {campaign}")
        return 1

    planned: list[tuple[Path, dict, str, str, str]] = []
    unknown: Counter[str] = Counter()

    for path in sorted(campaign.rglob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        if not isinstance(data, dict) or "attributes" not in data or "pointTotal" not in data:
            continue

        before = data.get("significance", "")
        if data.get("kind") == "type":
            after, why = "", "cleared (kind: type)"
        else:
            mapped = normalize_significance(before)
            if mapped is None:
                unknown[before] += 1
                continue
            after, why = mapped, "mapped"
        if after != before:
            planned.append((path, data, before, after, why))

    print(f"{len(planned)} characters to change\n")
    tally = Counter((b, a) for _, _, b, a, _ in planned)
    for (before, after), count in tally.most_common():
        print(f"  {count:3}x  {before!r:24} -> {after!r}")

    if unknown:
        print("\n  UNRECOGNISED -- left untouched, add a synonym and re-run:")
        for value, count in unknown.most_common():
            print(f"    {count}x {value!r}")

    if not args.apply:
        print("\nDry run. Re-run with --apply to write.")
        return 0

    for path, data, _, after, _ in planned:
        data["significance"] = after
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nWrote {len(planned)} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
