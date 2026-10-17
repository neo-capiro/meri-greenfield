"""Separately authorized Linux product image producer. Importing is inert.

Source sealing and archive verification belong to image-build-source.py. The exact
reviewed buildspec authenticates both module byte hashes before executing this file.
"""
import argparse
import base64
from contextlib import contextmanager
from contextvars import ContextVar
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import zipfile

_spec = importlib.util.spec_from_file_location("meri_product_source", Path(__file__).with_name("image-build-source.py"))
_source = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_source)
need, decode, encoded = _source.need, _source.decode, _source.encoded
validate_request, verify, file_sha = _source.validate_request, _source.verify, _source.file_sha
SHA, RUNNER, CONTRACT = _source.SHA, _source.RUNNER, _source.CONTRACT
REGION = "us-east-1"
LINUX_ONLY_TESTS = (
    "apps/runtime/test/prepared-candidate-bootstrap.test.mjs",
    "apps/runtime/test/remote-conversation-runner.test.mjs",
    "apps/runtime/temporal-product-token-writer.test.mjs",
)
_deadline = None
_active_diagnostic = ContextVar("product_image_diagnostic", default=None)
DIAGNOSTIC_FILE = Path("product-image-diagnostic.json")
_PHASES = frozenset((
    "REQUEST", "BUILD_IDENTITY", "BUILD_READBACK", "REPOSITORY_READBACK",
    "WORKDIR", "SOURCE_ARCHIVE", "SOURCE_MANIFEST", "SOURCE_VERIFY",
    "SOURCE_EXTRACT", "DOCKER_PREFLIGHT", "DOCKER_BUILD", "IMAGE_INSPECT",
    "SANDBOX_HELP", "SANDBOX_MEASURE", "LINUX_TESTS", "ECR_AUTH",
    "ECR_PUSH", "ECR_READBACK", "ECR_SCAN", "CLEANUP", "WORKDIR_CLEANUP",
    "RECEIPT",
))
# Only codes authored by this producer or its pinned source verifier may appear
# in build logs. In particular, never print an arbitrary exception message.
_ERROR_CODES = frozenset("PRODUCT_IMAGE_" + name for name in (
    "ARCHIVE_BOUND", "ARCHIVE_SHA_MISMATCH", "BUILD_IDENTITY", "BUILD_SOURCE",
    "CLEANUP_UNKNOWN", "COMMAND_BOUND", "COMMAND_FAILED",
    "COMMAND_UNAVAILABLE_OR_TIMEOUT", "DUPLICATE_KEY", "DUPLICATE_MEMBER",
    "FILE_BOUND", "IMAGE_IDENTITY", "IMAGE_MEASUREMENT", "IMAGE_READBACK",
    "LOCAL_IMAGE_EXISTS", "LOCAL_PROBE_EXISTS", "MANIFEST_BOUND",
    "LINUX_CASES_UNPROVEN", "LINUX_REPORTER_UNPROVEN",
    "MANIFEST_ORDER", "MANIFEST_SHA_MISMATCH", "MANIFEST_SHAPE",
    "MEMBER_ANCESTOR", "MEMBER_PATH", "MEMBER_TYPE", "NODE_PIN",
    "OBJECT_BINDING", "OBJECT_BOUND", "PRIVATE_MEMBER", "PRODUCER_DEADLINE",
    "PRODUCER_PLATFORM_OR_OUTPUT", "PROJECT_PIN", "REPOSITORY_PIN",
    "REPOSITORY_POLICY", "REQUEST_OBJECT", "REQUEST_PIN", "RUNNER_BOUND",
    "RUNTIME_USER", "SCAN_FINDINGS_HOLD", "SCAN_INCOMPLETE", "SHAPE_REFUSED",
    "SOURCE_COMMIT", "SOURCE_MEMBERS_MISMATCH", "SOURCE_PIN_MISMATCH",
    "TAG_PIN",
))
_COMMAND_STATUSES = frozenset(("EXIT_NONZERO", "TIMEOUT", "BOUND", "UNAVAILABLE"))
_LINUX_CASE_IDS = frozenset((*(f"B{i:02}" for i in range(1, 7)),
                            *(f"R{i:02}" for i in range(1, 7)),
                            *(f"W{i:02}" for i in range(1, 13))))
_EXCEPTION_TYPES = {FileNotFoundError: "MISSING_FILE", PermissionError: "PERMISSION", OSError: "OS",
                    json.JSONDecodeError: "JSON", ImportError: "IMPORT", KeyError: "KEY",
                    TypeError: "TYPE", ValueError: "VALUE", TimeoutError: "TIMEOUT"}


def _phase(diagnostic):
    value = diagnostic.get("phase")
    return value if type(value) is str and value in _PHASES else "REQUEST"


def _code(error):
    value = error.args[0] if type(error) is ValueError and len(error.args) == 1 else None
    return value if type(value) is str and value in _ERROR_CODES else "PRODUCT_IMAGE_CHECK_FAILED"


def _command_detail(diagnostic):
    value = diagnostic.get("commandFailure")
    if type(value) is not dict or value.get("phase") != _phase(diagnostic) or type(value.get("status")) is not str or value["status"] not in _COMMAND_STATUSES:
        return None
    exit_code, count, elapsed = value.get("exitCode"), value.get("outputBytes"), value.get("elapsedMs")
    if exit_code is not None and (type(exit_code) is not int or not -255 <= exit_code <= 255):
        return None
    if type(count) is not int or not 0 <= count <= 17 * 1024**2 or type(elapsed) is not int or not 0 <= elapsed <= 1600000:
        return None
    return {"status": value["status"], "exitCode": exit_code, "outputBytes": count, "elapsedMs": elapsed}


def _failure(diagnostic, error):
    code, detail = _code(error), _command_detail(diagnostic)
    error_type = _EXCEPTION_TYPES.get(type(error), "UNEXPECTED")
    if detail is None:
        errno = getattr(error, "errno", None) if type(error) in (FileNotFoundError, PermissionError, OSError, TimeoutError) else None
        detail = {"errorType": error_type, "errno": errno if type(errno) is int and 0 <= errno <= 255 else None}
    category = "COMMAND" if _command_detail(diagnostic) is not None else "CHECK" if code != "PRODUCT_IMAGE_CHECK_FAILED" else error_type
    return {"phase": _phase(diagnostic), "category": category, "code": code, "detail": detail}


def _record_primary(diagnostic, error):
    if diagnostic.get("primary") is None:
        diagnostic["primary"] = _failure(diagnostic, error)


def _record_cleanup(diagnostic, error):
    prior = diagnostic.get("cleanup", {"status": "NOT_RUN", "failure": None, "additionalFailures": []})
    failure = _failure(diagnostic, error)
    if prior.get("status") == "FAILED":
        additional = list(prior.get("additionalFailures", []))[:1]
        if len(additional) < 1:
            additional.append(failure)
        diagnostic["cleanup"] = {"status": "FAILED", "failure": prior["failure"], "additionalFailures": additional}
    else:
        diagnostic["cleanup"] = {"status": "FAILED", "failure": failure, "additionalFailures": []}


def _report_command(diagnostic, detail):
    if type(detail) is dict:
        diagnostic["commandFailure"] = {"phase": _phase(diagnostic), **detail}


def _diagnostic_receipt(diagnostic, status):
    receipt = {"schemaVersion": 1, "status": status, "phase": _phase(diagnostic),
            "diagnosticOwner": diagnostic.get("diagnosticOwner"), "primary": diagnostic.get("primary"),
            "cleanup": diagnostic.get("cleanup", {"status": "NOT_RUN", "failure": None, "additionalFailures": []})}
    if status == "FAILED" and (diagnostic.get("primary") or {}).get("phase") == "LINUX_TESTS":
        receipt["linuxTests"] = diagnostic.get("linuxTests", {"status": "UNAVAILABLE", "observedCases": 0,
            "failedCaseIds": [], "unknownFailures": 0, "unknownOutcomes": 0, "duplicateCases": 0,
            "skippedCases": 0})
    return receipt


def _read_linux_reporter(data):
    """Accept only reporter-owned bounded IDs, never child TAP or error text."""
    if len(data) > 4096:
        return None
    try:
        row = json.loads(data.decode("ascii"))
    except (UnicodeError, ValueError):
        return None
    if type(row) is not dict or set(row) != {"schemaVersion", "observedCases", "failedCaseIds", "unknownFailures", "unknownOutcomes", "duplicateCases", "skippedCases"} or row["schemaVersion"] != 1:
        return None
    count, failures = row["observedCases"], row["failedCaseIds"]
    unknown, duplicate = row["unknownFailures"], row["duplicateCases"]
    unknown_outcomes, skipped = row["unknownOutcomes"], row["skippedCases"]
    if type(count) is not int or not 0 <= count <= 24 or type(failures) is not list or len(failures) > 24 or \
            any(type(case) is not str or case not in _LINUX_CASE_IDS for case in failures) or len(set(failures)) != len(failures) or \
            type(unknown) is not int or not 0 <= unknown <= 25 or type(unknown_outcomes) is not int or not 0 <= unknown_outcomes <= 25 or \
            type(duplicate) is not int or not 0 <= duplicate <= 25 or type(skipped) is not int or not 0 <= skipped <= 25:
        return None
    return {"status": "COMPLETE", "observedCases": count, "failedCaseIds": sorted(failures),
            "unknownFailures": unknown, "unknownOutcomes": unknown_outcomes,
            "duplicateCases": duplicate, "skippedCases": skipped}


def _run_linux_tests(sandbox, context, diagnostic):
    reporter = context / "infra/product-preview/image-build-test-reporter.mjs"
    need(reporter.is_file() and 0 < reporter.stat().st_size <= 8192, "LINUX_REPORTER_UNPROVEN")
    reporter_url = "data:text/javascript;base64," + base64.b64encode(reporter.read_bytes()).decode("ascii")
    timeout = min(180, _deadline - time.monotonic()) if _deadline is not None else 180
    need(timeout > 0, "PRODUCER_DEADLINE")
    diagnostic["linuxTests"] = {"status": "UNAVAILABLE", "observedCases": 0,
        "failedCaseIds": [], "unknownFailures": 0, "unknownOutcomes": 0,
        "duplicateCases": 0, "skippedCases": 0}
    code, output = _source.bounded_command(sandbox + ["--test", "--test-reporter=" + reporter_url,
        *LINUX_ONLY_TESTS], timeout=timeout, report=lambda detail: _report_command(diagnostic, detail))
    parsed = _read_linux_reporter(output)
    if parsed is not None:
        diagnostic["linuxTests"] = parsed
    need(code == 0, "COMMAND_FAILED")
    need(parsed is not None and parsed["observedCases"] == 24 and not parsed["failedCaseIds"] and
         parsed["unknownFailures"] == 0 and parsed["unknownOutcomes"] == 0 and
         parsed["duplicateCases"] == 0 and parsed["skippedCases"] == 0, "LINUX_CASES_UNPROVEN")


def _save_diagnostic(diagnostic, status):
    """Best effort fixed-file artifact; never serialize external text or paths."""
    temporary = DIAGNOSTIC_FILE.with_name(DIAGNOSTIC_FILE.name + ".tmp")
    created = False
    try:
        if DIAGNOSTIC_FILE.is_symlink() or temporary.exists() or temporary.is_symlink():
            return False
        if DIAGNOSTIC_FILE.exists():
            if not diagnostic.get("_ownsDiagnostic"):
                expected = diagnostic.get("diagnosticOwner")
                if type(expected) is not str or not re.fullmatch(r"[a-f0-9]{32}", expected):
                    return False
            if DIAGNOSTIC_FILE.stat().st_size > 2048:
                return False
            prior = json.loads(DIAGNOSTIC_FILE.read_text(encoding="ascii"))
            if type(prior) is not dict or prior.get("diagnosticOwner") != diagnostic.get("diagnosticOwner"):
                return False
        elif diagnostic.get("diagnosticOwner") and not diagnostic.get("_ownsDiagnostic"):
            return False
        payload = (json.dumps(_diagnostic_receipt(diagnostic, status), sort_keys=True, separators=(",", ":")) + "\n").encode("ascii")
        if len(payload) > 2048:
            return False
        with temporary.open("xb") as output:
            created = True
            output.write(payload)
        os.replace(temporary, DIAGNOSTIC_FILE)
        diagnostic["_ownsDiagnostic"] = True
        return True
    except Exception:
        if created:
            try:
                temporary.unlink(missing_ok=True)
            except Exception:
                pass
        return False


def failure_line(diagnostic, error):
    """Fixed vocabulary only; no subprocess bytes, arguments or exception text."""
    failure = _failure(diagnostic, error)
    return "PRODUCT_IMAGE_CHECK_FAILED phase=" + failure["phase"] + " category=" + failure["category"] + " code=" + failure["code"]


@contextmanager
def _temporary_context(diagnostic):
    """Retain the failed phase unless removal itself fails closed."""
    diagnostic["phase"] = "WORKDIR"
    temporary = tempfile.TemporaryDirectory(prefix="meri-product-build-")
    try:
        yield temporary.name
    except Exception as error:
        _record_primary(diagnostic, error)
        raise
    finally:
        failed_phase = diagnostic["phase"]
        diagnostic["phase"] = "WORKDIR_CLEANUP"
        try:
            temporary.cleanup()
        except Exception as error:
            _record_cleanup(diagnostic, error)
            _record_primary(diagnostic, error)
            raise
        if diagnostic.get("cleanup", {}).get("status") == "NOT_RUN":
            diagnostic["cleanup"] = {"status": "OK", "failure": None, "additionalFailures": []}
        diagnostic["phase"] = failed_phase


def run(args, timeout=30, input_bytes=None):
    diagnostic = _active_diagnostic.get()
    if diagnostic is not None:
        diagnostic["commandFailure"] = None
    if _deadline is not None:
        timeout = min(timeout, _deadline - time.monotonic())
        need(timeout > 0, "PRODUCER_DEADLINE")
    report = (lambda detail: _report_command(diagnostic, detail)) if diagnostic is not None else None
    return _source.run(args, timeout=timeout, input_bytes=input_bytes, report=report)


def aws(*args):
    return decode(run(["aws", "--region", REGION, "--no-cli-pager", *args, "--output", "json"]))


def download(pin, target, maximum):
    # The VersionId is immutable, so reject an oversized source before the AWS
    # CLI starts writing the task-local download file.
    head = aws("s3api", "head-object", "--bucket", pin["bucket"], "--key", pin["key"], "--version-id", pin["versionId"])
    need(head.get("VersionId") == pin["versionId"] and type(head.get("ContentLength")) is int and
         0 < head["ContentLength"] <= maximum, "OBJECT_BOUND")
    response = aws("s3api", "get-object", "--bucket", pin["bucket"], "--key", pin["key"], "--version-id", pin["versionId"], str(target))
    need(response.get("VersionId") == pin["versionId"] and target.stat().st_size == head["ContentLength"] and
         file_sha(target, maximum) == pin["sha256"], "OBJECT_BINDING")


def cleanup(docker, probe_name, image, registry, owned_probe, owned_image, authenticated):
    """Remove only names proved absent before this producer allocated them."""
    def call(args):
        diagnostic = _active_diagnostic.get()
        if diagnostic is not None:
            diagnostic["commandFailure"] = None
        try:
            report = (lambda detail: _report_command(diagnostic, detail)) if diagnostic is not None else None
            return _source.bounded_command(args, timeout=15, report=report)
        except Exception:
            raise ValueError("PRODUCT_IMAGE_CLEANUP_UNKNOWN") from None
    unknown = False
    if owned_probe:
        try:
            call(docker + ["container", "rm", "--force", probe_name])
            observed = call(docker + ["container", "ls", "--all", "--filter", "name=^/" + probe_name + "$", "--quiet"])
            need(observed[0] == 0 and not observed[1].strip(), "CLEANUP_UNKNOWN")
        except Exception:
            unknown = True
    if authenticated:
        try:
            need(call(docker + ["logout", registry])[0] == 0, "CLEANUP_UNKNOWN")
        except Exception:
            unknown = True
    if owned_image:
        try:
            call(docker + ["image", "rm", image])
            observed = call(docker + ["image", "ls", "--filter", "reference=" + image, "--quiet"])
            need(observed[0] == 0 and not observed[1].strip(), "CLEANUP_UNKNOWN")
        except Exception:
            unknown = True
    need(not unknown, "CLEANUP_UNKNOWN")


def produce(pin, output, diagnostic=None):
    """No StartBuild, service, task, provider, database or security writes."""
    if diagnostic is None:
        diagnostic = {"phase": "REQUEST"}
    diagnostic["phase"] = "REQUEST"
    diagnostic["primary"] = None
    diagnostic["cleanup"] = {"status": "NOT_RUN", "failure": None, "additionalFailures": []}
    diagnostic["commandFailure"] = None
    token = _active_diagnostic.set(diagnostic)
    try:
        return _produce(pin, output, diagnostic)
    finally:
        _active_diagnostic.reset(token)


def _produce(pin, output, diagnostic):
    global _deadline
    p = validate_request(pin)
    _deadline = time.monotonic() + 1500
    need(sys.platform == "linux" and not output.exists(), "PRODUCER_PLATFORM_OR_OUTPUT")
    diagnostic["phase"] = "BUILD_IDENTITY"
    build_id = os.environ.get("CODEBUILD_BUILD_ID", "")
    need(os.environ.get("CODEBUILD_PROJECT_ARN") == p["codeBuildProjectArn"] and re.fullmatch(re.escape(p["codeBuildProjectArn"].split("/")[1]) + r":[a-f0-9-]{36}", build_id), "BUILD_IDENTITY")
    diagnostic["phase"] = "BUILD_READBACK"
    build = aws("codebuild", "batch-get-builds", "--ids", build_id)["builds"]
    need(len(build) == 1 and build[0]["projectName"] == p["codeBuildProjectArn"].split("/")[1] and build[0]["sourceVersion"] == p["archive"]["versionId"] and build[0]["source"]["type"] == "S3" and build[0]["source"]["location"] == p["archive"]["bucket"] + "/" + p["archive"]["key"], "BUILD_SOURCE")
    repository = p["ecrRepositoryUri"].split("/", 1)[1]
    registry = p["ecrRepositoryUri"].split("/", 1)[0]
    diagnostic["phase"] = "REPOSITORY_READBACK"
    repo = aws("ecr", "describe-repositories", "--repository-names", repository)["repositories"]
    need(len(repo) == 1 and repo[0]["repositoryUri"] == p["ecrRepositoryUri"] and repo[0]["imageTagMutability"] == "IMMUTABLE" and repo[0]["imageScanningConfiguration"]["scanOnPush"] is True, "REPOSITORY_POLICY")
    image = p["ecrRepositoryUri"] + ":" + p["imageTag"]
    with _temporary_context(diagnostic) as temporary:
        root = Path(temporary)
        archive, manifest, context, auth = root / "source.zip", root / "members.json", root / "context", root / "auth"
        context.mkdir(mode=0o700)
        auth.mkdir(mode=0o700)
        diagnostic["phase"] = "SOURCE_ARCHIVE"
        download(p["archive"], archive, 1024**3)
        diagnostic["phase"] = "SOURCE_MANIFEST"
        download(p["manifest"], manifest, 32 * 1024**2)
        diagnostic["phase"] = "SOURCE_VERIFY"
        verified = verify(archive, manifest, p)
        diagnostic["phase"] = "SOURCE_EXTRACT"
        with zipfile.ZipFile(archive) as source:
            for row in decode(manifest.read_bytes())["files"]:
                target = context.joinpath(*row["path"].split("/"))
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open("xb") as stream:
                    stream.write(source.read(row["path"]))
                target.chmod(0o755 if row["mode"] == "100755" else 0o644)
        docker = ["docker", "--config", str(auth)]
        owned_image, owned_probe, authenticated = False, False, False
        probe_name = "meri-product-probe-" + p["imageTag"].rsplit("-", 1)[1]
        try:
            diagnostic["phase"] = "DOCKER_PREFLIGHT"
            need(not run(docker + ["image", "ls", "--filter", "reference=" + image, "--quiet"]).strip(), "LOCAL_IMAGE_EXISTS")
            need(not run(docker + ["container", "ls", "--all", "--filter", "name=^/" + probe_name + "$", "--quiet"]).strip(), "LOCAL_PROBE_EXISTS")
            # No build args except the separately reviewed immutable Node base.
            owned_image = True
            diagnostic["phase"] = "DOCKER_BUILD"
            run(docker + ["build", "--platform", "linux/amd64", "--build-arg", "NODE_IMAGE=" + p["nodeImageUri"], "--label", "org.opencontainers.image.revision=" + p["sourceCommit"], "--label", "org.opencontainers.image.base.name=" + p["nodeImageUri"], "-f", str(context / "apps/runtime/Dockerfile"), "-t", image, str(context)], timeout=900)
            diagnostic["phase"] = "IMAGE_INSPECT"
            inspection = decode(run(docker + ["image", "inspect", image]))[0]
            config = inspection["Config"]
            need(inspection["Os"] == "linux" and inspection["Architecture"] == "amd64" and config["Entrypoint"] == ["node", "apps/runtime/cli.mjs"] and config["Labels"]["org.opencontainers.image.revision"] == p["sourceCommit"] and config["Labels"]["org.opencontainers.image.base.name"] == p["nodeImageUri"] and inspection["Size"] <= 3 * 1024**3, "IMAGE_IDENTITY")
            sandbox = docker + ["run", "--rm", "--name", probe_name, "--init", "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "128", "--memory", "2g", "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=128m", "--entrypoint", "/usr/local/bin/node", image]
            owned_probe = True
            diagnostic["phase"] = "SANDBOX_HELP"
            run(sandbox + ["apps/runtime/cli.mjs", "--help"])
            probe = "import fs from 'node:fs';import {createHash} from 'node:crypto';import {measureProductRunner} from './apps/runtime/native-authority/ecs-prepared-task-proof.mjs';const runner=await measureProductRunner();await import('./apps/runtime/control.mjs');await import('./apps/runtime/temporal-worker.mjs');await import('./apps/runtime/conversation-runner.mjs');console.log(JSON.stringify({runner,node:process.version,runtimeUser:process.getuid()+':'+process.getgid(),executableSha256:createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex')}));"
            diagnostic["phase"] = "SANDBOX_MEASURE"
            measured = decode(run(sandbox + ["--input-type=module", "-e", probe], timeout=90))
            need(measured["node"] == p["nodeVersion"] and measured["runtimeUser"] == p["runtimeUser"] and measured["runner"] == {"contract": CONTRACT, "path": RUNNER, "runnerSha256": p["runnerSha256"], "bytes": verified["runnerBytes"]} and SHA.fullmatch(measured["executableSha256"]), "IMAGE_MEASUREMENT")
            # These fixtures require POSIX path and owner semantics. Qualify them
            # inside the exact nonroot image before obtaining registry credentials.
            diagnostic["phase"] = "LINUX_TESTS"
            _run_linux_tests(sandbox, context, diagnostic)
            # No registry credentials exist until all source and image checks pass.
            diagnostic["phase"] = "ECR_AUTH"
            password = run(["aws", "--region", REGION, "ecr", "get-login-password"])
            try:
                authenticated = True
                run(docker + ["login", "--username", "AWS", "--password-stdin", registry], input_bytes=password)
            finally:
                password = None
            diagnostic["phase"] = "ECR_PUSH"
            run(docker + ["push", image], timeout=180)
            diagnostic["phase"] = "ECR_READBACK"
            details = aws("ecr", "describe-images", "--repository-name", repository, "--image-ids", "imageTag=" + p["imageTag"])["imageDetails"]
            need(len(details) == 1 and re.fullmatch(r"sha256:[a-f0-9]{64}", details[0]["imageDigest"]), "IMAGE_READBACK")
            image_digest = details[0]["imageDigest"]
            deadline = time.monotonic() + 300
            diagnostic["phase"] = "ECR_SCAN"
            while True:
                scan = aws("ecr", "describe-image-scan-findings", "--repository-name", repository, "--image-id", "imageDigest=" + image_digest)
                status = scan["imageScanStatus"]["status"]
                if status == "COMPLETE":
                    break
                need(status in ("IN_PROGRESS", "PENDING") and time.monotonic() < deadline, "SCAN_INCOMPLETE")
                time.sleep(10)
            counts = scan.get("imageScanFindings", {}).get("findingSeverityCounts", {})
            need(type(counts) is dict and all(type(n) is int and n >= 0 for n in counts.values()) and not counts.get("HIGH", 0) and not counts.get("CRITICAL", 0), "SCAN_FINDINGS_HOLD")
            receipt = {"buildId": build_id, "sourceVersion": p["archive"]["versionId"], "sourceCommit": p["sourceCommit"], "archiveSha256": verified["archiveSha256"], "dockerfileSha256": p["dockerfileSha256"], "nodeImageUri": p["nodeImageUri"], "imageDigest": image_digest, "runnerSha256": measured["runner"]["runnerSha256"], "runnerMeasurement": measured["runner"], "runtimeUser": measured["runtimeUser"], "executableSha256": measured["executableSha256"], "sourceManifestSha256": verified["sourceManifestSha256"], "verifierSha256": p["verifierSha256"], "producerSha256": p["producerSha256"], "scanStatus": status, "findingSeverityCounts": counts}
        except Exception as error:
            _record_primary(diagnostic, error)
            raise
        finally:
            failed_phase = diagnostic["phase"]
            diagnostic["phase"] = "CLEANUP"
            diagnostic["commandFailure"] = None
            try:
                cleanup(docker, probe_name, image, registry, owned_probe, owned_image, authenticated)
            except Exception as error:
                _record_cleanup(diagnostic, error)
                _record_primary(diagnostic, error)
                raise
            diagnostic["cleanup"] = {"status": "OK", "failure": None, "additionalFailures": []}
            diagnostic["phase"] = failed_phase
            # TemporaryDirectory removes the private Docker credential file on all exits.
    # A receipt appears only after container/image checks and physical auth cleanup.
    diagnostic["phase"] = "RECEIPT"
    with output.open("xb") as stream:
        stream.write(encoded(receipt))
    return {"status": "PRODUCER_RECEIPT_ONLY", "imageDigest": image_digest, "runnerSha256": measured["runner"]["runnerSha256"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__, epilog="Exit: 0 success/help; 2 invalid input, failed check, unavailable command or timeout. No automatic retries.")
    parser.add_argument("--request", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    owner = os.environ.get("MERI_PRODUCT_DIAGNOSTIC_OWNER")
    if owner is not None and not re.fullmatch(r"[a-f0-9]{32}", owner):
        print("PRODUCT_IMAGE_CHECK_FAILED phase=DIAGNOSTIC category=WRITE code=PRODUCT_IMAGE_CHECK_FAILED", file=sys.stderr)
        return 2
    diagnostic = {"phase": "REQUEST", "primary": None, "cleanup": {"status": "NOT_RUN", "failure": None, "additionalFailures": []}, "diagnosticOwner": owner}
    if not _save_diagnostic(diagnostic, "STARTED"):
        print("PRODUCT_IMAGE_CHECK_FAILED phase=DIAGNOSTIC category=WRITE code=PRODUCT_IMAGE_CHECK_FAILED", file=sys.stderr)
        return 2
    try:
        result = produce(decode(args.request.read_bytes()), args.output, diagnostic)
        if not _save_diagnostic(diagnostic, "SUCCEEDED"):
            print("PRODUCT_IMAGE_CHECK_FAILED phase=DIAGNOSTIC category=WRITE code=PRODUCT_IMAGE_CHECK_FAILED", file=sys.stderr)
            return 2
        print(json.dumps(result, sort_keys=True))
        return 0
    except Exception as error:
        _record_primary(diagnostic, error)
        if not _save_diagnostic(diagnostic, "FAILED"):
            print("PRODUCT_IMAGE_CHECK_FAILED phase=DIAGNOSTIC category=WRITE code=PRODUCT_IMAGE_CHECK_FAILED", file=sys.stderr)
        primary = diagnostic["primary"]
        print("PRODUCT_IMAGE_CHECK_FAILED phase=" + primary["phase"] + " category=" + primary["category"] + " code=" + primary["code"], file=sys.stderr)
        if diagnostic["cleanup"]["status"] == "FAILED":
            for failed in [diagnostic["cleanup"]["failure"], *diagnostic["cleanup"]["additionalFailures"]]:
                print("PRODUCT_IMAGE_CLEANUP_FAILED phase=" + failed["phase"] + " category=" + failed["category"] + " code=" + failed["code"], file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
