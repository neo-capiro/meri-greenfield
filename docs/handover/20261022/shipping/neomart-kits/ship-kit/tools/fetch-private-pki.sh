#!/usr/bin/env bash
# Fetch the Meri preview private PKI from Secrets Manager into <parent>/meri-preview-private-pki (owner-only).
# Used by release steps 11-private-core and 12-private-render (point MERI_PKI_DIR at the result).
# Prints only the archive hash, file count and paths; never file contents.
# Usage: fetch-private-pki.sh <parent-dir>        then, after the release: rm -rf <parent-dir>/meri-preview-private-pki
set -euo pipefail
parent="${1:?usage: fetch-private-pki.sh <parent-dir>}"
secret=meri/preview/private-pki
profile="${AWS_PROFILE:-capiro-dev}"
dest="$parent/meri-preview-private-pki"
[ -e "$dest" ] && { echo "REFUSED: $dest exists (remove it first)" >&2; exit 2; }
umask 077
mkdir -p "$parent"
tmp="$(mktemp -d "$parent/.pki-fetch.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
aws --profile "$profile" secretsmanager get-secret-value --secret-id "$secret" --query SecretBinary --output text \
  | tr -d '\r\n' | base64 -d > "$tmp/pki.tgz"
want="$(aws --profile "$profile" secretsmanager describe-secret --secret-id "$secret" --query "Tags[?Key=='ContentSha256'].Value | [0]" --output text)"
got="$(sha256sum "$tmp/pki.tgz" | cut -d' ' -f1)"
[ "$got" = "$want" ] || { echo "REFUSED: archive sha256 $got does not match the secret's ContentSha256 tag $want" >&2; exit 3; }
tar -xzf "$tmp/pki.tgz" -C "$parent"
chmod -R go-rwx "$dest"
echo "OK sha256=$got files=$(find "$dest" -type f | wc -l) dir=$dest"
echo "NEXT export MERI_PKI_DIR=$dest   (remove the directory when the release is done)"
