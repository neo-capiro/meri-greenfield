#!/usr/bin/env bash
# READ-ONLY. Kit inputs and live state before 01: account, sealed zip, commit on origin, S3 input prefix
# free, qualification project idle (the repository's own fail-closed check), serving proxy steady.
# Prints PREFLIGHT_OK or stops at the first mismatch. Re-run immediately before 01.
set -euo pipefail
source "$(dirname "$0")/kit.env"
cd "$KIT_DIR"

[ "$(awst sts get-caller-identity --query Account)" = "$ACCOUNT" ] || stop "wrong AWS account"
echo "$ZIP_SHA256  proxy-context.zip" | sha256sum -c - >/dev/null || stop "proxy-context.zip hash differs from the seal"
[ -n "$(git -C "$REPO" branch -r --contains "$COMMIT" 2>/dev/null)" ] || stop "$COMMIT is not on any origin branch (push it first)"

if [ ! -e put.json ]; then
  n="$(awst s3api list-object-versions --bucket "$BUCKET" --prefix "inputs/proxy-image/$COMMIT/" --query 'length(Versions || `[]`)')"
  [ "$n" = 0 ] || stop "inputs/proxy-image/$COMMIT/ already has $n object version(s); read back before uploading"
fi
# The start script's own fail-closed idle check (every build of the shared project, paginated).
PROXY_IMAGE_START_LIBRARY=1 source tools/proxy-image-start.sh
require_project_idle --profile "$AWS_PROFILE" --region "$AWS_REGION" || stop "$PROJECT is not proven idle (a Meri product or proxy build is running)"

read -r td desired running < <(awst ecs describe-services --cluster "$CLUSTER" --services "$PROXY_SERVICE" \
  --query 'services[0].[taskDefinition,desiredCount,runningCount]')
image="$(awst ecs describe-task-definition --task-definition "$td" --query 'taskDefinition.containerDefinitions[0].image')"
echo "serving proxy: $td desired=$desired running=$running image=${image##*@}"
[ "$image" = "$LIVE_PROXY" ] || echo "NOTE: the serving proxy image is not $LIVE_PROXY (rollback reference in kit.env is stale)"
echo PREFLIGHT_OK
