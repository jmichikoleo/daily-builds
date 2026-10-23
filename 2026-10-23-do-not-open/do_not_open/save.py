"""Local JSON save file. One file, in the OS's app-data folder, nothing else."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from .story import GameState

APP_DIR_NAME = "DO_NOT_OPEN"


def app_data_dir() -> Path:
    """~/Library/Application Support/DO_NOT_OPEN on macOS.

    Set DO_NOT_OPEN_HOME to use a different folder (tests do this).
    """
    override = os.environ.get("DO_NOT_OPEN_HOME")
    if override:
        return Path(override)
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / APP_DIR_NAME
    if os.name == "nt":
        return Path(os.environ.get("APPDATA", Path.home())) / APP_DIR_NAME
    return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "do-not-open"


def save_path() -> Path:
    return app_data_dir() / "save.json"


def load_state(path: Path | None = None) -> GameState:
    path = path or save_path()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return GameState()
    return GameState.from_dict(data)


def save_state(state: GameState, path: Path | None = None) -> None:
    path = path or save_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(state.to_dict(), indent=2), encoding="utf-8")
    os.replace(tmp, path)  # atomic: a crash never leaves half a save
