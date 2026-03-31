from __future__ import annotations

from typing import Any

import requests
from requests import Response

from bot.utils.retry import with_retry


class BotApiClient:
    def __init__(self, base_url: str, token: str, timeout: int, retry_count: int) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout
        self.retry_count = retry_count

    def import_batch(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._post("/api/bot/import", payload)

    def run_check(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._post("/api/bot/check", payload)

    def health(self) -> dict[str, Any]:
        return self._get("/api/bot/check/health")

    def _headers(self) -> dict[str, str]:
        return {"X-Bot-Token": self.token, "Content-Type": "application/json"}

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}{path}"

        def send() -> Response:
            response = requests.post(url, json=payload, headers=self._headers(), timeout=self.timeout)
            if response.status_code >= 500:
                response.raise_for_status()
            return response

        response = with_retry(send, retries=self.retry_count, retry_on=(requests.RequestException,))
        return response.json()

    def _get(self, path: str) -> dict[str, Any]:
        url = f"{self.base_url}{path}"

        def send() -> Response:
            response = requests.get(url, headers=self._headers(), timeout=self.timeout)
            if response.status_code >= 500:
                response.raise_for_status()
            return response

        response = with_retry(send, retries=self.retry_count, retry_on=(requests.RequestException,))
        return response.json()
