from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bot.client.api_client import BotApiClient
from bot.models.payload import ImportItem
from bot.models.result import ValidationErrorItem


CUID_RE = re.compile(r"^c[a-z0-9]{24}$")


def is_probable_cuid(value: str) -> bool:
    return bool(CUID_RE.match(value))


@dataclass
class ResolverConfig:
    mode: str
    map_path: str | None = None
    cache_dir: str | None = None
    strict: bool = True


class ReferenceResolver:
    def __init__(self, client: BotApiClient | None, config: ResolverConfig) -> None:
        self.client = client
        self.mode = config.mode
        self.map = self._load_map(config.map_path)
        self.cache_path = self._resolve_cache_path(config.cache_dir)
        self.cache_store = self._load_cache(self.cache_path)
        self.cache: dict[tuple[str, str], str] = {}
        self.strict = config.strict

    def resolve_items(self, items: list[ImportItem]) -> tuple[list[ValidationErrorItem], list[ValidationErrorItem]]:
        errors: list[ValidationErrorItem] = []
        warnings: list[ValidationErrorItem] = []

        if "search" in self.mode and self.client:
            self._prefetch_cache(items)

        for index, item in enumerate(items):
            item.parent_work_id = self._resolve_value(index, "parent_work_id", "work", item.parent_work_id, errors, warnings)
            data = item.initial_data or {}

            self._resolve_in_dict(index, data, "cityId", "city", errors, warnings)
            self._resolve_in_dict(index, data, "birthCityId", "city", errors, warnings)
            self._resolve_in_dict(index, data, "venueEntityId", "venue", errors, warnings)
            self._resolve_in_dict(index, data, "troupeId", "troupe", errors, warnings)
            self._resolve_in_list(index, data, "troupeIds", "troupe", errors, warnings)
            self._resolve_in_dict(index, data, "workEntityId", "work", errors, warnings)
            self._resolve_in_list(index, data, "programWorkIds", "work", errors, warnings)
            self._resolve_in_list(index, data, "programExcerptIds", "work", errors, warnings)
            self._resolve_in_list(index, data, "representativeWorkIds", "work", errors, warnings)
            self._resolve_in_list(index, data, "representativeExcerptIds", "work", errors, warnings)

            self._resolve_troupe_memberships(index, data, errors, warnings)
            self._resolve_program_detailed(index, data, errors, warnings)

            item.initial_data = data

        return errors, warnings

    def _resolve_troupe_memberships(
        self,
        index: int,
        data: dict[str, Any],
        errors: list[ValidationErrorItem],
        warnings: list[ValidationErrorItem],
    ) -> None:
        memberships = data.get("troupeMemberships")
        if not isinstance(memberships, list):
            return
        for m_index, membership in enumerate(memberships):
            if not isinstance(membership, dict):
                continue
            current = membership.get("troupeEntityId")
            resolved = self._resolve_value(
                index,
                f"initial_data.troupeMemberships[{m_index}].troupeEntityId",
                "troupe",
                current,
                errors,
                warnings,
            )
            if resolved is not None:
                membership["troupeEntityId"] = resolved

    def _resolve_program_detailed(
        self,
        index: int,
        data: dict[str, Any],
        errors: list[ValidationErrorItem],
        warnings: list[ValidationErrorItem],
    ) -> None:
        program = data.get("programDetailed")
        if not isinstance(program, list):
            return
        for p_index, item in enumerate(program):
            if not isinstance(item, dict):
                continue
            work_value = item.get("workEntityId")
            resolved_work = self._resolve_value(
                index,
                f"initial_data.programDetailed[{p_index}].workEntityId",
                "work",
                work_value,
                errors,
                warnings,
            )
            if resolved_work is not None:
                item["workEntityId"] = resolved_work
            casts = item.get("casts")
            if not isinstance(casts, list):
                continue
            for c_index, cast in enumerate(casts):
                if not isinstance(cast, dict):
                    continue
                role_value = cast.get("roleEntityId")
                resolved_role = self._resolve_value(
                    index,
                    f"initial_data.programDetailed[{p_index}].casts[{c_index}].roleEntityId",
                    "role",
                    role_value,
                    errors,
                    warnings,
                )
                if resolved_role is not None:
                    cast["roleEntityId"] = resolved_role
                person_value = cast.get("personEntityId")
                resolved_person = self._resolve_value(
                    index,
                    f"initial_data.programDetailed[{p_index}].casts[{c_index}].personEntityId",
                    "person",
                    person_value,
                    errors,
                    warnings,
                )
                if resolved_person is not None:
                    cast["personEntityId"] = resolved_person

    def _resolve_in_dict(
        self,
        index: int,
        data: dict[str, Any],
        key: str,
        entity_type: str,
        errors: list[ValidationErrorItem],
        warnings: list[ValidationErrorItem],
    ) -> None:
        if key not in data:
            return
        resolved = self._resolve_value(index, f"initial_data.{key}", entity_type, data.get(key), errors, warnings)
        if resolved is not None:
            data[key] = resolved

    def _resolve_in_list(
        self,
        index: int,
        data: dict[str, Any],
        key: str,
        entity_type: str,
        errors: list[ValidationErrorItem],
        warnings: list[ValidationErrorItem],
    ) -> None:
        values = data.get(key)
        if not isinstance(values, list):
            return
        resolved_list: list[str] = []
        for v_index, value in enumerate(values):
            resolved = self._resolve_value(index, f"initial_data.{key}[{v_index}]", entity_type, value, errors, warnings)
            if resolved is not None:
                resolved_list.append(resolved)
        data[key] = resolved_list

    def _resolve_value(
        self,
        index: int,
        field_path: str,
        entity_type: str,
        value: Any,
        errors: list[ValidationErrorItem],
        warnings: list[ValidationErrorItem],
    ) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            trimmed = value.strip()
            if not trimmed:
                return value
            if is_probable_cuid(trimmed):
                return trimmed
            resolved = self._lookup(entity_type, trimmed)
            if resolved:
                return resolved
            target = errors if self.strict else warnings
            target.append(
                ValidationErrorItem(
                    index=index,
                    field=field_path,
                    message=f"cannot resolve {entity_type} reference: {trimmed}",
                )
            )
            return None if not self.strict else value
        return value

    def _lookup(self, entity_type: str, name: str) -> str | None:
        cache_key = (entity_type, name)
        if cache_key in self.cache:
            return self.cache[cache_key]

        mapped = self._lookup_map(entity_type, name)
        if mapped:
            self.cache[cache_key] = mapped
            return mapped

        cached = self._lookup_cache(entity_type, name)
        if cached:
            self.cache[cache_key] = cached
            return cached

        if "search" in self.mode and self.client:
            resolved = self._lookup_search(entity_type, name)
            if resolved:
                self.cache[cache_key] = resolved
                self._write_cache_entry(entity_type, name, resolved, [])
                return resolved

        return None

    def _lookup_map(self, entity_type: str, name: str) -> str | None:
        if not self.map:
            return None
        type_map = self.map.get(entity_type, {})
        if not isinstance(type_map, dict):
            return None
        return type_map.get(name)

    def _lookup_cache(self, entity_type: str, name: str) -> str | None:
        entry = self.cache_store.get(entity_type, {}).get(name)
        if not isinstance(entry, dict):
            return None
        resolved_id = entry.get("resolvedId")
        if isinstance(resolved_id, str) and resolved_id:
            return resolved_id
        candidates = entry.get("candidates")
        if isinstance(candidates, list):
            resolved = self._resolve_from_candidates(name, candidates)
            if resolved:
                return resolved
        return None

    def _lookup_search(self, entity_type: str, name: str) -> str | None:
        results = self.client.search_entities(name, entity_type)
        return self._resolve_from_candidates(name, results)

    def _resolve_from_candidates(self, name: str, results: list[dict[str, Any]]) -> str | None:
        if not results:
            return None
        exact = [item for item in results if item.get("title") == name]
        if len(exact) == 1 and exact[0].get("id"):
            return exact[0]["id"]
        if len(exact) > 1:
            return None
        if len(results) == 1 and results[0].get("id"):
            return results[0]["id"]
        return None

    def _load_map(self, path: str | None) -> dict[str, dict[str, str]]:
        if not path:
            return {}
        file_path = Path(path)
        if not file_path.exists():
            return {}
        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        if not isinstance(data, dict):
            return {}
        return {k: v for k, v in data.items() if isinstance(v, dict)}

    def _resolve_cache_path(self, cache_dir: str | None) -> Path:
        if cache_dir:
            return Path(cache_dir) / "search_cache.json"
        return Path("bot") / "cache" / "search_cache.json"

    def _load_cache(self, path: Path) -> dict[str, dict[str, dict[str, Any]]]:
        if not path.exists():
            return {}
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        entries = data.get("entries") if isinstance(data, dict) else None
        if not isinstance(entries, dict):
            return {}
        return {k: v for k, v in entries.items() if isinstance(v, dict)}

    def _save_cache(self) -> None:
        if not self.cache_path:
            return
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": 1,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "entries": self.cache_store,
        }
        self.cache_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def _write_cache_entry(self, entity_type: str, name: str, resolved_id: str | None, candidates: list[dict[str, Any]]) -> None:
        bucket = self.cache_store.setdefault(entity_type, {})
        bucket[name] = {
            "resolvedId": resolved_id,
            "candidates": [
                {"id": item.get("id"), "title": item.get("title"), "entityType": item.get("entityType")} for item in candidates
            ],
        }

    def _prefetch_cache(self, items: list[ImportItem]) -> None:
        if not self.client:
            return
        queries: dict[str, set[str]] = {}

        def collect(entity_type: str, value: Any) -> None:
            if not isinstance(value, str):
                return
            trimmed = value.strip()
            if not trimmed or is_probable_cuid(trimmed):
                return
            queries.setdefault(entity_type, set()).add(trimmed)

        for item in items:
            collect("work", item.parent_work_id)
            data = item.initial_data or {}
            collect("city", data.get("cityId"))
            collect("city", data.get("birthCityId"))
            collect("venue", data.get("venueEntityId"))
            collect("troupe", data.get("troupeId"))
            for value in data.get("troupeIds", []) if isinstance(data.get("troupeIds"), list) else []:
                collect("troupe", value)
            collect("work", data.get("workEntityId"))
            for value in data.get("programWorkIds", []) if isinstance(data.get("programWorkIds"), list) else []:
                collect("work", value)
            for value in data.get("programExcerptIds", []) if isinstance(data.get("programExcerptIds"), list) else []:
                collect("work", value)
            for value in data.get("representativeWorkIds", []) if isinstance(data.get("representativeWorkIds"), list) else []:
                collect("work", value)
            for value in data.get("representativeExcerptIds", []) if isinstance(data.get("representativeExcerptIds"), list) else []:
                collect("work", value)

            memberships = data.get("troupeMemberships")
            if isinstance(memberships, list):
                for membership in memberships:
                    if isinstance(membership, dict):
                        collect("troupe", membership.get("troupeEntityId"))

            program = data.get("programDetailed")
            if isinstance(program, list):
                for program_item in program:
                    if not isinstance(program_item, dict):
                        continue
                    collect("work", program_item.get("workEntityId"))
                    casts = program_item.get("casts")
                    if isinstance(casts, list):
                        for cast in casts:
                            if isinstance(cast, dict):
                                collect("role", cast.get("roleEntityId"))
                                collect("person", cast.get("personEntityId"))

        for entity_type, names in queries.items():
            for name in names:
                if entity_type in self.map and isinstance(self.map.get(entity_type), dict) and name in self.map[entity_type]:
                    continue
                if name in self.cache_store.get(entity_type, {}):
                    continue
                results = self.client.search_entities(name, entity_type)
                resolved_id = self._resolve_from_candidates(name, results)
                self._write_cache_entry(entity_type, name, resolved_id, results)

        self._save_cache()
