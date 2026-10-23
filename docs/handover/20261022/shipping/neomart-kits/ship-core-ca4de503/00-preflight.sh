#!/usr/bin/env bash
# READ-ONLY. Confirms the kit inputs and that the live Core service is still where the kit expects it.
# Re-run immediately before 01. Prints PREFLIGHT_OK or stops at the first mismatch.
set -euo pipefail
source "$(dirname "$0")/kit.env"
cd "$KIT_DIR"

[ "$(awst sts get-caller-identity --query Account)" = "$ACCOUNT" ] || stop "wrong AWS account"

# Source archive: exact bytes of the pushed commit.
[ -f "$ARCHIVE_NAME" ] || stop "archive $ARCHIVE_NAME missing"
echo "$ARCHIVE_SHA256  $ARCHIVE_NAME" | sha256sum -c - >/dev/null || stop "archive sha256 mismatch"
remote="$(git ls-remote https://github.com/neo-capiro/capiro-backend.git "refs/heads/$SOURCE_BRANCH" | cut -f1)"
[ "$remote" = "$SOURCE_SHA" ] || stop "origin/$SOURCE_BRANCH is '$remote', expected $SOURCE_SHA"

# Nothing from this kit exists yet (01 creates the S3 version, 02 the image tag).
if [ ! -s "$STATE/source-version-id" ]; then
  n="$(awst s3api list-object-versions --bucket "$BUCKET" --prefix "$KEY" --query 'length(Versions[] || `[]`)')"
  [ "$n" = 0 ] || stop "s3://$BUCKET/$KEY already has $n version(s); inspect before uploading again"
fi
[ "$(awst ecr describe-repositories --repository-names "$REPOSITORY" --query 'repositories[0].imageTagMutability')" = IMMUTABLE ] || stop "repository not IMMUTABLE"
if [ ! -s "$STATE/image-digest" ]; then
  tagged="$(awst ecr describe-images --repository-name "$REPOSITORY" --filter tagStatus=TAGGED --query "imageDetails[?contains(imageTags, '$SOURCE_SHA')].imageDigest")"
  [ -z "$tagged" ] || stop "image tag $SOURCE_SHA already exists ($tagged)"
fi

# Build project idle (concurrentBuildLimit 1).
last="$(awst codebuild list-builds-for-project --project-name "$PROJECT" --no-paginate --query 'ids[0]')"
[ "$(awst codebuild batch-get-builds --ids "$last" --query 'builds[0].buildStatus')" != IN_PROGRESS ] || stop "build $last in progress"

# Live service: still on :2 serving 46acfc07, stable, one healthy target. Rollback image still present.
read -r td desired running rollout < <(awst ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" \
  --query 'services[0].[taskDefinition,desiredCount,runningCount,deployments[?status==`PRIMARY`]|[0].rolloutState]')
echo "service: td=$td desired=$desired running=$running rollout=$rollout"
[ "$(awst ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" --query 'length(services[0].deployments)')" = 1 ] || stop "a deployment is already in flight"
[ "$td" = "$ROLLBACK_TD" ] || echo "NOTE: service is not on $ROLLBACK_TD; confirm the rollback target before 05"
[ "$desired" = 1 ] && [ "$running" = 1 ] && [ "$rollout" = COMPLETED ] || stop "service not steady"
[ "$(awst ecs describe-task-definition --task-definition "$ROLLBACK_TD" --query 'taskDefinition.containerDefinitions[0].image')" = "$REGISTRY/$REPOSITORY@$ROLLBACK_DIGEST" ] || stop "rollback TD image changed"
[ "$(awst ecr describe-images --repository-name "$REPOSITORY" --image-ids "imageDigest=$ROLLBACK_DIGEST" --query 'imageDetails[0].imageDigest')" = "$ROLLBACK_DIGEST" ] || stop "rollback image missing"
healthy="$(awst elbv2 describe-target-health --target-group-arn "$TG_ARN" --query 'length(TargetHealthDescriptions[?TargetHealth.State==`healthy`])')"
[ "$healthy" = 1 ] || stop "expected 1 healthy Core target, found $healthy"

echo PREFLIGHT_OK
