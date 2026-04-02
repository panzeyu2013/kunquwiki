from __future__ import annotations

from typing import Any

from bot.client.api_client import BotApiClient
from bot.importer.validator import validate_payload
from bot.models.payload import ImportItem
from bot.models.result import ValidationErrorItem


def run_business_check(client: BotApiClient, data: dict[str, Any]) -> dict[str, Any]:
    items, errors = validate_payload(data)
    if errors:
        return {
            "check_type": "business",
            "passed": False,
            "errors": [error.__dict__ for error in errors],
            "warnings": [],
            "stats": {"total": len(items), "error_count": len(errors), "warning_count": 0},
        }

    return run_business_check_items(client, items, [])


def run_business_check_items(
    client: BotApiClient,
    items: list[ImportItem],
    errors: list[ValidationErrorItem],
) -> dict[str, Any]:
    if errors:
        return {
            "check_type": "business",
            "passed": False,
            "errors": [error.__dict__ for error in errors],
            "warnings": [],
            "stats": {"total": len(items), "error_count": len(errors), "warning_count": 0},
        }

    payload = {
        "checkType": "business",
        "items": [
            {
                "externalId": item.external_id,
                "entityType": item.entity_type,
                "title": item.title,
                "workType": item.work_type,
                "parentWorkId": item.parent_work_id,
                "initialData": item.initial_data or None,
            }
            for item in items
        ],
    }
    return client.run_check(payload)
