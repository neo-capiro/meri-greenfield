import json
from pathlib import Path
import tempfile
import unittest

from evidence import comparison, decode_output
from verify import fixture_paths


class EvidenceTests(unittest.TestCase):
    def test_gate_requires_every_outcome_and_exact_file_counts(self):
        good = {"observedCases": 24, "fileCaseCounts": {"B": 6, "R": 6, "W": 12},
                "failedCaseIds": [], "fileFailureIds": [], "unknownFailures": 0,
                "unknownOutcomes": 0, "duplicateCases": 0, "skippedCases": 0}
        self.assertTrue(decode_output(json.dumps(good), "gate")["gateValid"])
        for key, value in (("observedCases", 23), ("fileCaseCounts", {"B": 6, "R": 5, "W": 13}),
                           ("failedCaseIds", ["B01"]), ("fileFailureIds", ["B"]),
                           ("unknownFailures", 1), ("unknownOutcomes", 1), ("duplicateCases", 1), ("skippedCases", 1)):
            with self.subTest(key=key):
                self.assertFalse(decode_output(json.dumps({**good, key: value}), "gate")["gateValid"])
        self.assertFalse(decode_output(json.dumps(good) + "\n" + json.dumps(good), "gate")["gateValid"])
        self.assertFalse(decode_output("image exited without a verdict", "gate")["gateValid"])

    def test_tap_failure_names_totals_and_clock_steps(self):
        text = '\n'.join(["ok 1 - successful test", "not ok 2 - fails with a genuine assertion",
                          "# tests 2", "# pass 1", "# fail 1", "# skipped 0", '# result {"hostClockSteps":[]}'])
        result = decode_output(text, "node")
        self.assertEqual(result["failures"], ["fails with a genuine assertion"])
        self.assertEqual([result[k] for k in ("tests", "passed", "failed", "skipped")], [2, 1, 1, 0])
        self.assertFalse(result["clockSteps"])
        self.assertTrue(decode_output(text.replace('"hostClockSteps":[]', '"hostClockSteps":[{"ms":-2}]'), "node")["clockSteps"])
        self.assertIsNone(decode_output("module import failed", "node")["tests"])

    def test_python_failures_errors_and_environment_skips_remain_visible(self):
        text = "FAIL: test_a (suite.A.test_a)\nERROR: test_b (suite.B.test_b)\nRan 7 tests in 1.2s\nFAILED (failures=1, errors=1, skipped=2)\n"
        result = decode_output(text, "python")
        self.assertEqual(result["failures"], ["test_a (suite.A.test_a)", "test_b (suite.B.test_b)"])
        self.assertEqual([result[k] for k in ("tests", "passed", "failed", "skipped")], [7, 3, 2, 2])
        clean = decode_output("Ran 4 tests in 0.1s\nOK (skipped=1)\n", "python")
        self.assertEqual([clean[k] for k in ("tests", "passed", "failed", "skipped")], [4, 3, 0, 1])

    def test_comparison_does_not_waive_preexisting_failures_or_missing_evidence(self):
        records = [{"side": side, "mode": mode, "commit": side, "status": "passed", "checks": []}
                   for side in ("base", "head") for mode in ("runtime", "proxy", "infra")]
        for record in records:
            if record["mode"] == "runtime":
                record["status"] = "failed"
                record["checks"] = [{"name": "diagnostics", "status": "failed", "failures": ["old failure"]}]
        records[3]["checks"][0]["failures"].append("new failure")
        report, failed = comparison(records)
        self.assertTrue(failed)
        self.assertIn("old failure | pre-existing (same failing case)", report)
        self.assertIn("new failure | new or unverified", report)
        self.assertIn("Missing evidence", comparison(records[:-1])[0])
        self.assertTrue(comparison([])[1])

    def test_fixture_list_is_read_without_executing_source(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            path = root / "infra/product-preview/image-build-linux-checks.py"
            path.parent.mkdir(parents=True)
            paths = tuple(f"apps/test{i}.mjs" for i in range(10))
            path.write_text(f"raise RuntimeError('must not execute')\nFIXTURE_PATHS = {paths!r}\n")
            self.assertEqual(fixture_paths(root), paths)
            path.write_text("FIXTURE_PATHS = ('../escape',) * 10\n")
            with self.assertRaises(ValueError):
                fixture_paths(root)


if __name__ == "__main__":
    unittest.main()
