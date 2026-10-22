#!/usr/bin/env bash
# MUTATION (S3 create-only KMS upload of proxy-context.zip + ONE CodeBuild start on meri-greenfield-qualification-build).
# Runs the repository's own infra/product-preview/proxy-image-start.sh at this commit in LIVE mode
# (MERI_PROXY_START_APPROVED = the sealed zip sha256). That script: conditional upload, HEAD verify (length,
# SHA256, KMS), attempt id, project idle + both tags absent, then StartBuild 30/5/0. It never starts twice:
# once start-build.request.json exists it refuses; read an uncertain start back with 02, never resubmit.
# The build itself (proxy-image-build.sh, sha256 pinned in the buildspec) builds assembly -> product, runs the
# in-image native smoke, pushes both, gates the product scan on 0 HIGH/CRITICAL and writes the receipt.
set -euo pipefail
source "$(dirname "$0")/kit.env"
cd "$KIT_DIR"

[ ! -e start-build.request.json ] || stop "a start was already attempted (start-build.request.json): run 02-wait-receipt.sh"
bash ./00-preflight.sh
MERI_AWS_PROFILE="$AWS_PROFILE" MERI_REPO="$REPO" MERI_PROXY_START_APPROVED="$ZIP_SHA256" \
  bash tools/proxy-image-start.sh "$COMMIT" "$KIT_DIR" "$ZIP_SHA256"
echo "STARTED: next 02-wait-receipt.sh (about 15-25 minutes)"
