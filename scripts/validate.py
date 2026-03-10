from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Any


@dataclass(frozen=True)
class Heading:
    level: int
    text: str
    line: int


@dataclass(frozen=True)
class Finding:
    severity: str  # "error" | "warning"
    code: str
    message: str
    file: str
    line: int | None
    contract_id: str | None
    details: dict[str, Any] | None = None


@dataclass(frozen=True)
class Contract:
    id: str
    description: str | None
    template_path: str | None
    include_globs: list[str]
    exclude_globs: list[str]
    required_meta_keys: list[str]
    forbidden_meta_keys: list[str]
    required_headings: list[dict[str, Any]]  # {"level": int, "text": str}
    forbidden_heading_prefixes: list[str]
    allow_extra_headings: bool

    @staticmethod
    def from_json(data: dict[str, Any], source_path: Path) -> "Contract":
        def require(field: str, expected_type: type) -> Any:
            if field not in data:
                raise ValueError(f"Missing field '{field}' in {source_path.as_posix()}")
            value = data[field]
            if not isinstance(value, expected_type):
                raise ValueError(
                    f"Field '{field}' must be {expected_type.__name__} in {source_path.as_posix()}"
                )
            return value

        def opt(field: str, expected_type: type) -> Any:
            value = data.get(field)
            if value is None:
                return None
            if not isinstance(value, expected_type):
                raise ValueError(
                    f"Field '{field}' must be {expected_type.__name__} or null in {source_path.as_posix()}"
                )
            return value

        contract_id = require("id", str)
        description = opt("description", str)
        template_path = data.get("template_path")
        if template_path is not None and not isinstance(template_path, str):
            raise ValueError(
                f"Field 'template_path' must be string or null in {source_path.as_posix()}"
            )

        include_globs = require("include_globs", list)
        exclude_globs = require("exclude_globs", list)
        required_meta_keys = require("required_meta_keys", list)
        forbidden_meta_keys = require("forbidden_meta_keys", list)
        required_headings = require("required_headings", list)
        forbidden_heading_prefixes = require("forbidden_heading_prefixes", list)
        allow_extra_headings = require("allow_extra_headings", bool)

        for list_name, list_value in [
            ("include_globs", include_globs),
            ("exclude_globs", exclude_globs),
            ("required_meta_keys", required_meta_keys),
            ("forbidden_meta_keys", forbidden_meta_keys),
            ("forbidden_heading_prefixes", forbidden_heading_prefixes),
        ]:
            if not all(isinstance(x, str) for x in list_value):
                raise ValueError(
                    f"All values in '{list_name}' must be strings in {source_path.as_posix()}"
                )

        for heading in required_headings:
            if not isinstance(heading, dict):
                raise ValueError(
                    f"Each entry in 'required_headings' must be an object in {source_path.as_posix()}"
                )
            if "level" not in heading or "text" not in heading:
                raise ValueError(
                    f"Each required heading must include 'level' and 'text' in {source_path.as_posix()}"
                )
            if not isinstance(heading["level"], int) or not isinstance(heading["text"], str):
                raise ValueError(
                    f"Required heading 'level' must be int and 'text' must be string in {source_path.as_posix()}"
                )

        return Contract(
            id=contract_id,
            description=description,
            template_path=template_path,
            include_globs=include_globs,
            exclude_globs=exclude_globs,
            required_meta_keys=required_meta_keys,
            forbidden_meta_keys=forbidden_meta_keys,
            required_headings=required_headings,
            forbidden_heading_prefixes=forbidden_heading_prefixes,
            allow_extra_headings=allow_extra_headings,
        )


META_LINE_RE = re.compile(r"^\s*(?:[*-]\s+)?\*\*([^*\n]+?):\*\*")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*$")
FENCE_RE = re.compile(r"^\s*(```+|~~~+)")


def _extract_headings_and_meta(text: str) -> tuple[list[Heading], dict[str, int]]:
    headings: list[Heading] = []
    meta_first_line: dict[str, int] = {}

    in_fence = False
    fence_token: str | None = None

    for idx, line in enumerate(text.splitlines(), start=1):
        fence_match = FENCE_RE.match(line)
        if fence_match:
            token = fence_match.group(1)[:3]
            if not in_fence:
                in_fence = True
                fence_token = token
            elif fence_token == token:
                in_fence = False
                fence_token = None
            continue

        if in_fence:
            continue

        meta_match = META_LINE_RE.match(line)
        if meta_match:
            key = meta_match.group(1).strip()
            meta_first_line.setdefault(key, idx)

        heading_match = HEADING_RE.match(line)
        if heading_match:
            level = len(heading_match.group(1))
            text_part = heading_match.group(2).strip()
            if text_part:
                headings.append(Heading(level=level, text=text_part, line=idx))

    return headings, meta_first_line


def _build_contract_index(root: Path, contracts: list[Contract]) -> dict[str, set[Path]]:
    """
    Expand include/exclude globs into an index of absolute paths per contract.

    Rationale: pathlib's PurePath.match behavior is subtle and can be surprising across platforms.
    Using Path.glob with '**' gives deterministic results for our repo-relative globs.
    """

    index: dict[str, set[Path]] = {}
    for contract in contracts:
        included: set[Path] = set()
        for pattern in contract.include_globs:
            for p in root.glob(pattern):
                if p.is_file():
                    included.add(p.resolve())

        excluded: set[Path] = set()
        for pattern in contract.exclude_globs:
            for p in root.glob(pattern):
                if p.is_file():
                    excluded.add(p.resolve())

        index[contract.id] = included - excluded

    return index


def validate_file(
    rel_file: str, text: str, contract: Contract
) -> list[Finding]:
    findings: list[Finding] = []
    headings, meta_first_line = _extract_headings_and_meta(text)

    heading_by_key: dict[tuple[int, str], Heading] = {(h.level, h.text): h for h in headings}
    first_heading_by_text: dict[str, Heading] = {}
    for h in headings:
        first_heading_by_text.setdefault(h.text, h)

    for key in contract.required_meta_keys:
        if key not in meta_first_line:
            findings.append(
                Finding(
                    severity="error",
                    code="META_MISSING",
                    message=f"Missing meta line: **{key}:**",
                    file=rel_file,
                    line=None,
                    contract_id=contract.id,
                    details={"key": key},
                )
            )

    for key in contract.forbidden_meta_keys:
        if key in meta_first_line:
            findings.append(
                Finding(
                    severity="error",
                    code="META_FORBIDDEN",
                    message=f"Forbidden meta line present: **{key}:**",
                    file=rel_file,
                    line=meta_first_line.get(key),
                    contract_id=contract.id,
                    details={"key": key},
                )
            )

    for required in contract.required_headings:
        required_level = int(required["level"])
        required_text = str(required["text"])
        key = (required_level, required_text)
        if key in heading_by_key:
            continue

        if required_text in first_heading_by_text:
            found = first_heading_by_text[required_text]
            findings.append(
                Finding(
                    severity="error",
                    code="HEADING_LEVEL_MISMATCH",
                    message=(
                        f"Heading level mismatch for '{required_text}': "
                        f"expected H{required_level} (##...), found H{found.level}."
                    ),
                    file=rel_file,
                    line=found.line,
                    contract_id=contract.id,
                    details={
                        "expected_level": required_level,
                        "found_level": found.level,
                        "text": required_text,
                    },
                )
            )
        else:
            findings.append(
                Finding(
                    severity="error",
                    code="HEADING_MISSING",
                    message=f"Missing section heading: {'#' * required_level} {required_text}",
                    file=rel_file,
                    line=None,
                    contract_id=contract.id,
                    details={"level": required_level, "text": required_text},
                )
            )

    for prefix in contract.forbidden_heading_prefixes:
        for h in headings:
            if h.text.startswith(prefix):
                findings.append(
                    Finding(
                        severity="error",
                        code="HEADING_FORBIDDEN_PREFIX",
                        message=f"Forbidden section heading present: ## {prefix}...",
                        file=rel_file,
                        line=h.line,
                        contract_id=contract.id,
                        details={"prefix": prefix, "found": h.text, "level": h.level},
                    )
                )
                break

    return findings


def _load_contracts(contracts_dir: Path) -> list[Contract]:
    if not contracts_dir.exists():
        raise FileNotFoundError(f"Contracts directory not found: {contracts_dir}")

    contracts: list[Contract] = []
    for path in sorted(contracts_dir.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError(f"Contract must be a JSON object: {path.as_posix()}")
        contracts.append(Contract.from_json(data, path))
    return contracts


def _discover_markdown_files(campaign_dir: Path) -> list[Path]:
    if not campaign_dir.exists():
        raise FileNotFoundError(f"Campaign directory not found: {campaign_dir}")

    results: list[Path] = []
    for path in campaign_dir.rglob("*.md"):
        if not path.is_file():
            continue
        rel = path.as_posix()
        # Never validate generated reports.
        if "/_reports/" in rel or rel.endswith("/_reports"):
            continue
        results.append(path)
    return sorted(results)


def _write_json_report(out_path: Path, payload: dict[str, Any]) -> None:
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _write_md_report(out_path: Path, payload: dict[str, Any]) -> None:
    summary = payload["summary"]
    lines: list[str] = []
    lines.append("# Campaign Validation Report")
    lines.append("")
    lines.append(f"- Generated: `{payload['generated_at']}`")
    lines.append(f"- Files scanned: `{summary['files_scanned']}`")
    lines.append(f"- Contracts loaded: `{summary['contracts_loaded']}`")
    lines.append(f"- Errors: `{summary['errors']}`")
    lines.append(f"- Warnings: `{summary['warnings']}`")
    lines.append("")

    findings: list[dict[str, Any]] = payload["findings"]
    if not findings:
        lines.append("No issues found.")
        lines.append("")
        out_path.write_text("\n".join(lines), encoding="utf-8")
        return

    def sort_key(f: dict[str, Any]) -> tuple:
        return (
            0 if f["severity"] == "error" else 1,
            f.get("file") or "",
            f.get("line") or 0,
            f.get("code") or "",
        )

    lines.append("## Findings")
    lines.append("")
    for f in sorted(findings, key=sort_key):
        loc = f"{f['file']}"
        if f.get("line"):
            loc += f":{f['line']}"
        contract = f.get("contract_id") or "n/a"
        lines.append(f"- **{f['severity'].upper()}** `{f['code']}` ({contract}) `{loc}`: {f['message']}")
    lines.append("")
    out_path.write_text("\n".join(lines), encoding="utf-8")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        prog="validate",
        description="Deterministic validator for Campaign/ markdown structure (no AI).",
    )
    parser.add_argument("--campaign", default="Campaign", help="Campaign directory (default: Campaign)")
    parser.add_argument(
        "--contracts",
        default=".planning/contracts",
        help="Directory containing contract JSON files (default: .planning/contracts)",
    )
    parser.add_argument(
        "--out",
        default="Campaign/_reports",
        help="Output directory for reports (default: Campaign/_reports)",
    )
    parser.add_argument(
        "--format",
        default="json,md",
        help="Comma-separated: json, md (default: json,md)",
    )
    parser.add_argument(
        "--strict-unknown",
        action="store_true",
        help="Treat files with no matching contract as errors (default: warn).",
    )
    parser.add_argument(
        "--fail-on-warnings",
        action="store_true",
        help="Return non-zero exit code when warnings exist (default: no).",
    )
    parser.add_argument(
        "--only-contract",
        action="append",
        default=[],
        help="Restrict validation to one or more contract ids (repeatable).",
    )

    args = parser.parse_args(argv)

    root = Path.cwd()
    campaign_dir = (root / args.campaign).resolve()
    contracts_dir = (root / args.contracts).resolve()
    out_dir = (root / args.out).resolve()

    contracts = _load_contracts(contracts_dir)
    if args.only_contract:
        allowed = set(args.only_contract)
        contracts = [c for c in contracts if c.id in allowed]
        missing = sorted(allowed - {c.id for c in contracts})
        if missing:
            raise SystemExit(f"Unknown contract id(s): {', '.join(missing)}")

    files = _discover_markdown_files(campaign_dir)
    contract_index = _build_contract_index(root, contracts)

    findings: list[Finding] = []
    for abs_path in files:
        rel_path = abs_path.relative_to(root).as_posix()
        abs_resolved = abs_path.resolve()

        matched = [c for c in contracts if abs_resolved in contract_index.get(c.id, set())]
        if not matched:
            findings.append(
                Finding(
                    severity="error" if args.strict_unknown else "warning",
                    code="UNKNOWN_CONTRACT",
                    message="No matching contract for file.",
                    file=rel_path,
                    line=None,
                    contract_id=None,
                )
            )
            continue
        if len(matched) > 1:
            findings.append(
                Finding(
                    severity="error",
                    code="AMBIGUOUS_CONTRACT",
                    message="Multiple contracts match this file.",
                    file=rel_path,
                    line=None,
                    contract_id=None,
                    details={"contracts": [c.id for c in matched]},
                )
            )
            continue

        contract = matched[0]
        try:
            text = abs_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = abs_path.read_text(encoding="utf-8-sig")

        findings.extend(validate_file(rel_path, text, contract))

    errors = sum(1 for f in findings if f.severity == "error")
    warnings = sum(1 for f in findings if f.severity == "warning")
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    payload: dict[str, Any] = {
        "generated_at": generated_at,
        "campaign": str(PurePosixPath(args.campaign.replace("\\", "/"))),
        "contracts_dir": str(PurePosixPath(args.contracts.replace("\\", "/"))),
        "summary": {
            "files_scanned": len(files),
            "contracts_loaded": len(contracts),
            "errors": errors,
            "warnings": warnings,
        },
        "findings": [asdict(f) for f in findings],
    }

    formats = {f.strip().lower() for f in str(args.format).split(",") if f.strip()}
    if formats:
        out_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        base = out_dir / f"validation-{stamp}"
        if "json" in formats:
            _write_json_report(base.with_suffix(".json"), payload)
        if "md" in formats:
            _write_md_report(base.with_suffix(".md"), payload)

    print(
        f"Validation complete. Files={len(files)} "
        f"Errors={errors} Warnings={warnings} "
        f"Contracts={len(contracts)}"
    )

    if errors > 0:
        return 2
    if warnings > 0 and args.fail_on_warnings:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
