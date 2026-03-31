from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class BotConfig:
    base_url: str
    token: str
    timeout: int
    batch_size: int
    retry_count: int


def load_config(env_file: str | None = None) -> BotConfig:
    if env_file:
        load_dotenv(env_file)
    else:
        load_dotenv()

    base_url = os.getenv("BOT_BACKEND_BASE_URL", "http://localhost:4000").rstrip("/")
    token = os.getenv("BOT_API_TOKEN", "")
    timeout = int(os.getenv("BOT_TIMEOUT", "15"))
    batch_size = int(os.getenv("BOT_BATCH_SIZE", "20"))
    retry_count = int(os.getenv("BOT_RETRY_COUNT", "2"))

    if not token:
        raise ValueError("BOT_API_TOKEN is required")

    return BotConfig(
        base_url=base_url,
        token=token,
        timeout=timeout,
        batch_size=batch_size,
        retry_count=retry_count,
    )
