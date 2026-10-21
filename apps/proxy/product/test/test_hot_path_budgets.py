"""Rendered budget admission is independent of native imports and listeners."""
import hashlib
import io
import json
import unittest
from unittest.mock import patch
from apps.proxy.product import main
from apps.proxy.product.budgets import load_hot_path_budgets
from apps.proxy.product.test.budget_fixture import budget_data
from apps.proxy.product.test.test_startup_config import configuration, parse


class HotPathBudgetTests(unittest.TestCase):
    def test_missing_or_invalid_table_refuses_before_native_construction(self):
        for change in (lambda value: value.pop("budgets"),
                       lambda value: value["budgets"].update(version="unknown"),
                       lambda value: value["budgets"]["hops"].pop("proxy.bootstrap")):
            value = configuration()
            change(value)
            with patch("apps.proxy.product.main._native_bootstrap") as native:
                with self.assertRaisesRegex(Exception, "^HOT_PATH_BUDGET_CONFIGURATION$"):
                    parse(value)
                native.assert_not_called()
                raw = json.dumps(value).encode()
                with patch.object(main, "_environment"), patch.object(main, "read_reviewed_file", return_value=raw), \
                     patch.object(main.sys, "stderr", io.StringIO()) as stderr:
                    self.assertEqual(main.main(["--config", "/run/meri/proxy.json", "--config-sha256",
                                               hashlib.sha256(raw).hexdigest()]), 78)
                    self.assertEqual(stderr.getvalue(), "HOT_PATH_BUDGET_CONFIGURATION\n")
                native.assert_not_called()

    def test_nested_serial_and_background_edges_are_reasserted(self):
        for kind in ("nested", "serial", "background"):
            value = budget_data()
            if kind == "nested":
                value["hops"]["runner.call.load"]["ms"] = value["roots"]["request"]["ms"] - 1999
            elif kind == "serial":
                value["hops"]["runner.stage.local"]["ms"] = value["hops"]["runtime.preparation"]["ms"] - 1999
            else:
                value["hops"]["test.background"] = {"kind": kind, "ms": 1000, "periodMs": 1000, "expiryMs": 1999}
            with self.subTest(kind=kind), self.assertRaisesRegex(Exception, "^HOT_PATH_BUDGET_CONFIGURATION$"):
                load_hot_path_budgets(value)

    def test_rendered_margin_cannot_weaken_the_nesting_policy(self):
        value = budget_data()
        value["hops"]["budget.margin"]["ms"] = 1
        value["hops"]["runner.call.load"]["ms"] = value["roots"]["request"]["ms"] - 1
        with self.assertRaisesRegex(Exception, "^HOT_PATH_BUDGET_CONFIGURATION$"):
            load_hot_path_budgets(value)

    def test_independent_and_derived_budgets_require_reviewed_metadata(self):
        value = budget_data()
        value["hops"]["test.terminal"] = {"kind": "independent", "ms": 60000,
            "owner": "request teardown", "reason": "Cleanup starts after the request ends."}
        self.assertEqual(load_hot_path_budgets(value).ms("test.terminal"), 60000)
        for key in ("owner", "reason"):
            invalid = json.loads(json.dumps(value))
            invalid["hops"]["test.terminal"].pop(key)
            with self.subTest(key=key), self.assertRaisesRegex(Exception, "^HOT_PATH_BUDGET_CONFIGURATION$"):
                load_hot_path_budgets(invalid)

        value["hops"]["test.derived"] = {"kind": "derived", "ms": 1000,
            "reason": "A threshold used to validate another allowance."}
        self.assertEqual(load_hot_path_budgets(value).ms("test.derived"), 1000)
        value["hops"]["test.derived"].pop("reason")
        with self.assertRaisesRegex(Exception, "^HOT_PATH_BUDGET_CONFIGURATION$"):
            load_hot_path_budgets(value)

    def test_unbounded_library_requires_an_owner_and_keeps_uvicorn_none(self):
        value = budget_data()
        self.assertIsNone(load_hot_path_budgets(value).seconds("proxy.uvicorn.shutdown"))
        value["hops"]["proxy.uvicorn.shutdown"].pop("boundedBy")
        with self.assertRaisesRegex(Exception, "^HOT_PATH_BUDGET_CONFIGURATION$"):
            load_hot_path_budgets(value)


if __name__ == "__main__":
    unittest.main()
