"""Offline controls for exact ECR scan-pending classification and deadline gates."""
from contextlib import redirect_stderr, redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import unittest
from unittest import mock


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("product_scan_candidate", HERE / "image-build-producer.py")
producer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(producer)
source = producer._source
DIGEST = "sha256:" + "a" * 64
COMMAND = ["aws", "--region", "us-east-1", "--no-cli-pager", "ecr", "describe-image-scan-findings",
           "--repository-name", "meri-greenfield/qualification-worker", "--image-id", "imageDigest=" + DIGEST,
           "--output", "json"]
PENDING = b"\nAn error occurred (ScanNotFoundException) when calling the DescribeImageScanFindings operation: private-message-do-not-log\n"
# Current AWS CLI v2 prefixes service errors; build 63c305c4 failed on this exact envelope.
PREFIXED = b"\naws: [ERROR]: " + PENDING.lstrip(b"\n")


class ScriptedProcess:
    def __init__(self, error=PENDING, output=b"", code=254, timeout=False):
        self.stdin = None
        self.stdout, self.stderr = io.BytesIO(output), io.BytesIO(error)
        self.returncode, self.timeout, self.killed = code, timeout, False

    def wait(self, timeout):
        if self.timeout and not self.killed:
            raise subprocess.TimeoutExpired("private-command", timeout)
        return self.returncode

    def kill(self):
        self.killed, self.returncode = True, -9

    def poll(self):
        return self.returncode


class ScanCommandTests(unittest.TestCase):
    def invoke(self, process=None, command=COMMAND, **kwargs):
        process = process or ScriptedProcess()
        with mock.patch.object(source.subprocess, "Popen", return_value=process) as popen:
            try:
                return source.run(list(command), scan_not_found=True, **kwargs)
            finally:
                self.assertEqual(popen.call_count, 1)
                self.assertTrue(process.stdout.closed and process.stderr.closed)

    def test_only_exact_operation_digest_and_cli_envelope_yield_static_pending(self):
        for error in (PENDING, PENDING.lstrip(b"\n"), PENDING.replace(b"\n", b"\r\n"),
                      PREFIXED, PREFIXED.lstrip(b"\n"), PREFIXED.replace(b"\n", b"\r\n")):
            with self.subTest(errorLength=len(error)):
                report = []
                with self.assertRaises(source.ScanNotFoundPending) as caught:
                    self.invoke(ScriptedProcess(error=error), report=report.append)
                self.assertEqual(str(caught.exception), "PRODUCT_IMAGE_SCAN_INCOMPLETE")
                self.assertEqual(report, [])
                self.assertNotIn("private", repr(caught.exception))
                self.assertIsNone(caught.exception.__cause__)

    def test_denied_missing_image_wrong_operation_and_arbitrary_errors_stay_fatal(self):
        errors = [PENDING.replace(b"ScanNotFoundException", name) for name in
                  (b"AccessDeniedException", b"ImageNotFoundException", b"RepositoryNotFoundException", b"ThrottlingException")]
        errors += [PENDING.replace(b"DescribeImageScanFindings", b"DescribeImages"),
                   b"ScanNotFoundException", b"private-prefix" + PENDING,
                   PENDING + b"another private error\n", b"private arbitrary error",
                   PREFIXED.replace(b"ScanNotFoundException", b"AccessDeniedException"),
                   PREFIXED.replace(b"ScanNotFoundException", b"ImageNotFoundException"),
                   b"\naws: [ERROR]: aws: [ERROR]: " + PENDING.lstrip(b"\n"),
                   b"\naws: [WARNING]: " + PENDING.lstrip(b"\n"), b"private-prefix" + PREFIXED]
        for error in errors:
            with self.subTest(errorLength=len(error)):
                report = []
                with self.assertRaisesRegex(ValueError, "^PRODUCT_IMAGE_COMMAND_FAILED$"):
                    self.invoke(ScriptedProcess(error=error), report=report.append)
                self.assertEqual(report[-1]["status"], "EXIT_NONZERO")
                self.assertNotIn("private", str(report))

    def test_mixed_stdout_unexpected_exit_and_oversized_error_are_not_pending(self):
        for process in (ScriptedProcess(output=b"private-output"), ScriptedProcess(code=1),
                        ScriptedProcess(error=PENDING.rstrip(b"\n") + b"x" * 4096 + b"\n")):
            with self.assertRaisesRegex(ValueError, "^PRODUCT_IMAGE_COMMAND_FAILED$"):
                self.invoke(process)

    def test_opt_in_refuses_other_commands_before_any_process(self):
        variants = [COMMAND[:4] + ["ecr", "describe-images"] + COMMAND[6:],
                    COMMAND[:2] + ["us-west-2"] + COMMAND[3:],
                    COMMAND[:9] + ["imageTag=not-a-digest"] + COMMAND[10:],
                    COMMAND + ["--query", "private"]]
        for command in variants:
            with mock.patch.object(source.subprocess, "Popen") as popen:
                with self.assertRaisesRegex(ValueError, "^PRODUCT_IMAGE_COMMAND_BOUND$"):
                    source.run(command, scan_not_found=True)
                popen.assert_not_called()
        with mock.patch.object(source.subprocess, "Popen", return_value=ScriptedProcess()):
            with self.assertRaisesRegex(ValueError, "^PRODUCT_IMAGE_COMMAND_FAILED$"):
                source.run(COMMAND)  # No generic pending policy on other callers.

    def test_pending_text_never_overrides_command_timeout_or_output_bound(self):
        report = []
        process = ScriptedProcess(timeout=True)
        with self.assertRaisesRegex(ValueError, "^PRODUCT_IMAGE_COMMAND_UNAVAILABLE_OR_TIMEOUT$"):
            self.invoke(process, timeout=0.01, report=report.append)
        self.assertTrue(process.killed)
        self.assertEqual(report[-1]["status"], "TIMEOUT")
        report = []
        with self.assertRaisesRegex(ValueError, "^PRODUCT_IMAGE_COMMAND_BOUND$"):
            self.invoke(ScriptedProcess(output=b"x" * (16 * 1024**2 + 1)), report=report.append)
        self.assertEqual(report[-1]["status"], "BOUND")
        self.assertNotIn("private", str(report))

    def test_aws_enables_classification_only_on_the_scan_read(self):
        for args, enabled in [(("ecr", "describe-image-scan-findings", "--repository-name", "repo", "--image-id", "imageDigest=" + DIGEST), True),
                              (("ecr", "describe-images"), False)]:
            with mock.patch.object(producer, "run", return_value=b"{}") as run:
                self.assertEqual(producer.aws(*args), {})
            self.assertEqual(run.call_args.kwargs, {"scan_not_found": True} if enabled else {})


class Clock:
    def __init__(self):
        self.now, self.sleeps = 0, []

    def monotonic(self):
        return self.now

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.now += seconds


def complete(counts=None):
    return {"imageScanStatus": {"status": "COMPLETE"},
            "imageScanFindings": {"findingSeverityCounts": {"MEDIUM": 9, "LOW": 3} if counts is None else counts}}


class ScanPollingTests(unittest.TestCase):
    def poll(self, replies, clock=None, deadline=None):
        clock = clock or Clock()
        with mock.patch.object(producer.time, "monotonic", side_effect=clock.monotonic), \
                mock.patch.object(producer.time, "sleep", side_effect=clock.sleep), \
                mock.patch.object(producer, "_deadline", deadline), \
                mock.patch.object(producer, "aws", side_effect=replies) as aws:
            try:
                return producer.wait_for_scan("repo", DIGEST), clock, aws
            finally:
                self.assertIsNone(producer._active_scan_deadline.get())

    def test_exact_pending_then_in_progress_then_complete_retains_counts(self):
        (status, counts), clock, aws = self.poll([source.ScanNotFoundPending(),
            {"imageScanStatus": {"status": "IN_PROGRESS"}}, complete()])
        self.assertEqual((status, counts), ("COMPLETE", {"MEDIUM": 9, "LOW": 3}))
        self.assertEqual(clock.sleeps, [10, 10])
        self.assertEqual(aws.call_count, 3)
        self.assertTrue(all(call.args == ("ecr", "describe-image-scan-findings", "--repository-name", "repo",
                                        "--image-id", "imageDigest=" + DIGEST) for call in aws.call_args_list))

    def test_actual_command_boundary_pending_then_complete_does_not_emit_error_bytes(self):
        clock, diagnostic = Clock(), {"phase": "ECR_SCAN"}
        processes = [ScriptedProcess(), ScriptedProcess(error=b"", output=json.dumps(complete()).encode(), code=0)]
        token = producer._active_diagnostic.set(diagnostic)
        try:
            with mock.patch.object(producer.time, "monotonic", side_effect=clock.monotonic), \
                    mock.patch.object(producer.time, "sleep", side_effect=clock.sleep), \
                    mock.patch.object(producer, "_deadline", None), \
                    mock.patch.object(source.subprocess, "Popen", side_effect=processes) as popen, \
                    redirect_stderr(io.StringIO()) as stderr, redirect_stdout(io.StringIO()) as stdout:
                self.assertEqual(producer.wait_for_scan("meri-greenfield/qualification-worker", DIGEST),
                                 ("COMPLETE", {"MEDIUM": 9, "LOW": 3}))
            self.assertEqual((popen.call_count, clock.sleeps), (2, [10]))
            self.assertEqual(stdout.getvalue() + stderr.getvalue(), "")
            self.assertIsNone(diagnostic["commandFailure"])
            self.assertNotIn("private", json.dumps(diagnostic))
            self.assertTrue(all(p.stdout.closed and p.stderr.closed for p in processes))
        finally:
            producer._active_diagnostic.reset(token)

    def test_exhausted_pending_is_static_incomplete_at_300_seconds(self):
        clock, calls = Clock(), []
        def pending(*args):
            calls.append(args)
            raise source.ScanNotFoundPending()
        with self.assertRaisesRegex(ValueError, "^PRODUCT_IMAGE_SCAN_INCOMPLETE$"):
            self.poll(pending, clock)
        self.assertEqual(clock.now, 300)
        self.assertEqual(len(calls), 30)
        self.assertEqual(sum(clock.sleeps), 300)

    def test_remaining_producer_budget_caps_poll_without_extending_it(self):
        clock, calls = Clock(), []
        def pending(*args):
            calls.append(args)
            raise source.ScanNotFoundPending()
        with self.assertRaisesRegex(ValueError, "^PRODUCT_IMAGE_SCAN_INCOMPLETE$"):
            self.poll(pending, clock, deadline=17)
        self.assertEqual((clock.now, clock.sleeps, len(calls)), (17, [10, 7], 2))
        with self.assertRaisesRegex(ValueError, "^PRODUCT_IMAGE_SCAN_INCOMPLETE$"):
            self.poll(AssertionError("must not call AWS"), deadline=0)

    def test_late_complete_is_refused_and_no_other_error_is_polled(self):
        clock = Clock()
        def late(*args):
            clock.now = 301
            return complete()
        with self.assertRaisesRegex(ValueError, "^PRODUCT_IMAGE_SCAN_INCOMPLETE$"):
            self.poll(late, clock)
        for code in ("COMMAND_FAILED", "COMMAND_BOUND", "COMMAND_UNAVAILABLE_OR_TIMEOUT"):
            calls = []
            def fatal(*args):
                calls.append(args)
                raise ValueError("PRODUCT_IMAGE_" + code)
            clock = Clock()
            with self.assertRaisesRegex(ValueError, "^PRODUCT_IMAGE_" + code + "$"):
                self.poll(fatal, clock)
            self.assertEqual((len(calls), clock.sleeps), (1, []))

    def test_high_critical_and_invalid_counts_still_refuse(self):
        for counts in ({"HIGH": 3, "MEDIUM": 9, "LOW": 3}, {"CRITICAL": 1}, {"HIGH": True}, {"LOW": -1}, []):
            with self.subTest(counts=counts):
                with self.assertRaisesRegex(ValueError, "^PRODUCT_IMAGE_SCAN_FINDINGS_HOLD$"):
                    self.poll([source.ScanNotFoundPending(), complete(counts)])
        for status in ("FAILED", "UNSUPPORTED_IMAGE", "ACTIVE", "COMPLETE-private"):
            with self.assertRaisesRegex(ValueError, "^PRODUCT_IMAGE_SCAN_INCOMPLETE$"):
                self.poll([{"imageScanStatus": {"status": status}}])

    def test_scan_command_timeout_is_capped_by_both_existing_deadlines(self):
        clock = Clock()
        token = producer._active_scan_deadline.set(12)
        try:
            with mock.patch.object(producer.time, "monotonic", side_effect=clock.monotonic), \
                    mock.patch.object(producer, "_deadline", 7), \
                    mock.patch.object(source, "run", return_value=b"{}") as run:
                producer.run(COMMAND, timeout=30, scan_not_found=True)
                self.assertEqual(run.call_args.kwargs["timeout"], 7)
                self.assertIs(run.call_args.kwargs["scan_not_found"], True)
                clock.now = 13
                with self.assertRaisesRegex(ValueError, "^PRODUCT_IMAGE_PRODUCER_DEADLINE$"):
                    producer.run(COMMAND, scan_not_found=True)
                self.assertEqual(run.call_count, 1)
        finally:
            producer._active_scan_deadline.reset(token)


if __name__ == "__main__":
    unittest.main()
