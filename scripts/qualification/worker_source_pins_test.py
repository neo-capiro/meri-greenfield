"""Source-pin integrity regressions using an exclusively owned temporary tree."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts.qualification import worker_source_pins as pins


class WorkerSourcePinsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="meri-source-pins-")
        self.root = Path(self.temp.name)
        self.target = self.root / pins.worker_context.QUALIFICATION / "component-pins.json"
        self.target.parent.mkdir(parents=True)
        self.target.write_text(json.dumps({"unrelated": {"retained": True}, "sdkFixturePackaging": {
            "status": "SOURCE_ONLY", "contextAssembler": "scripts/qualification/worker_context.py",
            "directDependencies": ["synthetic"], "records": []}}))
        self.sources = [source for source, _ in pins.worker_context.MEMBERS if pins.selected(source)]
        for index, source in enumerate(self.sources):
            path = self.root / source
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(f"synthetic-source-{index}".encode())
        self.root_patch = patch.object(pins.worker_context, "ROOT", self.root)
        self.root_patch.start()

    def tearDown(self):
        self.root_patch.stop()
        self.temp.cleanup()

    def test_stale_check_has_no_write_and_generation_preserves_other_metadata(self):
        before = self.target.read_bytes()
        with self.assertRaisesRegex(ValueError, "stale"):
            pins.refresh(check=True)
        self.assertEqual(self.target.read_bytes(), before)
        self.assertEqual(pins.refresh(check=False), 19)
        generated = json.loads(self.target.read_bytes())
        self.assertEqual(generated["unrelated"], {"retained": True})
        self.assertEqual(generated["sdkFixturePackaging"]["directDependencies"], ["synthetic"])
        self.assertEqual(pins.refresh(check=True), 19)

    def test_check_refuses_earlier_source_change_during_later_reads(self):
        pins.refresh(check=False)
        before = self.target.read_bytes()
        read = pins.worker_context._read
        def drift(path, deadline):
            result = read(path, deadline)
            if path == self.root / self.sources[-1]:
                (self.root / self.sources[0]).write_bytes(b"changed-after-read")
            return result
        with patch.object(pins.worker_context, "_read", side_effect=drift):
            with self.assertRaisesRegex(ValueError, "source changed"):
                pins.refresh(check=True)
        self.assertEqual(self.target.read_bytes(), before)

    def test_generation_refuses_linked_source_without_replacing_metadata(self):
        before = self.target.read_bytes()
        source = self.root / self.sources[0]
        source.unlink()
        source.symlink_to(self.target)
        with self.assertRaisesRegex(ValueError, "linked"):
            pins.refresh(check=False)
        self.assertEqual(self.target.read_bytes(), before)

    def test_reusable_package_import_has_no_generation_side_effect(self):
        import importlib
        with patch.object(pins.worker_context, "_read", side_effect=AssertionError("unexpected read")):
            importlib.reload(pins)


if __name__ == "__main__":
    unittest.main()
