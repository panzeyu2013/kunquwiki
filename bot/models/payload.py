from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ImportItem:
    external_id: str | None
    entity_type: str
    title: str
    work_type: str | None = None
    parent_work_id: str | None = None
    initial_data: dict[str, Any] = field(default_factory=dict)


@dataclass
class ImportOptions:
    dry_run: bool = False
    upsert: bool = True
