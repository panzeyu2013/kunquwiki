from __future__ import annotations

from typing import Any

from bot.models.payload import ImportItem
from bot.models.result import ValidationErrorItem


ENTITY_TYPES = {"city", "troupe", "venue", "work", "person", "article", "event", "role"}


def validate_payload(data: dict[str, Any]) -> tuple[list[ImportItem], list[ValidationErrorItem]]:
    errors: list[ValidationErrorItem] = []
    items_raw = data.get("items")

    if "items" not in data:
        errors.append(ValidationErrorItem(index=0, field="items", message="missing top-level items"))
        return [], errors

    if not isinstance(items_raw, list):
        errors.append(ValidationErrorItem(index=0, field="items", message="items must be a list"))
        return [], errors

    seen_external: dict[str, int] = {}
    seen_title: dict[str, int] = {}
    items: list[ImportItem] = []

    for index, raw in enumerate(items_raw):
        if not isinstance(raw, dict):
            errors.append(ValidationErrorItem(index=index, field=None, message="item must be an object"))
            continue

        entity_type = raw.get("entity_type")
        title = raw.get("title")
        external_id = raw.get("external_id")
        work_type = raw.get("work_type")
        parent_work_id = raw.get("parent_work_id")
        initial_data = raw.get("initial_data") or {}

        if not isinstance(entity_type, str) or entity_type not in ENTITY_TYPES:
            errors.append(ValidationErrorItem(index=index, field="entity_type", message="invalid entity_type"))
        if not isinstance(title, str) or not title.strip():
            errors.append(ValidationErrorItem(index=index, field="title", message="title is required"))
        if external_id is not None and not isinstance(external_id, str):
            errors.append(ValidationErrorItem(index=index, field="external_id", message="external_id must be a string"))
        if work_type is not None and not isinstance(work_type, str):
            errors.append(ValidationErrorItem(index=index, field="work_type", message="work_type must be a string"))
        if parent_work_id is not None and not isinstance(parent_work_id, str):
            errors.append(ValidationErrorItem(index=index, field="parent_work_id", message="parent_work_id must be a string"))
        if initial_data is not None and not isinstance(initial_data, dict):
            errors.append(ValidationErrorItem(index=index, field="initial_data", message="initial_data must be an object"))

        if entity_type == "work" and work_type == "excerpt" and not parent_work_id:
            errors.append(
                ValidationErrorItem(index=index, field="parent_work_id", message="parent_work_id is required for excerpt work")
            )

        if isinstance(external_id, str):
            previous = seen_external.get(external_id)
            if previous is not None:
                errors.append(
                    ValidationErrorItem(index=index, field="external_id", message=f"duplicate external_id with item {previous}")
                )
            else:
                seen_external[external_id] = index

        if isinstance(entity_type, str) and isinstance(title, str):
            key = f"{entity_type}:{title.strip()}"
            previous = seen_title.get(key)
            if previous is not None:
                errors.append(ValidationErrorItem(index=index, field="title", message=f"duplicate title with item {previous}"))
            else:
                seen_title[key] = index

        items.append(
            ImportItem(
                external_id=external_id if isinstance(external_id, str) else None,
                entity_type=entity_type if isinstance(entity_type, str) else "",
                title=title.strip() if isinstance(title, str) else "",
                work_type=work_type if isinstance(work_type, str) else None,
                parent_work_id=parent_work_id if isinstance(parent_work_id, str) else None,
                initial_data=initial_data if isinstance(initial_data, dict) else {},
            )
        )

    return items, errors
