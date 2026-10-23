#!/usr/bin/env bash
# OPTIONAL MUTATION (ecr start-image-scan; BASIC allows one manual scan per image per 24 h).
# Re-scans the serving image 46acfc07 against today's CVE feed. Its base layers are the ones the new build
# reuses, so this previews base-image/feed drift before spending a build. If it now shows HIGH/CRITICAL,
# the serving image carries the same exposure: STOP and take the base-image decision first (PR100's lane).
set -euo pipefail
source "$(dirname "$0")/kit.env"

aws ecr start-image-scan --repository-name "$REPOSITORY" --image-id "imageDigest=$ROLLBACK_DIGEST" --query 'imageScanStatus.status' --output text | tr -d '\r'
aws ecr wait image-scan-complete --repository-name "$REPOSITORY" --image-id "imageDigest=$ROLLBACK_DIGEST"
aws ecr describe-image-scan-findings --repository-name "$REPOSITORY" --image-id "imageDigest=$ROLLBACK_DIGEST" \
  --query '{completedAt:imageScanFindings.imageScanCompletedAt,counts:imageScanFindings.findingSeverityCounts,high:imageScanFindings.findings[?severity==`HIGH` || severity==`CRITICAL`].[severity,name]}' --output json
