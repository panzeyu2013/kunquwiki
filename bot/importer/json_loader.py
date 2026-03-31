from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class JsonLoadError(ValueError):
    pass


def load_json_file(path: str) -> dict[str, Any]:
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"JSON file not found: {path}")

    try:
        content = file_path.read_text(encoding="utf-8")
    except OSError as error:
        raise JsonLoadError(f"Failed to read file: {error}") from error

    try:
        data = json.loads(content)
    except json.JSONDecodeError as error:
        raise JsonLoadError(f"Invalid JSON: {error.msg} at line {error.lineno}") from error

    if not isinstance(data, dict):
        raise JsonLoadError("JSON root must be an object")

    return data
