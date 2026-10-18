#!/usr/bin/env bash
# D3 outer envelope: ONE Temporal derivative image qualification start for a sealed
# temporal-context.zip (made by temporal-image-context.py).
#
#   MERI_AWS_PROFILE=<existing profile> MERI_REPO=<repo checkout> \
#     temporal-image-start.sh <full-commit> <inputs-dir with temporal-context.zip> <expected-zip-sha256>
#
# Default is a DRY RUN: stream-hash the ZIP, verify its manifest commit, base pins and
# build-script hash against the Git blob at <full-commit>, then print the exact
# StartBuild request with <ATTEMPT>/<SOURCE_VERSION> placeholders. Nothing is uploaded,
# started or read from AWS. A live start additionally requires
# MERI_TEMPORAL_IMAGE_START_APPROVED=<expected-zip-sha256>.
# Live: conditional SSE-KMS upload, version/checksum/KMS read-back, idle project check,
# tag-absence check, one StartBuild with timeout 30 / queue 5 / autoRetryLimitOverride 0.
# Never starts twice: an existing start-build.request.json refuses.
set -euo pipefail
PROJECT=meri-greenfield-qualification-build
REPOSITORY_NAME=meri-greenfield/qualification-worker

# Fail-closed preflight reads. Each returns nonzero unless AWS answered and the answer
# proves the condition; transport, throttling, access and unknown errors all stop.
require_project_idle() { # $@ = aws profile/region args
  # Every build of the project: the CLI paginates the full list (no --max-items), then
  # each chunk of <=100 IDs is read back. JSON goes to Python on stdin (argv limits).
  local listed chunks chunk builds
  listed="$(aws "$@" codebuild list-builds-for-project --project-name "$PROJECT" --sort-order DESCENDING --output json)" || return 1
  chunks="$(printf '%s' "$listed" | python3 -I -B -c 'import json,sys
d=json.load(sys.stdin); ids=d.get("ids")
assert type(ids) is list and all(type(i) is str and i and " " not in i for i in ids) and len(ids)==len(set(ids))
assert "nextToken" not in d and "NextToken" not in d
for k in range(0,len(ids),100): print(" ".join(ids[k:k+100]))')" || return 1
  [[ -z "$chunks" ]] && return 0
  while IFS= read -r chunk; do chunk="${chunk%$'\r'}"
    builds="$(aws "$@" codebuild batch-get-builds --ids $chunk --output json)" || return 1
    printf '%s' "$builds" | python3 -I -B -c 'import json,sys
d=json.load(sys.stdin); b=d.get("builds"); n=sys.argv[1].split()
assert type(b) is list and sorted(x.get("id") for x in b)==sorted(n) and not d.get("buildsNotFound")
assert all(x.get("buildComplete") is True and x.get("buildStatus") not in (None,"IN_PROGRESS") for x in b)' "$chunk" || return 1
  done <<< "$chunks"
}
require_tag_absent() { # $1 = tag, rest = aws profile/region args; only ImageNotFoundException proves absence
  local tag="$1" err rc=0; shift
  err="$(aws "$@" ecr describe-images --repository-name "$REPOSITORY_NAME" \
    --image-ids imageTag="$tag" --output json 2>&1 >/dev/null)" || rc=$?
  [[ $rc -eq 254 ]] || return 1
  printf '%s\n' "$err" | grep -qE '^(aws: \[ERROR\]: )?An error occurred \(ImageNotFoundException\) when calling the DescribeImages operation' || return 1
}
# Sourcing with TEMPORAL_IMAGE_START_LIBRARY=1 defines the preflight functions only (focused tests).
if [[ "${TEMPORAL_IMAGE_START_LIBRARY:-}" == 1 ]]; then return 0 2>/dev/null || exit 0; fi

[[ $# -eq 3 && "$1" =~ ^[0-9a-f]{40}$ && "$3" =~ ^[0-9a-f]{64}$ ]] || { echo 'usage: temporal-image-start.sh COMMIT INPUTS_DIR ZIP_SHA256' >&2; exit 2; }
C="$1"; O="$(cd "$2" && pwd)"; EXPECTED_ZIP="$3"
command -v cygpath >/dev/null && O="$(cygpath -m "$O")"
REPO="$(cd "${MERI_REPO:?set the repository checkout}" && pwd)"; command -v cygpath >/dev/null && REPO="$(cygpath -m "$REPO")"
export AWS_PAGER='' AWS_MAX_ATTEMPTS=1 MSYS_NO_PATHCONV=1
B=meri-greenfield-qual-build-967807252336-us-east-1
K=arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042
REPOSITORY_URI=967807252336.dkr.ecr.us-east-1.amazonaws.com/$REPOSITORY_NAME
SCRIPT_PATH=infra/product-preview/temporal-image-build.sh
KEY="inputs/temporal-image/$C/temporal-context.zip"
cd "$O"
test -f temporal-context.zip

# Bind ZIP bytes (streamed), manifest commit, base pins and build-script hash to Git at COMMIT.
SCRIPT_SHA="$(git -C "$REPO" show "$C:$SCRIPT_PATH" | python3 -I -B -c 'import hashlib,sys;print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())')"
python3 -I -B - "$EXPECTED_ZIP" "$C" "$SCRIPT_PATH" "$SCRIPT_SHA" <<'EOF'
import hashlib, json, os, sys, zipfile
expected, commit, path, script = sys.argv[1:]
h = hashlib.sha256()
with open("temporal-context.zip", "rb") as f:
    for block in iter(lambda: f.read(1 << 20), b""):
        h.update(block)
assert h.hexdigest() == expected, "ZIP_SHA256_MISMATCH"
bases = {"nodeBinary": "public.ecr.aws/docker/library/node@sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63",
         "glibcRuntime": "cgr.dev/chainguard/wolfi-base@sha256:030e45cb37187dff322bbefe9658bcaec31b824a5d523380771a64864c9f45d4",
         "temporalServer": "temporalio/server@sha256:2695f2564ec51aa84232bf3fa59b31e2cce99bec437a64f5bc487cbe21b2de0e"}
with zipfile.ZipFile("temporal-context.zip") as z:
    m = json.loads(z.read("context-manifest.json"))
    assert m["commit"] == commit, "MANIFEST_COMMIT_MISMATCH"
    assert m["bases"] == bases, "MANIFEST_BASES_MISMATCH"
    assert m["files"]["repo/" + path] == script, "SCRIPT_SHA256_MISMATCH"
    assert hashlib.sha256(z.read("repo/" + path)).hexdigest() == script, "SCRIPT_MEMBER_MISMATCH"
    assert sorted(z.namelist()) == sorted(["context-manifest.json", *m["files"]]), "MEMBER_SET_MISMATCH"
print(json.dumps({"zipBytes": os.path.getsize("temporal-context.zip"), "zipSha256": expected, "commit": commit,
                  "buildScriptSha256": script, "issuerCaSha256": m["issuerCaSha256"], "bases": bases}), file=sys.stderr)
EOF

request() { # $1 = attempt, $2 = source VersionId -> exact StartBuild JSON on stdout
  python3 -I -B - "$C" "$1" "$2" "$B" "$K" "$SCRIPT_SHA" "$SCRIPT_PATH" "$PROJECT" "$REPOSITORY_URI" <<'EOF'
import json, sys
C, A, V, B, K, S, path, project, uri = sys.argv[1:]
spec = ("version: 0.2\nphases:\n  build:\n    commands:\n"
        "      - echo '%s  repo/%s' | sha256sum -c -\n"
        "      - bash repo/%s\n") % (S, path, path)
env = [{"name": n, "value": v, "type": "PLAINTEXT"} for n, v in (
    ("COMMIT", C), ("ATTEMPT", A), ("KMS_KEY_ARN", K), ("REPOSITORY_URI", uri),
    ("REPOSITORY_NAME", uri.split("/", 1)[1]), ("RESULT_BUCKET", B))]
print(json.dumps({"projectName": project, "sourceTypeOverride": "S3",
    "sourceLocationOverride": "%s/inputs/temporal-image/%s/temporal-context.zip" % (B, C), "sourceVersion": V,
    "buildspecOverride": spec, "idempotencyToken": A, "timeoutInMinutesOverride": 30,
    "queuedTimeoutInMinutesOverride": 5, "autoRetryLimitOverride": 0,
    "environmentVariablesOverride": env, "artifactsOverride": {"type": "NO_ARTIFACTS"}}, indent=1, sort_keys=True))
EOF
}

if [[ "${MERI_TEMPORAL_IMAGE_START_APPROVED:-}" != "$EXPECTED_ZIP" ]]; then
  echo "DRY_RUN: no upload or StartBuild. Exact request with placeholders:" >&2
  request '<ATTEMPT_32_HEX>' '<SOURCE_VERSION_ID>'
  exit 0
fi

P=(--profile "${MERI_AWS_PROFILE:?set an existing authorized profile}" --region us-east-1)
test ! -e start-build.request.json
if [[ ! -e put.json ]]; then
  test "$(aws "${P[@]}" s3api list-object-versions --bucket "$B" --prefix "inputs/temporal-image/$C/" --query 'length(Versions || `[]`)' --output text)" = 0
  b64="$(python3 -I -B -c 'import base64,hashlib
h=hashlib.sha256()
with open("temporal-context.zip","rb") as f:
    for b in iter(lambda: f.read(1<<20), b""): h.update(b)
print(base64.b64encode(h.digest()).decode())')"
  aws "${P[@]}" s3api put-object --bucket "$B" --key "$KEY" --body temporal-context.zip --if-none-match '*' \
    --checksum-algorithm SHA256 --checksum-sha256 "$b64" --server-side-encryption aws:kms --ssekms-key-id "$K" --output json > put.json
fi
V="$(python3 -I -B -c "import json;print(json.load(open('put.json'))['VersionId'])")"
aws "${P[@]}" s3api head-object --bucket "$B" --key "$KEY" --version-id "$V" --checksum-mode ENABLED --output json > head.json
python3 -I -B - "$K" "$EXPECTED_ZIP" <<'EOF'
import base64, json, os, sys
h = json.load(open("head.json"))
assert (h["ContentLength"] == os.path.getsize("temporal-context.zip") and h["ChecksumSHA256"] == base64.b64encode(bytes.fromhex(sys.argv[2])).decode()
        and h["ChecksumType"] == "FULL_OBJECT" and h["ServerSideEncryption"] == "aws:kms" and h["SSEKMSKeyId"] == sys.argv[1]), "HEAD_MISMATCH"
EOF
[[ -e attempt.txt ]] || python3 -I -B -c "import secrets;open('attempt.txt','x').write(secrets.token_hex(16)+'\n')"
A="$(tr -d '\r\n' < attempt.txt)"
require_project_idle "${P[@]}" || { echo PROJECT_NOT_PROVEN_IDLE >&2; exit 3; }
require_tag_absent "temporal-server-$C-$A" "${P[@]}" || { echo "TAG_NOT_PROVEN_ABSENT temporal-server-$C-$A" >&2; exit 3; }
( set -o noclobber; request "$A" "$V" > start-build.request.json )
aws "${P[@]}" codebuild start-build --cli-input-json file://start-build.request.json \
  --query 'build.{id:id,status:buildStatus,sourceVersion:sourceVersion,timeout:timeoutInMinutes,queue:queuedTimeoutInMinutes,retry:autoRetryConfig}' \
  --output json | tee start-build.result.json
