"""Canonical stdlib-only product execution binding validation; no authority."""
import re
from ..qualification.state.pricing import StateDenied

_UUID = re.compile(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\Z", re.IGNORECASE)


def _deny():
    raise StateDenied("PRODUCT_HOST_OBSERVATION_REFUSED")


def _binding(value):
    if type(value) is not dict or set(value) != {"tenantId", "actorId", "conversationId",
                                                 "runId", "attemptId", "workerId", "writerFence"}:
        _deny()
    for name in ("tenantId", "actorId"):
        item = value[name]
        if type(item) is not str or not 1 <= len(item) <= 128:
            _deny()
        try:
            if len(item.encode("utf-8", "strict")) > 512:
                _deny()
        except UnicodeError:
            _deny()
    for name in ("conversationId", "runId", "attemptId", "workerId"):
        if type(value[name]) is not str or not _UUID.fullmatch(value[name]):
            _deny()
    if type(value["writerFence"]) is not int or not 1 <= value["writerFence"] <= 9007199254740991:
        _deny()
    return value.copy()
