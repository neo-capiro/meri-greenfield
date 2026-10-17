"""Focused receipt/failure controls for proxy-image-build.sh with stubbed aws/docker.

No AWS, Docker, network or credential use: the script is sourced in library mode
and the stubs record every call. Requires bash and python3 on PATH.
"""
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "proxy-image-build.sh"
COMMIT, ATTEMPT = "c" * 40, "a" * 32
AWS_STUB = r"""#!/usr/bin/env bash
# Records each call; behaviour from STUB_PUT (ok|fail|empty) and STUB_HEAD (match|mismatch|fail).
printf '%s\n' "$*" >> "$STUB_LOG"
case "$*" in
  *put-object*)
    body=""; prev=""
    for a in "$@"; do [ "$prev" = "--body" ] && body="$a"; prev="$a"; done
    cp "$body" "$STUB_STORE/$(basename "$body")"
    case "${STUB_PUT:-ok}" in ok) echo "v-$(basename "$body")";; empty) echo "";; *) exit 254;; esac;;
  *head-object*)
    name=""; for a in "$@"; do case "$a" in results/*) name="$(basename "$a")";; esac; done
    case "${STUB_HEAD:-match}" in
      match) wc -c < "$STUB_STORE/$name" | tr -d '[:space:]'; echo;;
      mismatch) echo 1;;
      *) exit 254;;
    esac;;
  *) exit 0;;
esac
"""
DOCKER_STUB = "#!/usr/bin/env bash\nprintf 'docker %s\\n' \"$*\" >> \"$STUB_LOG\"\n"


class ProxyImageReceiptTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="proxy-receipt-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)
        bin_dir = self.tmp / "bin"; bin_dir.mkdir()
        for name, body in (("aws", AWS_STUB), ("docker", DOCKER_STUB)):
            (bin_dir / name).write_text(body, newline="\n"); (bin_dir / name).chmod(0o755)
        (self.tmp / "store").mkdir(); (self.tmp / "work").mkdir()
        self.log = self.tmp / "calls.log"; self.log.write_text("")
        self.bin = bin_dir

    def run_snippet(self, snippet, **stub):
        env = dict(os.environ, PATH=str(self.bin) + os.pathsep + os.environ["PATH"],
                   STUB_LOG=str(self.log), STUB_STORE=str(self.tmp / "store"), PROXY_IMAGE_BUILD_LIBRARY="1", **stub)
        prelude = (
            'set -Eeuo pipefail; source "$1"; '
            f'COMMIT={COMMIT}; ATTEMPT={ATTEMPT}; REPOSITORY_URI=111.dkr.ecr.us-east-1.amazonaws.com/r; REPOSITORY_NAME=r; '
            'RESULT_BUCKET=b; KMS_KEY_ARN=k; RESULTS=results/proxy-image/x/y; WORK="$2"; '
            'ASSEMBLY_TAG=at; PRODUCT_TAG=pt; DIGEST[assembly]=sha256:' + "1" * 64 + '; DIGEST[product]=sha256:' + "2" * 64 + '; '
            'trap fail ERR; ')
        work = (self.tmp / "work").as_posix()
        return subprocess.run(["bash", "-c", prelude + snippet, "bash", SCRIPT.as_posix(), work],
                              env=env, capture_output=True, text=True, timeout=60)

    def counts(self, assembly='{}', product='{}'):
        for role, text in (("assembly", assembly), ("product", product)):
            if text is not None:
                (self.tmp / "work" / f"{role}.counts").write_text(text)

    def stored(self):
        return sorted(p.name for p in (self.tmp / "store").iterdir())

    def test_success_requires_checked_generation_upload_and_readback(self):
        self.counts()
        r = self.run_snippet("finish_success")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("PROXY_IMAGE_SUCCEEDED", r.stdout)
        self.assertIn("receiptVersion=v-proxy-image-receipt.json", r.stdout)
        receipt = json.loads((self.tmp / "store" / "proxy-image-receipt.json").read_text())
        self.assertEqual((receipt["status"], receipt["commit"], receipt["product"]["scan"]), ("SUCCEEDED", COMMIT, {}))
        self.assertIn("head-object", self.log.read_text())

    def test_failed_generation_never_reports_success_and_records_failure(self):
        self.counts(product=None)  # missing product counts makes receipt generation fail
        r = self.run_snippet("finish_success")
        self.assertEqual(r.returncode, 1)
        self.assertNotIn("PROXY_IMAGE_SUCCEEDED", r.stdout)
        self.assertIn("PROXY_IMAGE_FAILED phase=RECEIPT_GENERATE", r.stderr)
        self.assertEqual(self.stored(), ["proxy-image-failure.json"])
        failure = json.loads((self.tmp / "store" / "proxy-image-failure.json").read_text())
        self.assertEqual((failure["status"], failure["phase"]), ("FAILED", "RECEIPT_GENERATE"))

    def test_empty_or_malformed_json_is_refused_before_any_upload(self):
        for content in ("", "{not json", "[]", '{"schemaVersion":1,"status":"MAYBE"}', '{"schemaVersion":2,"status":"SUCCEEDED"}'):
            with self.subTest(content=content):
                (self.tmp / "work" / "x.json").write_text(content)
                self.log.write_text("")
                r = self.run_snippet('trap - ERR; if record_file x.json "$2/x.json"; then echo STORED; else echo REFUSED; fi')
                self.assertEqual(r.stdout.strip(), "REFUSED", r.stderr)
                self.assertNotIn("put-object", self.log.read_text())

    def test_failed_or_unproved_upload_is_not_success(self):
        for stub, expect in ((dict(STUB_PUT="fail"), "UNCONFIRMED"), (dict(STUB_PUT="empty"), "UNCONFIRMED"),
                             (dict(STUB_HEAD="mismatch"), "UNCONFIRMED"), (dict(STUB_HEAD="fail"), "UNCONFIRMED")):
            with self.subTest(**stub):
                shutil.rmtree(self.tmp / "store"); (self.tmp / "store").mkdir(); self.counts()
                r = self.run_snippet("finish_success", **stub)
                self.assertEqual(r.returncode, 1)
                self.assertNotIn("PROXY_IMAGE_SUCCEEDED", r.stdout)
                self.assertIn("PROXY_IMAGE_FAILED phase=RECEIPT_UPLOAD", r.stderr)
                self.assertIn("PROXY_IMAGE_FAILURE_RECORD_" + expect, r.stderr)

    def test_failure_record_generation_fallback_is_still_valid_json(self):
        r = self.run_snippet('python3() { return 1; }; false')
        self.assertEqual(r.returncode, 1)
        # With python3 unavailable the fixed fallback is written, but record_file cannot
        # validate it, so the upload is reported unconfirmed rather than claimed.
        fallback = json.loads((self.tmp / "work" / "proxy-image-failure.json").read_text())
        self.assertEqual((fallback["status"], fallback["receiptGeneration"]), ("FAILED", "FAILED"))
        self.assertIn("PROXY_IMAGE_FAILURE_RECORD_UNCONFIRMED", r.stderr)


if __name__ == "__main__":
    unittest.main()
