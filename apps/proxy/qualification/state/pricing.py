"""Integer microUSD arithmetic for the one admitted small native envelope."""
from dataclasses import dataclass
from datetime import datetime, timezone
import re

CAP_MICRO_USD = 10_000_000
PRICING_REVISION = "b21cfc4941e346275d9503700a094dc892f838172c41bc2e14c8284d91b1677a"
INPUT_RATE = 3300
RESERVE_INPUT_RATE = 6600
OUTPUT_RATE = 16500
HASH = re.compile(r"[0-9a-f]{64}\Z")


class StateDenied(ValueError):
    """Fixed reasons only; no connection strings, capabilities or request bodies."""


def digest(value):
    if type(value) is not str or not HASH.fullmatch(value):
        raise StateDenied("INVALID_DIGEST")
    return value


def utc(value):
    if type(value) is not datetime or value.tzinfo is None or value.utcoffset() is None:
        raise StateDenied("AWARE_TIME_REQUIRED")
    return value.astimezone(timezone.utc)


def tokens(value, maximum):
    if type(value) is not int or not 0 <= value <= maximum:
        raise StateDenied("INVALID_TOKEN_COUNT")
    return value


def liability(input_tokens, output_tokens, *, reserve=False):
    tokens(input_tokens, 8192 if reserve else 2**31-1)
    tokens(output_tokens, 256 if reserve else 2**31-1)
    if reserve and (input_tokens == 0 or output_tokens == 0):
        raise StateDenied("EMPTY_TOKEN_BOUND")
    rate = RESERVE_INPUT_RATE if reserve else INPUT_RATE
    return (rate * input_tokens + OUTPUT_RATE * output_tokens + 999) // 1000


@dataclass(frozen=True)
class Pricing:
    valid_until: datetime
    revision: str = PRICING_REVISION

    def __post_init__(self):
        utc(self.valid_until)
        if self.revision != PRICING_REVISION:
            raise StateDenied("UNQUALIFIED_PRICING")
