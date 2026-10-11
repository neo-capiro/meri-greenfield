"""Real temporary-filesystem checks; no build, native SDK or listener."""
import importlib.util
import json
import os
from pathlib import Path
import posixpath
import re
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("worker_context", Path(__file__).with_name("worker_context.py"))
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)
PROJECT_ROOT = m.ROOT


class WorkerContextTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="meri-worker-context-")
        self.base = Path(self.temp.name)
        self.root = self.base / "source"
        self.root.mkdir()
        for i, (source, _) in enumerate(m.MEMBERS):
            path = self.root / source
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(bytes([i]) + b"verbatim\r\n\x00\xff")
        self.root_patch = patch.object(m, "ROOT", self.root)
        self.root_patch.start()
        self.out = self.base / "exclusive"

    def tearDown(self):
        self.root_patch.stop()
        self.temp.cleanup()

    def test_exact_raw_copy_excludes_private_and_unselected_files(self):
        (self.root / ".env").write_text("synthetic excluded")
        path = self.root / m.QUALIFICATION / "node_modules/private.txt"
        path.parent.mkdir()
        path.write_text("synthetic excluded")
        result = m.assemble_context(self.out)
        self.assertEqual(len(result["members"]), 53)
        sources = {row["sourcePath"] for row in result["members"]}
        self.assertNotIn("scripts/qualification/sdk-stale-worker-challenge.mjs", sources)
        self.assertIn(m.QUALIFICATION + "checkpoint/resume-admission.mjs", sources)
        self.assertIn(m.QUALIFICATION + "checkpoint/fixture-sentinel.mjs", sources)
        self.assertEqual(result, m.verify_context(self.out))
        for source, member in m.MEMBERS:
            self.assertEqual((self.root / source).read_bytes(), (self.out / "context" / member).read_bytes())

    def test_missing_source_refused_before_output_allocation(self):
        (self.root / m.MEMBERS[-1][0]).unlink()
        with self.assertRaises(FileNotFoundError):
            m.assemble_context(self.out)
        self.assertFalse(self.out.exists())

    def test_existing_output_is_unchanged(self):
        self.out.mkdir()
        sentinel = self.out / "owner.txt"
        sentinel.write_bytes(b"retained")
        with self.assertRaises(FileExistsError):
            m.assemble_context(self.out)
        self.assertEqual(sentinel.read_bytes(), b"retained")

    def test_hardlink_source_refused_before_allocation(self):
        original = self.root / m.MEMBERS[0][0]
        os.link(original, self.base / "second-link")
        with self.assertRaisesRegex(ValueError, "single regular"):
            m.assemble_context(self.out)
        self.assertFalse(self.out.exists())

    def test_symlink_source_refused_before_allocation(self):
        original = self.root / m.MEMBERS[0][0]
        original.unlink()
        # Directory junction creation works without Windows symlink privilege;
        # a linked directory in a required file slot must also be refused.
        target = self.base / "target"
        target.mkdir()
        if os.name == "nt":
            # Source-file symlink semantics can be checked without privileged
            # creation using the actual lstat result with its reparse flag.
            st = os.stat(target)
            class Linked:
                st_mode = st.st_mode
                st_file_attributes = 0x400
            with patch.object(Path, "lstat", return_value=Linked()):
                with self.assertRaisesRegex(ValueError, "linked"):
                    m._plain(original)
        else:
            original.symlink_to(target, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "linked"):
                m.assemble_context(self.out)
        self.assertFalse(self.out.exists())

    def test_file_bound_refused_before_allocation(self):
        with patch.object(m, "MAX_FILE_BYTES", 1):
            with self.assertRaisesRegex(ValueError, "file bound"):
                m.assemble_context(self.out)
        self.assertFalse(self.out.exists())

    def test_aggregate_bound_refused_before_allocation(self):
        with patch.object(m, "MAX_TOTAL_BYTES", 20):
            with self.assertRaisesRegex(ValueError, "aggregate"):
                m.assemble_context(self.out)
        self.assertFalse(self.out.exists())

    def test_deadline_refused_before_allocation(self):
        with patch.object(m, "DEADLINE_SECONDS", 0):
            with self.assertRaisesRegex(ValueError, "deadline"):
                m.assemble_context(self.out)
        self.assertFalse(self.out.exists())

    def test_relative_and_parent_traversal_output_refused(self):
        for path in [Path("relative"), self.base / ".." / "ambiguous"]:
            with self.assertRaisesRegex(ValueError, "absolute fresh"):
                m.assemble_context(path)

    def test_partial_write_is_retained_and_cannot_be_reused(self):
        original = m._write_new
        calls = []
        def fail_second(path, raw, deadline):
            calls.append(path)
            if len(calls) == 2:
                raise OSError("synthetic disk failure")
            return original(path, raw, deadline)
        with patch.object(m, "_write_new", side_effect=fail_second):
            with self.assertRaises(OSError):
                m.assemble_context(self.out)
        self.assertTrue(calls[0].is_file())
        self.assertFalse((self.out / "manifest.json").exists())
        with self.assertRaises(FileExistsError):
            m.assemble_context(self.out)

    def test_source_drift_during_copy_refused_without_manifest(self):
        original = m._write_new
        def drift(path, raw, deadline):
            result = original(path, raw, deadline)
            (self.root / m.MEMBERS[0][0]).write_bytes(b"changed")
            return result
        with patch.object(m, "_write_new", side_effect=drift):
            with self.assertRaisesRegex(ValueError, "identity drift"):
                m.assemble_context(self.out)
        self.assertFalse((self.out / "manifest.json").exists())

    def test_context_extra_missing_and_drift_each_refused(self):
        m.assemble_context(self.out)
        context = self.out / "context"
        extra = context / "unexpected.txt"
        extra.write_bytes(b"extra")
        with self.assertRaises(ValueError):
            m.verify_context(self.out)
        extra.unlink()
        member = context / m.MEMBERS[0][1]
        raw = member.read_bytes()
        member.unlink()
        with self.assertRaises(ValueError):
            m.verify_context(self.out)
        member.write_bytes(b"drift")
        with self.assertRaisesRegex(ValueError, "byte drift"):
            m.verify_context(self.out)
        member.write_bytes(raw)
        self.assertEqual(len(m.verify_context(self.out)["members"]), 53)

    def test_extra_directory_and_output_file_refused(self):
        m.assemble_context(self.out)
        extra = self.out / "context/empty-extra"
        extra.mkdir()
        with self.assertRaises(ValueError):
            m.verify_context(self.out)
        extra.rmdir()
        (self.out / "unexpected.json").write_text("{}")
        with self.assertRaisesRegex(ValueError, "output membership"):
            m.verify_context(self.out)

    def test_manifest_unknown_duplicate_and_wrong_member_refused(self):
        m.assemble_context(self.out)
        path = self.out / "manifest.json"
        raw = path.read_bytes()
        for invalid in [raw.replace(b'{', b'{"schemaVersion":1,', 1),
                        raw.replace(b'"schemaVersion":1', b'"schemaVersion":true'),
                        raw.replace(b'"contextPath":".dockerignore"', b'"contextPath":"../foreign"')]:
            path.write_bytes(invalid)
            with self.assertRaises(ValueError):
                m.verify_context(self.out)
        path.write_bytes(raw)

    def test_source_after_assembly_drift_refused(self):
        m.assemble_context(self.out)
        (self.root / m.MEMBERS[-1][0]).write_bytes(b"changed source")
        with self.assertRaisesRegex(ValueError, "byte drift"):
            m.verify_context(self.out)

    def test_source_identity_change_late_in_verification_refused(self):
        m.assemble_context(self.out)
        original = m._read
        last = self.out / "context" / m.MEMBERS[-1][1]
        first = self.root / m.MEMBERS[0][0]
        def change_earlier_identity(path, deadline):
            result = original(path, deadline)
            if path == last:
                st = first.stat()
                os.utime(first, ns=(st.st_atime_ns, st.st_mtime_ns + 1000000000))
            return result
        with patch.object(m, "_read", side_effect=change_earlier_identity):
            with self.assertRaisesRegex(ValueError, "final identity drift"):
                m.verify_context(self.out)

    def test_real_native_observation_import_closure_is_in_fixed_context(self):
        """Check image relocation, not just a synthetic copy of member rows."""
        image_members = {}
        for source, member in m.MEMBERS:
            if member.startswith("build-dependencies/contracts/"):
                image = "/packages/contracts/" + member.removeprefix("build-dependencies/contracts/")
            elif member.startswith("build-dependencies/sdk-capture/"):
                image = "/scripts/sdk-capture/" + Path(member).name
            else:
                image = "/opt/meri-worker/" + member
            image_members[image] = source
        required = {
            "/opt/meri-worker/probes/native-observations.mjs",
            "/opt/meri-worker/probes/native-stream-observer.mjs",
            "/opt/meri-worker/probes/native-namespace-observer.mjs",
            "/packages/contracts/qualification-sdk/native-evidence.mjs",
            "/packages/contracts/qualification-sdk/native-evidence.schema.json",
        }
        self.assertTrue(required.issubset(image_members))
        # The owned modules use static ESM imports; external pinned packages and
        # node builtins are not relocated by this fixed-source assembler.
        imports = re.compile(r"(?:import|export)\s+(?:[^;]*?\s+from\s*)?['\"]([^'\"]+)['\"]")
        for image, source in image_members.items():
            if not image.endswith(".mjs") or image.endswith(".test.mjs"):
                continue
            text = (PROJECT_ROOT / source).read_text(encoding="utf-8")
            for specifier in imports.findall(text):
                if specifier.startswith("."):
                    relocated = posixpath.normpath(posixpath.join(posixpath.dirname(image), specifier))
                    self.assertIn(relocated, image_members, f"{source} -> {specifier}")
        with patch.object(m, "ROOT", PROJECT_ROOT):
            actual = m.assemble_context(self.out)
            self.assertEqual(len(actual["members"]), 53)
            self.assertEqual(actual, m.verify_context(self.out))


if __name__ == "__main__":
    unittest.main()
