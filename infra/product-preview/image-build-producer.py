"""Separately authorized Linux product image producer. Importing is inert.

Source sealing and archive verification belong to image-build-source.py. The exact
reviewed buildspec authenticates both module byte hashes before executing this file.
"""
import argparse
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
)
_deadline = None


def run(args, timeout=30, input_bytes=None):
    if _deadline is not None:
        timeout = min(timeout, _deadline - time.monotonic())
        need(timeout > 0, "PRODUCER_DEADLINE")
    return _source.run(args, timeout=timeout, input_bytes=input_bytes)


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
        try:
            return _source.bounded_command(args, timeout=15)
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


def produce(pin, output):
    """No StartBuild, service, task, provider, database or security writes."""
    global _deadline
    p = validate_request(pin)
    _deadline = time.monotonic() + 1500
    need(sys.platform == "linux" and not output.exists(), "PRODUCER_PLATFORM_OR_OUTPUT")
    build_id = os.environ.get("CODEBUILD_BUILD_ID", "")
    need(os.environ.get("CODEBUILD_PROJECT_ARN") == p["codeBuildProjectArn"] and re.fullmatch(re.escape(p["codeBuildProjectArn"].split("/")[1]) + r":[a-f0-9-]{36}", build_id), "BUILD_IDENTITY")
    build = aws("codebuild", "batch-get-builds", "--ids", build_id)["builds"]
    need(len(build) == 1 and build[0]["projectName"] == p["codeBuildProjectArn"].split("/")[1] and build[0]["sourceVersion"] == p["archive"]["versionId"] and build[0]["source"]["type"] == "S3" and build[0]["source"]["location"] == p["archive"]["bucket"] + "/" + p["archive"]["key"], "BUILD_SOURCE")
    repository = p["ecrRepositoryUri"].split("/", 1)[1]
    registry = p["ecrRepositoryUri"].split("/", 1)[0]
    repo = aws("ecr", "describe-repositories", "--repository-names", repository)["repositories"]
    need(len(repo) == 1 and repo[0]["repositoryUri"] == p["ecrRepositoryUri"] and repo[0]["imageTagMutability"] == "IMMUTABLE" and repo[0]["imageScanningConfiguration"]["scanOnPush"] is True, "REPOSITORY_POLICY")
    image = p["ecrRepositoryUri"] + ":" + p["imageTag"]
    with tempfile.TemporaryDirectory(prefix="meri-product-build-") as temporary:
        root = Path(temporary)
        archive, manifest, context, auth = root / "source.zip", root / "members.json", root / "context", root / "auth"
        context.mkdir(mode=0o700)
        auth.mkdir(mode=0o700)
        download(p["archive"], archive, 1024**3)
        download(p["manifest"], manifest, 32 * 1024**2)
        verified = verify(archive, manifest, p)
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
            need(not run(docker + ["image", "ls", "--filter", "reference=" + image, "--quiet"]).strip(), "LOCAL_IMAGE_EXISTS")
            need(not run(docker + ["container", "ls", "--all", "--filter", "name=^/" + probe_name + "$", "--quiet"]).strip(), "LOCAL_PROBE_EXISTS")
            # No build args except the separately reviewed immutable Node base.
            owned_image = True
            run(docker + ["build", "--platform", "linux/amd64", "--build-arg", "NODE_IMAGE=" + p["nodeImageUri"], "--label", "org.opencontainers.image.revision=" + p["sourceCommit"], "--label", "org.opencontainers.image.base.name=" + p["nodeImageUri"], "-f", str(context / "apps/runtime/Dockerfile"), "-t", image, str(context)], timeout=900)
            inspection = decode(run(docker + ["image", "inspect", image]))[0]
            config = inspection["Config"]
            need(inspection["Os"] == "linux" and inspection["Architecture"] == "amd64" and config["Entrypoint"] == ["node", "apps/runtime/cli.mjs"] and config["Labels"]["org.opencontainers.image.revision"] == p["sourceCommit"] and config["Labels"]["org.opencontainers.image.base.name"] == p["nodeImageUri"] and inspection["Size"] <= 3 * 1024**3, "IMAGE_IDENTITY")
            sandbox = docker + ["run", "--rm", "--name", probe_name, "--init", "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "128", "--memory", "2g", "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=128m", "--entrypoint", "/usr/local/bin/node", image]
            owned_probe = True
            run(sandbox + ["apps/runtime/cli.mjs", "--help"])
            probe = "import fs from 'node:fs';import {createHash} from 'node:crypto';import {measureProductRunner} from './apps/runtime/native-authority/ecs-prepared-task-proof.mjs';const runner=await measureProductRunner();await import('./apps/runtime/control.mjs');await import('./apps/runtime/temporal-worker.mjs');await import('./apps/runtime/conversation-runner.mjs');console.log(JSON.stringify({runner,node:process.version,runtimeUser:process.getuid()+':'+process.getgid(),executableSha256:createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex')}));"
            measured = decode(run(sandbox + ["--input-type=module", "-e", probe], timeout=90))
            need(measured["node"] == p["nodeVersion"] and measured["runtimeUser"] == p["runtimeUser"] and measured["runner"] == {"contract": CONTRACT, "path": RUNNER, "runnerSha256": p["runnerSha256"], "bytes": verified["runnerBytes"]} and SHA.fullmatch(measured["executableSha256"]), "IMAGE_MEASUREMENT")
            # These fixtures require POSIX path and owner semantics. Qualify them
            # inside the exact nonroot image before obtaining registry credentials.
            run(sandbox + ["--test", *LINUX_ONLY_TESTS], timeout=180)
            # No registry credentials exist until all source and image checks pass.
            password = run(["aws", "--region", REGION, "ecr", "get-login-password"])
            try:
                authenticated = True
                run(docker + ["login", "--username", "AWS", "--password-stdin", registry], input_bytes=password)
            finally:
                password = None
            run(docker + ["push", image], timeout=180)
            details = aws("ecr", "describe-images", "--repository-name", repository, "--image-ids", "imageTag=" + p["imageTag"])["imageDetails"]
            need(len(details) == 1 and re.fullmatch(r"sha256:[a-f0-9]{64}", details[0]["imageDigest"]), "IMAGE_READBACK")
            image_digest = details[0]["imageDigest"]
            deadline = time.monotonic() + 300
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
        finally:
            cleanup(docker, probe_name, image, registry, owned_probe, owned_image, authenticated)
            # TemporaryDirectory removes the private Docker credential file on all exits.
    # A receipt appears only after container/image checks and physical auth cleanup.
    with output.open("xb") as stream:
        stream.write(encoded(receipt))
    return {"status": "PRODUCER_RECEIPT_ONLY", "imageDigest": image_digest, "runnerSha256": measured["runner"]["runnerSha256"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__, epilog="Exit: 0 success/help; 2 invalid input, failed check, unavailable command or timeout. No automatic retries.")
    parser.add_argument("--request", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = produce(decode(args.request.read_bytes()), args.output)
        print(json.dumps(result, sort_keys=True))
        return 0
    except Exception:
        print("PRODUCT_IMAGE_CHECK_FAILED", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
