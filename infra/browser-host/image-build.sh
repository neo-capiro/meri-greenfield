#!/usr/bin/env bash
# Build, probe, push and scan the browser-only host image (apps/runtime/Dockerfile.browser-host) on the existing CodeBuild
# project, the way infra/product-preview/image-build.sh builds the product runtime image: the same sealed S3 source, member
# manifest and source verification, native linux/arm64, one build, no network for probes, a scan of the pushed digest with
# 0 HIGH/CRITICAL required, and private evidence. It does not reuse that script because that one is bound to the runtime
# repository, its tag shape, its Dockerfile and its ClamAV and init probes. It makes no model, database, deployment or AWS
# write other than the image push. The helper, program and Chromium hashes the build recorded inside the image become the
# deployment inputs `helperSha256`, `nativeHostRelayHelperSha256` and `programSha256` (infra/browser-host/ami/).
set -Eeuo pipefail
umask 077
if [[ ${1:-} == --help && $# == 1 ]]; then
  printf '%s\n' 'Build the exact CodeBuild S3 source on native ARM64 as the browser host image, probe without network, push and scan. Required: SOURCE_COMMIT, SOURCE_VERSION, SOURCE_MANIFEST_KEY, SOURCE_MANIFEST_VERSION, SOURCE_MANIFEST_SHA256, IMAGE_TAG (browser-<commit>-<32 hex>). No model, database or deployment calls.'
  exit 0
fi
[[ $# == 0 ]] || exit 2
[[ $(uname -s) == Linux && $(uname -m) == aarch64 ]] || exit 2
[[ ${SOURCE_COMMIT:-} =~ ^[a-f0-9]{40}$ && ${SOURCE_MANIFEST_SHA256:-} =~ ^[a-f0-9]{64}$ ]] || exit 2
[[ ${IMAGE_TAG:-} =~ ^browser-${SOURCE_COMMIT}-[a-f0-9]{32}$ ]] || exit 2
[[ ${SOURCE_VERSION:-} =~ ^[A-Za-z0-9._~+/=-]+$ && ${#SOURCE_VERSION} -le 1024 && $SOURCE_VERSION != null && ${CODEBUILD_SOURCE_VERSION:-} == "$SOURCE_VERSION" ]] || exit 2
[[ ${SOURCE_MANIFEST_KEY:-} =~ ^inputs/[A-Za-z0-9._/-]+$ && ${SOURCE_MANIFEST_VERSION:-} =~ ^[A-Za-z0-9._~+/=-]+$ && $SOURCE_MANIFEST_VERSION != null ]] || exit 2
[[ -n ${CODEBUILD_SRC_DIR:-} && $PWD == "$CODEBUILD_SRC_DIR" ]] || exit 2
bucket=meri-greenfield-qual-build-967807252336-us-east-1
registry=967807252336.dkr.ecr.us-east-1.amazonaws.com
repository=meri-greenfield/browser-host
dockerfile=apps/runtime/Dockerfile.browser-host
lockfile=apps/runtime/browser-host-service/image/package-lock.json
helper=infra/browser-host/image-evidence.py
image="$registry/$repository:$IMAGE_TAG"
probe="meri-browser-image-${IMAGE_TAG##*-}"
evidence="$(dirname "$PWD")/image-evidence"
[[ ! -e $evidence && ! -e $PWD/image-evidence ]] || exit 2
scratch=''
owned_probe=0 owned_image=0 owned_evidence=0

# Private files cap output while the command runs; timeout kills the whole command group.
run() {
  local seconds=$1 log=$2
  shift 2
  (ulimit -f 32768; timeout --signal=TERM --kill-after=5s "${seconds}s" "$@") > "$evidence/$log" 2>&1
}
cleanup() {
  local rc=$? clean=0
  trap - EXIT INT TERM
  ((owned_evidence)) || exit "$rc"
  if ((owned_probe)); then
    run 15 container-cleanup.log docker rm -f "$probe" || true
    run 15 container-check.log docker ps -aq --filter "name=^/$probe$" || clean=1
    [[ ! -s $evidence/container-check.log ]] || clean=1
  fi
  if ((owned_image)); then
    run 15 image-cleanup.log docker image rm "$image" || true
    run 15 image-check.log docker images -q "$image" || clean=1
    [[ ! -s $evidence/image-check.log ]] || clean=1
  fi
  if [[ -n $scratch ]]; then
    rm -rf -- "$scratch" || clean=1
    [[ ! -e $scratch ]] || clean=1
  fi
  if (( clean != 0 && rc == 0 )); then rc=1; fi
  printf '{"exitCode":%s,"cleanupFailed":%s}\n' "$rc" "$clean" > "$evidence/cleanup.json"
  if ((rc != 0)); then rm -f -- "$evidence/result.json"; fi
  # Only this invocation may relocate the evidence directory it created.
  if [[ -e $PWD/image-evidence ]] || ! mv -T --no-clobber -- "$evidence" "$PWD/image-evidence" || [[ -e $evidence ]]; then
    rm -f -- "$evidence/result.json"
    rc=1
  fi
  if ((rc != 0)); then printf '%s\n' 'BROWSER_IMAGE_BUILD_FAILED; inspect private build evidence.' >&2; fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir -m 700 "$evidence"
owned_evidence=1
scratch=$(mktemp -d /tmp/meri-browser-image.XXXXXXXX)
export DOCKER_CONFIG="$scratch/auth"
mkdir -m 700 "$DOCKER_CONFIG"
export AWS_MAX_ATTEMPTS=1 AWS_PAGER=''
aws=(aws --region us-east-1 --no-cli-pager --no-cli-auto-prompt --cli-connect-timeout 5 --cli-read-timeout 20)

# Exact source: the sealed archive's member manifest is fetched by its immutable S3 version and checked against the tree.
run 30 manifest-head.json "${aws[@]}" s3api head-object --bucket "$bucket" --key "$SOURCE_MANIFEST_KEY" --version-id "$SOURCE_MANIFEST_VERSION" --output json
python3 -I -B -S - "$evidence/manifest-head.json" "$SOURCE_MANIFEST_VERSION" <<'PY'
import json,sys
v=json.load(open(sys.argv[1])); assert v['VersionId']==sys.argv[2]
assert type(v['ContentLength']) is int and 0<v['ContentLength']<=32*1024**2
PY
run 30 manifest-get.json "${aws[@]}" s3api get-object --bucket "$bucket" --key "$SOURCE_MANIFEST_KEY" --version-id "$SOURCE_MANIFEST_VERSION" "$scratch/members.json" --output json
python3 -I -B -S - "$evidence/manifest-head.json" "$evidence/manifest-get.json" "$scratch/members.json" <<'PY'
import json,os,sys
head=json.load(open(sys.argv[1])); got=json.load(open(sys.argv[2]))
assert got['VersionId']==head['VersionId'] and os.stat(sys.argv[3]).st_size==head['ContentLength']
PY
run 120 source.log python3 -I -B -S infra/product-preview/image-build-source.py verify-tree --directory "$PWD" --manifest "$scratch/members.json" --commit "$SOURCE_COMMIT" --manifest-sha256 "$SOURCE_MANIFEST_SHA256"
# The Dockerfile refuses without the browser stack lockfile; refuse earlier and by name.
[[ -f $dockerfile && -f $lockfile ]] || { echo "missing $dockerfile or $lockfile in the sealed source" >&2; exit 2; }

run 15 preexisting-container.log docker ps -aq --filter "name=^/$probe$"
[[ ! -s $evidence/preexisting-container.log ]] || exit 2
run 15 preexisting-image.log docker images -q "$image"
[[ ! -s $evidence/preexisting-image.log ]] || exit 2
owned_image=1
# One build, one platform. The Node, Wolfi base and package-closure pins live in the Dockerfile and its lock.
run 1800 build.log docker build --platform linux/arm64 --label "org.opencontainers.image.revision=$SOURCE_COMMIT" -f "$dockerfile" -t "$image" --iidfile "$evidence/image.id" .
run 15 image-inspect.json docker image inspect "$image" || exit 1
image_id=$(python3 -I -B -S "$helper" inspect --inspect "$evidence/image-inspect.json" --commit "$SOURCE_COMMIT") || exit 1
[[ $image_id =~ ^sha256:[a-f0-9]{64}$ ]] || { echo "missing immutable local image id" >&2; exit 1; }
[[ "$(tr -d ' \r\n' < "$evidence/image.id")" == "$image_id" ]] || { echo "iidfile/image-inspect mismatch" >&2; exit 1; }

# Probes: no network, no capabilities, no new privileges, nothing mounted. The image runs as root on the host by design
# (it owns cgroups, namespaces and the helpers), so the probes also read the recorded facts without becoming the service.
owned_probe=1
common=(docker run --rm --name "$probe" --platform linux/arm64 --read-only --network none --cap-drop ALL --security-opt no-new-privileges
  --pids-limit 256 --cpus 2 --memory 2g --tmpfs /tmp:rw,nosuid,nodev,noexec,size=64m,mode=1777)
run 30 helper-hashes.txt "${common[@]}" --entrypoint cat "$image" /opt/meri/browser-host/helper-hashes.txt
run 30 chromium-hashes.txt "${common[@]}" --entrypoint cat "$image" /opt/meri/browser-host/chromium-hashes.txt
run 30 os-installed-packages.txt "${common[@]}" --entrypoint cat "$image" /opt/meri/browser-host/os-installed-packages.txt
run 30 runtime-versions.txt "${common[@]}" --entrypoint cat "$image" /opt/meri/browser-host/runtime-versions.txt
# The recorded hashes must be the bytes the image actually carries.
run 30 helper-rehash.txt "${common[@]}" --entrypoint sha256sum "$image" /opt/meri/meri-host-launcher /opt/meri/meri-host-relay-launcher /opt/meri/apps/runtime/native-processing-host/protected-bootstrap.mjs
run 30 node-version.txt "${common[@]}" --entrypoint node "$image" --version
run 30 playwright-versions.txt "${common[@]}" --entrypoint node "$image" -p "require('/opt/meri/browser-host/node_modules/@playwright/mcp/package.json').version+' '+require('/opt/meri/browser-host/node_modules/playwright-core/package.json').version"
chrome=$(python3 -I -B -S "$helper" chromium-path --chromium "$evidence/chromium-hashes.txt")
run 60 chromium-version.txt "${common[@]}" --entrypoint "$chrome" "$image" --version
run 60 setuid-files.txt "${common[@]}" --entrypoint find "$image" / -xdev \( -path /proc -o -path /sys -o -path /dev -o -path /run \) -prune -o -type f -perm /6000 -print
[[ ! -s $evidence/setuid-files.txt ]] || { echo "SUID or SGID file in the image" >&2; exit 1; }
# Inert imports of the host composition and the bootstrap program the SSM document runs, and the closed refusal of the
# bootstrap program without its payload (a missing module would exit differently).
run 120 host-imports.log "${common[@]}" --entrypoint node "$image" --input-type=module -e "await import('/opt/meri/apps/runtime/browser-host-service/host.mjs');await import('/opt/meri/apps/runtime/browser-host-service/composition.mjs');await import('/opt/meri/apps/runtime/native-processing-host/protected-bootstrap.mjs');"
set +e
run 30 bootstrap-refusal.log "${common[@]}" --entrypoint node "$image" /opt/meri/native-bootstrap.mjs
bootstrap_status=$?
set -e
[[ $bootstrap_status == 1 ]] && grep -qx 'NATIVE_PROTECTED_BOOTSTRAP_REFUSED' "$evidence/bootstrap-refusal.log" || { echo "bootstrap program did not refuse as designed" >&2; exit 1; }
python3 -I -B -S "$helper" hashes --helper "$evidence/helper-hashes.txt" --rehash "$evidence/helper-rehash.txt" --chromium "$evidence/chromium-hashes.txt" \
  --packages "$evidence/os-installed-packages.txt" --node "$evidence/node-version.txt" --playwright "$evidence/playwright-versions.txt" --out "$evidence/hashes.json"

run 30 repository.json "${aws[@]}" ecr describe-repositories --repository-names "$repository" --output json
python3 -I -B -S - "$evidence/repository.json" "$registry/$repository" <<'PY'
import json,sys
rows=json.load(open(sys.argv[1]))['repositories']; assert len(rows)==1
v=rows[0]; assert v['repositoryUri']==sys.argv[2] and v['imageTagMutability']=='IMMUTABLE'
assert v['imageScanningConfiguration']['scanOnPush'] is True
PY
# Never echo the password or supply model/DB/service credentials to build or probes.
run 30 registry-login.log bash -o pipefail -c 'aws --region us-east-1 --no-cli-pager --no-cli-auto-prompt --cli-connect-timeout 5 --cli-read-timeout 20 ecr get-login-password | docker login --username AWS --password-stdin "$1"' -- "$registry"
run 600 push.log docker push "$image"
run 30 ecr-image.json "${aws[@]}" ecr describe-images --repository-name "$repository" --image-ids "imageTag=$IMAGE_TAG" --output json
digest=$(python3 -I -B -S "$helper" digest --described "$evidence/ecr-image.json" --tag "$IMAGE_TAG")
run 15 pushed-image.json docker image inspect "$image"
python3 -I -B -S - "$evidence/pushed-image.json" "$registry/$repository@$digest" <<'PY'
import json,sys
rows=json.load(open(sys.argv[1])); assert len(rows)==1 and sys.argv[2] in rows[0]['RepoDigests']
PY
# Same standard waiter and cadence as the product build; ECR may register the scan after push, so only ScanNotFoundException retries.
mkdir -p "$scratch/models/ecr/2015-09-21"
cat > "$scratch/models/ecr/2015-09-21/waiters-2.json" <<'JSON'
{"version":2,"waiters":{"ImageScanComplete":{
  "operation":"DescribeImageScanFindings","delay":5,"maxAttempts":60,
  "acceptors":[
    {"state":"success","matcher":"path","argument":"imageScanStatus.status","expected":"COMPLETE"},
    {"state":"failure","matcher":"path","argument":"imageScanStatus.status","expected":"FAILED"},
    {"state":"retry","matcher":"error","expected":"ScanNotFoundException"}
  ]
}}}
JSON
AWS_DATA_PATH="$scratch/models" run 310 scan-wait.log "${aws[@]}" ecr wait image-scan-complete --repository-name "$repository" --image-id "imageDigest=$digest"
run 30 scan.json "${aws[@]}" ecr describe-image-scan-findings --repository-name "$repository" --image-id "imageDigest=$digest" --output json
python3 -I -B -S "$helper" result --scan "$evidence/scan.json" --hashes "$evidence/hashes.json" --digest "$digest" --repository "$repository" \
  --commit "$SOURCE_COMMIT" --source-version "$SOURCE_VERSION" --image-id "$image_id" --out "$evidence/result.json"
