#!/usr/bin/env python3
"""Run P0's existing image gate/suites with public build inputs and no AWS access."""
import argparse
import ast
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time

from evidence import decode_output


NODE_IMAGE = "public.ecr.aws/docker/library/node@sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63"
RUNTIME_IMAGE = "cgr.dev/chainguard/wolfi-base@sha256:030e45cb37187dff322bbefe9658bcaec31b824a5d523380771a64864c9f45d4"
PYTHON_IMAGE = "public.ecr.aws/docker/library/python:3.13-slim"
HERE = Path(__file__).resolve().parent


def output(argv, cwd=None):
    return subprocess.check_output(argv, cwd=cwd, text=True, timeout=60).strip()


def files(source, *patterns):
    return output(["git", "ls-files", "--", *patterns], source).splitlines()


def fixture_paths(source):
    tree = ast.parse((source / "infra/product-preview/image-build-linux-checks.py").read_text())
    for item in tree.body:
        if isinstance(item, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "FIXTURE_PATHS" for t in item.targets):
            value = ast.literal_eval(item.value)
            if len(value) == 10 and all(isinstance(p, str) and not Path(p).is_absolute() and ".." not in Path(p).parts for p in value):
                return value
    raise ValueError("The canonical ten-fixture gate is unavailable")


class Verification:
    def __init__(self, source, destination, side, mode):
        self.source, self.destination = source, destination
        self.result = {"schemaVersion": 1, "side": side, "mode": mode, "status": "blocked", "checks": [],
                       "nodeBase": NODE_IMAGE, "runtimeBase": RUNTIME_IMAGE}
        destination.mkdir(parents=True, exist_ok=True)
        self.save()

    def save(self):
        (self.destination / "result.json").write_text(json.dumps(self.result, indent=2) + "\n")

    def run(self, name, argv, timeout, kind=None, cwd=None):
        path = self.destination / f"{name}.log"
        start = time.monotonic()
        with path.open("w") as log:
            try:
                process = subprocess.Popen(argv, cwd=cwd or self.source, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
                try:
                    code = process.wait(timeout=timeout)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait(timeout=15)
                    log.write(f"\nP0_CHECK_TIMEOUT seconds={timeout}\n")
                    code = 124
            except OSError as exc:
                log.write(f"P0_COMMAND_UNAVAILABLE errno={exc.errno}\n")
                code = 127
        decoded = decode_output(path.read_text(errors="replace"), kind)
        status = "passed" if code == 0 else "failed"
        if kind == "gate" and not decoded.get("gateValid"):
            status = "failed"
        if kind in ("node", "python") and not decoded.get("tests"):
            status = "unverified"
        check = {"name": name, "status": status, "exitCode": code,
                 "elapsedSeconds": round(time.monotonic() - start, 3), "log": path.name, **decoded}
        self.result["checks"].append(check)
        self.save()
        print(json.dumps(check), flush=True)
        if status != "passed":
            print("\n".join(path.read_text(errors="replace").splitlines()[-80:]), flush=True)
        return check

    def runtime(self, context):
        image = "meri-p0-runtime:" + self.result["commit"][:12]
        self.result["image"] = image
        build = self.run("runtime-build", ["docker", "build", "--platform", "linux/amd64",
                         "--build-arg", f"NODE_IMAGE={NODE_IMAGE}", "--build-arg", f"RUNTIME_IMAGE={RUNTIME_IMAGE}",
                         "--file", "apps/runtime/Dockerfile", "--tag", image, "."], 2400, cwd=context)
        if build["status"] != "passed":
            build["status"] = "blocked"
            return
        self.result["imageId"] = output(["docker", "image", "inspect", "--format", "{{.Id}}", image])
        sandbox = ["docker", "run", "--rm", "--init", "--network", "none", "--read-only", "--cap-drop", "ALL",
                   "--security-opt", "no-new-privileges", "--pids-limit", "128", "--memory", "2g",
                   "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=128m"]
        self.run("image-user", [*sandbox, "--entrypoint", "/usr/local/bin/node", image,
                 "-e", "if(process.getuid()!==1000)process.exit(1);console.log('uid=1000')"], 60)
        mounts = []
        for path in fixture_paths(context):
            mounts += ["--mount", f"type=bind,src={context / path},dst=/opt/meri/{path},readonly"]
        reporter = base64.b64encode((context / "infra/product-preview/image-build-test-reporter.mjs").read_bytes()).decode()
        name = "meri-p0-gate-" + str(os.getpid())
        try:
            self.run("image-gate", [*sandbox, "--name", name, *mounts, "--entrypoint", "/usr/local/bin/node", image,
                     "--test", "--test-reporter=data:text/javascript;base64," + reporter,
                     "apps/runtime/test/prepared-candidate-bootstrap.test.mjs", "apps/runtime/test/remote-conversation-runner.test.mjs",
                     "apps/runtime/temporal-product-token-writer.test.mjs"], 1500, "gate")
        finally:
            subprocess.run(["docker", "rm", "-f", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30)
        groups = [
            ("runner-diagnostics", 1500, [
                "apps/runtime/test/runner-runtime-diagnostics.test.mjs", "apps/runtime/test/runner-first-failure.test.mjs",
                "apps/runtime/test/pinned-native-transport.test.mjs", "apps/runtime/test/activity-runtime-diagnostics.test.mjs",
                "apps/runtime/native-authority/test/sdk-initialization-milestones.test.mjs", "apps/runtime/native-authority/test/native-start-router-budget.test.mjs"]),
            ("control", 1500, ["apps/control/conversations/test/load-amplification.test.mjs", "apps/control/conversations/test/startup-composition-latency.test.mjs"]),
            ("worker", 1500, files(self.source, "apps/worker/conversation/test/*.test.mjs")),
            ("owner", 1500, files(self.source, "apps/proxy/product/*.test.mjs", "apps/proxy/product/test/*.test.mjs")),
            ("telemetry", 1500, files(self.source, "apps/runtime/telemetry/test/*.test.mjs")),
        ]
        changed = json.loads(os.environ.get("P0_CHANGED_NODE_TESTS", "[]"))
        if not isinstance(changed, list) or any(not isinstance(p, str) or not re.fullmatch(r"[a-zA-Z0-9_./-]+\.test\.mjs", p) or ".." in Path(p).parts for p in changed):
            raise ValueError("P0_CHANGED_NODE_TESTS must contain repository test paths")
        rehearsals = [
            ("first-turn", 1500, ["--test-name-pattern=first turn", "apps/runtime/test/first-turn-rehearsal.test.mjs"]),
            ("d3", 3300, ["apps/runtime/test/d3-rehearsal.test.mjs"]),
        ]
        selected = {p for _, _, paths in [*groups, *rehearsals] for p in paths}
        additional = [p for p in changed if p not in selected and not p.startswith("infra/product-preview/first-chat/") and (context / p).is_file()]
        self.result["candidateOnlyTestsAbsent"] = [p for p in changed if not (context / p).is_file()]
        # Include the observability test for direct local use even without a diff.
        observability = "infra/product-preview/first-chat-observability.test.mjs"
        if (context / observability).is_file() and observability not in additional:
            additional.append(observability)
        groups.append(("changed-tests", 1500, additional))
        groups += rehearsals
        for group, limit, paths in groups:
            if not paths:
                if group != "changed-tests":
                    raise ValueError(f"Required suite has no test files: {group}")
                self.result["checks"].append({"name": group, "status": "not-applicable", "reason": "No matching tests on this commit"})
                self.save()
                continue
            command = ["bash", str(HERE / "in-image.sh"), image, str(self.source), str(limit), *paths]
            check = self.run(group, command, limit + 240, "node")
            if group in ("first-turn", "d3") and check["clockSteps"]:
                check["status"] = "unverified-clock-step"
                retry = self.run(group + "-clock-retry", command, limit + 240, "node")
                if retry["clockSteps"]:
                    retry["status"] = "unverified"
                self.save()

    def proxy(self, context, temporary):
        pull = self.run("python-base", ["docker", "pull", "--platform", "linux/amd64", PYTHON_IMAGE], 600)
        if pull["status"] != "passed":
            pull["status"] = "blocked"
            return
        digest = output(["docker", "image", "inspect", "--format", "{{index .RepoDigests 0}}", PYTHON_IMAGE])
        if not re.fullmatch(r"public\.ecr\.aws/docker/library/python@sha256:[a-f0-9]{64}", digest):
            raise ValueError("Python base digest was not resolved")
        self.result["pythonBaseDigest"] = digest
        build_context = temporary / "proxy-build"
        build_context.mkdir()
        shutil.copyfile(HERE / "proxy-test.Dockerfile", build_context / "Dockerfile")
        shutil.copyfile(context / "apps/proxy/qualification/linux/requirements.lock", build_context / "requirements.lock")
        image = "meri-p0-proxy:" + self.result["commit"][:12]
        self.result["image"] = image
        build = self.run("proxy-build", ["docker", "build", "--platform", "linux/amd64", "--build-arg", "PYTHON_IMAGE=" + digest,
                         "--tag", image, "."], 2400, cwd=build_context)
        if build["status"] != "passed":
            build["status"] = "blocked"
            return
        self.result["imageId"] = output(["docker", "image", "inspect", "--format", "{{.Id}}", image])
        modules = [p[:-3].replace("/", ".") for p in files(self.source, "apps/proxy/product/test/test_*.py",
                   "apps/proxy/product/test_*.py", "apps/proxy/qualification/test/test_*.py")]
        if not modules:
            raise ValueError("No proxy test modules found")
        self.run("proxy-suites", ["bash", str(HERE / "proxy-tests.sh"), image, str(self.source), "3300", *modules], 3540, "python")

    def host_infra(self, temporary):
        # Render fixtures need historical git blobs and freshly generated synthetic PKI.
        # These are supplemental host checks, not substitutes for the image gate.
        self.result["nodeVersion"] = output(["node", "--version"])
        self.result["pythonVersion"] = sys.version.split()[0]
        if not self.result["nodeVersion"].startswith("v24.") or sys.version_info[:2] != (3, 13):
            raise ValueError("Host infra checks require Node 24 and Python 3.13")
        installs = [("root", [], []), ("runtime", ["--prefix", "apps/runtime"], []),
                    ("conversation-worker", ["--prefix", "apps/worker/conversation"], []),
                    ("ui-stream", ["--prefix", "packages/ui-stream"], []),
                    ("window-resolution", ["--prefix", "packages/window-resolution"], []),
                    ("control-conversations", ["--prefix", "apps/control/conversations"], []),
                    ("artifact-storage", ["--prefix", "apps/artifacts/storage"], ["--omit=dev"]),
                    ("artifact-generation", ["--prefix", "apps/artifacts/generation"], ["--omit=dev"])]
        for name, prefix, extra in installs:
            check = self.run("npm-" + name, ["npm", "ci", *prefix, *extra, "--ignore-scripts", "--no-audit", "--no-fund"], 600)
            if check["status"] != "passed":
                check["status"] = "blocked"
                return
        links = {"@capiro/meri-contracts": "../../packages/contracts",
                 "@anthropic-ai/claude-agent-sdk": "../../apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk",
                 "@aws-sdk/client-s3": "../../apps/artifacts/storage/node_modules/@aws-sdk/client-s3"}
        for name, target in links.items():
            link = self.source / "node_modules" / name
            link.parent.mkdir(parents=True, exist_ok=True)
            if not link.exists() and not link.is_symlink():
                link.symlink_to(target)
        locked = (self.source / "apps/proxy/qualification/linux/requirements.lock").read_text().splitlines()
        selected = [line for line in locked if re.match(r"^(cffi|cryptography|pycparser)==", line)]
        if len(selected) != 3:
            raise ValueError("Synthetic PKI dependency closure is not pinned")
        requirements = temporary / "infra-requirements.lock"
        requirements.write_text("\n".join(selected) + "\n")
        virtualenv = temporary / "infra-venv"
        self.run("infra-venv", [sys.executable, "-m", "venv", str(virtualenv)], 120)
        python = virtualenv / "bin/python"
        check = self.run("infra-python-deps", [str(python), "-m", "pip", "install", "--disable-pip-version-check",
                         "--require-hashes", "--only-binary=:all:", "-r", str(requirements)], 600)
        if check["status"] != "passed":
            check["status"] = "blocked"
            return
        tests = ["infra/product-preview/first-chat/render-material.test.mjs", "infra/product-preview/first-chat/render-features.test.mjs"]
        tests += files(self.source, "infra/product-preview/first-chat/*telemetry*.test.mjs")
        previous = {name: os.environ.get(name) for name in ("MERI_REVIEW_SOURCE_ROOT", "MERI_TEST_PYTHON")}
        try:
            os.environ["MERI_REVIEW_SOURCE_ROOT"] = str(self.source)
            os.environ["MERI_TEST_PYTHON"] = str(python)
            self.run("infra-renderers", ["node", "--experimental-test-module-mocks", "--test", "--test-concurrency=1",
                     "--test-reporter=tap", *tests], 1500, "node")
        finally:
            for name, value in previous.items():
                if value is None:
                    os.environ.pop(name, None)
                else:
                    os.environ[name] = value

    def execute(self):
        self.result["commit"] = output(["git", "rev-parse", "HEAD"], self.source)
        self.save()
        if self.result["mode"] != "infra" and shutil.which("docker") is None:
            raise ValueError("Docker is unavailable")
        if self.result["mode"] != "infra" and self.run("docker-version", ["docker", "version"], 30)["status"] != "passed":
            return
        with tempfile.TemporaryDirectory(prefix="meri-p0-") as directory:
            temporary = Path(directory)
            archive, context = temporary / "source.tar", temporary / "source"
            subprocess.run(["git", "-c", "tar.umask=0022", "archive", "--format=tar", "--output", str(archive), "HEAD"], cwd=self.source, check=True, timeout=120)
            with archive.open("rb") as handle:
                self.result["sourceSha256"] = hashlib.file_digest(handle, "sha256").hexdigest()
            context.mkdir()
            subprocess.run(["tar", "-xf", str(archive), "-C", str(context)], check=True, timeout=120)
            archive.unlink()
            self.save()
            if self.result["mode"] == "infra":
                self.host_infra(temporary)
            elif self.result["mode"] == "runtime":
                self.runtime(context)
            else:
                self.proxy(context, temporary)
        acceptable = {"passed", "not-applicable", "unverified-clock-step"}
        self.result["status"] = "passed" if all(c["status"] in acceptable for c in self.result["checks"]) else "failed"
        # A clock-affected original only becomes usable when a clean retry passed.
        for check in self.result["checks"]:
            if check["status"] == "unverified-clock-step" and not any(c["name"] == check["name"] + "-clock-retry" and c["status"] == "passed" and not c["clockSteps"] for c in self.result["checks"]):
                self.result["status"] = "failed"
        self.save()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("runtime", "proxy", "infra"))
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--side", choices=("base", "head"), default="head")
    args = parser.parse_args()
    verification = Verification(args.source.resolve(), args.output.resolve(), args.side, args.mode)
    try:
        verification.execute()
    except (ValueError, OSError, subprocess.SubprocessError) as exc:
        verification.result["status"] = "blocked"
        verification.result["error"] = str(exc)
        verification.save()
        print(f"P0 verification blocked: {exc}")
        return 2
    return int(verification.result["status"] != "passed")


if __name__ == "__main__":
    raise SystemExit(main())
