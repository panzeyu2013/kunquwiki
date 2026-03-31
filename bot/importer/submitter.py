from __future__ import annotations

from typing import Any, Iterable

from bot.client.api_client import BotApiClient
from bot.models.payload import ImportItem, ImportOptions


def chunked(items: list[ImportItem], size: int) -> Iterable[list[ImportItem]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def submit_batches(
    client: BotApiClient,
    items: list[ImportItem],
    options: ImportOptions,
    batch_size: int,
) -> list[dict[str, Any]]:
    all_results: list[dict[str, Any]] = []
    for batch in chunked(items, batch_size):
        payload = {
            "items": [
                {
                    "externalId": item.external_id,
                    "entityType": item.entity_type,
                    "title": item.title,
                    "workType": item.work_type,
                    "parentWorkId": item.parent_work_id,
                    "initialData": item.initial_data or None,
                }
                for item in batch
            ],
            "options": {
                "dryRun": options.dry_run,
                "upsert": options.upsert,
            },
        }
        response = client.import_batch(payload)
        results = response.get("results", []) if isinstance(response, dict) else []
        all_results.extend(results)
    return all_results
