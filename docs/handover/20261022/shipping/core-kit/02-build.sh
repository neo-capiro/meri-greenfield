#!/usr/bin/env bash
# MUTATION (CodeBuild start-build, which pushes one IMMUTABLE ECR tag). Repeats build #8 6ee29aa7, the
# build that produced the serving image 46acfc07, with StartBuild overrides. Only SOURCE_SHA, SOURCE_KEY,
# ARCHIVE_SHA256 and the S3 VersionId differ from it; gates unchanged except objective-migration-absence -> consolidated-migrations-presence (O137).
# Never use capiro-preview-first-chat-core-build (Debian Dockerfile: the 7 HIGH image).
# Records state/build-id and state/image-digest. About 5 minutes.
#
# Safe to re-run. A recorded build that is still running is waited on; one that ended FAILED, FAULT,
# STOPPED or TIMED_OUT is moved to state/build-attempts.log and a new build starts from the same S3
# version, but only while the image tag is still absent (a failure after the push is a STOP).
set -euo pipefail
source "$(dirname "$0")/kit.env"
cd "$STATE"

vid="$(need source-version-id)"
[ ! -s image-digest ] || stop "already built: $(need image-digest)"
sed "s/__APPROVED_SOURCE_VERSION_ID__/$vid/" "$KIT_DIR/buildspec.template.yml" > buildspec.yml
! grep -q __APPROVED_SOURCE_VERSION_ID__ buildspec.yml || stop "buildspec placeholder left"
[ "$(grep -c "$SOURCE_SHA" buildspec.yml)" = 2 ] || stop "buildspec SOURCE_SHA/SOURCE_KEY not rendered"

build_status() { awst codebuild batch-get-builds --ids "$1" --query 'builds[0].buildStatus'; }
tag_digest() { awst ecr describe-images --repository-name "$REPOSITORY" --filter tagStatus=TAGGED \
  --query "imageDetails[?contains(imageTags, '$SOURCE_SHA')].imageDigest"; }

if [ -s build-id ]; then
  previous="$(need build-id)"; status="$(build_status "$previous")"
  case "$status" in
    IN_PROGRESS|SUCCEEDED) ;;
    *) [ -z "$(tag_digest)" ] || stop "build $previous ended $status but tag $SOURCE_SHA exists; inspect before retrying"
       printf '%s %s %s\n' "$(date -u +%FT%TZ)" "$previous" "$status" >> build-attempts.log
       rm -f build-id build-gates.log
       echo "previous build $previous ended $status; starting a new attempt" ;;
  esac
fi
if [ ! -s build-id ]; then
  [ -z "$(tag_digest)" ] || stop "tag $SOURCE_SHA already exists"
  awst codebuild start-build --project-name "$PROJECT" \
    --source-type-override S3 --source-location-override "$BUCKET/$KEY" --source-version "$vid" \
    --buildspec-override file://buildspec.yml \
    --environment-variables-override "name=APPROVED_SOURCE_BUCKET,value=$BUCKET,type=PLAINTEXT" \
                                     "name=APPROVED_SOURCE_VERSION_ID,value=$vid,type=PLAINTEXT" \
    --query build.id > build-id
fi
build="$(need build-id)"
echo "build $build"

for _ in $(seq 1 80); do
  status="$(build_status "$build")"
  [ "$status" = IN_PROGRESS ] || break
  sleep 30
done
stream="$(awst codebuild batch-get-builds --ids "$build" --query 'builds[0].logs.streamName')"
# CodeBuild echoes each buildspec command, so only exact output lines count as evidence.
aws logs filter-log-events --log-group-name "/aws/codebuild/$PROJECT" --log-stream-names "$stream" \
  --filter-pattern '?BLOCK ?ERROR ?PASS_COMPILED ?imageDigest' --query 'events[].message' --output json \
  | node -e "for(const m of JSON.parse(require('fs').readFileSync(0,'utf8')))process.stdout.write(m.endsWith('\n')?m:m+'\n')" \
  | tr -d '\r' > build-gates.log
grep -E '^(BLOCK:|ERROR|#[0-9]+ ERROR)' build-gates.log || true
[ "$status" = SUCCEEDED ] || stop "build $build ended $status (see state/build-gates.log); re-run 02 to retry"
grep -qx 'PASS_COMPILED_ENTRYPOINT_REACHES_ISOLATED_DB_GATE; FULL_API_STARTUP_UNVERIFIED' build-gates.log || stop "entrypoint DB gate output line missing"

line="$(grep -E "^source=$SOURCE_SHA s3Version=$vid archiveSha256=$ARCHIVE_SHA256 imageDigest=sha256:[0-9a-f]{64}$" build-gates.log | head -1)"
logged="${line##*imageDigest=}"
registry="$(awst ecr describe-images --repository-name "$REPOSITORY" --image-ids "imageTag=$SOURCE_SHA" --query 'imageDetails[0].imageDigest')"
[ -n "$line" ] && [ "$logged" = "$registry" ] || stop "digest mismatch: log '$logged' registry '$registry'"
printf '%s\n' "$registry" > image-digest
echo "BUILT $REGISTRY/$REPOSITORY@$registry (tag $SOURCE_SHA)"
