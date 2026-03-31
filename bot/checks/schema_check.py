from __future__ import annotations

from typing import Any

from bot.importer.validator import validate_payload


def run_schema_check(data: dict[str, Any]) -> dict[str, Any]:
    _, errors = validate_payload(data)
    return {
        "check_type": "schema",
        "passed": len(errors) == 0,
        "errors": [error.__dict__ for error in errors],
        "warnings": [],
        "stats": {"total": len(data.get("items", []) or []), "error_count": len(errors), "warning_count": 0},
    }
