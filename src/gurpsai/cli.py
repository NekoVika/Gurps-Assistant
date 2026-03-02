#!/usr/bin/env python3
"""Python command layer for GURPSAI.

Core app/update/sync/install logic runs in Python.
"""

from __future__ import annotations

import base64
import datetime as dt
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
from typing import Any, Dict, List, Optional, Sequence, Tuple

DEFAULT_CORE_REPO = "https://github.com/NekoVika/Gurps-Assistant.git"
DEFAULT_CORE_REF = "main"


def utc_now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def ensure_dir(path: pathlib.Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def read_json(path: pathlib.Path, default: Any) -> Any:
    if not path.is_file():
        return default
    # Accept UTF-8 with or without BOM (PowerShell often writes BOM by default).
    with path.open("r", encoding="utf-8-sig") as f:
        return json.load(f)


def write_json(path: pathlib.Path, data: Any) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=True)
        f.write("\n")


def sha256_or_none(path: pathlib.Path) -> Optional[str]:
    if not path.is_file():
        return None
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest().lower()


def run_command(args: Sequence[str], cwd: Optional[pathlib.Path] = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        list(args),
        cwd=str(cwd) if cwd else None,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


def run_git(args: Sequence[str], cwd: Optional[pathlib.Path] = None) -> str:
    p = run_command(["git", *args], cwd=cwd)
    if p.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed:\n{p.stderr}")
    return p.stdout


def can_write(path: pathlib.Path) -> bool:
    try:
        ensure_dir(path)
        probe = path / f".write-test-{os.getpid()}"
        probe.write_text("ok", encoding="ascii")
        probe.unlink()
        return True
    except OSError:
        return False


def resolve_global_home(repo_root: pathlib.Path) -> pathlib.Path:
    candidates: List[pathlib.Path] = []
    if os.environ.get("GURPSAI_HOME"):
        candidates.append(pathlib.Path(os.environ["GURPSAI_HOME"]).expanduser())
    if os.environ.get("USERPROFILE"):
        candidates.append(pathlib.Path(os.environ["USERPROFILE"]) / ".gurps-assistant")
    candidates.append(repo_root / ".app-global")
    for candidate in candidates:
        if can_write(candidate):
            return candidate
    raise RuntimeError("Could not find writable global home. Set GURPSAI_HOME.")


def parse_options(
    args: Sequence[str],
    value_options: Sequence[str],
    switch_options: Sequence[str],
) -> Tuple[List[str], Dict[str, Any]]:
    vmap = {k.lower(): k for k in value_options}
    smap = {k.lower(): k for k in switch_options}
    out: Dict[str, Any] = {k: False for k in switch_options}
    positionals: List[str] = []
    i = 0
    while i < len(args):
        tok = args[i]
        if not tok.startswith("-") or tok == "-":
            positionals.append(tok)
            i += 1
            continue
        key = tok.lstrip("-").lower()
        if key in smap:
            out[smap[key]] = True
            i += 1
            continue
        if key in vmap:
            if i + 1 >= len(args):
                raise RuntimeError(f"Missing value for option {tok}")
            out[vmap[key]] = args[i + 1]
            i += 2
            continue
        positionals.append(tok)
        i += 1
    return positionals, out


def workflow_names(root: pathlib.Path) -> List[str]:
    wfdir = root / ".agents" / "workflows"
    if not wfdir.is_dir():
        return []
    names = []
    for p in sorted(wfdir.glob("*.md")):
        if p.name == "INDEX.md":
            continue
        names.append(p.stem)
    return names


def load_app_state(path: pathlib.Path, core_root: pathlib.Path) -> Dict[str, Any]:
    default = {
        "schema_version": 1,
        "core_repo_url": DEFAULT_CORE_REPO,
        "core_path": str(core_root),
        "active_campaign": None,
        "campaigns": {},
        "created_at_utc": utc_now_iso(),
        "updated_at_utc": utc_now_iso(),
    }
    loaded = read_json(path, None)
    if loaded is None:
        write_json(path, default)
        return default
    campaigns = loaded.get("campaigns", {})
    if not isinstance(campaigns, dict):
        campaigns = {}
    return {
        "schema_version": int(loaded.get("schema_version") or 1),
        "core_repo_url": str(loaded.get("core_repo_url") or DEFAULT_CORE_REPO),
        "core_path": str(loaded.get("core_path") or core_root),
        "active_campaign": loaded.get("active_campaign"),
        "campaigns": {str(k): str(v) for k, v in campaigns.items()},
        "created_at_utc": str(loaded.get("created_at_utc") or utc_now_iso()),
        "updated_at_utc": utc_now_iso(),
    }


def save_app_state(path: pathlib.Path, state: Dict[str, Any]) -> None:
    state["updated_at_utc"] = utc_now_iso()
    write_json(path, state)


def relpath_from(base: pathlib.Path, target: pathlib.Path) -> str:
    return str(target.resolve().relative_to(base.resolve()))


def is_ignored_managed_path(rel: str) -> bool:
    normalized = rel.replace("\\", "/")
    parts = pathlib.PurePosixPath(normalized).parts
    if not parts:
        return True

    if any(p in {"__pycache__", ".pytest_cache", ".mypy_cache"} for p in parts):
        return True
    if any(p.endswith(".egg-info") for p in parts):
        return True

    leaf = parts[-1].lower()
    if leaf.endswith((".pyc", ".pyo", ".pyd")):
        return True

    if parts[0] in {"build", "dist"}:
        return True
    return False


def framework_sync(repo_root: pathlib.Path, core_path: pathlib.Path, dry_run: bool, force: bool) -> int:
    manifest_path = core_path.resolve() / ".framework" / "framework.manifest.json"
    if not manifest_path.is_file():
        raise RuntimeError(f"Manifest not found at '{manifest_path}'.")
    manifest = read_json(manifest_path, {})

    state_dir = repo_root / ".framework"
    state_path = state_dir / "install-state.json"
    state = read_json(
        state_path,
        {
            "framework_name": manifest.get("framework_name"),
            "framework_version": None,
            "source_core_path": None,
            "installed_at_utc": None,
            "files": {},
        },
    )
    files_state = state.get("files")
    if not isinstance(files_state, dict):
        files_state = {}
        state["files"] = files_state

    managed: List[str] = []
    for root_name in manifest.get("managed_roots", []):
        root_path = core_path / str(root_name)
        if not root_path.exists():
            continue
        for fp in root_path.rglob("*"):
            if fp.is_file():
                rel = relpath_from(core_path, fp)
                if not is_ignored_managed_path(rel):
                    managed.append(rel)
    for file_name in manifest.get("managed_files", []):
        p = core_path / str(file_name)
        if p.is_file():
            rel = str(file_name)
            if not is_ignored_managed_path(rel):
                managed.append(rel)
    managed = sorted(set(managed))

    created = updated = unchanged = skipped = conflicts = 0
    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M%S")
    if dry_run:
        print("Dry run mode is ON. No files will be changed.")

    for rel in managed:
        src = core_path / rel
        dst = repo_root / rel
        src_hash = sha256_or_none(src)
        if src_hash is None:
            continue
        dst_hash = sha256_or_none(dst)
        entry = files_state.get(rel, {})
        if not isinstance(entry, dict):
            entry = {}
        last_applied = entry.get("last_applied_hash")
        last_core = entry.get("last_core_hash")

        if not dst.is_file():
            action = "create"
        elif dst_hash == src_hash:
            action = "unchanged"
        elif not entry:
            action = "force-update" if force else "conflict-no-state"
        elif dst_hash == last_applied:
            action = "update"
        elif src_hash == last_core:
            action = "keep-local"
        else:
            action = "force-update" if force else "conflict-local-and-core-changed"

        if action == "create":
            print(f"[CREATE ] {rel}")
            if not dry_run:
                ensure_dir(dst.parent)
                shutil.copy2(src, dst)
            created += 1
        elif action == "update":
            print(f"[UPDATE ] {rel}")
            if not dry_run:
                ensure_dir(dst.parent)
                shutil.copy2(src, dst)
            updated += 1
        elif action == "force-update":
            print(f"[FORCE  ] {rel}")
            if not dry_run:
                if dst.is_file():
                    backup = repo_root / ".framework" / "backups" / timestamp / rel
                    ensure_dir(backup.parent)
                    shutil.copy2(dst, backup)
                ensure_dir(dst.parent)
                shutil.copy2(src, dst)
            updated += 1
        elif action == "unchanged":
            print(f"[OK     ] {rel}")
            unchanged += 1
        elif action == "keep-local":
            print(f"[LOCAL  ] {rel} (core unchanged, local edits kept)")
            unchanged += 1
        elif action == "conflict-no-state":
            print(f"[SKIP   ] {rel} (exists but no prior state; use -Force to overwrite)")
            skipped += 1
            conflicts += 1
        elif action == "conflict-local-and-core-changed":
            print(f"[SKIP   ] {rel} (local + core changed; use -Force to overwrite)")
            skipped += 1
            conflicts += 1

        if action in {"create", "update", "force-update", "unchanged", "keep-local"} and not dry_run:
            files_state[rel] = {
                "last_applied_hash": sha256_or_none(dst),
                "last_core_hash": src_hash,
                "updated_at_utc": utc_now_iso(),
            }

    if not dry_run:
        ensure_dir(state_dir)
        state["framework_name"] = manifest.get("framework_name")
        state["framework_version"] = manifest.get("framework_version")
        state["source_core_path"] = str(core_path.resolve())
        state["installed_at_utc"] = utc_now_iso()
        write_json(state_path, state)

    print("")
    print("Framework sync summary:")
    print(f"  Core:      {manifest.get('framework_name')} v{manifest.get('framework_version')}")
    print(f"  Target:    {repo_root}")
    print(f"  Created:   {created}")
    print(f"  Updated:   {updated}")
    print(f"  Unchanged: {unchanged}")
    print(f"  Skipped:   {skipped}")
    print(f"  Conflicts: {conflicts}")
    if conflicts > 0 and not force:
        print("")
        print("Conflicts detected. Re-run with -Force to overwrite conflicted files.")
        return 2
    return 0


def actualize_campaign(root: pathlib.Path) -> int:
    issues: List[Tuple[str, str, str]] = []

    def issue(sev: str, code: str, msg: str) -> None:
        issues.append((sev, code, msg))

    # Campaign-level requirements (authoritative campaign data only)
    campaign_required_files = [
        "state.md",
        "00_System_Rules.md",
    ]
    campaign_required_dirs = [
        "01_World_Bible",
        "02_Characters",
        "03_Story",
    ]

    for rel in campaign_required_files:
        if not (root / rel).is_file():
            issue("ERROR", "MISSING_FILE", f"Missing required file: {rel}")
    for rel in campaign_required_dirs:
        if not (root / rel).is_dir():
            issue("ERROR", "MISSING_DIR", f"Missing required directory: {rel}")

    # Core-level requirements (single source of truth for personas/workflows/templates)
    core = resolve_repo_root()
    core_required_files = [
        "AGENTS.md",
        "SYSTEM.md",
        ".agents/workflows/INDEX.md",
        ".planning/MAP.md",
    ]
    core_required_dirs = [
        ".agents/agents",
        ".agents/workflows",
        ".planning/_templates",
    ]
    core_required_personas = ["Narrator", "RulesLawyer", "WorldBuilder", "SessionPlanner"]
    core_required_templates = [
        "Encounter_Template.md",
        "Location_Template.md",
        "NPC_Template.md",
        "Episode_Overview_Template.md",
        "Chapter_Template.md",
    ]
    core_required_workflows = [
        "new_campaign",
        "catch_up",
        "new_episode",
        "new_chapter",
        "prep_session",
        "start_session",
        "conclude_session",
        "create_npc",
        "brainstorm",
        "update_framework",
        "update_core",
        "actualize",
        "configure_core_source",
        "update_campaign",
    ]

    for rel in core_required_files:
        if not (core / rel).is_file():
            issue("ERROR", "CORE_MISSING_FILE", f"Missing core file: {rel}")
    for rel in core_required_dirs:
        if not (core / rel).is_dir():
            issue("ERROR", "CORE_MISSING_DIR", f"Missing core directory: {rel}")
    for name in core_required_personas:
        if not (core / ".agents" / "agents" / f"{name}.md").is_file():
            issue("ERROR", "CORE_MISSING_PERSONA", f"Missing core persona: .agents/agents/{name}.md")
    for name in core_required_templates:
        if not (core / ".planning" / "_templates" / name).is_file():
            issue("ERROR", "CORE_MISSING_TEMPLATE", f"Missing core template: .planning/_templates/{name}")
    for name in core_required_workflows:
        if not (core / ".agents" / "workflows" / f"{name}.md").is_file():
            issue("ERROR", "CORE_MISSING_WORKFLOW", f"Missing core workflow: .agents/workflows/{name}.md")

    agents = core / "AGENTS.md"
    if agents.is_file():
        txt = agents.read_text(encoding="utf-8")
        if not re.search(r"(?is)Slash command style.*?/new_campaign", txt):
            issue("ERROR", "AGENTS_TRIGGER_SLASH_MISSING", "AGENTS.md must document slash workflow invocation (for example /new_campaign).")
        if not re.search(r"(?is)Natural language style.*?run new_campaign workflow", txt):
            issue("ERROR", "AGENTS_TRIGGER_NL_MISSING", "AGENTS.md must document natural-language workflow invocation (for example run new_campaign workflow).")

    index = core / ".agents" / "workflows" / "INDEX.md"
    if index.is_file():
        lines = index.read_text(encoding="utf-8").splitlines()
        joined = "\n".join(lines)
        for line in lines:
            m = re.search(r"->\s*`?(.+?\.md)`?$", line)
            if m and not (core / m.group(1).strip()).is_file():
                issue("ERROR", "WORKFLOW_INDEX_BROKEN", f"Workflow index points to missing file: {m.group(1).strip()}")
        for wf in core_required_workflows:
            link = f".agents/workflows/{wf}.md"
            if link not in joined:
                issue("ERROR", "WORKFLOW_INDEX_MISSING_ENTRY", f"Workflow index is missing mapping for: {wf}")

    # With core-sourced framework, install-state in campaign is optional
    if not (root / ".framework" / "install-state.json").is_file():
        issue("WARN", "NO_INSTALL_STATE", "No .framework/install-state.json found in campaign.")
    # Validate workflow discovery against core
    if "new_campaign" not in workflow_names(core):
        issue("WARN", "GM_WORKFLOWS_OUTPUT_UNEXPECTED", "Workflow list did not include new_campaign.")

    reports = root / ".framework" / "reports"
    ensure_dir(reports)
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M%S")
    report = reports / f"actualize-{stamp}.md"
    errors = sum(1 for s, _, _ in issues if s == "ERROR")
    warns = sum(1 for s, _, _ in issues if s == "WARN")
    status = "FAIL" if errors > 0 else "PASS"
    lines = [
        "# Campaign Actualization Report",
        "",
        f"- Status: **{status}**",
        f"- Generated (UTC): {utc_now_iso()}",
        f"- Errors: {errors}",
        f"- Warnings: {warns}",
        "",
    ]
    if not issues:
        lines.append("No issues detected.")
    else:
        lines.append("## Findings")
        for sev, code, msg in issues:
            lines.append(f"- [{sev}] {code}: {msg}")
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Actualization status: {status}")
    print(f"Errors: {errors}")
    print(f"Warnings: {warns}")
    print(f"Report: {report}")
    return 2 if errors > 0 else 0


def load_source_config(global_home: pathlib.Path, repo_root: pathlib.Path) -> Dict[str, Any]:
    primary = global_home / "core-source.json"
    legacy = repo_root / ".framework" / "core-source.json"
    if primary.is_file():
        print(f"Using configured core source from: {primary}")
        return read_json(primary, {})
    if legacy.is_file():
        print(f"Using legacy campaign config from: {legacy}")
        print("Tip: run `gurpsai set-core-source -UseLatestTag` to move config to global home.")
        return read_json(legacy, {})
    print("Using built-in default core source.")
    return {"repo_url": DEFAULT_CORE_REPO, "default_ref": DEFAULT_CORE_REF, "use_latest_tag": True}


def repo_hash(url: str) -> str:
    return base64.b64encode(url.encode("utf-8")).decode("ascii").replace("=", "").replace("+", "-").replace("/", "_")


def update_core(
    repo_root: pathlib.Path,
    global_home: pathlib.Path,
    repo_url: Optional[str],
    core_path: Optional[str],
    ref: Optional[str],
    latest_tag: bool,
    dry_run: bool,
    force: bool,
) -> int:
    has_repo = bool(repo_url)
    has_core = bool(core_path)
    if has_repo and has_core:
        raise RuntimeError("Provide exactly one source: either -RepoUrl or -CorePath.")

    resolved_ref = ref or DEFAULT_CORE_REF
    if not has_repo and not has_core:
        cfg = load_source_config(global_home, repo_root)
        repo_url = str(cfg.get("repo_url") or DEFAULT_CORE_REPO)
        has_repo = True
        if not ref:
            resolved_ref = str(cfg.get("default_ref") or DEFAULT_CORE_REF)
        if not latest_tag and bool(cfg.get("use_latest_tag")):
            latest_tag = True

    if has_core:
        source = pathlib.Path(str(core_path)).expanduser().resolve()
        print(f"Using local core path: {source}")
    else:
        if shutil.which("git") is None:
            raise RuntimeError("git is required for -RepoUrl mode, but not found in PATH.")
        assert repo_url is not None
        cache = global_home / "cache" / repo_hash(repo_url)
        ensure_dir(cache.parent)
        if not cache.exists():
            print("Cloning core repo...")
            run_git(["clone", repo_url, str(cache)])
        else:
            print("Refreshing core repo cache...")
            run_git(["fetch", "--all", "--tags", "--prune"], cwd=cache)
        if latest_tag:
            tags = [t.strip() for t in run_git(["tag", "--sort=-v:refname"], cwd=cache).splitlines() if t.strip()]
            if not tags:
                raise RuntimeError("No tags found in core repository. Cannot use -LatestTag.")
            resolved_ref = tags[0]
        print(f"Checking out ref: {resolved_ref}")
        run_git(["checkout", "--force", resolved_ref], cwd=cache)
        if not latest_tag:
            pull = run_command(["git", "pull", "--ff-only"], cwd=cache)
            if pull.returncode != 0:
                print(f"Warning: pull --ff-only skipped for ref '{resolved_ref}'.")
        source = cache

    print("Running framework sync...")
    code = framework_sync(repo_root, source, dry_run, force)
    if code != 0:
        return code
    print("")
    print("Update Core finished successfully.")
    if repo_url:
        print(f"  Repo: {repo_url}")
        print(f"  Ref:  {resolved_ref}")
        print(f"  LatestTag: {bool(latest_tag)}")
    print(f"  Source: {source}")
    print(f"  Global home: {global_home}")
    return 0


def show_app_help() -> None:
    print("GURPS AI Assistant - CLI Interface")
    print("Usage: gurpsai <command> [options]")
    print("       python -m gurpsai <command> [options]")
    print("")
    print("Global Commands:")
    print("  init                Initialize global app state")
    print("  install             Install gurpsai launcher to PATH and init home")
    print("")
    print("Campaign Management:")
    print("  new -Name NAME      Create a new campaign directory from core templates")
    print("  load -Name NAME     Set an existing campaign as the active one")
    print("  register -Path PATH Register a campaign directory with the system")
    print("  list                List all registered campaigns")
    print("  current             Show the active campaign and its path")
    print("")
    print("Campaign Operations:")
    print("  update              Sync framework files and actualize (on active/named)")
    print("  actualize           Run health check and repair on campaign files")
    print("  workflows           List all available workflows in the core")
    print("  workflow -Name NAME Print help/status for a specific workflow")
    print("")
    print("Advanced Modes:")
    print("  gm <subcommand>     Access GM/System tools (sync, update-core, etc.)")
    print("  ai <subcommand>     Access AI provider configuration and testing")
    print("")
    print("Options:")
    print("  -h, -Help           Show detailed help for any command")
    print("  -Name <name>        Specify campaign name for commands")
    print("  -Path <path>        Specify directory path for commands")
    print("")
    print("Run 'gurpsai <command> -Help' for details on specific commands.")


def resolve_campaign_for_app(state: Dict[str, Any], name: Optional[str], path_opt: Optional[str]) -> pathlib.Path:
    if path_opt:
        return pathlib.Path(str(path_opt)).expanduser().resolve()
    if name:
        if name not in state["campaigns"]:
            raise RuntimeError(f"Unknown campaign name '{name}'.")
        return pathlib.Path(state["campaigns"][str(name)]).resolve()
    active = state.get("active_campaign")
    if active and str(active) in state["campaigns"]:
        return pathlib.Path(state["campaigns"][str(active)]).resolve()
    raise RuntimeError("No campaign selected. Use: gurpsai load -Name <campaign>")


def app_mode(args: Sequence[str], repo_root: pathlib.Path) -> int:
    pos, opts = parse_options(args, ["Name", "Path", "Ref"], ["LatestTag", "DryRun", "Force", "H", "Help"])
    cmd = pos[0].lower() if pos else "help"
    
    # Handle 'gurpsai help <cmd>' or 'gurpsai <cmd> -Help'
    show_help = opts.get("H") or opts.get("Help")
    if cmd == "help":
        if len(pos) > 1:
            cmd = pos[1].lower()
            show_help = True
        else:
            show_app_help()
            return 0

    global_home = resolve_global_home(repo_root)
    state_path = global_home / "state.json"
    state = load_app_state(state_path, repo_root)

    if show_help:
        if cmd == "new":
            print("Usage: gurpsai new -Name <name> [-Path <path>]")
            print("Creates a new GURPS campaign folder using core templates.")
            print("If -Path is omitted, it defaults to ~/Documents/GurpsCampaigns/<name>.")
        elif cmd == "load":
            print("Usage: gurpsai load [-Name <name>] [-Path <path>]")
            print("Sets the active campaign. If -Path is used, also registers it.")
        elif cmd == "register":
            print("Usage: gurpsai register -Path <path> [-Name <name>]")
            print("Registers an existing campaign directory with the global state.")
        elif cmd == "update":
            print("Usage: gurpsai update [-Name <name>] [-Ref <ref>] [-LatestTag] [-DryRun] [-Force]")
            print("Phased update: 1. Syncs core framework files, 2. Runs actualize check.")
        elif cmd == "actualize":
            print("Usage: gurpsai actualize [-Name <name>]")
            print("Runs a health check on the campaign structure, verifying required files and templates.")
        elif cmd == "ai":
            return ai_mode(["help"], repo_root)
        elif cmd == "gm":
            return gm_mode(["help"], repo_root)
        else:
            print(f"No specific help for '{cmd}'.")
            show_app_help()
        return 0

    if cmd == "help":
        show_app_help()
        return 0
    if cmd == "init":
        state["core_repo_url"] = DEFAULT_CORE_REPO
        state["core_path"] = str(repo_root)
        save_app_state(state_path, state)
        print("Global app state initialized:")
        print(f"  State: {state_path}")
        print(f"  Core repo: {state['core_repo_url']}")
        print(f"  Core path: {state['core_path']}")
        return 0
    if cmd == "new":
        name = opts.get("Name")
        path_opt = opts.get("Path")
        if not name and not path_opt:
            raise RuntimeError("Provide -Name and optionally -Path.")
        target = pathlib.Path(str(path_opt)).expanduser() if path_opt else (pathlib.Path.home() / "Documents" / "GurpsCampaigns" / str(name))
        if not name:
            name = target.name
        if target.exists():
            if any(target.iterdir()):
                raise RuntimeError(f"Target path already exists and is not empty: {target}")
        else:
            ensure_dir(target)
        for d in ("01_World_Bible", "02_Characters", "03_Story"):
            ensure_dir(target / d)
        templates_dir = repo_root / ".planning" / "_templates"
        seeds = [
            ("00_System_Rules_Template.md", "00_System_Rules.md"),
            ("State_Template.md", "state.md"),
        ]
        for tmpl, dest in seeds:
            dst = target / dest
            cand1 = templates_dir / tmpl
            cand2 = repo_root / "Campaign" / dest
            src = cand1 if cand1.is_file() else cand2
            if src.is_file() and not dst.exists():
                shutil.copy2(src, dst)
        sync_code = framework_sync(target.resolve(), repo_root, False, False)
        if sync_code != 0:
            return sync_code
        state["campaigns"][str(name)] = str(target.resolve())
        state["active_campaign"] = str(name)
        save_app_state(state_path, state)
        print("Campaign created and loaded:")
        print(f"  Name: {name}")
        print(f"  Path: {target.resolve()}")
        return 0
    if cmd == "register":
        if not opts.get("Path"):
            raise RuntimeError("register requires -Path")
        cpath = pathlib.Path(str(opts["Path"])).expanduser().resolve()
        if not cpath.is_dir():
            raise RuntimeError(f"Not a directory: {cpath}")
        name = str(opts.get("Name") or cpath.name)
        state["campaigns"][name] = str(cpath)
        state["active_campaign"] = name
        save_app_state(state_path, state)
        print("Campaign registered and loaded:")
        print(f"  Name: {name}")
        print(f"  Path: {cpath}")
        return 0
    if cmd == "load":
        if opts.get("Path"):
            cpath = pathlib.Path(str(opts["Path"])).expanduser().resolve()
            if not cpath.is_dir():
                raise RuntimeError(f"Not a directory: {cpath}")
            name = str(opts.get("Name") or cpath.name)
            state["campaigns"][name] = str(cpath)
            state["active_campaign"] = name
            save_app_state(state_path, state)
            print("Campaign loaded:")
            print(f"  Name: {name}")
            print(f"  Path: {cpath}")
            return 0
        name = opts.get("Name")
        if not name:
            raise RuntimeError("load requires -Name or -Path")
        if name not in state["campaigns"]:
            raise RuntimeError(f"Unknown campaign: {name}")
        state["active_campaign"] = str(name)
        save_app_state(state_path, state)
        print(f"Active campaign: {name}")
        print(f"Path: {state['campaigns'][name]}")
        return 0
    if cmd == "list":
        campaigns = state["campaigns"]
        active = state.get("active_campaign")
        if not campaigns:
            print("No campaigns registered.")
            return 0
        for k in sorted(campaigns):
            mark = "*" if k == active else " "
            print(f"{mark} {k} -> {campaigns[k]}")
        return 0
    if cmd == "current":
        active = state.get("active_campaign")
        if not active:
            print("No active campaign.")
            return 0
        print(f"Active campaign: {active}")
        print(f"Path: {state['campaigns'].get(active, '<missing>')}")
        return 0
    if cmd == "workflows":
        for wf in workflow_names(repo_root):
            print(wf)
        return 0
    if cmd == "workflow":
        name = opts.get("Name")
        if not name:
            raise RuntimeError("workflow requires -Name")
        if not (repo_root / ".agents" / "workflows" / f"{name}.md").is_file():
            raise RuntimeError(f"Unknown workflow: {name}")
        print(f"run {name} workflow")
        return 0
    if cmd == "update":
        campaign = resolve_campaign_for_app(state, opts.get("Name"), opts.get("Path"))
        pass_args: List[str] = []
        if opts.get("DryRun"):
            pass_args.append("-DryRun")
        if opts.get("Force"):
            pass_args.append("-Force")
        if opts.get("Ref"):
            pass_args += ["-Ref", str(opts["Ref"])]
        if opts.get("LatestTag"):
            pass_args.append("-LatestTag")
        return update_campaign_mode(pass_args, campaign)
    if cmd == "actualize":
        campaign = resolve_campaign_for_app(state, opts.get("Name"), opts.get("Path"))
        return actualize_campaign_mode([], campaign)
    raise RuntimeError(f"Unknown command: {cmd}")


def set_core_source_mode(args: Sequence[str], repo_root: pathlib.Path) -> int:
    _, opts = parse_options(args, ["RepoUrl", "DefaultRef"], ["UseLatestTag"])
    cfg = {
        "repo_url": str(opts.get("RepoUrl") or DEFAULT_CORE_REPO),
        "default_ref": str(opts.get("DefaultRef") or DEFAULT_CORE_REF),
        "use_latest_tag": bool(opts.get("UseLatestTag")),
        "updated_at_utc": utc_now_iso(),
    }
    home = resolve_global_home(repo_root)
    path = home / "core-source.json"
    write_json(path, cfg)
    print("Core source configuration saved:")
    print(f"  File: {path}")
    print(f"  Global home: {home}")
    print(f"  Repo: {cfg['repo_url']}")
    print(f"  Default ref: {cfg['default_ref']}")
    print(f"  Use latest tag: {cfg['use_latest_tag']}")
    return 0


def framework_sync_mode(args: Sequence[str], repo_root: pathlib.Path) -> int:
    _, opts = parse_options(args, ["CorePath"], ["DryRun", "Force"])
    if not opts.get("CorePath"):
        raise RuntimeError("framework-sync requires -CorePath")
    return framework_sync(
        repo_root=repo_root,
        core_path=pathlib.Path(str(opts["CorePath"])).expanduser().resolve(),
        dry_run=bool(opts.get("DryRun")),
        force=bool(opts.get("Force")),
    )


def update_core_mode(args: Sequence[str], repo_root: pathlib.Path) -> int:
    _, opts = parse_options(args, ["RepoUrl", "CorePath", "Ref"], ["LatestTag", "DryRun", "Force"])
    return update_core(
        repo_root=repo_root,
        global_home=resolve_global_home(repo_root),
        repo_url=opts.get("RepoUrl"),
        core_path=opts.get("CorePath"),
        ref=opts.get("Ref"),
        latest_tag=bool(opts.get("LatestTag")),
        dry_run=bool(opts.get("DryRun")),
        force=bool(opts.get("Force")),
    )


def update_campaign_mode(args: Sequence[str], repo_root: pathlib.Path) -> int:
    _, opts = parse_options(args, ["RepoUrl", "CorePath", "Ref"], ["LatestTag", "DryRun", "Force", "SkipActualize"])
    print("Phase 1/2: Update Core")
    c = update_core_mode(args, repo_root)
    if c != 0:
        return c
    if opts.get("DryRun"):
        print("")
        print("Dry run completed. Actualization was skipped.")
        return 0
    if opts.get("SkipActualize"):
        print("")
        print("Core updated. Actualization skipped by request.")
        return 0
    print("")
    print("Phase 2/2: Actualize Campaign")
    return actualize_campaign(repo_root)


def actualize_campaign_mode(args: Sequence[str], repo_root: pathlib.Path) -> int:
    del args
    return actualize_campaign(repo_root)


def provider_alias(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    n = str(name).strip().lower()
    if n in {"chatgpt", "openai"}:
        return "chatgpt"
    if n in {"gemini", "deepseek"}:
        return n
    return n


def default_ai_config() -> Dict[str, Any]:
    return {
        "schema_version": 1,
        "default_provider": "chatgpt",
        "providers": {
            "chatgpt": {
                "display_name": "ChatGPT (OpenAI)",
                "api_style": "openai_responses",
                "endpoint": "https://api.openai.com/v1/responses",
                "api_key_env": "OPENAI_API_KEY",
                "model": "gpt-5",
                "enabled": False,
            },
            "gemini": {
                "display_name": "Gemini",
                "api_style": "gemini_generate_content",
                "endpoint": "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                "api_key_env": "GEMINI_API_KEY",
                "model": "gemini-2.5-pro",
                "enabled": False,
            },
            "deepseek": {
                "display_name": "DeepSeek",
                "api_style": "openai_chat",
                "endpoint": "https://api.deepseek.com/v1/chat/completions",
                "api_key_env": "DEEPSEEK_API_KEY",
                "model": "deepseek-chat",
                "enabled": False,
            },
        },
        "updated_at_utc": utc_now_iso(),
    }


def ai_mode(args: Sequence[str], repo_root: pathlib.Path) -> int:
    cmd = args[0].lower() if args else "help"
    _, opts = parse_options(
        args[1:] if args else [],
        ["Provider", "Model", "ApiKeyEnv", "Endpoint", "Prompt", "PromptFile", "SystemPrompt", "SystemFile", "Task", "WorkflowName", "CampaignPath", "MaxSteps", "Resume"],
        ["SetDefault", "Disable", "PrintPromptOnly", "SkipStartupDocs", "Raw", "DryRun", "RequireApproval"],
    )
    home = resolve_global_home(repo_root)
    cfg_path = home / "ai-config.json"
    cfg = read_json(cfg_path, None)
    if cfg is None:
        cfg = default_ai_config()
        write_json(cfg_path, cfg)

    if cmd == "help":
        print("AI Provider Configuration & Tools")
        print("Usage: gurpsai ai <subcommand> [options]")
        print("")
        print("Subcommands:")
        print("  providers           List all providers, their status, and models")
        print("  configure           Set provider options (Model, ApiKeyEnv, Endpoint)")
        print("  set-default         Set the default AI provider")
        print("  show-config         Display local path to ai-config.json")
        print("")
        print("Options (for configure):")
        print("  -Provider <name>    chatgpt, gemini, or deepseek")
        print("  -Model <model>      Override default model (e.g., gpt-4o)")
        print("  -SetDefault         Set as default provider after configuring")
        print("  -Disable            Disable this provider")
        return 0
    if cmd == "providers":
        print("AI Providers")
        print(f"  Config:  {cfg_path}")
        print(f"  Default: {cfg.get('default_provider')}")
        print("")
        for name in ("chatgpt", "gemini", "deepseek"):
            p = cfg["providers"][name]
            mark = "*" if cfg.get("default_provider") == name else " "
            key_set = bool(os.environ.get(str(p["api_key_env"])))
            print(f"{mark} {name}")
            print(f"    display:      {p['display_name']}")
            print(f"    enabled:      {bool(p['enabled'])}")
            print(f"    model:        {p['model']}")
            print(f"    endpoint:     {p['endpoint']}")
            print(f"    api_key_env:  {p['api_key_env']} (set={key_set})")
        return 0
    if cmd == "show-config":
        print(f"AI config file: {cfg_path}")
        print(f"Global home:    {home}")
        return 0
    if cmd == "configure":
        provider = provider_alias(opts.get("Provider"))
        if not provider:
            raise RuntimeError("configure requires -Provider.")
        if provider not in cfg["providers"]:
            raise RuntimeError(f"Unknown provider '{provider}'.")
        p = dict(cfg["providers"][provider])
        if opts.get("Model"):
            p["model"] = str(opts["Model"])
        if opts.get("ApiKeyEnv"):
            p["api_key_env"] = str(opts["ApiKeyEnv"])
        if opts.get("Endpoint"):
            p["endpoint"] = str(opts["Endpoint"])
        p["enabled"] = False if opts.get("Disable") else True
        cfg["providers"][provider] = p
        if opts.get("SetDefault"):
            cfg["default_provider"] = provider
        cfg["updated_at_utc"] = utc_now_iso()
        write_json(cfg_path, cfg)
        print(f"Provider configured: {provider}")
        print(f"  Enabled:     {bool(p['enabled'])}")
        print(f"  Model:       {p['model']}")
        print(f"  Endpoint:    {p['endpoint']}")
        print(f"  API key env: {p['api_key_env']}")
        if opts.get("SetDefault"):
            print("  Default:     yes")
        print(f"Config: {cfg_path}")
        return 0
    if cmd == "set-default":
        provider = provider_alias(opts.get("Provider"))
        if not provider:
            raise RuntimeError("set-default requires -Provider.")
        if provider not in cfg["providers"]:
            raise RuntimeError(f"Unknown provider '{provider}'.")
        cfg["default_provider"] = provider
        cfg["updated_at_utc"] = utc_now_iso()
        write_json(cfg_path, cfg)
        print(f"Default provider: {provider}")
        print(f"Config: {cfg_path}")
        return 0

    raise RuntimeError(
        f"AI subcommand '{cmd}' is not yet implemented in Python runtime. "
        "Supported commands: help, providers, show-config, configure, set-default."
    )


def gm_mode(args: Sequence[str], repo_root: pathlib.Path) -> int:
    cmd = args[0].lower() if args else "help"
    sub = args[1] if len(args) > 1 else ""
    rest = list(args[2:]) if len(args) > 2 else []
    if cmd == "help":
        print("GM & System Framework Tools")
        print("Usage: gurpsai gm <subcommand> [options]")
        print("")
        print("Core Framework:")
        print("  update-core         Fetch latest core files from repo to global cache")
        print("  update              Update core AND then sync to active campaign")
        print("  sync                Directly sync files from a local CorePath to campaign")
        print("  actualize           Run health check on current campaign structure")
        print("")
        print("Configuration:")
        print("  configure-source    Set the global Git repo URL for core updates")
        print("  ai                  Access AI configuration sub-cli")
        print("")
        print("Automation:")
        print("  workflows           List all available workflow files")
        print("  workflow <name>     Check status of a specific workflow")
        return 0
    if cmd == "configure-source":
        return set_core_source_mode(([sub] if sub else []) + rest, repo_root)
    if cmd == "update-core":
        return update_core_mode(([sub] if sub else []) + rest, repo_root)
    if cmd == "update":
        return update_campaign_mode(([sub] if sub else []) + rest, repo_root)
    if cmd == "actualize":
        return actualize_campaign_mode(([sub] if sub else []) + rest, repo_root)
    if cmd == "sync":
        return framework_sync_mode(([sub] if sub else []) + rest, repo_root)
    if cmd == "ai":
        ai_args = ([sub] if sub else []) + rest
        return ai_mode(ai_args, repo_root)
    if cmd == "workflows":
        print("Workflow commands (AI-level):")
        for wf in workflow_names(repo_root):
            print(f"  {wf}")
        print("")
        print("Run in Codex chat with one of these:")
        print("  run <workflow_name> workflow")
        print("  /<workflow_name>")
        return 0
    if cmd == "workflow":
        if not sub:
            raise RuntimeError("Missing workflow name. Example: gurpsai gm workflow create_npc")
        if not (repo_root / ".agents" / "workflows" / f"{sub}.md").is_file():
            raise RuntimeError(f"Unknown workflow '{sub}'. Run gurpsai gm workflows")
        print(f"run {sub} workflow")
        return 0
    print(f"Unknown command: {cmd}")
    print("Run gurpsai gm help")
    return 1


def install_mode(args: Sequence[str], repo_root: pathlib.Path) -> int:
    _, opts = parse_options(args, [], ["SkipPathUpdate"])
    skip_path = bool(opts.get("SkipPathUpdate"))
    home = resolve_global_home(repo_root)
    bin_dir = home / "bin"
    ensure_dir(bin_dir)
    launcher_cmd = bin_dir / "gurpsai.cmd"
    script_path = repo_root / "scripts" / "python" / "gurpsai.py"
    launcher_cmd.write_text(
        "@echo off\n"
        "setlocal\n"
        f"set \"_SCRIPT={script_path}\"\n"
        "set \"_PY=%GURPSAI_PYTHON%\"\n"
        "if not \"%_PY%\"==\"\" goto run\n"
        "where python >nul 2>nul\n"
        "if %ERRORLEVEL%==0 set \"_PY=python\"\n"
        "if not \"%_PY%\"==\"\" goto run\n"
        "where python3 >nul 2>nul\n"
        "if %ERRORLEVEL%==0 set \"_PY=python3\"\n"
        "if not \"%_PY%\"==\"\" goto run\n"
        "echo Python is required but was not found. Set GURPSAI_PYTHON or install python/python3 in PATH.\n"
        "exit /b 1\n"
        ":run\n"
        "\"%_PY%\" \"%_SCRIPT%\" %*\n"
        "exit /b %ERRORLEVEL%\n",
        encoding="ascii",
    )

    if not (home / "core-source.json").is_file():
        set_core_source_mode(["-UseLatestTag"], repo_root)
    if not (home / "ai-config.json").is_file():
        write_json(home / "ai-config.json", default_ai_config())
    state_path = home / "state.json"
    if not state_path.is_file():
        save_app_state(state_path, load_app_state(state_path, repo_root))

    path_changed = False
    if not skip_path and os.name == "nt":
        try:
            import winreg

            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment", 0, winreg.KEY_READ | winreg.KEY_SET_VALUE) as key:
                try:
                    current_user_path, reg_type = winreg.QueryValueEx(key, "Path")
                except FileNotFoundError:
                    current_user_path, reg_type = "", winreg.REG_EXPAND_SZ
                entries = [e.strip().rstrip("\\/").lower() for e in str(current_user_path).split(";") if e.strip()]
                if str(bin_dir).rstrip("\\/").lower() not in entries:
                    updated_path = str(current_user_path).strip().strip(";")
                    if updated_path:
                        updated_path = f"{updated_path};{bin_dir}"
                    else:
                        updated_path = str(bin_dir)
                    winreg.SetValueEx(key, "Path", 0, reg_type, updated_path)
                    path_changed = True
        except OSError:
            path_changed = False

    print("")
    print("GURPSAI install complete.")
    print(f"  Core root: {repo_root}")
    print(f"  Global home: {home}")
    print(f"  Launcher: {launcher_cmd}")
    if skip_path:
        print("  PATH update: skipped by -SkipPathUpdate")
    elif path_changed:
        print(f"  PATH update: added {bin_dir} (new shells only)")
    else:
        print("  PATH update: already present or skipped")
    print("")
    print("Usage:")
    print("  gurpsai help")
    print("  gurpsai ai help")
    print("  gurpsai init")
    print("  gurpsai new -Name MyCampaign")
    return 0


def dispatch(mode: str, args: Sequence[str], repo_root: pathlib.Path) -> int:
    mode = mode.lower()
    if mode == "app":
        return app_mode(args, repo_root)
    if mode == "gm":
        return gm_mode(args, repo_root)
    if mode == "ai":
        return ai_mode(args, repo_root)
    if mode == "ai-agent":
        return ai_mode(["agent", *args], repo_root)
    if mode == "install":
        return install_mode(args, repo_root)
    if mode == "framework-sync":
        return framework_sync_mode(args, repo_root)
    if mode == "set-core-source":
        return set_core_source_mode(args, repo_root)
    if mode == "update-core":
        return update_core_mode(args, repo_root)
    if mode == "update-campaign":
        return update_campaign_mode(args, repo_root)
    if mode == "actualize-campaign":
        return actualize_campaign_mode(args, repo_root)
    raise RuntimeError(f"Unknown mode: {mode}")


def resolve_repo_root() -> pathlib.Path:
    env_root = os.environ.get("GURPSAI_CORE_ROOT")
    if env_root:
        candidate = pathlib.Path(env_root).expanduser().resolve()
        if (candidate / "AGENTS.md").is_file():
            return candidate

    candidates = [
        pathlib.Path(__file__).resolve().parents[2],
        pathlib.Path.cwd().resolve(),
    ]
    for candidate in candidates:
        if (candidate / "AGENTS.md").is_file():
            return candidate
    return candidates[0]


def main(argv: Sequence[str]) -> int:
    repo_root = resolve_repo_root()
    known_modes = {
        "app",
        "gm",
        "ai",
        "ai-agent",
        "install",
        "framework-sync",
        "set-core-source",
        "update-core",
        "update-campaign",
        "actualize-campaign",
    }
    if argv and argv[0].lower() in known_modes:
        mode = argv[0]
        args = list(argv[1:])
    else:
        mode = "app"
        args = list(argv)
    try:
        return dispatch(mode, args, repo_root)
    except RuntimeError as e:
        print(str(e), file=sys.stderr)
        return 1


def console_main() -> int:
    return main(sys.argv[1:])


if __name__ == "__main__":
    sys.exit(console_main())
