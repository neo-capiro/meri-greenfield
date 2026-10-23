#!/usr/bin/env bash
# READ-ONLY. ECR BASIC scan-on-push gate for the exact new digest (repo gate:
# docs/runtime-source-qualification-20261014/container/ALPINE-AMD64-PR45-QUALIFICATION.md).
#
#   Any HIGH or CRITICAL finding  -> STOP. Do not roll. The base image and lockfile are pinned, so a new
#                                    finding means apk package drift or a CVE published after 10-17; it is
#                                    a base-image decision (PR100's lane), not something this fix may waive.
#   Only MEDIUM/LOW/INFORMATIONAL -> HOLD. The serving image 46acfc07 had zero findings and PR100's receiving
#                                    gate is zero of any severity. Proceed only with an explicit decision:
#                                    ACCEPT_NON_HIGH_FINDINGS=1 bash 03-scan-gate.sh
#   Zero findings                 -> PASS (writes state/scan-gate.pass).
set -euo pipefail
source "$(dirname "$0")/kit.env"
cd "$STATE"

digest="$(need image-digest)"
rm -f scan-gate.pass
aws ecr wait image-scan-complete --repository-name "$REPOSITORY" --image-id "imageDigest=$digest"
aws ecr describe-images --repository-name "$REPOSITORY" --image-ids "imageDigest=$digest" --output json > describe-images.json
aws ecr describe-image-scan-findings --repository-name "$REPOSITORY" --image-id "imageDigest=$digest" --output json > describe-image-scan-findings.json

counts="$(node -e "const f=require('./describe-image-scan-findings.json').imageScanFindings||{};console.log(JSON.stringify({counts:f.findingSeverityCounts||{},findings:(f.findings||[]).length}))")"
echo "scan: $counts"
node -e "for(const r of (require('./describe-image-scan-findings.json').imageScanFindings?.findings||[])){const a=Object.fromEntries((r.attributes||[]).map(x=>[x.key,x.value]));console.log([r.severity,r.name,a.package_name,a.package_version].join('\t'))}" | tee scan-findings.tsv

# Exact-digest, complete, post-push, unpaginated, zero CRITICAL/HIGH (exits non-zero otherwise).
node "../verify-alpine-amd64-scan.cjs" "$digest" "$REPOSITORY" describe-images.json describe-image-scan-findings.json \
  || stop "HIGH/CRITICAL finding or incomplete scan for $digest. Do not roll; base-image/package drift needs a decision"

if [ -s scan-findings.tsv ]; then
  [ "${ACCEPT_NON_HIGH_FINDINGS:-}" = 1 ] || stop "HOLD: non-HIGH findings above (serving image had none). Re-run with ACCEPT_NON_HIGH_FINDINGS=1 only on an explicit decision"
  echo "ACCEPTED_NON_HIGH_FINDINGS $counts" > scan-gate.pass
else
  echo "ZERO_FINDINGS" > scan-gate.pass
fi
echo "SCAN_GATE_PASS $(cat scan-gate.pass)"
