"""Measurement-only Linux CodeBuild wrapper. Root operator executes after review.

No image build/push, deployment, task registration, or resource creation. Uses the
byte-pinned canonical verifier and bounded command adapter. Output never includes
child stderr, registry password, environment, or arbitrary exception text.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import time

SOURCE = "2b4421f612f9fbb728d6da52927aac228d712d40"
PROJECT_ARN = "arn:aws:codebuild:us-east-1:967807252336:project/meri-greenfield-qualification-build"
PROJECT_ROLE_ARN = "arn:aws:iam::967807252336:role/MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H"
VERIFIER = "c373ff556873823e1fd7cb5a00945ed2f70f41acb74c96d2d9756d0f12bf461d"
OUTPUTS = ("launch-measurement.json", "launch-readback.json", "runtime-native.json",
           "runtime-packages.json", "measurement-provenance.json", "measurement-diagnostic.json")
READBACK = r"""import {readFileSync,realpathSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {measureProductRunner} from '/opt/meri/apps/runtime/native-authority/ecs-prepared-task-proof.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const modulePath='/opt/meri/apps/runtime/build/first-chat-launch-measurement.mjs';
const directory='/opt/meri/apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64';
const cliPath=directory+'/claude',bytes=readFileSync(cliPath),st=statSync(cliPath);
const pkg=JSON.parse(readFileSync(directory+'/package.json','utf8'));
const sdk=JSON.parse(readFileSync('/opt/meri/apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk/package.json','utf8'));
console.log(JSON.stringify({platform:{os:process.platform,arch:process.arch,node:process.version,uid:process.getuid(),gid:process.getgid()},
nodeExecutable:{path:realpathSync(process.execPath),sha256:sha(readFileSync(process.execPath))},
module:{path:modulePath,sha256:sha(readFileSync(modulePath))},runner:await measureProductRunner(),
sdkVersion:sdk.version,platformPackage:{name:pkg.name,version:pkg.version},
executable:{path:realpathSync(cliPath),sha256:sha(bytes),bytes:bytes.length,isFile:st.isFile(),executable:(st.mode&0o111)!==0,cliVersionMarker:bytes.includes(Buffer.from('VERSION:"2.1.295"'))}}));"""


def need(value):
    if not value:
        raise ValueError("MEASUREMENT_REFUSED")


def digest(value):
    return hashlib.sha256(value).hexdigest()


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def main(plan_path):
    phase, cleanup_ok = "PRECHECK", False
    command_detail = None
    artifact_root = Path.cwd()
    temporary = None
    docker, registry, image, name = None, None, None, None
    owns_image, owns_container, login_attempted = False, False, False
    outputs = {}
    source = None
    deadline = time.monotonic() + 420

    def report(detail):
        nonlocal command_detail
        command_detail = detail

    def run(argv, seconds=30, input_bytes=None, cleaning=False):
        remaining = 15 if cleaning else min(seconds, deadline - time.monotonic())
        need(remaining > 0)
        code, output = source.bounded_command(argv, timeout=remaining, input_bytes=input_bytes, report=report)
        need(code == 0)
        return output

    def aws(*argv):
        payload = run(["aws", "--region", "us-east-1", "--no-cli-pager", *argv, "--output", "json"])
        need(len(payload) <= 2 * 1024**2)
        return source.decode(payload)

    def image_present(cleaning=False):
        # Digest references are not tags. List actual digest rows instead of
        # relying on Docker's tag-oriented reference filter for absence proof.
        raw = run(docker + ["image", "ls", "--digests", "--no-trunc", "--format", "{{json .}}"], cleaning=cleaning)
        rows = [source.decode(line) for line in raw.splitlines() if line.strip()]
        return any(row.get("Repository", "") + "@" + row.get("Digest", "") == image for row in rows)

    try:
        need(sys.platform == "linux" and all(not (artifact_root / f).exists() for f in OUTPUTS))
        plan_bytes = plan_path.read_bytes()
        need(0 < len(plan_bytes) <= 512 * 1024)
        plan = json.loads(plan_bytes)
        need(plan["schema"] == "meri.operator-launch-measurement-plan.v1")
        request, product = plan["request"], plan["productReceipt"]
        need(request["sourceCommit"] == SOURCE and request["verifierSha256"] == VERIFIER)
        need(re.fullmatch(r"[a-f0-9]{32}", plan["attempt"]))
        need(plan["projectRoleArn"] == PROJECT_ROLE_ARN and request["codeBuildProjectArn"] == PROJECT_ARN)
        need(type(plan["command"]) is str and 0 < len(plan["command"].encode()) <= 8192)
        # No alternate command is accepted: the plan pins canonical shipped argv.
        need(plan["command"].startswith("set -euo pipefail; cd '/opt/meri'; exec -c /usr/local/bin/node 'apps/runtime/build/first-chat-launch-measurement.mjs' "))
        source_root = Path(os.environ["CODEBUILD_SRC_DIR"]).resolve(strict=True)
        verifier = source_root / "infra/product-preview/image-build-source.py"
        need(verifier.is_file() and not verifier.is_symlink() and digest(verifier.read_bytes()) == VERIFIER)
        spec = importlib.util.spec_from_file_location("meri_measurement_source", verifier)
        source = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(source)
        source.validate_request(request)
        need(plan["image"] == request["ecrRepositoryUri"] + "@" + product["imageDigest"])
        need(re.fullmatch(r"sha256:[a-f0-9]{64}", product["imageDigest"]))
        need(product["sourceCommit"] == SOURCE and product["scanStatus"] == "COMPLETE")
        need(not product["findingSeverityCounts"].get("HIGH", 0) and not product["findingSeverityCounts"].get("CRITICAL", 0))
        os.environ.update(AWS_PAGER="", AWS_MAX_ATTEMPTS="1", AWS_RETRY_MODE="standard")
        phase = "BUILD_IDENTITY"
        build_id = os.environ["CODEBUILD_BUILD_ID"]
        need(os.environ.get("CODEBUILD_PROJECT_ARN") == request["codeBuildProjectArn"])
        need(re.fullmatch(re.escape(request["codeBuildProjectArn"].split("/")[1]) + r":[a-f0-9-]{36}", build_id))
        build = aws("codebuild", "batch-get-builds", "--ids", build_id)["builds"]
        need(len(build) == 1)
        build = build[0]
        need(build["projectName"] == request["codeBuildProjectArn"].split("/")[1] and build["serviceRole"] == plan["projectRoleArn"])
        need(build["sourceVersion"] == request["archive"]["versionId"] and build["source"]["type"] == "S3" and build["source"]["location"] == request["archive"]["bucket"] + "/" + request["archive"]["key"])
        need(build["environment"]["type"] == "LINUX_CONTAINER" and build["environment"]["privilegedMode"] is True)
        need(build["environment"]["computeType"] == "BUILD_GENERAL1_SMALL" and build["environment"]["image"] == "aws/codebuild/standard:7.0")
        need(build["timeoutInMinutes"] == 10 and build["queuedTimeoutInMinutes"] == 5)
        need(build.get("autoRetryConfig", {}).get("autoRetryLimit", 0) == 0 and build.get("autoRetryConfig", {}).get("autoRetryNumber", 0) == 0)
        temporary = Path(tempfile.mkdtemp(prefix="meri-launch-measurement-"))
        temporary.chmod(0o700)
        phase = "SOURCE_VERIFY"
        for key, maximum in (("archive", 1024**3), ("manifest", 32*1024**2)):
            pin = request[key]
            head = aws("s3api", "head-object", "--bucket", pin["bucket"], "--key", pin["key"], "--version-id", pin["versionId"])
            need(head["VersionId"] == pin["versionId"] and type(head["ContentLength"]) is int and 0 < head["ContentLength"] <= maximum)
            dest = temporary / key
            result = aws("s3api", "get-object", "--bucket", pin["bucket"], "--key", pin["key"], "--version-id", pin["versionId"], str(dest))
            need(result["VersionId"] == pin["versionId"] and dest.stat().st_size == head["ContentLength"] and source.file_sha(dest, maximum) == pin["sha256"])
        source.verify(temporary / "archive", temporary / "manifest", request)
        members = {r["path"]: r for r in source.decode((temporary / "manifest").read_bytes())["files"]}
        for path, pin in plan["sourcePins"].items():
            need(members[path]["sha256"] == pin["sha256"] and members[path]["bytes"] == pin["bytes"])
        phase = "ECR_IDENTITY"
        registry, repository = request["ecrRepositoryUri"].split("/", 1)
        repo = aws("ecr", "describe-repositories", "--repository-names", repository)["repositories"]
        need(len(repo) == 1 and repo[0]["repositoryUri"] == request["ecrRepositoryUri"] and repo[0]["imageTagMutability"] == "IMMUTABLE" and repo[0]["imageScanningConfiguration"]["scanOnPush"] is True)
        detail = aws("ecr", "describe-images", "--repository-name", repository, "--image-ids", "imageDigest="+product["imageDigest"])["imageDetails"]
        need(len(detail) == 1 and request["imageTag"] in detail[0]["imageTags"] and detail[0]["imageDigest"] == product["imageDigest"])
        scan = aws("ecr", "describe-image-scan-findings", "--repository-name", repository, "--image-id", "imageDigest="+product["imageDigest"])
        need(scan["imageScanStatus"]["status"] == "COMPLETE")
        counts = scan.get("imageScanFindings", {}).get("findingSeverityCounts", {})
        need(type(counts) is dict and all(type(n) is int and n >= 0 for n in counts.values()) and not counts.get("HIGH", 0) and not counts.get("CRITICAL", 0))
        auth = temporary / "auth"
        auth.mkdir(mode=0o700)
        docker = ["docker", "--config", str(auth)]
        image = plan["image"]
        name = "meri-launch-measure-" + plan["attempt"]
        phase = "DOCKER_PREFLIGHT"
        need(not image_present())
        need(not run(docker + ["container", "ls", "--all", "--filter", "name=^/"+name+"$", "--quiet"]).strip())
        phase = "ECR_AUTH_PULL"
        password = run(["aws", "--region", "us-east-1", "ecr", "get-login-password"])
        try:
            login_attempted = True
            run(docker + ["login", "--username", "AWS", "--password-stdin", registry], input_bytes=password)
        finally:
            password = None
        owns_image = True
        run(docker + ["pull", "--platform", "linux/amd64", image], seconds=180)
        phase = "IMAGE_INSPECT"
        inspections = source.decode(run(docker + ["image", "inspect", image]))
        need(len(inspections) == 1)
        inspection = inspections[0]
        conf = inspection["Config"]
        need(image in inspection["RepoDigests"] and inspection["Os"] == "linux" and inspection["Architecture"] == "amd64" and 0 < inspection["Size"] <= 3*1024**3)
        need(conf["User"] == "node" and conf["WorkingDir"] == "/opt/meri" and conf["Entrypoint"] == ["node", "apps/runtime/cli.mjs"])
        for label, expected in (("org.opencontainers.image.revision", SOURCE), ("org.opencontainers.image.base.name", request["runtimeBaseImageUri"]), ("io.meri.node.base", request["nodeImageUri"]), ("io.meri.runtime.packages.sha256", request["runtimePackagesSha256"])):
            need(conf["Labels"][label] == expected)
        sandbox = docker + ["run", "--pull=never", "--rm", "--name", name, "--init", "--platform", "linux/amd64", "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "128", "--memory", "2g", "--user", "1000:1000", "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=128m", "--entrypoint", "/bin/bash", image]
        commands = (
            ("LAUNCH", "launch-measurement.json", ["-c", plan["command"]]),
            ("READBACK", "launch-readback.json", ["-c", 'exec -c /usr/local/bin/node --input-type=module -e "$1"', "--", READBACK]),
            ("NATIVE", "runtime-native.json", ["-c", "cd /opt/meri && exec -c /usr/local/bin/node apps/runtime/build/runtime-base-probe.mjs --measure"]),
            ("PACKAGES", "runtime-packages.json", ["-c", "cd /opt/meri && exec -c /usr/local/bin/node apps/runtime/build/runtime-packages.mjs verify --lock infra/product-preview/runtime-packages.lock.json"]),
        )
        for phase, filename, argv in commands:
            owns_container = True
            raw = run(sandbox + argv, seconds=180)
            need(0 < len(raw) <= 2*1024**2)
            outputs[filename] = source.decode(raw)
            need(not run(docker + ["container", "ls", "--all", "--filter", "name=^/"+name+"$", "--quiet"]).strip())
        outputs["measurement-provenance.json"] = {"schema": "meri.operator-launch-measurement-result.v1", "attempt": plan["attempt"], "planSha256": digest(plan_bytes), "buildId": build_id, "sourceCommit": SOURCE, "sourceVersion": request["archive"]["versionId"], "image": image,
            "inspection": {k: inspection[k] for k in ("RepoDigests", "Os", "Architecture", "Size", "Config")}, "cleanup": "COMPLETE"}
        phase = "COMPLETE"
    except Exception:
        outputs = {}
    finally:
        cleanup_ok = True
        if source is not None and docker is not None:
            if owns_container:
                try:
                    source.bounded_command(docker + ["container", "rm", "--force", "--volumes", name], timeout=15)
                    need(not run(docker + ["container", "ls", "--all", "--filter", "name=^/"+name+"$", "--quiet"], cleaning=True).strip())
                except Exception:
                    cleanup_ok = False
            if login_attempted:
                try:
                    run(docker + ["logout", registry], cleaning=True)
                except Exception:
                    cleanup_ok = False
            if owns_image:
                try:
                    source.bounded_command(docker + ["image", "rm", image], timeout=15)
                    need(not image_present(cleaning=True))
                except Exception:
                    cleanup_ok = False
        if temporary is not None:
            try:
                shutil.rmtree(temporary)
                need(not temporary.exists())
            except Exception:
                cleanup_ok = False
        success = phase == "COMPLETE" and cleanup_ok and len(outputs) == 5
        # Public fixed fields only. In particular never print exception messages.
        diagnostic = {"schemaVersion": 1, "status": "SUCCEEDED" if success else "FAILED", "phase": phase, "cleanup": "COMPLETE" if cleanup_ok else "UNKNOWN", "commandFailure": command_detail}
        try:
            with (artifact_root / "measurement-diagnostic.json").open("xb") as stream:
                stream.write(encoded(diagnostic))
            if success:
                for filename, value in outputs.items():
                    with (artifact_root / filename).open("xb") as stream:
                        stream.write(encoded(value))
        except Exception:
            success = False
        print("MEASUREMENT_WRAPPER_COMPLETE" if success else "MEASUREMENT_WRAPPER_REFUSED")
        return 0 if success else 2


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, epilog="Exit 0 receipts after cleanup; 2 refused. No retries.")
    parser.add_argument("--plan", type=Path, required=True)
    parsed = parser.parse_args()
    raise SystemExit(main(parsed.plan))
