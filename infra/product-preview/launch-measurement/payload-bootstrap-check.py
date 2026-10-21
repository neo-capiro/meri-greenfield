"""Local-only exact bootstrap exercise: AWS and child execution are replaced.

The actual pinned source file is hash-checked; no AWS, Docker or wrapper runs.
"""
import argparse
import base64
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import subprocess
from types import SimpleNamespace
from unittest.mock import patch

parser = argparse.ArgumentParser()
for name in ("buildspec", "payload", "plan", "wrapper", "source-root"):
    parser.add_argument("--"+name, required=True, type=Path)
args = parser.parse_args()
command = json.loads(args.buildspec.read_bytes())["phases"]["build"]["commands"][0]
script = command.split("\n", 1)[1].rsplit("\nMERI_MEASURE_BOOTSTRAP", 1)[0]
compiled = compile(script, "actual-generated-bootstrap", "exec")
pin = json.loads(base64.b64decode(re.search(r"pin=json.loads\(base64.b64decode\('([^']+)'", script)[1]))
payload, plan, wrapper = args.payload.read_bytes(), args.plan.read_bytes(), args.wrapper.read_bytes()
results = []
for mode in ("exact-roundtrip", "wrong-head-version", "download-byte-tamper"):
    calls, launched, temporary_paths = [], [], []

    def bounded_command(argv, timeout):
        assert 0 < timeout <= 20
        assert argv[:5] == ["aws", "--region", "us-east-1", "--no-cli-pager", "s3api"]
        assert argv[argv.index("--bucket")+1] == pin["bucket"]
        assert argv[argv.index("--key")+1] == pin["key"]
        assert argv[argv.index("--version-id")+1] == pin["versionId"]
        calls.append(argv[5])
        if argv[5] == "head-object":
            answer = {"VersionId": "wrong" if mode == "wrong-head-version" else pin["versionId"], "ContentLength": len(payload), "ServerSideEncryption": "aws:kms", "SSEKMSKeyId": pin["kmsKeyArn"]}
        else:
            assert argv[5] == "get-object" and calls == ["head-object", "get-object"]
            target = Path(argv[-3]);temporary_paths.append(target.parent)
            target.write_bytes(payload if mode != "download-byte-tamper" else b"X"+payload[1:])
            answer = {"VersionId": pin["versionId"]}
        return 0, json.dumps(answer).encode()

    def file_sha(path, maximum):
        content = Path(path).read_bytes();assert 0 < len(content) <= maximum
        return hashlib.sha256(content).hexdigest()

    def child(argv, timeout):
        assert mode == "exact-roundtrip" and 500 <= timeout <= 540
        assert argv[:4] == ["python3", "-I", "-B", "-S"] and argv[5] == "--plan"
        assert Path(argv[4]).read_bytes() == wrapper
        assert Path(argv[6]).read_bytes() == plan
        launched.append(True)
        return SimpleNamespace(returncode=0)

    fake_source = SimpleNamespace(bounded_command=bounded_command, decode=json.loads, file_sha=file_sha)
    fake_spec = SimpleNamespace(loader=SimpleNamespace(exec_module=lambda module: None))
    capture = io.StringIO()
    with patch.dict(os.environ, {"CODEBUILD_SRC_DIR": str(args.source_root)}), patch.object(importlib.util, "spec_from_file_location", return_value=fake_spec), patch.object(importlib.util, "module_from_spec", return_value=fake_source), patch.object(subprocess, "run", side_effect=child), contextlib.redirect_stdout(capture):
        try:
            exec(compiled, {})
            raise AssertionError("bootstrap did not exit")
        except SystemExit as stop:
            assert stop.code == (0 if mode == "exact-roundtrip" else 2)
    assert all(not directory.exists() for directory in temporary_paths)
    if mode == "exact-roundtrip":
        assert launched == [True] and capture.getvalue() == ""
    else:
        assert not launched
        phase = "PAYLOAD_HEAD" if mode == "wrong-head-version" else "PAYLOAD_GET"
        assert capture.getvalue() == "MEASUREMENT_BOOTSTRAP_REFUSED phase="+phase+"\n"
    results.append({"case": mode, "status": "PASS"})
print(json.dumps({"status": "LOCAL_BOOTSTRAP_CHECKS_PASS", "cases": results, "awsExecuted": False, "wrapperExecuted": False}))
