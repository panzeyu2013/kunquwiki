from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from bot.checks.business_check import run_business_check, run_business_check_items
from bot.checks.health_check import run_health_check
from bot.checks.schema_check import run_schema_check
from bot.client.api_client import BotApiClient
from bot.config import load_config
from bot.importer.json_loader import JsonLoadError, load_json_file
from bot.importer.resolver import ReferenceResolver, ResolverConfig
from bot.importer.submitter import submit_batches
from bot.importer.validator import validate_payload
from bot.models.payload import ImportOptions
from bot.utils.logger import setup_logger


logger = setup_logger()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="KunquWiki Bot")
    parser.add_argument("--env", help="Path to .env file", default=None)

    subparsers = parser.add_subparsers(dest="command", required=True)

    import_parser = subparsers.add_parser("import", help="Import JSON items")
    import_parser.add_argument("--file", required=True, help="Path to JSON file")
    import_parser.add_argument("--commit", action="store_true", help="Write to backend (default is dry-run)")
    import_parser.add_argument("--dry-run", action="store_true", help="Validate only, no write (default)")
    import_parser.add_argument("--batch-size", type=int, default=None, help="Override batch size")
    import_parser.add_argument("--no-upsert", action="store_true", help="Fail on duplicate title")
    import_parser.add_argument("--resolve", action="store_true", help="Resolve name references to entity IDs")
    import_parser.add_argument("--resolve-mode", choices=["map", "search", "map+search"], default="map+search")
    import_parser.add_argument("--map-file", help="Path to entity mapping JSON", default=None)
    import_parser.add_argument("--cache-dir", help="Directory for search cache JSON", default=None)
    import_parser.add_argument("--alias-file", help="Path to entity alias JSON", default=None)
    import_parser.add_argument("--no-fuzzy", action="store_true", help="Disable fuzzy matching")
    import_parser.add_argument("--fuzzy-threshold", type=float, default=0.92, help="Auto-resolve score threshold")
    import_parser.add_argument("--fuzzy-gap", type=float, default=0.08, help="Min score gap between top candidates")
    import_parser.add_argument("--fuzzy-warn", type=float, default=0.85, help="Warn threshold for fuzzy matches")

    check_parser = subparsers.add_parser("check", help="Run checks")
    check_parser.add_argument("--type", required=True, choices=["schema", "business", "health"], help="Check type")
    check_parser.add_argument("--file", help="Path to JSON file")
    check_parser.add_argument("--resolve", action="store_true", help="Resolve name references to entity IDs")
    check_parser.add_argument("--resolve-mode", choices=["map", "search", "map+search"], default="map+search")
    check_parser.add_argument("--map-file", help="Path to entity mapping JSON", default=None)
    check_parser.add_argument("--cache-dir", help="Directory for search cache JSON", default=None)
    check_parser.add_argument("--alias-file", help="Path to entity alias JSON", default=None)
    check_parser.add_argument("--no-fuzzy", action="store_true", help="Disable fuzzy matching")
    check_parser.add_argument("--fuzzy-threshold", type=float, default=0.92, help="Auto-resolve score threshold")
    check_parser.add_argument("--fuzzy-gap", type=float, default=0.08, help="Min score gap between top candidates")
    check_parser.add_argument("--fuzzy-warn", type=float, default=0.85, help="Warn threshold for fuzzy matches")

    return parser.parse_args()


def render_json(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def run_import(args: argparse.Namespace) -> int:
    try:
        data = load_json_file(args.file)
    except (FileNotFoundError, JsonLoadError) as error:
        logger.error(str(error))
        return 1

    items, errors = validate_payload(data)
    if errors:
        logger.error("Local validation failed")
        render_json({"errors": [error.__dict__ for error in errors]})
        return 1

    config = load_config(args.env)
    client = BotApiClient(config.base_url, config.token, config.timeout, config.retry_count)
    batch_size = args.batch_size or config.batch_size
    dry_run = not args.commit
    options = ImportOptions(dry_run=dry_run, upsert=not args.no_upsert)

    if args.resolve:
        resolver = ReferenceResolver(
            client,
            ResolverConfig(
                mode=args.resolve_mode,
                map_path=args.map_file,
                alias_path=args.alias_file,
                cache_dir=args.cache_dir,
                strict=not dry_run,
                fuzzy=not args.no_fuzzy,
                fuzzy_threshold=args.fuzzy_threshold,
                fuzzy_gap=args.fuzzy_gap,
                fuzzy_warn=args.fuzzy_warn,
            ),
        )
        resolve_errors, resolve_warnings = resolver.resolve_items(items)
        if resolve_errors:
            logger.error("Reference resolution failed")
            render_json({"errors": [error.__dict__ for error in resolve_errors]})
            return 1
    else:
        resolve_warnings = []

    if dry_run:
        result = run_business_check_items(client, items, [])
        warnings = result.get("warnings", [])
        warnings.extend([warning.__dict__ for warning in resolve_warnings])
        result["warnings"] = warnings
        result["mode"] = "dry_run"
        render_json(result)
        return 0 if result.get("passed", False) else 1

    logger.info("Submitting import batches")
    results = submit_batches(client, items, options, batch_size)
    summary = {
        "total": len(items),
        "success_count": len([item for item in results if item.get("success")]),
        "failed_count": len([item for item in results if not item.get("success")]),
    }
    render_json({"summary": summary, "results": results})
    return 0


def run_check(args: argparse.Namespace) -> int:
    config = load_config(args.env)
    client = BotApiClient(config.base_url, config.token, config.timeout, config.retry_count)

    if args.type == "health":
        result = run_health_check(client)
        render_json(result)
        return 0

    if not args.file:
        logger.error("--file is required for schema/business checks")
        return 1

    try:
        data = load_json_file(args.file)
    except (FileNotFoundError, JsonLoadError) as error:
        logger.error(str(error))
        return 1

    if args.type == "schema":
        result = run_schema_check(data)
    else:
        if args.resolve:
            items, errors = validate_payload(data)
            if errors:
                result = {
                    "check_type": "business",
                    "passed": False,
                    "errors": [error.__dict__ for error in errors],
                    "warnings": [],
                    "stats": {"total": len(items), "error_count": len(errors), "warning_count": 0},
                }
            else:
                resolver = ReferenceResolver(
                    client,
                    ResolverConfig(
                        mode=args.resolve_mode,
                        map_path=args.map_file,
                        alias_path=args.alias_file,
                        cache_dir=args.cache_dir,
                        strict=False,
                        fuzzy=not args.no_fuzzy,
                        fuzzy_threshold=args.fuzzy_threshold,
                        fuzzy_gap=args.fuzzy_gap,
                        fuzzy_warn=args.fuzzy_warn,
                    ),
                )
                resolve_errors, resolve_warnings = resolver.resolve_items(items)
                result = run_business_check_items(client, items, resolve_errors)
                warnings = result.get("warnings", [])
                warnings.extend([warning.__dict__ for warning in resolve_warnings])
                result["warnings"] = warnings
        else:
            result = run_business_check(client, data)

    render_json(result)
    return 0 if result.get("passed", False) else 1


def main() -> int:
    args = parse_args()
    if args.command == "import":
        return run_import(args)
    if args.command == "check":
        return run_check(args)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
