"""Validate the canonical table delivered in reviewed proxy startup material.

No timing values originate here. The JavaScript table is rendered as data;
Python checks its edges before native imports, clients or a listener exist.
"""
import copy
from ..qualification.state.pricing import StateDenied

VERSION = "meri.hot-path-budgets/1"
_REQUIRED = frozenset((
    "proxy.exchange.max", "proxy.exchange.min", "proxy.exchange.carrier",
    "proxy.request.check", "proxy.request.cleanup", "proxy.request.poll",
    "proxy.bootstrap", "proxy.connection", "proxy.pair.fetch", "proxy.pair.lease",
    "proxy.boto.connect", "proxy.boto.read", "proxy.boto.attempts",
    "proxy.uvicorn.keepAlive", "proxy.uvicorn.shutdown", "proxy.native.start",
    "proxy.native.stop", "proxy.resources.close", "proxy.owner.settle",
    "proxy.startup.pair.window", "proxy.startup.pair.retry",
    "proxy.diagnostics.burst", "proxy.diagnostics.window"))


def _deny():
    raise StateDenied("HOT_PATH_BUDGET_CONFIGURATION")


def _number(value):
    return type(value) is int and 0 <= value <= 9007199254740991


class HotPathBudgets:
    def __init__(self, value):
        if (type(value) is not dict or value.get("version") != VERSION
                or type(value.get("roots")) is not dict or type(value.get("hops")) is not dict
                or not _REQUIRED <= value["hops"].keys()):
            _deny()
        self._value = copy.deepcopy(value)
        hops = self._value["hops"]
        for root in ("turn", "startup", "shutdown", "request", "original"):
            row = self._value["roots"].get(root)
            if type(row) is not dict or not _number(row.get("ms")) or row["ms"] <= 0:
                _deny()
        # Schema invariant: rendered data cannot weaken the required two-second nesting policy.
        if not _number(self._margin()) or self._margin() != 2000:
            _deny()
        values_by_id = {**self._value["roots"], **hops}
        for hop, row in hops.items():
            if type(hop) is not str or type(row) is not dict or row.get("kind") not in ("nested", "serial", "background", "derived", "library", "independent"):
                _deny()
            if row.get("parent") is not None and row["parent"] not in values_by_id:
                _deny()
            if row.get("unbounded") is True:
                if type(row.get("reason")) is not str or not row["reason"].strip() or row.get("boundedBy") not in values_by_id:
                    _deny()
            values = row.get("ms") if type(row.get("ms")) is list else [row.get("ms")]
            if not all(_number(value) for value in values):
                _deny()
            if row["kind"] == "derived":
                if type(row.get("reason")) is not str or not row["reason"].strip():
                    _deny()
            if row["kind"] == "independent":
                if (not _number(row["ms"]) or row["ms"] <= 0
                        or type(row.get("owner")) is not str or not row["owner"].strip()
                        or type(row.get("reason")) is not str or not row["reason"].strip()):
                    _deny()
            if row["kind"] == "nested":
                parent = hops.get(row.get("parent"), self._value["roots"].get(row.get("parent")))
                if parent is None or not _number(parent.get("ms")) or row["ms"] > parent["ms"] - self._margin():
                    _deny()
            if row["kind"] == "serial":
                if type(row.get("children")) is not list or not row["children"]:
                    _deny()
                for child in row["children"]:
                    if child not in hops or hops[child]["ms"] > row["ms"] - self._margin():
                        _deny()
            if row["kind"] == "background":
                period = values_by_id.get(row.get("period"), {}).get("ms", row.get("periodMs"))
                expiry = values_by_id.get(row.get("expiry"), {}).get("ms", row.get("expiryMs"))
                if not _number(period) or period <= 0 or not _number(expiry) or expiry < 2 * period:
                    _deny()
        for hop in _REQUIRED:
            self.ms(hop)

    def _margin(self):
        # Read the table field after pinning its schema invariant during admission.
        try:
            return self._value["hops"]["budget.margin"]["ms"]
        except (KeyError, TypeError):
            _deny()

    def ms(self, hop):
        try:
            row = self._value["hops"][hop]
        except (KeyError, TypeError):
            _deny()
        if row.get("unbounded") is True:
            return None
        value = row.get("ms")
        if not _number(value):
            _deny()
        return value

    def seconds(self, hop):
        value = self.ms(hop)
        if value is None:
            return None
        return value // 1000 if value % 1000 == 0 else value / 1000

    @property
    def value(self):
        return copy.deepcopy(self._value)


def load_hot_path_budgets(value):
    try:
        return HotPathBudgets(value)
    except StateDenied:
        raise
    except (TypeError, ValueError, KeyError, OverflowError):
        _deny()
