"""Offline AST guard for product budget defaults and library construction.

MERI_BUDGET_SOURCE_ROOT permits the same guard to demonstrate failure on the
reviewed base without copying tests into or modifying that checkout.
"""
import ast
import json
import os
from pathlib import Path
import re
import unittest

REPOSITORY = Path(__file__).resolve().parents[4]
ROOT = Path(os.environ.get("MERI_BUDGET_SOURCE_ROOT", REPOSITORY))
ALLOWLIST = json.loads((REPOSITORY / "packages/runtime/test/budget-literal-allowlist.json").read_text())
BUDGET_NAME = re.compile(r"(?:^timeout$|_(?:seconds|timeout|ms)$|_(?:SECONDS|TIMEOUT|MS)$)")


def numeric(node):
    return isinstance(node, ast.Constant) and type(node.value) in (int, float)


def callee(node):
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return callee(node.value) + "." + node.attr
    return ""


def source_tree(relative):
    source = (ROOT / relative).read_text()
    return source, ast.parse(source, filename=str(relative))


def hop(call, expected):
    return (isinstance(call, ast.Call)
            and callee(call.func).endswith((".seconds", ".ms"))
            and len(call.args) == 1
            and isinstance(call.args[0], ast.Constant)
            and call.args[0].value == expected)


class NoDefaultBudgetTests(unittest.TestCase):
    def test_product_has_no_numeric_budget_defaults_or_literals(self):
        failures = []
        for file in sorted((ROOT / "apps/proxy/product").rglob("*.py")):
            relative = file.relative_to(ROOT).as_posix()
            if "test" in file.parts or file.name.startswith("test_"):
                continue
            source, tree = source_tree(relative)
            for node in ast.walk(tree):
                candidates = []
                if isinstance(node, (ast.Assign, ast.AnnAssign)):
                    targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                    candidates += [(target.id, node.value) for target in targets if isinstance(target, ast.Name)]
                elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    positional = node.args.posonlyargs + node.args.args
                    candidates += [(arg.arg, value) for arg, value in zip(positional[-len(node.args.defaults):], node.args.defaults)]
                    candidates += [(arg.arg, value) for arg, value in zip(node.args.kwonlyargs, node.args.kw_defaults) if value is not None]
                elif isinstance(node, ast.Call):
                    candidates += [(kw.arg, kw.value) for kw in node.keywords if kw.arg]
                for name, value in candidates:
                    if not BUDGET_NAME.search(name) or not numeric(value):
                        continue
                    line = source.splitlines()[value.lineno - 1].strip()
                    approved = any(entry["file"] == relative and entry["field"] == name and entry["site"] == line
                                   for entry in ALLOWLIST)
                    if not approved:
                        failures.append(f"{relative}:{value.lineno} {name}={value.value}")
        self.assertEqual(failures, [], "\n".join(failures))

    def test_product_library_timeouts_are_explicit_table_hops(self):
        specifications = [
            ("apps/proxy/product/main.py", "config_type", "region_name", {
                "connect_timeout": "proxy.boto.connect", "read_timeout": "proxy.boto.read"}),
            ("apps/proxy/product/uvicorn_tls_protocol.py", "config_type", "app", {
                "timeout_keep_alive": "proxy.uvicorn.keepAlive", "timeout_graceful_shutdown": "proxy.uvicorn.shutdown"}),
            ("apps/proxy/product/host_composition.py", "LifetimeLimits", "poll_seconds", {
                "poll_seconds": "proxy.request.poll", "check_seconds": "proxy.request.check",
                "cleanup_seconds": "proxy.request.cleanup"}),
        ]
        for file, name, discriminator, expected in specifications:
            _, tree = source_tree(file)
            calls = [node for node in ast.walk(tree) if isinstance(node, ast.Call) and callee(node.func) == name
                     and any(kw.arg == discriminator for kw in node.keywords)]
            with self.subTest(file=file, constructor=name):
                self.assertEqual(len(calls), 1, "expected exactly one reviewed library construction")
                actual = {kw.arg: kw.value for kw in calls[0].keywords}
                for field, identifier in expected.items():
                    self.assertIn(field, actual)
                    self.assertTrue(hop(actual[field], identifier), f"{file}: {field} must receive {identifier}")

    def test_service_pair_caps_are_required_and_root_passes_table_hops(self):
        file = "apps/proxy/product/service_pair_discovery.py"
        _, tree = source_tree(file)
        classes = [node for node in ast.walk(tree) if isinstance(node, ast.ClassDef) and node.name == "ProductServicePairDiscovery"]
        self.assertEqual(len(classes), 1)
        constructor = next(node for node in classes[0].body if isinstance(node, ast.FunctionDef) and node.name == "__init__")
        defaults = dict(zip((arg.arg for arg in constructor.args.kwonlyargs), constructor.args.kw_defaults))
        for field in ("max_request_ms", "max_lease_ms"):
            self.assertIn(field, defaults)
            self.assertIsNone(defaults[field], f"{field} must be required")
        _, root = source_tree("apps/proxy/product/main.py")
        calls = [node for node in ast.walk(root) if isinstance(node, ast.Call) and callee(node.func) == "ProductServicePairDiscovery"]
        self.assertEqual(len(calls), 1)
        supplied = {kw.arg: kw.value for kw in calls[0].keywords}
        for field, identifier in (("max_request_ms", "proxy.pair.fetch"), ("max_lease_ms", "proxy.pair.lease")):
            self.assertIn(field, supplied)
            self.assertTrue(hop(supplied[field], identifier), f"{field} must receive {identifier}")


if __name__ == "__main__":
    unittest.main()
