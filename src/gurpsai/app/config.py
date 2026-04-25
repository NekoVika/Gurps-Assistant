from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import sys

def get_bundle_dir() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS) if hasattr(sys, '_MEIPASS') else Path(sys.executable).parent
    return Path(__file__).resolve().parents[3]

ROOT = get_bundle_dir()

# Universal AppData mapping
APP_DIR = Path.home() / ".gurpsai"
APP_DIR.mkdir(parents=True, exist_ok=True)

ENV_PATH = APP_DIR / "config.env"


@dataclass(frozen=True)
class GeminiProviderConfig:
    api_key: str | None = None
    base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    timeout_seconds: float = 15.0


@dataclass(frozen=True)
class OllamaProviderConfig:
    base_url: str = "http://127.0.0.1:11434"
    timeout_seconds: float = 120.0


@dataclass(frozen=True)
class CampaignConfig:
    active_path: str = ""


@dataclass(frozen=True)
class ModelDefaultsConfig:
    chat_provider: str = "gemini"
    chat_model: str = "gemini-1.5-flash"
    wizard_provider: str = "gemini"
    wizard_model: str = "gemini-1.5-flash"
    mending_provider: str = "gemini"
    mending_model: str = "gemini-1.5-flash"


@dataclass(frozen=True)
class AppConfig:
    gemini: GeminiProviderConfig
    ollama: OllamaProviderConfig
    defaults: ModelDefaultsConfig
    campaign: CampaignConfig


@dataclass(frozen=True)
class ProviderSettingsView:
    gemini_api_key_configured: bool
    gemini_base_url: str
    gemini_timeout_seconds: float
    ollama_base_url: str
    ollama_timeout_seconds: float
    default_chat_provider: str
    default_chat_model: str
    default_wizard_provider: str
    default_wizard_model: str
    default_mending_provider: str
    default_mending_model: str


@dataclass(frozen=True)
class ProviderSettingsUpdate:
    gemini_api_key: str | None = None
    set_gemini_api_key: bool = False
    gemini_base_url: str | None = None
    gemini_timeout_seconds: float | None = None
    ollama_base_url: str | None = None
    ollama_timeout_seconds: float | None = None
    default_chat_provider: str | None = None
    default_chat_model: str | None = None
    default_wizard_provider: str | None = None
    default_wizard_model: str | None = None
    default_mending_provider: str | None = None
    default_mending_model: str | None = None


@dataclass(frozen=True)
class CampaignSettingsView:
    active_path: str


@dataclass(frozen=True)
class CampaignSettingsUpdate:
    active_path: str


import json

APP_STATE_PATH = APP_DIR / "state.json"

def _load_app_state() -> dict:
    if APP_STATE_PATH.exists():
        try:
            return json.loads(APP_STATE_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return {}

def _save_app_state(state: dict) -> None:
    APP_STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")

def load_app_config() -> AppConfig:
    file_values = _read_env_file(ENV_PATH)

    gemini_api_key = _pick_value("GEMINI_API_KEY", file_values)
    gemini_base_url = _pick_value(
        "GEMINI_BASE_URL",
        file_values,
        default="https://generativelanguage.googleapis.com/v1beta",
    )
    gemini_timeout_raw = _pick_value("GEMINI_TIMEOUT_SECONDS", file_values, default="15")
    gemini_timeout = _parse_float(gemini_timeout_raw, default=15.0)
    ollama_base_url = _pick_value(
        "OLLAMA_BASE_URL",
        file_values,
        default="http://127.0.0.1:11434",
    )
    ollama_timeout_raw = _pick_value("OLLAMA_TIMEOUT_SECONDS", file_values, default="120")
    ollama_timeout = _parse_float(ollama_timeout_raw, default=120.0)

    app_state = _load_app_state()
    campaign_active_path = app_state.get("active_campaign_path", "")
    
    # Fallback to .env during migration
    if not campaign_active_path:
        campaign_active_path = _pick_value("ACTIVE_CAMPAIGN_PATH", file_values, default="")

    default_chat_provider = _pick_value("DEFAULT_CHAT_PROVIDER", file_values, default="gemini")
    default_chat_model = _pick_value("DEFAULT_CHAT_MODEL", file_values, default="gemini-1.5-flash")
    default_wizard_provider = _pick_value("DEFAULT_WIZARD_PROVIDER", file_values, default="gemini")
    default_wizard_model = _pick_value("DEFAULT_WIZARD_MODEL", file_values, default="gemini-1.5-flash")
    default_mending_provider = _pick_value("DEFAULT_MENDING_PROVIDER", file_values, default="gemini")
    default_mending_model = _pick_value("DEFAULT_MENDING_MODEL", file_values, default="gemini-1.5-flash")

    return AppConfig(
        gemini=GeminiProviderConfig(
            api_key=gemini_api_key,
            base_url=gemini_base_url,
            timeout_seconds=gemini_timeout,
        ),
        ollama=OllamaProviderConfig(
            base_url=ollama_base_url,
            timeout_seconds=ollama_timeout,
        ),
        defaults=ModelDefaultsConfig(
            chat_provider=default_chat_provider,
            chat_model=default_chat_model,
            wizard_provider=default_wizard_provider,
            wizard_model=default_wizard_model,
            mending_provider=default_mending_provider,
            mending_model=default_mending_model,
        ),
        campaign=CampaignConfig(
            active_path=campaign_active_path,
        ),
    )


def load_provider_settings_view() -> ProviderSettingsView:
    config = load_app_config()
    return ProviderSettingsView(
        gemini_api_key_configured=bool(config.gemini.api_key),
        gemini_base_url=config.gemini.base_url,
        gemini_timeout_seconds=config.gemini.timeout_seconds,
        ollama_base_url=config.ollama.base_url,
        ollama_timeout_seconds=config.ollama.timeout_seconds,
        default_chat_provider=config.defaults.chat_provider,
        default_chat_model=config.defaults.chat_model,
        default_wizard_provider=config.defaults.wizard_provider,
        default_wizard_model=config.defaults.wizard_model,
        default_mending_provider=config.defaults.mending_provider,
        default_mending_model=config.defaults.mending_model,
    )


def save_provider_settings(update: ProviderSettingsUpdate) -> ProviderSettingsView:
    current = load_app_config()
    file_values = _read_env_file(ENV_PATH)

    if update.set_gemini_api_key:
        file_values["GEMINI_API_KEY"] = update.gemini_api_key or ""

    file_values["GEMINI_BASE_URL"] = (update.gemini_base_url or current.gemini.base_url).strip()
    file_values["GEMINI_TIMEOUT_SECONDS"] = _format_float(
        update.gemini_timeout_seconds
        if update.gemini_timeout_seconds is not None
        else current.gemini.timeout_seconds
    )
    file_values["OLLAMA_BASE_URL"] = (update.ollama_base_url or current.ollama.base_url).strip()
    file_values["OLLAMA_TIMEOUT_SECONDS"] = _format_float(
        update.ollama_timeout_seconds
        if update.ollama_timeout_seconds is not None
        else current.ollama.timeout_seconds
    )
    if update.default_chat_provider is not None:
        file_values["DEFAULT_CHAT_PROVIDER"] = update.default_chat_provider.strip()
    if update.default_chat_model is not None:
        file_values["DEFAULT_CHAT_MODEL"] = update.default_chat_model.strip()
    if update.default_wizard_provider is not None:
        file_values["DEFAULT_WIZARD_PROVIDER"] = update.default_wizard_provider.strip()
    if update.default_wizard_model is not None:
        file_values["DEFAULT_WIZARD_MODEL"] = update.default_wizard_model.strip()
    if update.default_mending_provider is not None:
        file_values["DEFAULT_MENDING_PROVIDER"] = update.default_mending_provider.strip()
    if update.default_mending_model is not None:
        file_values["DEFAULT_MENDING_MODEL"] = update.default_mending_model.strip()

    _write_env_file(ENV_PATH, file_values)
    return load_provider_settings_view()


def load_campaign_settings_view() -> CampaignSettingsView:
    config = load_app_config()
    return CampaignSettingsView(active_path=config.campaign.active_path)


def save_campaign_settings(update: CampaignSettingsUpdate) -> CampaignSettingsView:
    state = _load_app_state()
    state["active_campaign_path"] = update.active_path.strip()
    _save_app_state(state)
    return load_campaign_settings_view()


def _pick_value(key: str, file_values: dict[str, str], *, default: str | None = None) -> str | None:
    value = os.environ.get(key)
    if value is not None and value.strip():
        return value.strip()
    value = file_values.get(key)
    if value is not None and value.strip():
        return value.strip()
    return default


def _parse_float(raw: str | None, *, default: float) -> float:
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _format_float(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return str(value)


def _read_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        values[key] = value
    return values


def _write_env_file(path: Path, values: dict[str, str]) -> None:
    existing_lines = path.read_text(encoding="utf-8", errors="replace").splitlines() if path.exists() else []
    output_lines: list[str] = []
    seen: set[str] = set()

    for line in existing_lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in line:
            output_lines.append(line)
            continue

        key, _ = line.split("=", 1)
        key = key.strip()
        if key in values:
            output_lines.append(f"{key}={values[key]}")
            seen.add(key)
        else:
            output_lines.append(line)

    missing_keys = [key for key in values.keys() if key not in seen]
    if missing_keys and output_lines and output_lines[-1].strip():
        output_lines.append("")
    for key in missing_keys:
        output_lines.append(f"{key}={values[key]}")

    text = "\n".join(output_lines).rstrip() + "\n"
    path.write_text(text, encoding="utf-8")
