"""Offline capture deadline controls; no AWS CLI or network may execute."""
import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import aws_evidence as capture_owner

ROOT = Path(__file__).resolve().parents[2]
E = ROOT / ".task-inputs/qualification-upload-deadline-1/fixtures"
COMMIT = "822193ce11bd1693f17604efd6d0dda555af4b97"
UUID = "e1c11eb9-4d6c-4683-9a36-2488609e5901"


def audit(event, arguments):
    if event.startswith("socket.") or event in {"subprocess.Popen", "os.system", "os.posix_spawn"}:
        raise RuntimeError("offline tests deny network and real processes")


sys.addaudithook(audit)


class CaptureDeadline(unittest.TestCase):
    def setUp(self):
        E.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(prefix="case-", dir=E)
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.body = self.directory / "source.zip"
        self.body.write_bytes(b"independent synthetic ZIP-body bytes")
        self.digest = hashlib.sha256(self.body.read_bytes())
        self.args = ["s3api", "put-object", "--bucket", capture_owner.UPLOAD_BUCKET,
                     "--key", "inputs/proxy-linux-import-" + COMMIT + "/" + UUID + ".zip",
                     "--body", str(self.body), "--if-none-match", "*",
                     "--server-side-encryption", "aws:kms", "--ssekms-key-id", capture_owner.UPLOAD_KMS,
                     "--checksum-algorithm", "SHA256", "--checksum-sha256",
                     base64.b64encode(self.digest.digest()).decode(), "--metadata",
                     json.dumps({"sourcecommit": COMMIT, "archivesha256": self.digest.hexdigest()})]
        self.out = self.directory / "not-allocated"

    def changed(self, key, value):
        args = self.args.copy()
        args[args.index(key) + 1] = value
        return args

    def deny(self, args=None, timeout=180):
        with mock.patch.object(capture_owner.subprocess, "run") as runner:
            with self.assertRaises((ValueError, OSError)):
                capture_owner.capture(self.out, "capture", self.args if args is None else args, timeout)
            runner.assert_not_called()
        self.assertFalse(self.out.exists(), "rejection must precede evidence allocation")

    def test_explicit_upload_deadlines_forward_exactly(self):
        for timeout in (61, 179, 180):
            with self.subTest(timeout=timeout):
                out = self.directory / ("accepted-" + str(timeout))
                with mock.patch.object(capture_owner.subprocess, "run", return_value=
                                       subprocess.CompletedProcess([], 0, b'{"VersionId":"fake"}', b"")) as runner:
                    result = capture_owner.capture(out, "capture", self.args, timeout)
                self.assertEqual(result, {"VersionId": "fake"})
                argv = runner.call_args.args[0]
                kwargs = runner.call_args.kwargs
                self.assertEqual(kwargs["timeout"], timeout)
                self.assertIs(kwargs["shell"], False)
                self.assertEqual(argv[:1], [capture_owner.AWS])
                self.assertEqual(argv[1:len(self.args) + 1], self.args)
                self.assertEqual(argv[-4:], ["--cli-connect-timeout", "10", "--cli-read-timeout", "30"])
                self.assertEqual(kwargs["env"]["AWS_MAX_ATTEMPTS"], "1")
                receipt = json.loads((out / "capture/process.json").read_bytes())
                self.assertEqual(receipt["timeoutSeconds"], timeout)
                self.assertEqual(receipt["automaticRetries"], 0)

    def test_ordinary_operations_keep_one_to_sixty(self):
        for timeout in (1, 45, 60):
            with mock.patch.object(capture_owner.subprocess, "run", return_value=
                                   subprocess.CompletedProcess([], 0, b"{}", b"")) as runner:
                capture_owner.capture(self.directory / str(timeout), "ordinary", ["sts", "get-caller-identity"], timeout)
            self.assertEqual(runner.call_args.kwargs["timeout"], timeout)
        self.deny(["sts", "get-caller-identity"], 61)
        self.deny(["s3api", "head-object", "--bucket", capture_owner.UPLOAD_BUCKET], 180)

    def test_timeout_type_and_range(self):
        for value in (True, False, 0, -1, 181, 60.0, float("inf"), float("nan"), "180", None):
            with self.subTest(value=repr(value)):
                self.deny(timeout=value)

    def test_no_duplicate_or_ambiguous_options(self):
        self.deny(self.args + ["--bucket", capture_owner.UPLOAD_BUCKET])
        args = self.args.copy(); args[2] = "--key"
        self.deny(args)
        args = self.args.copy(); args[2] = "--buck"
        self.deny(args)
        args = self.args.copy(); args[2] = "--bucket=" + capture_owner.UPLOAD_BUCKET
        self.deny(args)
        self.deny(self.args[:-1])
        self.deny(self.args + ["--profile", "other"])

    def test_fixed_upload_namespace_and_encryption(self):
        for key, value in (("--bucket", "foreign"), ("--key", "results/foreign.zip"),
                           ("--key", "inputs/proxy-linux-import-" + COMMIT.upper() + "/" + UUID + ".zip"),
                           ("--if-none-match", "no"), ("--server-side-encryption", "AES256"),
                           ("--ssekms-key-id", "alias/foreign"), ("--checksum-algorithm", "SHA1")):
            with self.subTest(key=key, value=value):
                self.deny(self.changed(key, value))

    def test_metadata_binding_and_duplicate_keys(self):
        for metadata in ({"sourcecommit": "0" * 40, "archivesha256": self.digest.hexdigest()},
                         {"sourcecommit": COMMIT, "archivesha256": "0" * 64},
                         {"sourcecommit": COMMIT, "archivesha256": self.digest.hexdigest(), "extra": "x"},
                         [], None, {"sourcecommit": COMMIT, "archivesha256": True}):
            with self.subTest(metadata=metadata):
                self.deny(self.changed("--metadata", json.dumps(metadata)))
        self.deny(self.changed("--metadata", '{"sourcecommit":"x","sourcecommit":"y"}'))

    def test_checksum_is_actual_body_hash(self):
        self.deny(self.changed("--checksum-sha256", "A" * 44))
        self.body.write_bytes(b"changed after input preparation")
        self.deny()

    def test_missing_empty_relative_directory_or_oversized_body(self):
        self.deny(self.changed("--body", str(self.directory / "missing.zip")))
        self.deny(self.changed("--body", "source.zip"))
        self.deny(self.changed("--body", str(self.directory)))
        self.body.write_bytes(b"")
        self.deny()
        with self.body.open("wb") as stream:
            stream.truncate(512 * 1024 * 1024 + 1)
        self.deny()

    def test_body_hardlink_is_not_admitted(self):
        other = self.directory / "alias.zip"
        os.link(self.body, other)
        self.deny()

    def test_timeout_is_retained_without_retry(self):
        error = subprocess.TimeoutExpired([], 180, output=b"partial", stderr=b"diagnostic")
        with mock.patch.object(capture_owner.subprocess, "run", side_effect=error) as runner:
            with self.assertRaisesRegex(RuntimeError, "AWS operation failed"):
                capture_owner.capture(self.out, "capture", self.args, 180)
        self.assertEqual(runner.call_count, 1)
        receipt = json.loads((self.out / "capture/process.json").read_bytes())
        self.assertIs(receipt["timedOut"], True)
        self.assertIsNone(receipt["exitCode"])
        self.assertEqual((self.out / "capture/stdout.bin").read_bytes(), b"partial")
        self.assertEqual((self.out / "capture/stderr.bin").read_bytes(), b"diagnostic")


if __name__ == "__main__":
    unittest.main(verbosity=2)
