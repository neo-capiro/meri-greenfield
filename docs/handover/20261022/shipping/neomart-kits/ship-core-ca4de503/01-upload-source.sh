#!/usr/bin/env bash
# MUTATION (S3 put-object). Uploads the exact LF archive of $SOURCE_SHA to the versioned source bucket
# and records its VersionId in state/source-version-id. Safe to re-run: once recorded, it only re-checks
# that S3 version and reuses it (the archive is content-pinned by ARCHIVE_SHA256 in the buildspec).
set -euo pipefail
source "$(dirname "$0")/kit.env"
cd "$KIT_DIR"

echo "$ARCHIVE_SHA256  $ARCHIVE_NAME" | sha256sum -c - >/dev/null || stop "archive sha256 mismatch"
local_size="$(stat -c %s "$ARCHIVE_NAME")"

if [ -s "$STATE/source-version-id" ]; then
  vid="$(need source-version-id)"
  size="$(awst s3api head-object --bucket "$BUCKET" --key "$KEY" --version-id "$vid" --query ContentLength)" || stop "recorded S3 version $vid not readable"
  [ "$size" = "$local_size" ] || stop "recorded S3 version $vid has size $size, local $local_size"
  echo "REUSE s3://$BUCKET/$KEY versionId=$vid size=$size"
  exit 0
fi

n="$(awst s3api list-object-versions --bucket "$BUCKET" --prefix "$KEY" --query 'length(Versions[] || `[]`)')"
[ "$n" = 0 ] || stop "s3://$BUCKET/$KEY already has $n version(s) but none is recorded in state/; inspect before uploading again"
vid="$(awst s3api put-object --bucket "$BUCKET" --key "$KEY" --body "$ARCHIVE_NAME" --query VersionId)"
[ -n "$vid" ] && [ "$vid" != None ] || stop "no VersionId returned"
size="$(awst s3api head-object --bucket "$BUCKET" --key "$KEY" --version-id "$vid" --query ContentLength)"
[ "$size" = "$local_size" ] || stop "uploaded size $size differs from local $local_size"
printf '%s\n' "$vid" > "$STATE/source-version-id"
echo "UPLOADED s3://$BUCKET/$KEY versionId=$vid size=$size"
