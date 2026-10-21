"""Production-shaped reviewed test data; the render cross-language test checks it."""
import json
from pathlib import Path
from apps.proxy.product.budgets import load_hot_path_budgets
from apps.proxy.qualification.runtime.lifetime import LifetimeLimits


def budget_data():
    return json.loads(Path(__file__).with_name("budget-fixture.json").read_text())


def budget_fixture(**changes):
    value = budget_data()
    for hop, ms in changes.items():
        value["hops"][hop]["ms"] = ms
    return load_hot_path_budgets(value)


TEST_BUDGETS = budget_fixture()
TEST_LIFETIME_LIMITS = LifetimeLimits(poll_seconds=5, check_seconds=26, cleanup_seconds=26)
