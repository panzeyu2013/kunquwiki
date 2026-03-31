from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class ValidationErrorItem:
    index: int
    field: str | None
    message: str


@dataclass
class ImportResult:
    success: bool
    summary: dict[str, Any]
    results: list[dict[str, Any]]
