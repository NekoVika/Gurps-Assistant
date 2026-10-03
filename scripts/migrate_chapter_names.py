"""Point episode childLinks at the names their chapters actually carry.

Episodes link to their chapters by bare number -- "Chapter 01" -- while the
chapter files hold real titles like "The Drainage Awakening". Bare numbers are
not unique across a campaign with several episodes, so two episodes claiming
"Chapter 01" leaves one of them mis-parented and its fixtures reaching the
wrong scenes.

Nothing is invented: every replacement is a title already written in the file
the link points at. A link whose folder holds no chapter file is left alone and
reported, because there is no name to use.

    python scripts/migrate_chapter_names.py
    python scripts/migrate_chapter_names.py --apply
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

_GENERIC = re.compile(r"^\s*chapter\s*\d+\s*$", re.IGNORECASE)


def chapter_title(folder: Path) -> str | None:
    """The title held by the chapter file in this folder, if there is one."""
    for path in sorted(folder.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        if isinstance(data, dict):
            title = data.get("title") or data.get("name")
            if title and not _GENERIC.match(str(title)):
                return str(title)
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("campaign", nargs="?", default="AnomalyHuntersCampaign")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    story = (ROOT / args.campaign / "03_Story").resolve()
    if not story.is_dir():
        print(f"No 03_Story directory under {args.campaign}")
        return 1

    changed: list[tuple[Path, dict]] = []
    empty: list[str] = []

    for overview in sorted(story.glob("Episode_*/*.json")):
        try:
            data = json.loads(overview.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        links = data.get("childLinks")
        if not isinstance(links, list) or not links:
            continue

        episode = data.get("title") or data.get("name") or overview.parent.name
        rewritten: list[str] = []
        touched = False
        for link in links:
            if not isinstance(link, str) or not _GENERIC.match(link):
                rewritten.append(link)
                continue
            folder = overview.parent / link.replace(" ", "_")
            title = chapter_title(folder) if folder.is_dir() else None
            if title:
                print(f"  {episode[:28]:30} {link!r:14} -> {title!r}")
                rewritten.append(title)
                touched = True
            else:
                empty.append(f"{episode}: {link!r} — folder holds no chapter file")
                rewritten.append(link)
        if touched:
            data["childLinks"] = rewritten
            changed.append((overview, data))

    if empty:
        print("\n  left alone — nothing to take a name from:")
        for line in empty:
            print(f"    {line}")

    print(f"\n{len(changed)} episode files would change.")
    if not args.apply:
        print("\nDry run. Re-run with --apply to write.")
        return 0

    for path, data in changed:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nWrote {len(changed)} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
