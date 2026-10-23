#!/usr/bin/env bash
# Root supplies one reviewed S3 source version and a separate immutable member manifest.
set -Eeuo pipefail
umask 077
if [[ ${1:-} == --help && $# == 1 ]]; then
  printf '%s\n' 'Build the exact CodeBuild S3 source on native ARM64, probe without network, push and scan. Required: SOURCE_COMMIT, SOURCE_VERSION, SOURCE_MANIFEST_KEY, SOURCE_MANIFEST_VERSION, SOURCE_MANIFEST_SHA256, IMAGE_TAG. No model, database or deployment calls.'
  exit 0
fi
[[ $# == 0 ]] || exit 2
[[ $(uname -s) == Linux && $(uname -m) == aarch64 ]] || exit 2
[[ ${SOURCE_COMMIT:-} =~ ^[a-f0-9]{40}$ && ${SOURCE_MANIFEST_SHA256:-} =~ ^[a-f0-9]{64}$ ]] || exit 2
[[ ${IMAGE_TAG:-} =~ ^product-${SOURCE_COMMIT}-[a-f0-9]{32}$ ]] || exit 2
[[ ${SOURCE_VERSION:-} =~ ^[A-Za-z0-9._~+/=-]+$ && ${#SOURCE_VERSION} -le 1024 && $SOURCE_VERSION != null && ${CODEBUILD_SOURCE_VERSION:-} == "$SOURCE_VERSION" ]] || exit 2
[[ ${SOURCE_MANIFEST_KEY:-} =~ ^inputs/[A-Za-z0-9._/-]+$ && ${SOURCE_MANIFEST_VERSION:-} =~ ^[A-Za-z0-9._~+/=-]+$ && $SOURCE_MANIFEST_VERSION != null ]] || exit 2
[[ -n ${CODEBUILD_SRC_DIR:-} && $PWD == "$CODEBUILD_SRC_DIR" ]] || exit 2
bucket=meri-greenfield-qual-build-967807252336-us-east-1
registry=967807252336.dkr.ecr.us-east-1.amazonaws.com
repository=meri-greenfield/qualification-worker
image="$registry/$repository:$IMAGE_TAG"
probe="meri-image-${IMAGE_TAG##*-}"
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
  ((clean == 0)) || rc=1
  printf '{"exitCode":%s,"cleanupFailed":%s}\n' "$rc" "$clean" > "$evidence/cleanup.json"
  if ((rc != 0)); then
    rm -f -- "$evidence/result.json"
  fi
  # Only this invocation may relocate the evidence directory it created.
  if [[ -e $PWD/image-evidence ]] || ! mv -T --no-clobber -- "$evidence" "$PWD/image-evidence" || [[ -e $evidence ]]; then
    rm -f -- "$evidence/result.json"
    rc=1
  fi
  if ((rc != 0)); then printf '%s\n' 'IMAGE_BUILD_FAILED; inspect private build evidence.' >&2; fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir -m 700 "$evidence"
owned_evidence=1
scratch=$(mktemp -d /tmp/meri-image.XXXXXXXX)
export DOCKER_CONFIG="$scratch/auth"
mkdir -m 700 "$DOCKER_CONFIG"
export AWS_MAX_ATTEMPTS=1 AWS_PAGER=''
aws=(aws --region us-east-1 --no-cli-pager --no-cli-auto-prompt --cli-connect-timeout 5 --cli-read-timeout 20)
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
readarray -t bases < <(python3 -I -B -S - <<'PY'
import json,re
v=json.load(open('infra/product-preview/runtime-packages.lock.json'))
assert v['platform']=='linux/arm64'
for key,name in [('nodeImageUri','node'),('runtimeImageUri','python')]:
 value=v[key]; assert re.fullmatch('public.ecr.aws/docker/library/'+name+'@sha256:[a-f0-9]{64}',value); print(value)
PY
)
[[ ${#bases[@]} == 2 ]] || exit 2
run 15 preexisting-container.log docker ps -aq --filter "name=^/$probe$"
[[ ! -s $evidence/preexisting-container.log ]] || exit 2
run 15 preexisting-image.log docker images -q "$image"
[[ ! -s $evidence/preexisting-image.log ]] || exit 2
owned_image=1
run 1800 build.log docker build --platform linux/arm64 --build-arg "NODE_IMAGE=${bases[0]}" --build-arg "RUNTIME_IMAGE=${bases[1]}" --label "org.opencontainers.image.revision=$SOURCE_COMMIT" -f apps/runtime/Dockerfile -t "$image" --iidfile "$evidence/image.id" .
run 15 image-inspect.json docker image inspect "$image"
python3 -I -B -S - "$evidence/image-inspect.json" "$SOURCE_COMMIT" <<'PY'
import json,sys
v=json.load(open(sys.argv[1])); assert len(v)==1
v=v[0]; c=v['Config']
assert v['Os']=='linux' and v['Architecture']=='arm64' and 0<v['Size']<=3*1024**3
assert c['User']=='1000:1000' and c['Entrypoint']==['node','apps/runtime/cli.mjs']
assert c['Labels']['org.opencontainers.image.revision']==sys.argv[2]
assert [x for x in c['Env'] if x.startswith('NODE_EXTRA_CA_CERTS=')]==['NODE_EXTRA_CA_CERTS=/opt/meri/certs/rds-global-bundle.pem']
PY
common=(docker run --rm --name "$probe" --platform linux/arm64 --read-only --user 1000:1000
  --network none --cap-drop ALL --security-opt no-new-privileges --pids-limit 256 --cpus 2 --memory 2g
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=256m,mode=1777
  --tmpfs /workspace:rw,nosuid,nodev,noexec,size=64m,uid=1000,gid=1000,mode=0700
  --tmpfs /run/meri:rw,nosuid,nodev,noexec,size=16m,uid=1000,gid=1000,mode=0700
  --tmpfs /run/meri-temporal:rw,nosuid,nodev,noexec,size=16m,uid=1000,gid=1000,mode=0700)
owned_probe=1
run 30 cli-help.log "${common[@]}" "$image" --help
run 180 runtime-probe.log "${common[@]}" --entrypoint node "$image" apps/runtime/build/runtime-base-probe.mjs --check
run 300 artifact-generation.log "${common[@]}" --entrypoint node "$image" infra/product-preview/runtime-packages/executor-generation-smoke.mjs
run 120 product-imports.log "${common[@]}" --entrypoint node "$image" --input-type=module -e "await import('./apps/runtime/control.mjs');await import('./apps/runtime/temporal-worker.mjs');await import('./apps/runtime/conversation-runner.mjs');"
run 30 public-ca.log "${common[@]}" --entrypoint node "$image" --input-type=module -e "import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';const lock=JSON.parse(fs.readFileSync('apps/runtime/certs/rds-global-bundle.lock.json'));const path=process.env.NODE_EXTRA_CA_CERTS;assert.equal(path,lock.imagePath);const bytes=fs.readFileSync(path),s=fs.statSync(path);assert.equal(createHash('sha256').update(bytes).digest('hex'),lock.sha256);assert.equal(bytes.length,lock.bytes);assert.equal(s.mode&4095,292);assert.equal(s.uid,0);"
run 30 repository.json "${aws[@]}" ecr describe-repositories --repository-names "$repository" --output json
python3 -I -B -S - "$evidence/repository.json" "$registry/$repository" <<'PY'
import json,sys
rows=json.load(open(sys.argv[1]))['repositories']; assert len(rows)==1
v=rows[0]; assert v['repositoryUri']==sys.argv[2] and v['imageTagMutability']=='IMMUTABLE'
assert v['imageScanningConfiguration']['scanOnPush'] is True
PY
# Never echo the password or supply model/DB/service credentials to build or probes.
run 30 registry-login.log bash -o pipefail -c 'aws --region us-east-1 --no-cli-pager --no-cli-auto-prompt --cli-connect-timeout 5 --cli-read-timeout 20 ecr get-login-password | docker login --username AWS --password-stdin "$1"' -- "$registry"
run 300 push.log docker push "$image"
run 30 ecr-image.json "${aws[@]}" ecr describe-images --repository-name "$repository" --image-ids "imageTag=$IMAGE_TAG" --output json
digest=$(python3 -I -B -S - "$evidence/ecr-image.json" "$IMAGE_TAG" <<'PY'
import json,re,sys
rows=json.load(open(sys.argv[1]))['imageDetails']; assert len(rows)==1
v=rows[0]; assert sys.argv[2] in v['imageTags'] and re.fullmatch('sha256:[a-f0-9]{64}',v['imageDigest'])
print(v['imageDigest'])
PY
)
run 15 pushed-image.json docker image inspect "$image"
python3 -I -B -S - "$evidence/pushed-image.json" "$registry/$repository@$digest" <<'PY'
import json,sys
rows=json.load(open(sys.argv[1])); assert len(rows)==1 and sys.argv[2] in rows[0]['RepoDigests']
PY
run 310 scan-wait.log "${aws[@]}" ecr wait image-scan-complete --repository-name "$repository" --image-id "imageDigest=$digest"
run 30 scan.json "${aws[@]}" ecr describe-image-scan-findings --repository-name "$repository" --image-id "imageDigest=$digest" --output json
python3 -I -B -S - "$evidence/scan.json" "$digest" "$repository" "$SOURCE_COMMIT" "$SOURCE_VERSION" "$evidence/result.json" <<'PY'
import json,sys
v=json.load(open(sys.argv[1])); assert v['repositoryName']==sys.argv[3] and v['imageId']['imageDigest']==sys.argv[2]
assert v['imageScanStatus']['status']=='COMPLETE'
counts=v['imageScanFindings']['findingSeverityCounts']
assert type(counts) is dict and all(type(n) is int and n>=0 for n in counts.values())
assert counts.get('HIGH',0)==counts.get('CRITICAL',0)==0
with open(sys.argv[6],'x') as out:
 json.dump({'sourceCommit':sys.argv[4],'sourceVersion':sys.argv[5],'imageDigest':sys.argv[2],'platform':'linux/arm64','scanStatus':'COMPLETE','findingSeverityCounts':counts},out)
PY
