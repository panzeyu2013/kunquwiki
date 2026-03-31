from __future__ import annotations

from bot.client.api_client import BotApiClient


def run_health_check(client: BotApiClient) -> dict[str, str]:
    return client.health()
