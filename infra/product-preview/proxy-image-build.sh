#!/usr/bin/env bash
# One Meri product proxy qualification inside CodeBuild (privileged, no cache).
# Input: the extracted proxy context ZIP made by proxy-image-context.py:
#   repo/apps/proxy/**            exact git archive of COMMIT (apps/proxy only)
#   artifacts/**                  the 331 assembly-pins.json artifacts
#   context-manifest.json         {"commit":..., "files":{path: sha256}} for every other member
# Order: verify -> UNCHANGED assembly Dockerfile -> locked-down import probe -> push
# -> product Dockerfile FROM that digest (in-image InstalledNativeStartup smoke)
# -> push -> both scans COMPLETE with zero HIGH/CRITICAL -> receipt.
# Any failure stops and writes a failure record; there is no retry.
set -Eeuo pipefail
: "${COMMIT:?}" "${ATTEMPT:?}" "${REPOSITORY_URI:?}" "${REPOSITORY_NAME:?}" "${RESULT_BUCKET:?}" "${KMS_KEY_ARN:?}"
[[ "$COMMIT" =~ ^[0-9a-f]{40}$ && "$ATTEMPT" =~ ^[0-9a-f]{32}$ ]]
REGION=us-east-1
NODE_BASE='node:24.21.0-trixie-slim@sha256:173f125896c3b47ddf056734c7ea789d04595a6a08769a8f78e0df642781fb66'
NODE_MIRROR='public.ecr.aws/docker/library/node@sha256:173f125896c3b47ddf056734c7ea789d04595a6a08769a8f78e0df642781fb66'
ASSEMBLY_TAG="proxy-assembly-$COMMIT-$ATTEMPT"
PRODUCT_TAG="proxy-product-$COMMIT-$ATTEMPT"
RESULTS="results/proxy-image/$COMMIT/$ATTEMPT"
ROOT="$(pwd)"; WORK="$(mktemp -d)"; PHASE=VERIFY_CONTEXT
declare -A DIGEST=()

record() { # $1 = name, $2 = JSON body; one conditional KMS put per name
  printf '%s\n' "$2" > "$WORK/$1"
  aws --region "$REGION" s3api put-object --bucket "$RESULT_BUCKET" --key "$RESULTS/$1" \
    --body "$WORK/$1" --if-none-match '*' --server-side-encryption aws:kms --ssekms-key-id "$KMS_KEY_ARN" \
    --query VersionId --output text
}
fail() {
  local code=$?
  trap - ERR
  set +e
  record proxy-image-failure.json "$(python3 -c 'import json,sys;print(json.dumps({"schemaVersion":1,"status":"FAILED","phase":sys.argv[1],"exitCode":int(sys.argv[2]),"commit":sys.argv[3],"attempt":sys.argv[4],"assemblyDigest":sys.argv[5] or None,"productDigest":sys.argv[6] or None},sort_keys=True))' \
    "$PHASE" "$code" "$COMMIT" "$ATTEMPT" "${DIGEST[assembly]:-}" "${DIGEST[product]:-}")"
  docker logout "${REPOSITORY_URI%%/*}" >/dev/null 2>&1
  echo "PROXY_IMAGE_FAILED phase=$PHASE exit=$code" >&2
  exit 1
}
trap fail ERR

# 1. Every member is pinned; the 331 artifacts match assembly-pins.json exactly; no extras.
python3 -I -B - "$ROOT" "$COMMIT" <<'PY'
import hashlib, json, os, sys
root, commit = sys.argv[1], sys.argv[2]
m = json.load(open(os.path.join(root, "context-manifest.json")))
assert m["commit"] == commit and m["schemaVersion"] == 1
pins = json.load(open(os.path.join(root, "repo/apps/proxy/qualification/linux/assembly-pins.json")))
art = {"artifacts/" + a["path"]: a for a in pins["artifacts"]}
assert len(art) == 331
seen = set()
for base, _, files in os.walk(root):
    for name in files:
        rel = os.path.relpath(os.path.join(base, name), root).replace(os.sep, "/")
        if rel == "context-manifest.json":
            continue
        data = open(os.path.join(root, rel), "rb").read()
        digest = hashlib.sha256(data).hexdigest()
        if rel in art:
            assert len(data) == art[rel]["bytes"] and digest == art[rel]["sha256"], rel
        else:
            assert m["files"].get(rel) == digest, rel
        seen.add(rel)
assert set(art) <= seen and set(m["files"]) <= seen and seen == set(art) | set(m["files"])
print("PROXY_CONTEXT_VERIFIED", len(seen))
PY

# 2. Exact assembly context: the seven reviewed source files plus artifacts/.
PHASE=ASSEMBLY_BUILD
L="$ROOT/repo/apps/proxy/qualification/linux"; A="$WORK/assembly"; mkdir "$A"
cp "$L/Dockerfile" "$L/assembly-pins.json" "$L/requirements.lock" "$L/prisma-build.py" "$L/import-probe.py" "$L/assembly.test.py" "$L/README.md" "$A/"
cp -R "$ROOT/artifacts" "$A/artifacts"
aws --region "$REGION" ecr get-login-password | docker login --username AWS --password-stdin "${REPOSITORY_URI%%/*}" >/dev/null
# The base digest is identical on the AWS public mirror; avoid anonymous Docker Hub limits.
docker buildx build --load --platform linux/amd64 --build-context "$NODE_BASE=docker-image://$NODE_MIRROR" \
  -t "$REPOSITORY_URI:$ASSEMBLY_TAG" "$A"

PHASE=ASSEMBLY_IMPORT_PROBE
timeout 600 docker run --rm --network none --read-only --tmpfs /tmp:rw,nosuid,nodev,noexec,size=256m \
  --cap-drop ALL --security-opt no-new-privileges --pids-limit 64 --memory 2g --cpus 2 "$REPOSITORY_URI:$ASSEMBLY_TAG"

push() { # $1 = role, $2 = tag
  PHASE="${1^^}_PUSH"
  docker push "$REPOSITORY_URI:$2" >/dev/null
  DIGEST[$1]="$(aws --region "$REGION" ecr describe-images --repository-name "$REPOSITORY_NAME" \
    --image-ids imageTag="$2" --query 'imageDetails[0].imageDigest' --output text)"
  [[ "${DIGEST[$1]}" =~ ^sha256:[0-9a-f]{64}$ ]]
  echo "PUSHED $1 ${DIGEST[$1]}"
}
push assembly "$ASSEMBLY_TAG"

# 3. Product image from exactly that digest; its Dockerfile runs the in-image native smoke.
PHASE=PRODUCT_BUILD
P="$WORK/product"; mkdir -p "$P/apps/proxy/qualification/test" "$P/apps/proxy/qualification/linux"
cp -R "$ROOT/repo/apps/proxy/product" "$P/apps/proxy/product"
cp -R "$ROOT/repo/apps/proxy/qualification/runtime" "$ROOT/repo/apps/proxy/qualification/state" "$P/apps/proxy/qualification/"
cp "$ROOT/repo/apps/proxy/qualification/test/test_ingress.py" "$P/apps/proxy/qualification/test/"
cp "$L/assembly-pins.json" "$L/requirements.lock" "$P/apps/proxy/qualification/linux/"
docker buildx build --load --platform linux/amd64 \
  --build-arg "PROXY_ASSEMBLY_IMAGE=$REPOSITORY_URI@${DIGEST[assembly]}" \
  -f "$P/apps/proxy/product/Dockerfile" -t "$REPOSITORY_URI:$PRODUCT_TAG" "$P"
push product "$PRODUCT_TAG"
docker logout "${REPOSITORY_URI%%/*}" >/dev/null

# 4. Both scans must COMPLETE with zero HIGH/CRITICAL within 300 s.
scan() { # $1 = role
  PHASE="${1^^}_SCAN"; local deadline=$((SECONDS+300)) out status
  while :; do
    if out="$(aws --region "$REGION" ecr describe-image-scan-findings --repository-name "$REPOSITORY_NAME" \
        --image-id imageDigest="${DIGEST[$1]}" --query '[imageScanStatus.status,imageScanFindings.findingSeverityCounts]' --output json 2>"$WORK/scan.err")"; then
      status="$(python3 -c 'import json,sys;print(json.loads(sys.argv[1])[0])' "$out")"
      [[ "$status" == COMPLETE ]] && break
      [[ "$status" == IN_PROGRESS || "$status" == PENDING ]] || return 1
    else
      grep -qE '^(aws: \[ERROR\]: )?An error occurred \(ScanNotFoundException\)' "$WORK/scan.err" || return 1
    fi
    (( SECONDS < deadline )) || return 1
    sleep 10
  done
  python3 -c 'import json,sys;c=json.loads(sys.argv[1])[1] or {};print(json.dumps(c,sort_keys=True));sys.exit(1 if c.get("HIGH",0) or c.get("CRITICAL",0) else 0)' "$out" > "$WORK/$1.counts"
}
scan assembly; scan product

PHASE=RECEIPT
trap - ERR
record proxy-image-receipt.json "$(python3 -c 'import json,sys;print(json.dumps({"schemaVersion":1,"status":"SUCCEEDED","commit":sys.argv[1],"attempt":sys.argv[2],"repository":sys.argv[3],"assembly":{"tag":sys.argv[4],"digest":sys.argv[5],"scan":json.load(open(sys.argv[8]))},"product":{"tag":sys.argv[6],"digest":sys.argv[7],"scan":json.load(open(sys.argv[9]))},"nodeBase":sys.argv[10]},sort_keys=True))' \
  "$COMMIT" "$ATTEMPT" "$REPOSITORY_URI" "$ASSEMBLY_TAG" "${DIGEST[assembly]}" "$PRODUCT_TAG" "${DIGEST[product]}" "$WORK/assembly.counts" "$WORK/product.counts" "$NODE_BASE")"
echo "PROXY_IMAGE_SUCCEEDED assembly=${DIGEST[assembly]} product=${DIGEST[product]}"
