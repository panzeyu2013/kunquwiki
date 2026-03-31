from __future__ import annotations

import time
from typing import Callable, Iterable, TypeVar


T = TypeVar("T")


def with_retry(
    func: Callable[[], T],
    retries: int,
    backoff_seconds: float = 0.5,
    retry_on: Iterable[type[Exception]] = (Exception,),
) -> T:
    attempt = 0
    while True:
        try:
            return func()
        except tuple(retry_on):
            if attempt >= retries:
                raise
            attempt += 1
            time.sleep(backoff_seconds * attempt)


__all__ = ["with_retry"]
