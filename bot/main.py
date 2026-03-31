from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from bot.checks.business_check import run_business_check
from bot.checks.health_check import run_health_check
from bot.checks.schema_check import run_schema_check
from bot.client.api_client import BotApiClient
from bot.config import load_config
from bot.importer.json_loader import JsonLoadError, load_json_file
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
    import_parser.add_argument("--dry-run", action="store_true", help="Validate only, no write")
    import_parser.add_argument("--batch-size", type=int, default=None, help="Override batch size")
    import_parser.add_argument("--no-upsert", action="store_true", help="Fail on duplicate title")

    check_parser = subparsers.add_parser("check", help="Run checks")
    check_parser.add_argument("--type", required=True, choices=["schema", "business", "health"], help="Check type")
    check_parser.add_argument("--file", help="Path to JSON file")

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
    options = ImportOptions(dry_run=args.dry_run, upsert=not args.no_upsert)

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
