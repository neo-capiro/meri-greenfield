"""Immutable qualification migration history, retained after model proxy retirement."""
from pathlib import Path
import unittest


class ToolBudgetSourceTests(unittest.TestCase):
    def test_migration_preserves_domain_identity(self):
        root = Path(__file__).resolve().parents[4]
        sql = (root / 'apps/proxy/qualification/state/migrations/0002_tool_budget.sql').read_text()
        self.assertIn("'model'::text AS kind", sql)
        self.assertIn("'tool'::text AS kind", sql)
        self.assertIn('charged_micro_usd', sql)


if __name__ == '__main__':
    unittest.main()
