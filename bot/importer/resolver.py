from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from difflib import SequenceMatcher
from typing import Any

from bot.client.api_client import BotApiClient
from bot.models.payload import ImportItem
from bot.models.result import ValidationErrorItem


CUID_RE = re.compile(r"^c[a-z0-9]{24}$")
CORE_TOKENS = [
    "剧场",
    "剧院",
    "剧团",
    "剧社",
    "昆剧院",
    "艺术中心",
    "文化中心",
    "大剧院",
    "音乐厅",
    "会馆",
    "戏曲馆",
    "舞台",
    "戏台",
]


def is_probable_cuid(value: str) -> bool:
    return bool(CUID_RE.match(value))


@dataclass
class ResolverConfig:
    mode: str
    map_path: str | None = None
    alias_path: str | None = None
    cache_dir: str | None = None
    strict: bool = True
    fuzzy: bool = True
    fuzzy_threshold: float = 0.92
    fuzzy_gap: float = 0.08
    fuzzy_warn: float = 0.85


class ReferenceResolver:
    def __init__(self, client: BotApiClient | None, config: ResolverConfig) -> None:
        self.client = client
        self.mode = config.mode
        self.map = self._load_map(config.map_path)
        self.alias_map = self._load_map(config.alias_path)
        self.cache_path = self._resolve_cache_path(config.cache_dir)
        self.cache_store = self._load_cache(self.cache_path)
        self.cache: dict[tuple[str, str], str] = {}
        self.strict = config.strict
        self.fuzzy = config.fuzzy
        self.fuzzy_threshold = config.fuzzy_threshold
        self.fuzzy_gap = config.fuzzy_gap
        self.fuzzy_warn = config.fuzzy_warn

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
            lookup = self._lookup(entity_type, trimmed)
            if lookup["resolved_id"]:
                return lookup["resolved_id"]
            target = errors if self.strict else warnings
            detail = self._format_candidate_message(trimmed, lookup.get("candidates", []), lookup.get("scores"))
            target.append(ValidationErrorItem(index=index, field=field_path, message=detail))
            return None if not self.strict else value
        return value

    def _lookup(self, entity_type: str, name: str) -> dict[str, Any]:
        cache_key = (entity_type, name)
        if cache_key in self.cache:
            return {"resolved_id": self.cache[cache_key], "candidates": [], "scores": []}

        canonical = self._canonical_name(entity_type, name)
        mapped = self._lookup_map(entity_type, canonical)
        if mapped:
            self.cache[cache_key] = mapped
            return {"resolved_id": mapped, "candidates": [], "scores": []}

        cached = self._lookup_cache(entity_type, canonical)
        if cached["resolved_id"]:
            self.cache[cache_key] = cached["resolved_id"]
            return cached

        if "search" in self.mode and self.client:
            searched = self._lookup_search(entity_type, canonical)
            if searched["resolved_id"]:
                self.cache[cache_key] = searched["resolved_id"]
            return searched

        return {"resolved_id": None, "candidates": [], "scores": []}

    def _lookup_map(self, entity_type: str, name: str) -> str | None:
        if not self.map:
            return None
        type_map = self.map.get(entity_type, {})
        if not isinstance(type_map, dict):
            return None
        return type_map.get(name)

    def _lookup_cache(self, entity_type: str, name: str) -> dict[str, Any]:
        entry = self.cache_store.get(entity_type, {}).get(name)
        if not isinstance(entry, dict):
            return {"resolved_id": None, "candidates": [], "scores": []}
        resolved_id = entry.get("resolvedId")
        candidates = entry.get("candidates")
        if isinstance(candidates, list):
            resolved_id, scores = self._resolve_from_candidates(entity_type, name, candidates)
            return {"resolved_id": resolved_id, "candidates": candidates, "scores": scores}
        if isinstance(resolved_id, str) and resolved_id and self.fuzzy:
            return {"resolved_id": resolved_id, "candidates": [], "scores": []}
        return {"resolved_id": None, "candidates": [], "scores": []}

    def _lookup_search(self, entity_type: str, name: str) -> dict[str, Any]:
        results = self.client.search_entities(name, entity_type)
        resolved_id, scores = self._resolve_from_candidates(entity_type, name, results)
        self._write_cache_entry(entity_type, name, resolved_id, results)
        return {"resolved_id": resolved_id, "candidates": results, "scores": scores}

    def _resolve_from_candidates(
        self, entity_type: str, name: str, results: list[dict[str, Any]]
    ) -> tuple[str | None, list[dict[str, Any]]]:
        if not results:
            return None, []
        scored = self._rank_candidates(entity_type, name, results)
        if not scored:
            return None, []
        scored_sorted = sorted(scored, key=lambda item: item["score"], reverse=True)
        top = scored_sorted[0]
        second = scored_sorted[1]["score"] if len(scored_sorted) > 1 else 0.0
        if not self.fuzzy:
            return (top["id"], scored_sorted) if top["score"] == 1.0 else (None, scored_sorted)
        if top["score"] >= self.fuzzy_threshold and (top["score"] - second) >= self.fuzzy_gap:
            return top["id"], scored_sorted
        return None, scored_sorted

    def _rank_candidates(self, entity_type: str, name: str, results: list[dict[str, Any]]) -> list[dict[str, Any]]:
        scored: list[dict[str, Any]] = []
        query_variants = self._expand_query_variants(entity_type, name)
        for item in results:
            title = item.get("title")
            entity_id = item.get("id")
            candidate_type = item.get("entityType")
            if not isinstance(title, str) or not isinstance(entity_id, str):
                continue
            type_for_candidate = candidate_type if isinstance(candidate_type, str) else entity_type
            candidate_variants = self._expand_query_variants(type_for_candidate, title)
            score = self._score_variants(query_variants, candidate_variants)
            scored.append({"id": entity_id, "title": title, "score": score})
        return scored

    def _score_variants(self, query_variants: set[str], candidate_variants: set[str]) -> float:
        best = 0.0
        for q in query_variants:
            for c in candidate_variants:
                if q == c:
                    return 1.0
                ratio = SequenceMatcher(None, q, c).ratio()
                if ratio > best:
                    best = ratio
        return best

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

    def _canonical_name(self, entity_type: str, name: str) -> str:
        if not self.alias_map:
            return name
        type_map = self.alias_map.get(entity_type, {})
        if isinstance(type_map, dict) and name in type_map:
            return type_map[name]
        return name

    def _expand_query_variants(self, entity_type: str, name: str) -> set[str]:
        canonical = self._canonical_name(entity_type, name)
        variants = set(self._generate_variants(canonical))
        if canonical != name:
            variants.update(self._generate_variants(name))
        return variants

    def _generate_variants(self, name: str) -> set[str]:
        base = self._normalize_name(name)
        variants = {base} if base else set()
        if base and len(base) >= 5:
            for n in (2, 3, 4):
                if len(base) - n >= 2:
                    candidate = base[n:]
                    if any(token in candidate for token in CORE_TOKENS):
                        variants.add(candidate)
        return variants

    def _normalize_name(self, name: str) -> str:
        normalized = re.sub(r"[\s·・•\\-—_（）()【】\\[\\]{}<>《》「」『』]", "", name)
        return normalized.strip()

    def _format_candidate_message(self, name: str, candidates: list[dict[str, Any]], scores: list[dict[str, Any]] | None) -> str:
        if not candidates:
            return f"cannot resolve reference: {name}"
        if not scores:
            return f"cannot resolve reference: {name}; candidates={len(candidates)}"
        top = [f"{item['title']}({item['id']}, {item['score']:.2f})" for item in scores[:3]]
        best_score = scores[0]["score"] if scores else 0.0
        note = "near_match" if best_score >= self.fuzzy_warn else "low_confidence"
        return f"cannot resolve reference: {name}; best_score={best_score:.2f}; {note}; top_candidates={', '.join(top)}"

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
                canonical = self._canonical_name(entity_type, name)
                if entity_type in self.map and isinstance(self.map.get(entity_type), dict) and canonical in self.map[entity_type]:
                    continue
                if canonical in self.cache_store.get(entity_type, {}):
                    continue
                results = self.client.search_entities(canonical, entity_type)
                resolved_id, scores = self._resolve_from_candidates(entity_type, canonical, results)
                self._write_cache_entry(entity_type, canonical, resolved_id, results)

        self._save_cache()
