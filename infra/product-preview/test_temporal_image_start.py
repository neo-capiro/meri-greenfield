"""Dry-run and fail-closed preflight controls for temporal-image-start.sh with a stubbed aws CLI.

No AWS, network or credential use. The dry run must verify the sealed ZIP against Git and
print the exact StartBuild request without any aws call; the preflights are sourced in
library mode. Requires bash, git and python3 on PATH.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from test_temporal_image_build import context, sealed_repository  # noqa: E402

SCRIPT = HERE / "temporal-image-start.sh"
AWS_STUB = r"""#!/usr/bin/env bash
printf '%s\n' "$*" >> "$STUB_LOG"
case "$*" in
  *list-builds-for-project*)
    case "$STUB_LIST" in
      empty) echo '{"ids": []}';;
      ok) echo '{"ids": ["p:1", "p:2"]}';;
      paged) echo '{"ids": ["p:1"], "nextToken": "more"}';;
      *) echo 'aws: [ERROR]: An error occurred (ThrottlingException) when calling the ListBuildsForProject operation' >&2; exit 254;;
    esac;;
  *batch-get-builds*)
    case "$STUB_BATCH" in
      complete) echo '{"builds": [{"id":"p:1","buildComplete":true,"buildStatus":"SUCCEEDED"},{"id":"p:2","buildComplete":true,"buildStatus":"FAILED"}], "buildsNotFound": []}';;
      active) echo '{"builds": [{"id":"p:1","buildComplete":false,"buildStatus":"IN_PROGRESS"},{"id":"p:2","buildComplete":true,"buildStatus":"FAILED"}], "buildsNotFound": []}';;
      *) exit 254;;
    esac;;
  *describe-images*)
    case "$STUB_DESCRIBE" in
      exists) echo '{"imageDetails": [{"imageDigest": "sha256:aa"}]}';;
      notfound) printf '\naws: [ERROR]: An error occurred (ImageNotFoundException) when calling the DescribeImages operation: The image with imageId {imageTag:x} does not exist\n' >&2; exit 254;;
      denied) printf '\naws: [ERROR]: An error occurred (AccessDeniedException) when calling the DescribeImages operation: denied\n' >&2; exit 254;;
      *) exit 1;;
    esac;;
  *) exit 1;;
esac
"""


class TemporalStartTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="temporal-start-"))
        cls.repo, cls.commit = sealed_repository(cls.tmp)
        (cls.tmp / "inputs").mkdir()
        cls.seal = context.seal(cls.repo, cls.commit, cls.tmp / "ca.pem", cls.tmp / "inputs" / "temporal-context.zip")
        (cls.tmp / "aws").write_text(AWS_STUB, newline="\n"); (cls.tmp / "aws").chmod(0o755)
        cls.log = cls.tmp / "calls.log"

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, True)

    def env(self, **extra):
        self.log.write_text("")
        env = dict(os.environ, PATH=str(self.tmp) + os.pathsep + os.environ["PATH"], STUB_LOG=str(self.log),
                   MERI_REPO=str(self.repo), **extra)
        for key in ("MERI_TEMPORAL_IMAGE_START_APPROVED", "MERI_AWS_PROFILE", "TEMPORAL_IMAGE_START_LIBRARY"):
            if key not in extra:
                env.pop(key, None)
        return env

    def start(self, zip_sha, **extra):
        return subprocess.run(["bash", SCRIPT.as_posix(), self.commit, (self.tmp / "inputs").as_posix(), zip_sha],
                              env=self.env(**extra), capture_output=True, text=True, timeout=120)

    def test_dry_run_is_default_and_prints_the_exact_request_without_aws(self):
        r = self.start(self.seal["zipSha256"], MERI_AWS_PROFILE="p")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("DRY_RUN: no upload or StartBuild", r.stderr)
        self.assertEqual(self.log.read_text(), "")
        self.assertEqual(sorted(p.name for p in (self.tmp / "inputs").iterdir()), ["temporal-context.zip"])
        bound = json.loads([l for l in r.stderr.splitlines() if l.startswith("{")][0])
        self.assertEqual((bound["zipSha256"], bound["buildScriptSha256"], bound["issuerCaSha256"], bound["bases"]),
                         (self.seal["zipSha256"], self.seal["buildScriptSha256"], self.seal["issuerCaSha256"], context.BASES))
        req = json.loads(r.stdout)
        self.assertEqual((req["projectName"], req["timeoutInMinutesOverride"], req["queuedTimeoutInMinutesOverride"],
                          req["autoRetryLimitOverride"], req["sourceTypeOverride"], req["artifactsOverride"]),
                         ("meri-greenfield-qualification-build", 30, 5, 0, "S3", {"type": "NO_ARTIFACTS"}))
        self.assertEqual(req["sourceLocationOverride"],
                         f"meri-greenfield-qual-build-967807252336-us-east-1/inputs/temporal-image/{self.commit}/temporal-context.zip")
        self.assertEqual((req["idempotencyToken"], req["sourceVersion"]), ("<ATTEMPT_32_HEX>", "<SOURCE_VERSION_ID>"))
        self.assertIn("echo '%s  repo/infra/product-preview/temporal-image-build.sh' | sha256sum -c -" % self.seal["buildScriptSha256"],
                      req["buildspecOverride"])
        env = {e["name"]: e["value"] for e in req["environmentVariablesOverride"]}
        self.assertEqual((env["COMMIT"], env["REPOSITORY_NAME"], env["RESULT_BUCKET"], env["KMS_KEY_ARN"]),
                         (self.commit, "meri-greenfield/qualification-worker", "meri-greenfield-qual-build-967807252336-us-east-1",
                          "arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042"))
        # A wrong approval value is still a dry run.
        r = self.start(self.seal["zipSha256"], MERI_TEMPORAL_IMAGE_START_APPROVED="0" * 64)
        self.assertEqual((r.returncode, self.log.read_text()), (0, ""))

    def test_dry_run_refuses_a_mismatched_zip_or_usage(self):
        r = self.start("0" * 64)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("ZIP_SHA256_MISMATCH", r.stderr)
        self.assertEqual(r.stdout, "")
        r = subprocess.run(["bash", SCRIPT.as_posix(), "abc", "x", "y"], env=self.env(), capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 2)

    def check(self, call, **stub):
        snippet = 'source "$1"; if ' + call + '; then echo PROVEN; else echo REFUSED; fi'
        r = subprocess.run(["bash", "-c", snippet, "bash", SCRIPT.as_posix()],
                           env=self.env(TEMPORAL_IMAGE_START_LIBRARY="1", **stub), capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 0, r.stderr)
        return r.stdout.strip()

    def test_preflights_prove_idle_and_tag_absence_or_refuse(self):
        self.assertEqual(self.check("require_project_idle --profile p", STUB_LIST="empty"), "PROVEN")
        self.assertEqual(self.check("require_project_idle --profile p", STUB_LIST="ok", STUB_BATCH="complete"), "PROVEN")
        for stub in (dict(STUB_LIST="fail"), dict(STUB_LIST="paged", STUB_BATCH="complete"),
                     dict(STUB_LIST="ok", STUB_BATCH="active"), dict(STUB_LIST="ok", STUB_BATCH="fail")):
            with self.subTest(**stub):
                self.assertEqual(self.check("require_project_idle --profile p", **stub), "REFUSED")
        self.assertEqual(self.check("require_tag_absent tag --profile p", STUB_DESCRIBE="notfound"), "PROVEN")
        self.assertIn("--repository-name meri-greenfield/qualification-worker --image-ids imageTag=tag", self.log.read_text())
        for mode in ("exists", "denied", "other"):
            with self.subTest(mode=mode):
                self.assertEqual(self.check("require_tag_absent tag --profile p", STUB_DESCRIBE=mode), "REFUSED")


if __name__ == "__main__":
    unittest.main()
