#!/usr/bin/env bash
# MUTATION (ecs update-service). Puts Core back on capiro-preview-first-chat-core:2 (image 46acfc07,
# source ade7fc88). Leaves the new revision and image registered; never deregisters :2.
set -euo pipefail
source "$(dirname "$0")/kit.env"
cd "$STATE"

date -u +%FT%TZ > roll-started-at
awst ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --task-definition "$ROLLBACK_TD" --query 'service.taskDefinition'
aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE" || echo "WARN: wait timed out; read the output below"
bash "$KIT_DIR/06-verify.sh"
