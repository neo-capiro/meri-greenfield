"""Offline checks against the exact vendor archive; native CTest remains mandatory.

CLAMAV_SOURCE_ARCHIVE=/path/clamav-1.5.4.tar.gz python -m unittest discover \
  -s infra/product-preview -p test_clamav_retirement_patch.py
No download, compiler, scanner, database or AWS client is invoked here.
"""
import hashlib
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
PATCHES = ROOT / "infra/product-preview/native-clamav-patches"
ARCHIVE_SHA = "1af1117a228f1b5bc7fa91a0dabc37848a99e7d25188e9be8043332ce721dfd3"
MACRO = "THRMGR_TEST_RETIREMENT_SYNC"


class RetirementPatchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        archive = Path(os.environ["CLAMAV_SOURCE_ARCHIVE"])
        if hashlib.sha256(archive.read_bytes()).hexdigest() != ARCHIVE_SHA:
            raise ValueError("Unexpected ClamAV archive; no fallback source")
        docker = (ROOT / "apps/runtime/Dockerfile").read_text(encoding="utf-8")
        cls.bindings = re.findall(
            r"python3\.13 /tmp/meri-clamav-patches/apply-pinned-patch\.py "
            r"/tmp/meri-clamav-patches/(clamav-1\.5\.4-retirement-\S+) "
            r"/usr/src/clamav-1\.5\.4/(\S+) ([a-f0-9]{64}) ([a-f0-9]{64})",
            docker,
        )
        if len(cls.bindings) != 3:
            raise ValueError("Expected three exact Dockerfile patch applications")
        cls.original = {}
        cls.patched = {}
        with tarfile.open(archive, "r:gz") as vendor, tempfile.TemporaryDirectory() as directory:
            for name, target, before, after in cls.bindings:
                patch = PATCHES / name
                digest = hashlib.sha256(patch.read_bytes()).hexdigest()
                if f'{digest}  /tmp/meri-clamav-patches/{name}" >> /tmp/clamav-compat.sha256' not in docker:
                    raise ValueError("Patch hash is not checked by the Dockerfile")
                raw = vendor.extractfile("clamav-1.5.4/" + target).read()
                cls.original[target] = raw
                path = Path(directory) / Path(target).name
                path.write_bytes(raw)
                result = cls.apply(patch, path, before, after)
                if result.returncode:
                    raise ValueError(result.stderr)
                cls.patched[target] = path.read_bytes()

    @staticmethod
    def apply(patch, target, before, after):
        return subprocess.run(
            [sys.executable, str(PATCHES / "apply-pinned-patch.py"),
             str(patch), str(target), before, after],
            capture_output=True, text=True, encoding="utf-8", check=False,
        )

    def test_pinned_archive_applies_to_exact_expected_outputs(self):
        for _, target, before, after in self.bindings:
            with self.subTest(target=target):
                self.assertEqual(hashlib.sha256(self.original[target]).hexdigest(), before)
                self.assertEqual(hashlib.sha256(self.patched[target]).hexdigest(), after)

    def test_production_thread_manager_source_is_identical_without_test_blocks(self):
        # All changes to scanner code must disappear when the private test macro
        # is absent; this is source equivalence, not a claim of native compilation.
        source = self.patched["clamd/thrmgr.c"]
        blocks = rb"^#ifdef THRMGR_TEST_RETIREMENT_SYNC\n.*?^#endif\n"
        stripped, count = re.subn(blocks, b"", source, flags=re.MULTILINE | re.DOTALL)
        self.assertEqual(count, 3)
        self.assertEqual(stripped, self.original["clamd/thrmgr.c"])
        original = self.original["unit_tests/CMakeLists.txt"]
        target_line = b'target_compile_definitions(check_clamd PUBLIC OBJDIR="${OBJDIR}" SRCDIR="${SRCDIR}")'
        expected = original.replace(target_line, target_line[:-1] + b" PRIVATE " + MACRO.encode() + b")")
        self.assertEqual(self.patched["unit_tests/CMakeLists.txt"], expected)
        self.assertEqual(expected.count(MACRO.encode()), 1)

    def test_changed_vendor_source_is_refused_without_writing(self):
        name, target, before, after = self.bindings[0]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.c"
            changed = self.original[target] + b"\n/* unrelated source */\n"
            path.write_bytes(changed)
            result = self.apply(PATCHES / name, path, before, after)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(path.read_bytes(), changed)

    def test_changed_patch_cannot_bypass_expected_output_hash(self):
        name, target, before, after = self.bindings[0]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.c"
            path.write_bytes(self.original[target])
            patch = Path(directory) / "changed.patch"
            patch.write_bytes((PATCHES / name).read_bytes().replace(
                b"+void (*thrmgr_test_retiring_hook)(void) = NULL;",
                b"+void (*unexpected_hook)(void) = NULL;"))
            result = self.apply(patch, path, before, after)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(path.read_bytes(), self.original[target])


if __name__ == "__main__":
    unittest.main()
