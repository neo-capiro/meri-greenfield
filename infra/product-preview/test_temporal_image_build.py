"""Focused controls for the Temporal derivative image (D3) path with stubbed aws/docker.

No AWS, Docker, network or credential use: temporal-image-build.sh is sourced in library
mode and the stubs record every call; temporal-image-context.py seals a throwaway Git
repository built from the working-tree members. Requires bash, git and python3 on PATH.
"""
import hashlib
import importlib.util
import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SCRIPT = HERE / "temporal-image-build.sh"
COMMIT, ATTEMPT = "c" * 40, "a" * 32
CA = ("-----BEGIN CERTIFICATE-----\n" + ("A" * 64 + "\n") * 4 + "-----END CERTIFICATE-----\n").encode()
_spec = importlib.util.spec_from_file_location("temporal_image_context", HERE / "temporal-image-context.py")
context = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(context)

AWS_STUB = r"""#!/usr/bin/env bash
# Records each call; put-object behaviour from STUB_PUT (ok|fail|empty|badsum|badkms).
printf '%s\n' "$*" >> "$STUB_LOG"
case "$*" in
  *put-object*)
    body=""; kms=""; prev=""
    for a in "$@"; do [ "$prev" = "--body" ] && body="$a"; [ "$prev" = "--ssekms-key-id" ] && kms="$a"; prev="$a"; done
    cp "$body" "$STUB_STORE/$(basename "$body")"
    sum="$(python3 -c 'import base64,hashlib,sys;print(base64.b64encode(hashlib.sha256(open(sys.argv[1],"rb").read()).digest()).decode())' "$body")"
    case "${STUB_PUT:-ok}" in
      ok) printf '{"VersionId":"v-%s","ChecksumSHA256":"%s","ServerSideEncryption":"aws:kms","SSEKMSKeyId":"%s"}\n' "$(basename "$body")" "$sum" "$kms";;
      empty) printf '{"ChecksumSHA256":"%s","ServerSideEncryption":"aws:kms","SSEKMSKeyId":"%s"}\n' "$sum" "$kms";;
      badsum) printf '{"VersionId":"v1","ChecksumSHA256":"AAAA","ServerSideEncryption":"aws:kms","SSEKMSKeyId":"%s"}\n' "$kms";;
      badkms) printf '{"VersionId":"v1","ChecksumSHA256":"%s","ServerSideEncryption":"aws:kms","SSEKMSKeyId":"other"}\n' "$sum";;
      *) exit 254;;
    esac;;
  *) exit 0;;
esac
"""
# Emulates the launcher contract of a built image; STUB_FRONTEND_EXIT breaks it on purpose.
DOCKER_STUB = r"""#!/usr/bin/env bash
printf 'docker %s\n' "$*" >> "$STUB_LOG"
case "$*" in
  *--entrypoint*) cat "$STUB_PROBE";;
  *" --help") printf 'Usage: temporal-launch <frontend|history|matching|worker|internal-frontend>\nmore\n';;
  *" all") echo TEMPORAL_LAUNCH_USAGE >&2; exit 64;;
  *" frontend") echo TEMPORAL_LAUNCH_REFUSED >&2; exit "${STUB_FRONTEND_EXIT:-78}";;
  *) exit 0;;
esac
"""


def sealed_repository(tmp):
    """A throwaway Git repository holding exactly the sealed members from this worktree."""
    repo = tmp / "repo"; repo.mkdir()
    for path in context.MEMBERS:
        target = repo / path; target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / path, target)
    g = ["git", "-C", str(repo), "-c", "core.autocrlf=false", "-c", "commit.gpgsign=false",
         "-c", "user.name=test", "-c", "user.email=test@example.invalid"]
    subprocess.run(["git", "init", "-q", str(repo)], check=True)
    subprocess.run(g + ["add", "-A"], check=True)
    # Mirror the source index's executable bits (a Windows checkout cannot carry them).
    staged = subprocess.run(["git", "-C", str(ROOT), "ls-files", "-s", "--", *context.MEMBERS],
                            check=True, capture_output=True, text=True).stdout.splitlines()
    for row in staged:
        if row.startswith("100755 "):
            subprocess.run(g + ["update-index", "--chmod=+x", row.split("\t", 1)[1]], check=True)
    subprocess.run(g + ["commit", "-q", "-m", "fixture"], check=True)
    commit = subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()
    (tmp / "ca.pem").write_bytes(CA)
    return repo, commit


class TemporalImageReceiptTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="temporal-receipt-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.bin = self.tmp / "bin"; self.bin.mkdir()
        for name, body in (("aws", AWS_STUB), ("docker", DOCKER_STUB)):
            (self.bin / name).write_text(body, newline="\n"); (self.bin / name).chmod(0o755)
        (self.tmp / "store").mkdir(); (self.tmp / "work").mkdir()
        self.log = self.tmp / "calls.log"; self.log.write_text("")

    def run_snippet(self, snippet, **stub):
        env = dict(os.environ, PATH=str(self.bin) + os.pathsep + os.environ["PATH"], STUB_LOG=str(self.log),
                   STUB_STORE=str(self.tmp / "store"), TEMPORAL_IMAGE_BUILD_LIBRARY="1", **stub)
        prelude = (
            'set -Eeuo pipefail; source "$1"; '
            f'COMMIT={COMMIT}; ATTEMPT={ATTEMPT}; REPOSITORY_URI=111.dkr.ecr.us-east-1.amazonaws.com/r; REPOSITORY_NAME=r; '
            'RESULT_BUCKET=b; KMS_KEY_ARN=k; RESULTS=results/temporal-image/x/y; WORK="$2"; IMAGE_TAG=tt; '
            'DIGEST=sha256:' + "1" * 64 + '; ISSUER_CA_SHA256=' + "e" * 64 + '; MANIFEST_SHA256=' + "f" * 64 + '; '
            'trap fail ERR; ')
        return subprocess.run(["bash", "-c", prelude + snippet, "bash", SCRIPT.as_posix(), (self.tmp / "work").as_posix()],
                              env=env, capture_output=True, text=True, timeout=120)

    def evidence(self, counts="{}", high="[]", probe='{"node":"v24.21.0"}'):
        for name, text in (("image.counts", counts), ("high-findings.json", high), ("probe.json", probe)):
            if text is not None:
                (self.tmp / "work" / name).write_text(text)

    def stored(self):
        return sorted(p.name for p in (self.tmp / "store").iterdir())

    def test_success_requires_checked_generation_upload_and_proof(self):
        self.evidence()
        r = self.run_snippet("finish_success")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("TEMPORAL_IMAGE_SUCCEEDED image=sha256:" + "1" * 64, r.stdout)
        self.assertIn("receiptVersion=v-temporal-image-receipt.json", r.stdout)
        receipt = json.loads((self.tmp / "store" / "temporal-image-receipt.json").read_text())
        self.assertEqual((receipt["status"], receipt["commit"], receipt["image"]["scan"], receipt["image"]["role"]),
                         ("SUCCEEDED", COMMIT, {}, "deployable"))
        self.assertEqual(receipt["bases"], context.BASES)
        self.assertEqual((receipt["issuerCaSha256"], receipt["probe"]["node"]), ("e" * 64, "v24.21.0"))
        self.assertIn("ecr-basic-os-packages-only", receipt["scanCoverage"])
        self.assertIn("libstdc++=16.2.0-r1", receipt["glibcRuntimePackages"])
        log = self.log.read_text()
        self.assertIn("--checksum-sha256", log); self.assertIn("--if-none-match *", log)
        self.assertNotIn("head-object", log); self.assertNotIn("get-object", log)

    def test_failed_generation_never_reports_success_and_records_failure(self):
        self.evidence(probe=None)  # a missing probe makes receipt generation fail
        r = self.run_snippet("finish_success")
        self.assertEqual(r.returncode, 1)
        self.assertNotIn("TEMPORAL_IMAGE_SUCCEEDED", r.stdout)
        self.assertIn("TEMPORAL_IMAGE_FAILED phase=RECEIPT_GENERATE", r.stderr)
        self.assertEqual(self.stored(), ["temporal-image-failure.json"])
        failure = json.loads((self.tmp / "store" / "temporal-image-failure.json").read_text())
        self.assertEqual((failure["status"], failure["phase"], failure["probe"]), ("FAILED", "RECEIPT_GENERATE", None))

    def test_empty_or_malformed_json_is_refused_before_any_upload(self):
        for content in ("", "{not json", "[]", '{"schemaVersion":1,"status":"MAYBE"}', '{"schemaVersion":2,"status":"SUCCEEDED"}'):
            with self.subTest(content=content):
                (self.tmp / "work" / "x.json").write_text(content); self.log.write_text("")
                r = self.run_snippet('trap - ERR; if record_file x.json "$2/x.json"; then echo STORED; else echo REFUSED; fi')
                self.assertEqual(r.stdout.strip(), "REFUSED", r.stderr)
                self.assertNotIn("put-object", self.log.read_text())

    def test_failed_or_unproved_upload_is_not_success(self):
        for mode in ("fail", "empty", "badsum", "badkms"):
            with self.subTest(mode=mode):
                shutil.rmtree(self.tmp / "store"); (self.tmp / "store").mkdir(); self.evidence()
                r = self.run_snippet("finish_success", STUB_PUT=mode)
                self.assertEqual(r.returncode, 1)
                self.assertNotIn("TEMPORAL_IMAGE_SUCCEEDED", r.stdout)
                self.assertIn("TEMPORAL_IMAGE_FAILED phase=RECEIPT_UPLOAD", r.stderr)
                self.assertIn("TEMPORAL_IMAGE_FAILURE_RECORD_UNCONFIRMED", r.stderr)

    def test_scan_gate_refuses_any_high_or_critical(self):
        for counts, code in (({"HIGH": 1}, 1), ({"CRITICAL": 1}, 1), ({"HIGH": 2, "MEDIUM": 3}, 1),
                             ({}, 0), ({"MEDIUM": 4, "LOW": 1}, 0), (None, 0)):
            with self.subTest(counts=counts):
                r = self.run_snippet(f"trap - ERR; scan_counts '{json.dumps(['COMPLETE', counts])}' gate")
                self.assertEqual(r.returncode, code, r.stderr)
                self.assertEqual(json.loads(r.stdout), counts or {})
        r = self.run_snippet("trap - ERR; scan_counts '[\"COMPLETE\",{}]' skip")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("scan_counts \"$out\" gate", SCRIPT.read_text())

    def test_gate_failure_record_keeps_counts_and_high_rows_as_evidence(self):
        self.evidence(counts='{"HIGH": 2, "LOW": 1}', high='[{"name":"CVE-X","severity":"HIGH","package":"busybox","version":"1"}]')
        r = self.run_snippet("PHASE=SCAN; false")
        self.assertEqual(r.returncode, 1)
        self.assertIn("TEMPORAL_IMAGE_FAILED phase=SCAN", r.stderr)
        failure = json.loads((self.tmp / "store" / "temporal-image-failure.json").read_text())
        self.assertEqual((failure["scan"], failure["highFindings"][0]["package"], failure["imageDigest"]),
                         ({"HIGH": 2, "LOW": 1}, "busybox", "sha256:" + "1" * 64))

    def test_failure_record_generation_fallback_is_still_valid_json(self):
        r = self.run_snippet('python3() { return 1; }; false')
        self.assertEqual(r.returncode, 1)
        fallback = json.loads((self.tmp / "work" / "temporal-image-failure.json").read_text())
        self.assertEqual((fallback["status"], fallback["receiptGeneration"]), ("FAILED", "FAILED"))
        self.assertIn("TEMPORAL_IMAGE_FAILURE_RECORD_UNCONFIRMED", r.stderr)

    def test_smoke_requires_exact_launcher_exits_and_probe(self):
        good = {"node": "v24.21.0", "uid": 1000, "issuerCaSha256": "e" * 64, "temporalServer": True, "runTemporalMode": "700"}
        probe = self.tmp / "probe-in.json"
        for change, frontend, ok in (({}, "78", True), ({}, "0", False), ({"uid": 0}, "78", False),
                                     ({"issuerCaSha256": "0" * 64}, "78", False), ({"node": "v24.19.0"}, "78", False)):
            with self.subTest(change=change, frontend=frontend):
                probe.write_text(json.dumps(good | change)); self.log.write_text("")
                r = self.run_snippet(f'trap - ERR; if smoke_image img:t {"e" * 64}; then echo SMOKE_OK; else echo SMOKE_REFUSED; fi',
                                     STUB_PROBE=str(probe), STUB_FRONTEND_EXIT=frontend)
                self.assertEqual(r.stdout.strip().splitlines()[-1], "SMOKE_OK" if ok else "SMOKE_REFUSED", r.stderr)
        runs = [l for l in self.log.read_text().splitlines() if l.startswith("docker run")]
        self.assertTrue(runs and all("--network none" in l and "--cap-drop ALL" in l and "--read-only" in l for l in runs))


class TemporalContextSealTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="temporal-seal-"))
        cls.repo, cls.commit = sealed_repository(cls.tmp)
        cls.result = context.seal(cls.repo, cls.commit, cls.tmp / "ca.pem", cls.tmp / "one.zip")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, True)

    def verify(self, root):
        env = dict(os.environ, TEMPORAL_IMAGE_BUILD_LIBRARY="1")
        return subprocess.run(["bash", "-c", 'set -Eeuo pipefail; source "$1"; verify_context "$2" "$3"', "bash",
                               SCRIPT.as_posix(), root.as_posix(), self.commit], env=env, capture_output=True, text=True, timeout=120)

    def extract(self, name):
        root = self.tmp / name
        with zipfile.ZipFile(self.tmp / "one.zip") as z:
            z.extractall(root)
        return root

    def test_seal_is_deterministic_and_bound_to_git(self):
        again = context.seal(self.repo, self.commit, self.tmp / "ca.pem", self.tmp / "two.zip")
        self.assertEqual(again["zipSha256"], self.result["zipSha256"])
        self.assertEqual((self.tmp / "one.zip").read_bytes(), (self.tmp / "two.zip").read_bytes())
        self.assertEqual(self.result["issuerCaSha256"], hashlib.sha256(CA).hexdigest())
        with zipfile.ZipFile(self.tmp / "one.zip") as z:
            rows = z.infolist()
            self.assertEqual([r.filename for r in rows], sorted(r.filename for r in rows))
            self.assertTrue(all(r.date_time == (1980, 1, 1, 0, 0, 0) and r.create_system == 3 and not r.flag_bits & 8 for r in rows))
            m = json.loads(z.read("context-manifest.json"))
            self.assertEqual((m["commit"], m["bases"], len(m["files"])), (self.commit, context.BASES, 10))
            self.assertEqual(z.getinfo("repo/infra/product-preview/temporal-image-build.sh").external_attr >> 16, 0o100755)
            self.assertEqual(z.getinfo("repo/infra/product-preview/temporal-launch.sh").external_attr >> 16, 0o100644)
            self.assertEqual(hashlib.sha256(z.read("repo/infra/product-preview/temporal-image-build.sh")).hexdigest(),
                             self.result["buildScriptSha256"])

    def test_seal_refuses_existing_output_bad_ca_and_unknown_commit(self):
        with self.assertRaisesRegex(context.Refused, "OUTPUT_EXISTS"):
            context.seal(self.repo, self.commit, self.tmp / "ca.pem", self.tmp / "one.zip")
        (self.tmp / "bad.pem").write_bytes(b"-----BEGIN PRIVATE KEY-----\n" + b"A" * 80 + b"\n-----END PRIVATE KEY-----\n")
        with self.assertRaisesRegex(context.Refused, "ISSUER_CA"):
            context.seal(self.repo, self.commit, self.tmp / "bad.pem", self.tmp / "bad.zip")
        with self.assertRaisesRegex(context.Refused, "GIT|COMMIT"):
            context.seal(self.repo, "0" * 40, self.tmp / "ca.pem", self.tmp / "bad.zip")
        self.assertFalse((self.tmp / "bad.zip").exists())

    def test_build_verifies_the_extracted_context_and_refuses_drift(self):
        r = self.verify(self.extract("ok"))
        self.assertEqual((r.returncode, r.stdout.strip()), (0, self.result["manifestSha256"]), r.stderr)
        root = self.extract("tampered")
        (root / "repo/infra/product-preview/temporal-launch.sh").write_bytes(b"#!/bin/sh\nexit 0\n")
        self.assertNotEqual(self.verify(root).returncode, 0)
        root = self.extract("extra")
        (root / "repo/extra.txt").write_text("x")
        self.assertNotEqual(self.verify(root).returncode, 0)

    def test_dockerfile_pins_every_base_by_digest(self):
        text = (HERE / "temporal-launch.Dockerfile").read_text()
        froms = [l.split()[2] for l in text.splitlines() if l.startswith("FROM ")]
        self.assertEqual(froms, [context.BASES["nodeBinary"], context.BASES["glibcRuntime"], context.BASES["temporalServer"]])
        self.assertTrue(all(re.search(r"@sha256:[0-9a-f]{64}$", f) for f in froms))
        self.assertFalse(any(l.lower().startswith("# syntax=") for l in text.splitlines()))
        self.assertNotIn("ARG NODE24_IMAGE", text)
        self.assertNotIn("ld-musl", text)
        # Same Node binary as the qualified runtime; same Temporal pin as the launcher renderer.
        qualify = (ROOT / "docs/handover/20261017/fable-shipping/scripts/qualify-start.sh").read_text()
        self.assertIn('"nodeImageUri":"%s"' % context.BASES["nodeBinary"], qualify)
        render = (HERE / "temporal-launch-render.mjs").read_text()
        self.assertIn("SERVER_DIGEST='%s'" % context.BASES["temporalServer"].split("@")[1], render)
        lock = json.loads((HERE / "runtime-packages.lock.json").read_text())
        self.assertEqual(lock["runtimeImageUri"], context.BASES["glibcRuntime"])
        self.assertIn(lock["repositoryIndex"]["sha256"], text)
        self.assertIn('--secret "id=temporal_issuer_ca,src=$ROOT/inputs/temporal-issuer-ca.pem"', SCRIPT.read_text())


if __name__ == "__main__":
    unittest.main()
