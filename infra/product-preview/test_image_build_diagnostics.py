"""Task-local, offline checks for the unapplied producer diagnostic patch."""
from contextlib import redirect_stderr
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("product_diagnostic_candidate", HERE / "image-build-producer.py")
producer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(producer)


def request():
    commit = "a" * 40
    return {
        "schemaVersion": 2,
        "sourceCommit": commit,
        "archive": {"bucket": "example-build-bucket", "key": "inputs/source.zip", "versionId": "version-one", "sha256": "b" * 64},
        "manifest": {"bucket": "example-build-bucket", "key": "inputs/members.json", "versionId": "version-two", "sha256": "c" * 64},
        "dockerfileSha256": "d" * 64,
        "nodeImageUri": "public.ecr.aws/docker/library/node@sha256:" + "e" * 64,
        "nodeVersion": "v24.21.0", "runtimeBaseImageUri": "cgr.dev/chainguard/wolfi-base@sha256:" + "1" * 64,
        "runtimePackagesSha256": "4" * 64, "runnerSha256": "f" * 64,
        "runtimeUser": "1000:1000",
        "codeBuildProjectArn": "arn:aws:codebuild:us-east-1:967807252336:project/meri-greenfield-qualification-build",
        "ecrRepositoryUri": "967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker",
        "imageTag": "product-" + commit + "-" + "1" * 32,
        "verifierSha256": "2" * 64, "producerSha256": "3" * 64,
    }


class ProducerDiagnosticTests(unittest.TestCase):
    def test_only_static_codes_and_phases_escape(self):
        diagnostic = {"phase": "DOCKER_BUILD"}
        self.assertEqual(
            producer.failure_line(diagnostic, ValueError("PRODUCT_IMAGE_COMMAND_FAILED")),
            "PRODUCT_IMAGE_CHECK_FAILED phase=DOCKER_BUILD category=CHECK code=PRODUCT_IMAGE_COMMAND_FAILED",
        )
        for error in (RuntimeError("secret=top-secret"), ValueError("PRODUCT_IMAGE_SECRET_TOKEN"),
                      ValueError("PRODUCT_IMAGE_COMMAND_FAILED secret=top-secret"),
                      ValueError(["secret=top-secret"])):
            line = producer.failure_line(diagnostic, error)
            self.assertIn(line, (
                "PRODUCT_IMAGE_CHECK_FAILED phase=DOCKER_BUILD category=VALUE code=PRODUCT_IMAGE_CHECK_FAILED",
                "PRODUCT_IMAGE_CHECK_FAILED phase=DOCKER_BUILD category=UNEXPECTED code=PRODUCT_IMAGE_CHECK_FAILED",
            ))
            self.assertNotIn("secret", line.lower())
        self.assertEqual(
            producer.failure_line({"phase": "secret-phase"}, ValueError("PRODUCT_IMAGE_COMMAND_FAILED")),
            "PRODUCT_IMAGE_CHECK_FAILED phase=REQUEST category=CHECK code=PRODUCT_IMAGE_COMMAND_FAILED",
        )
        self.assertEqual(
            producer.failure_line({"phase": ["secret-phase"]}, ValueError("PRODUCT_IMAGE_COMMAND_FAILED")),
            "PRODUCT_IMAGE_CHECK_FAILED phase=REQUEST category=CHECK code=PRODUCT_IMAGE_COMMAND_FAILED",
        )

    def test_missing_request_is_bounded_before_produce_or_external_calls(self):
        missing = HERE / "missing-secret-looking-request.json"
        with tempfile.TemporaryDirectory(dir=HERE) as work:
            receipt = Path(work) / "product-image-diagnostic.json"
            with mock.patch.object(producer, "DIAGNOSTIC_FILE", receipt), \
                    mock.patch.object(sys, "argv", ["producer", "--request", str(missing), "--output", str(HERE / "never-receipt.json")]), \
                    mock.patch.object(producer, "produce", side_effect=AssertionError("must not run")) as produce, \
                    redirect_stderr(io.StringIO()) as stderr:
                self.assertEqual(producer.main(), 2)
            produce.assert_not_called()
            self.assertEqual(stderr.getvalue(), "PRODUCT_IMAGE_CHECK_FAILED phase=REQUEST category=MISSING_FILE code=PRODUCT_IMAGE_CHECK_FAILED\n")
            self.assertEqual(json.loads(receipt.read_text())["primary"]["phase"], "REQUEST")
            receipt.unlink()
            malformed = Path(work) / "request.json"
            malformed.write_text('{"secret":"do-not-log",', encoding="utf-8")
            with mock.patch.object(producer, "DIAGNOSTIC_FILE", receipt), \
                    mock.patch.object(sys, "argv", ["producer", "--request", str(malformed), "--output", str(HERE / "never-receipt.json")]), \
                    mock.patch.object(producer, "produce", side_effect=AssertionError("must not run")) as produce, \
                    redirect_stderr(io.StringIO()) as stderr:
                self.assertEqual(producer.main(), 2)
            produce.assert_not_called()
            self.assertEqual(stderr.getvalue(), "PRODUCT_IMAGE_CHECK_FAILED phase=REQUEST category=JSON code=PRODUCT_IMAGE_CHECK_FAILED\n")
            self.assertEqual(json.loads(receipt.read_text())["status"], "FAILED")

    def test_repeated_calls_have_independent_phase_state(self):
        value = request()
        build_id = "meri-greenfield-qualification-build:12345678-1234-1234-1234-123456789abc"
        with tempfile.TemporaryDirectory(dir=HERE) as work, \
                mock.patch.object(producer.sys, "platform", "linux"), \
                mock.patch.dict(os.environ, {"CODEBUILD_BUILD_ID": build_id, "CODEBUILD_PROJECT_ARN": value["codeBuildProjectArn"]}), \
                mock.patch.object(producer, "aws", side_effect=ValueError("PRODUCT_IMAGE_COMMAND_FAILED")) as aws:
            first = {"phase": "secret-prior-state"}
            with self.assertRaises(ValueError):
                producer.produce(value, Path(work) / "receipt.json", first)
            self.assertEqual(first["phase"], "BUILD_READBACK")
            second = {"phase": "secret-prior-state"}
            with self.assertRaises(ValueError):
                producer.produce({**value, "sourceCommit": "invalid"}, Path(work) / "receipt.json", second)
            self.assertEqual(second["phase"], "REQUEST")
            self.assertEqual(aws.call_count, 1)

    def _fail_in_docker_build(self, cleanup_error, workdir_error=False):
        value = request()
        build_id = "meri-greenfield-qualification-build:12345678-1234-1234-1234-123456789abc"
        def aws(service, operation, *args):
            if (service, operation) == ("codebuild", "batch-get-builds"):
                return {"builds": [{"projectName": "meri-greenfield-qualification-build", "sourceVersion": value["archive"]["versionId"],
                                    "source": {"type": "S3", "location": value["archive"]["bucket"] + "/" + value["archive"]["key"]}}]}
            if (service, operation) == ("ecr", "describe-repositories"):
                return {"repositories": [{"repositoryUri": value["ecrRepositoryUri"], "imageTagMutability": "IMMUTABLE",
                                          "imageScanningConfiguration": {"scanOnPush": True}}]}
            raise AssertionError("unexpected mocked AWS operation")
        def download(pin, target, maximum):
            target.write_bytes(b'{"files":[{"path":"infra/product-preview/runtime-packages.lock.json","mode":"100644"}]}' if target.name == "members.json" else b"not-a-real-archive")
        def run(args, **kwargs):
            if "build" in args:
                raise ValueError("PRODUCT_IMAGE_COMMAND_FAILED")
            if ("image" in args or "container" in args) and "ls" in args:
                return b""
            raise AssertionError("unexpected mocked command")
        def cleanup(*args):
            if cleanup_error:
                raise ValueError("PRODUCT_IMAGE_CLEANUP_UNKNOWN")
        real_temp = tempfile.TemporaryDirectory
        def temporary(**kwargs):
            owned = real_temp(dir=HERE, **kwargs)
            if not workdir_error:
                return owned
            class FailingRemoval:
                name = owned.name
                def cleanup(self):
                    owned.cleanup()
                    raise OSError("secret=never-print-this")
            return FailingRemoval()
        fake_zip = mock.MagicMock()
        fake_zip.__enter__.return_value.read.return_value = json.dumps({"runtimeImageUri": value["runtimeBaseImageUri"], "nodeVersion": value["nodeVersion"], "glibcVersion": "2.41"}).encode()
        with real_temp(dir=HERE) as work, \
                mock.patch.object(producer.sys, "platform", "linux"), \
                mock.patch.dict(os.environ, {"CODEBUILD_BUILD_ID": build_id, "CODEBUILD_PROJECT_ARN": value["codeBuildProjectArn"]}), \
                mock.patch.object(producer, "aws", side_effect=aws), \
                mock.patch.object(producer, "download", side_effect=download), \
                mock.patch.object(producer, "verify", return_value={}), \
                mock.patch.object(producer.zipfile, "ZipFile", return_value=fake_zip), \
                mock.patch.object(producer, "run", side_effect=run), \
                mock.patch.object(producer, "cleanup", side_effect=cleanup), \
                mock.patch.object(producer.tempfile, "TemporaryDirectory", side_effect=temporary):
            diagnostic = {"phase": "REQUEST"}
            with self.assertRaises(Exception) as raised:
                producer.produce(value, Path(work) / "receipt.json", diagnostic)
            self.assertFalse((Path(work) / "receipt.json").exists())
        return diagnostic, raised.exception

    def test_original_failed_phase_survives_successful_cleanup(self):
        diagnostic, error = self._fail_in_docker_build(False)
        self.assertEqual(producer.failure_line(diagnostic, error),
                         "PRODUCT_IMAGE_CHECK_FAILED phase=DOCKER_BUILD category=CHECK code=PRODUCT_IMAGE_COMMAND_FAILED")
        self.assertEqual(diagnostic["primary"]["phase"], "DOCKER_BUILD")
        self.assertEqual(diagnostic["cleanup"]["status"], "OK")

    def test_cleanup_unknown_overrides_original_failed_phase(self):
        diagnostic, error = self._fail_in_docker_build(True)
        self.assertEqual(producer.failure_line(diagnostic, error),
                         "PRODUCT_IMAGE_CHECK_FAILED phase=CLEANUP category=CHECK code=PRODUCT_IMAGE_CLEANUP_UNKNOWN")
        self.assertEqual(diagnostic["primary"]["phase"], "DOCKER_BUILD")
        self.assertEqual(diagnostic["cleanup"]["failure"]["phase"], "CLEANUP")
        with tempfile.TemporaryDirectory(dir=HERE) as work, mock.patch.object(producer, "DIAGNOSTIC_FILE", Path(work) / "product-image-diagnostic.json"):
            self.assertTrue(producer._save_diagnostic(diagnostic, "FAILED"))
            receipt = json.loads(producer.DIAGNOSTIC_FILE.read_text())
            self.assertEqual(receipt["primary"]["phase"], "DOCKER_BUILD")
            self.assertEqual(receipt["cleanup"]["failure"]["phase"], "CLEANUP")

    def test_resource_and_workdir_cleanup_failures_both_survive(self):
        diagnostic, error = self._fail_in_docker_build(True, True)
        self.assertIsInstance(error, OSError)
        self.assertEqual(diagnostic["primary"]["phase"], "DOCKER_BUILD")
        self.assertEqual(diagnostic["cleanup"]["failure"]["phase"], "CLEANUP")
        self.assertEqual([row["phase"] for row in diagnostic["cleanup"]["additionalFailures"]], ["WORKDIR_CLEANUP"])
        self.assertNotIn("secret", json.dumps(producer._diagnostic_receipt(diagnostic, "FAILED")))

    def test_failed_command_records_only_bounded_numeric_details(self):
        diagnostic = {"phase": "LINUX_TESTS", "primary": None}
        token = producer._active_diagnostic.set(diagnostic)
        try:
            with mock.patch.object(producer, "_deadline", None):
                with self.assertRaises(ValueError) as raised:
                    producer.run([sys.executable, "-I", "-B", "-S", "-c",
                                  "import sys;sys.stdout.write('secret=top-secret');sys.stderr.write('other-secret');sys.exit(7)"])
            producer._record_primary(diagnostic, raised.exception)
        finally:
            producer._active_diagnostic.reset(token)
        primary = diagnostic["primary"]
        self.assertEqual((primary["phase"], primary["category"], primary["code"]),
                         ("LINUX_TESTS", "COMMAND", "PRODUCT_IMAGE_COMMAND_FAILED"))
        self.assertEqual(primary["detail"]["status"], "EXIT_NONZERO")
        self.assertEqual(primary["detail"]["exitCode"], 7)
        self.assertGreaterEqual(primary["detail"]["outputBytes"], 20)
        self.assertIsInstance(primary["detail"]["elapsedMs"], int)
        self.assertNotIn("secret", json.dumps(producer._diagnostic_receipt(diagnostic, "FAILED")))

    def test_reporter_denies_skipped_foreign_and_malformed_case_results(self):
        complete = {"schemaVersion": 1, "observedCases": 24, "failedCaseIds": [],
                    "unknownFailures": 0, "unknownOutcomes": 0, "duplicateCases": 0, "skippedCases": 0,
                    "fileCaseCounts": {"B": 6, "R": 6, "W": 12}, "fileFailureIds": [], "failureDetails": [], "detailTruncated": False}
        self.assertEqual(producer._read_linux_reporter(json.dumps(complete).encode())["status"], "COMPLETE")
        self.assertIsNone(producer._read_linux_reporter(b'{"secret":"do-not-echo"}'))
        detail = {"id": "W08", "stage": "FIRST_METADATA", "code": "ERR_ASSERTION", "checkId": 9,
                  "exception": "AssertionError", "failureType": "testCodeFailure", "exitCode": None, "signal": "NONE"}
        failed = {**complete, "failedCaseIds": ["W08"], "fileFailureIds": ["W"], "failureDetails": [detail]}
        self.assertEqual(producer._read_linux_reporter(json.dumps(failed).encode())["failureDetails"], [detail])
        for changed in ({"checkId": True}, {"checkId": 31}, {"checkId": 0}, {"exception": "private-name"},
                        {"exception": "NONE"}, {"id": "B01"}, {"stage": "NONE"}):
            self.assertIsNone(producer._read_linux_reporter(json.dumps({**failed, "failureDetails": [{**detail, **changed}]}).encode()))
        with tempfile.TemporaryDirectory(dir=HERE) as work:
            reporter = Path(work) / "infra/product-preview/image-build-test-reporter.mjs"
            reporter.parent.mkdir(parents=True)
            reporter.write_text("export default function* (){}", encoding="ascii")
            members = {"infra/product-preview/image-build-test-reporter.mjs": {"sha256": producer.file_sha(reporter, 16384)}}
            for changed in ({"observedCases": 23}, {"skippedCases": 1}, {"unknownOutcomes": 1}, {"duplicateCases": 1},
                            {"failedCaseIds": ["W08"]}):
                row = {**complete, **changed}
                diagnostic = {"phase": "LINUX_TESTS"}
                with mock.patch.object(producer, "_prepare_linux_fixture_sandbox", return_value=(["docker", "run"], members)), \
                        mock.patch.object(producer._source, "bounded_command", return_value=(0, json.dumps(row).encode())):
                    with self.assertRaisesRegex(ValueError, "PRODUCT_IMAGE_LINUX_CASES_UNPROVEN"):
                        producer._run_linux_tests(["docker", "run"], Path(work), Path(work) / "unused.json", diagnostic)
                self.assertNotIn("secret", json.dumps(diagnostic))

    def test_diagnostic_serialization_failure_is_static_and_stops_before_work(self):
        with tempfile.TemporaryDirectory(dir=HERE) as work, \
                mock.patch.object(producer, "DIAGNOSTIC_FILE", Path(work) / "product-image-diagnostic.json"), \
                mock.patch.object(sys, "argv", ["producer", "--request", str(Path(work) / "missing.json"), "--output", str(Path(work) / "receipt.json")]), \
                mock.patch.object(producer.json, "dumps", side_effect=RuntimeError("secret=top-secret")), \
                mock.patch.object(producer, "produce", side_effect=AssertionError("must not run")) as produce, \
                redirect_stderr(io.StringIO()) as stderr:
            self.assertEqual(producer.main(), 2)
        produce.assert_not_called()
        self.assertEqual(stderr.getvalue(), "PRODUCT_IMAGE_CHECK_FAILED phase=DIAGNOSTIC category=WRITE code=PRODUCT_IMAGE_CHECK_FAILED\n")

    def test_unowned_existing_artifact_and_scratch_are_preserved(self):
        with tempfile.TemporaryDirectory(dir=HERE) as work:
            receipt = Path(work) / "product-image-diagnostic.json"
            scratch = Path(work) / "product-image-diagnostic.json.tmp"
            receipt.write_text("unrelated-artifact", encoding="ascii")
            diagnostic = {"phase": "REQUEST", "diagnosticOwner": None}
            with mock.patch.object(producer, "DIAGNOSTIC_FILE", receipt):
                self.assertFalse(producer._save_diagnostic(diagnostic, "STARTED"))
                self.assertEqual(receipt.read_text(), "unrelated-artifact")
                receipt.unlink()
                scratch.write_text("unrelated-scratch", encoding="ascii")
                self.assertFalse(producer._save_diagnostic(diagnostic, "STARTED"))
                self.assertEqual(scratch.read_text(), "unrelated-scratch")

    def test_workdir_removal_failure_overrides_body_failure(self):
        class Unremovable:
            name = str(HERE)
            def cleanup(self):
                raise OSError("secret=never-print-this")
        diagnostic = {"phase": "REQUEST"}
        with mock.patch.object(producer.tempfile, "TemporaryDirectory", return_value=Unremovable()):
            with self.assertRaises(OSError) as raised:
                with producer._temporary_context(diagnostic):
                    diagnostic["phase"] = "DOCKER_BUILD"
                    raise ValueError("PRODUCT_IMAGE_COMMAND_FAILED")
        self.assertEqual(producer.failure_line(diagnostic, raised.exception),
                         "PRODUCT_IMAGE_CHECK_FAILED phase=WORKDIR_CLEANUP category=OS code=PRODUCT_IMAGE_CHECK_FAILED")
        self.assertEqual(diagnostic["primary"]["phase"], "DOCKER_BUILD")
        self.assertEqual(diagnostic["cleanup"]["failure"]["phase"], "WORKDIR_CLEANUP")


if __name__ == "__main__":
    unittest.main()
