"""Fail-closed preflight controls for proxy-image-start.sh with a stubbed aws CLI.

No AWS, network or credential use. The wrapper is sourced in library mode and only
require_project_idle / require_tag_absent are exercised. Requires bash and python3.
"""
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "proxy-image-start.sh"
AWS_STUB = r"""#!/usr/bin/env bash
printf '%s\n' "$*" >> "$STUB_LOG"
case "$*" in
  *list-builds-for-project*)
    case "$STUB_LIST" in
      empty) echo '{"ids": []}';;
      ok) echo '{"ids": ["p:1", "p:2"]}';;
      many) python3 -c 'import json;print(json.dumps({"ids":["p:%d"%i for i in range(1,206)]}))';;
      dup) echo '{"ids": ["p:1", "p:1"]}';;
      paged) echo '{"ids": ["p:1"], "nextToken": "more"}';;
      garbage) echo 'not json';;
      noids) echo '{}';;
      *) echo 'aws: [ERROR]: An error occurred (ThrottlingException) when calling the ListBuildsForProject operation' >&2; exit 254;;
    esac;;
  *batch-get-builds*)
    case "$STUB_BATCH" in
      complete) echo '{"builds": [{"id":"p:1","buildComplete":true,"buildStatus":"SUCCEEDED"},{"id":"p:2","buildComplete":true,"buildStatus":"FAILED"}], "buildsNotFound": []}';;
      echo-complete|echo-old-active) python3 - "$STUB_BATCH" "$@" <<'PY'
import json,sys
mode=sys.argv[1]; a=sys.argv[2:]; ids=a[a.index("--ids")+1:a.index("--output")]
print(json.dumps({"builds":[{"id":i,"buildComplete":not(mode=="echo-old-active" and i=="p:150"),"buildStatus":"IN_PROGRESS" if (mode=="echo-old-active" and i=="p:150") else "SUCCEEDED"} for i in ids],"buildsNotFound":[]}))
PY
      ;;
      active) echo '{"builds": [{"id":"p:1","buildComplete":false,"buildStatus":"IN_PROGRESS"},{"id":"p:2","buildComplete":true,"buildStatus":"FAILED"}], "buildsNotFound": []}';;
      missing) echo '{"builds": [{"id":"p:1","buildComplete":true,"buildStatus":"SUCCEEDED"}], "buildsNotFound": ["p:2"]}';;
      nostatus) echo '{"builds": [{"id":"p:1"},{"id":"p:2","buildComplete":true,"buildStatus":"FAILED"}], "buildsNotFound": []}';;
      *) echo 'aws: [ERROR]: An error occurred (AccessDeniedException) when calling the BatchGetBuilds operation' >&2; exit 254;;
    esac;;
  *describe-images*)
    case "$STUB_DESCRIBE" in
      exists) echo '{"imageDetails": [{"imageDigest": "sha256:aa"}]}';;
      notfound) printf '\naws: [ERROR]: An error occurred (ImageNotFoundException) when calling the DescribeImages operation: The image with imageId {imageTag:x} does not exist\n' >&2; exit 254;;
      legacy) printf '\nAn error occurred (ImageNotFoundException) when calling the DescribeImages operation: missing\n' >&2; exit 254;;
      denied) printf '\naws: [ERROR]: An error occurred (AccessDeniedException) when calling the DescribeImages operation: denied\n' >&2; exit 254;;
      throttle) printf '\naws: [ERROR]: An error occurred (ThrottlingException) when calling the DescribeImages operation: slow down\n' >&2; exit 254;;
      repo) printf '\naws: [ERROR]: An error occurred (RepositoryNotFoundException) when calling the DescribeImages operation: gone\n' >&2; exit 254;;
      transport) printf '\nCould not connect to the endpoint URL: "https://api.ecr.us-east-1.amazonaws.com/"\n' >&2; exit 255;;
      *) exit 1;;
    esac;;
  *) exit 1;;
esac
"""


class StartPreflightTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="proxy-start-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)
        (self.tmp / "aws").write_text(AWS_STUB, newline="\n"); (self.tmp / "aws").chmod(0o755)
        self.log = self.tmp / "calls.log"

    def check(self, call, **stub):
        self.log.write_text("")
        env = dict(os.environ, PATH=str(self.tmp) + os.pathsep + os.environ["PATH"], STUB_LOG=str(self.log),
                   PROXY_IMAGE_START_LIBRARY="1", **stub)
        snippet = 'source "$1"; if ' + call + '; then echo PROVEN; else echo REFUSED; fi'
        r = subprocess.run(["bash", "-c", snippet, "bash", SCRIPT.as_posix()], env=env, capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 0, r.stderr)
        return r.stdout.strip()

    def test_idle_requires_successful_structured_reads(self):
        self.assertEqual(self.check("require_project_idle --profile p", STUB_LIST="empty"), "PROVEN")
        self.assertEqual(self.check("require_project_idle --profile p", STUB_LIST="ok", STUB_BATCH="complete"), "PROVEN")
        for stub in (dict(STUB_LIST="fail"), dict(STUB_LIST="garbage"), dict(STUB_LIST="noids"),
                     dict(STUB_LIST="ok", STUB_BATCH="fail"), dict(STUB_LIST="ok", STUB_BATCH="active"),
                     dict(STUB_LIST="ok", STUB_BATCH="missing"), dict(STUB_LIST="ok", STUB_BATCH="nostatus"),
                     dict(STUB_LIST="dup", STUB_BATCH="complete"), dict(STUB_LIST="paged", STUB_BATCH="complete"),
                     dict(STUB_LIST="many", STUB_BATCH="echo-old-active")):
            with self.subTest(**stub):
                self.assertEqual(self.check("require_project_idle --profile p", **stub), "REFUSED")

    def test_idle_reads_every_build_in_chunks_of_100(self):
        self.assertEqual(self.check("require_project_idle --profile p", STUB_LIST="many", STUB_BATCH="echo-complete"), "PROVEN")
        calls = [line for line in self.log.read_text().splitlines() if "batch-get-builds" in line]
        self.assertEqual([len(line.split("--ids ")[1].split(" --output")[0].split()) for line in calls], [100, 100, 5])
        self.assertNotIn("--max-items", self.log.read_text())

    def test_tag_absent_only_on_exact_image_not_found(self):
        for mode in ("notfound", "legacy"):
            with self.subTest(mode=mode):
                self.assertEqual(self.check("require_tag_absent tag --profile p", STUB_DESCRIBE=mode), "PROVEN")
        for mode in ("exists", "denied", "throttle", "repo", "transport", "other"):
            with self.subTest(mode=mode):
                self.assertEqual(self.check("require_tag_absent tag --profile p", STUB_DESCRIBE=mode), "REFUSED")
        self.assertIn("imageTag=tag", self.log.read_text())


if __name__ == "__main__":
    unittest.main()
