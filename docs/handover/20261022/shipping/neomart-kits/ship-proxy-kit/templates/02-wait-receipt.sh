#!/usr/bin/env bash
# READ-ONLY. Waits for the build 01 started, then authenticates its result:
#   SUCCEEDED -> download results/proxy-image/<commit>/<attempt>/proxy-image-receipt.json (exact bytes; their sha256
#   is the Meri kit's proxyScanSha256), check commit/attempt/repository/tags/bases and the product scan in the
#   receipt, and that ECR's tag proxy-product-<commit>-<attempt> names the same digest.
#   FAILED    -> download proxy-image-failure.json and stop (no retry: a new attempt is a reviewed new 01).
# Writes state/proxy-image-receipt.json, state/product-digest, state/receipt-sha256.
set -euo pipefail
source "$(dirname "$0")/kit.env"
cd "$KIT_DIR"

[ -s start-build.request.json ] || stop "01 has not run"
[ -s start-build.result.json ] || stop "StartBuild outcome unknown: read back with
  aws codebuild list-builds-for-project --project-name $PROJECT --sort-order DESCENDING --max-items 3
  and record that build id in start-build.result.json as {\"id\": \"...\"}; never resubmit"
build="$(python3 -c 'import json;print(json.load(open("start-build.result.json"))["id"])')"
attempt="$(tr -d '\r\n' < attempt.txt)"
prefix="results/proxy-image/$COMMIT/$attempt"
echo "build $build attempt $attempt"

for _ in $(seq 1 90); do
  status="$(awst codebuild batch-get-builds --ids "$build" --query 'builds[0].buildStatus')"
  [ "$status" = IN_PROGRESS ] || break
  sleep 30
done
aws codebuild batch-get-builds --ids "$build" --output json > "$STATE/build.json"
fetch() { # $1 = object name -> state/$1 (latest version, exact bytes)
  local v; v="$(awst s3api list-object-versions --bucket "$BUCKET" --prefix "$prefix/$1" --query 'Versions[0].VersionId')"
  [ -n "$v" ] && [ "$v" != None ] || return 1
  aws s3api get-object --bucket "$BUCKET" --key "$prefix/$1" --version-id "$v" "$STATE/$1" --output json > "$STATE/$1.get.json"
}
if [ "$status" != SUCCEEDED ]; then
  fetch proxy-image-failure.json && cat "$STATE/proxy-image-failure.json" || echo "(no failure record in $prefix)"
  stop "build $build ended $status: read state/build.json and the CodeBuild log; a retry is a new reviewed 01 (new attempt)"
fi
fetch proxy-image-receipt.json || stop "receipt missing under $prefix"

tag="proxy-product-$COMMIT-$attempt"
ecr_digest="$(awst ecr describe-images --repository-name "$REPOSITORY_NAME" --image-ids "imageTag=$tag" --query 'imageDetails[0].imageDigest')"
python3 -I -B - "$STATE/proxy-image-receipt.json" "$COMMIT" "$attempt" "$REPOSITORY_URI" "$NODE_BASE" "$RUNTIME_BASE" "$ecr_digest" <<'EOF'
import json, re, sys
path, commit, attempt, uri, node_base, runtime_base, ecr_digest = sys.argv[1:]
r = json.load(open(path, encoding="utf-8"))
assert r["schemaVersion"] == 1 and r["status"] == "SUCCEEDED", "receipt status"
assert r["commit"] == commit and r["attempt"] == attempt and r["repository"] == uri, "receipt identity"
assert r["product"]["tag"] == f"proxy-product-{commit}-{attempt}" and r["assembly"]["tag"] == f"proxy-assembly-{commit}-{attempt}", "receipt tags"
assert r["nodeBase"] == node_base and r["runtimeBase"] == runtime_base, "pinned bases changed"
assert re.fullmatch(r"sha256:[0-9a-f]{64}", r["product"]["digest"]) and r["product"]["digest"] == ecr_digest, "ECR tag does not name the receipt digest"
scan = r["product"]["scan"] or {}
assert not scan.get("HIGH") and not scan.get("CRITICAL"), "product scan in receipt has HIGH/CRITICAL"
print("RECEIPT_OK product", r["product"]["digest"], "scan", json.dumps(scan), "assembly(builder-only)", json.dumps(r["assembly"]["scan"]))
EOF
printf '%s\n' "$ecr_digest" > "$STATE/product-digest"
sha256sum "$STATE/proxy-image-receipt.json" | cut -d' ' -f1 > "$STATE/receipt-sha256"
echo "BUILT $REPOSITORY_URI@$ecr_digest receiptSha256=$(need receipt-sha256). Next 03-scan-gate.sh"
