#!/usr/bin/env bash
# MUTATION (ecs update-service). Rolls Core to the new revision. Rolling deployment min 50 / max 200,
# circuit breaker with automatic rollback to :2 if the new task never becomes healthy.
# Rollback by hand at any time: 90-rollback.sh.
set -euo pipefail
source "$(dirname "$0")/kit.env"
cd "$STATE"

arn="$(need td-new-arn)"
[ -s scan-gate.pass ] || stop "scan gate has not passed"
current="$(awst ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" --query 'services[0].taskDefinition')"
[ "$current" = "$ROLLBACK_TD" ] || stop "service is on $current, not $ROLLBACK_TD; re-check before rolling"
[ "$(awst ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" --query 'length(services[0].deployments)')" = 1 ] || stop "a deployment is already in flight"

date -u +%FT%TZ > roll-started-at
awst ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --task-definition "$arn" --query 'service.taskDefinition'
aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE" || echo "WARN: wait timed out; read 06-verify.sh output"
bash "$KIT_DIR/06-verify.sh"
