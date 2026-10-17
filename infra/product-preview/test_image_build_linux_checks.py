"""Credential-free source controls for the product Linux fixture mount helper."""

import hashlib
import importlib.util
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch


SOURCE = Path(__file__).with_name("image-build-linux-checks.py")
SPEC = importlib.util.spec_from_file_location("image_build_linux_checks", SOURCE)
CHECKS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECKS)
IMAGE = "967807252336.dkr.ecr.us-east-1.amazonaws.com/meri:product-" + "a" * 40 + "-" + "b" * 32


class FixtureSandboxTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(prefix="meri-fixture-check-")
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name) / "context"
        self.root.mkdir()
        self.members = {}
        for index, name in enumerate(CHECKS.FIXTURE_PATHS):
            target = self.root.joinpath(*name.split("/"))
            target.parent.mkdir(parents=True, exist_ok=True)
            payload = ("synthetic-fixture-%02d" % index).encode("ascii")
            target.write_bytes(payload)
            target.chmod(0o644)
            self.members[name] = {"path": name, "mode": "100644", "bytes": len(payload),
                                  "sha256": hashlib.sha256(payload).hexdigest()}
        self.sandbox = ["docker", "--config", str(Path(self.scratch.name) / "auth"), "run", "--rm",
                        "--name", "fixed-probe", "--init", "--network", "none", "--read-only",
                        "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "128",
                        "--memory", "2g", "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=128m",
                        "--entrypoint", "/usr/local/bin/node", IMAGE]
        self.calls = []
        self.report = lambda detail: None

    def command(self, args, *, timeout, report):
        self.calls.append((args, timeout, report))
        return 0, b'{"schemaVersion":1,"status":"PRESENT","count":10}\n'

    def prepare(self, *, command=None, timeout=120, members=None, sandbox=None, context=None):
        return CHECKS.prepare_fixture_sandbox(
            self.sandbox if sandbox is None else sandbox,
            self.root if context is None else context,
            self.members if members is None else members,
            self.command if command is None else command,
            timeout, self.report,
        )

    def refused(self, **kwargs):
        with self.assertRaisesRegex(ValueError, r"^PRODUCT_IMAGE_LINUX_FIXTURE_UNPROVEN$"):
            self.prepare(**kwargs)

    def test_exact_verified_mounts_precede_image_and_preflight_uses_same_sandbox(self):
        result = self.prepare()
        self.assertEqual(result[-1], IMAGE)
        self.assertEqual(result.count("--mount"), 10)
        self.assertEqual(result[:len(self.sandbox) - 1], self.sandbox[:-1])
        mounts = [result[index + 1] for index, word in enumerate(result) if word == "--mount"]
        self.assertEqual(mounts, ["type=bind,src=" + str(self.root.joinpath(*name.split("/")))
                                  + ",dst=/opt/meri/" + name + ",readonly"
                                  for name in CHECKS.FIXTURE_PATHS])
        self.assertEqual(len(self.calls), 1)
        args, timeout, report = self.calls[0]
        self.assertEqual(args[:len(result)], result)
        self.assertEqual(args[len(result):len(result) + 3], ["--input-type=module", "-e", CHECKS._PREFLIGHT])
        self.assertEqual(timeout, 30)
        self.assertIs(report, self.report)
        self.assertNotIn("--privileged", result)
        self.assertEqual(result.count("--network"), 1)

    def test_missing_executable_symlink_digest_and_foreign_manifest_rows_refuse_before_command(self):
        name = CHECKS.FIXTURE_PATHS[0]
        target = self.root.joinpath(*name.split("/"))
        target.unlink()
        self.refused()
        self.assertEqual(self.calls, [])
        target.write_bytes(b"synthetic-fixture-00")
        target.chmod(0o644)
        original = Path.lstat

        def fake_executable(path, *args, **kwargs):
            info = original(path, *args, **kwargs)
            if Path(path) == target:
                fields = list(info)
                fields[0] |= 0o111
                return os.stat_result(fields)
            return info

        with patch.object(Path, "lstat", fake_executable):
            self.refused()

        def fake_symlink(path, *args, **kwargs):
            info = original(path, *args, **kwargs)
            if Path(path) == target:
                fields = list(info)
                fields[0] = (fields[0] & ~stat.S_IFMT(fields[0])) | stat.S_IFLNK | 0o777
                return os.stat_result(fields)
            return info

        with patch.object(Path, "lstat", fake_symlink):
            self.refused()
        changed = {key: dict(value) for key, value in self.members.items()}
        changed[name]["sha256"] = "0" * 64
        self.refused(members=changed)
        changed = {key: dict(value) for key, value in self.members.items()}
        changed[name]["path"] = "apps/runtime/foreign-fixture.mjs"
        self.refused(members=changed)
        changed = {key: dict(value) for key, value in self.members.items()}
        changed[name]["mode"] = "100755"
        self.refused(members=changed)
        self.assertEqual(self.calls, [])

    def test_comma_path_foreign_sandbox_and_untrusted_preflight_refuse(self):
        outer = Path(self.scratch.name) / "with,comma"
        outer.mkdir()
        for name in CHECKS.FIXTURE_PATHS:
            target = outer.joinpath(*name.split("/"))
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(self.root.joinpath(*name.split("/")).read_bytes())
            target.chmod(0o644)
        self.refused(context=outer)
        altered = list(self.sandbox)
        altered[altered.index("--network") + 1] = "host"
        self.refused(sandbox=altered)
        self.refused(command=lambda args, **kwargs: (1, b""))
        self.refused(command=lambda args, **kwargs: (0, b'{"schemaVersion":1,"status":"PRESENT","count":9}\n'))
        self.refused(command=lambda args, **kwargs: (0, b"private unexpected output"))
        self.refused(timeout=0)


if __name__ == "__main__":
    unittest.main()
