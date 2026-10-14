#!/usr/bin/env bash
# Root-level resolution links that mirror the runtime image recipe (apps/runtime/Dockerfile) plus
# the two test-only links the existing PostgreSQL/JSZip test files resolve from the repository root.
# node_modules/ is ignored by Git; no lock or package source is changed.
# Usage: link-dependencies.sh [--repo DIR]   Exit: 0 ok; 2 usage; 3 a non-link already occupies a target.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
while [ $# -gt 0 ]; do case "$1" in --repo) REPO="$2"; shift 2;; *) echo "unknown argument: $1" >&2; exit 2;; esac; done
link(){ # target relative-source role
 local target="$REPO/node_modules/$1" source="$2" role="$3"
 mkdir -p "$(dirname "$target")"
 if [ -e "$target" ] && [ ! -L "$target" ]; then echo "refusing: $target exists and is not a symlink" >&2; exit 3; fi
 [ -e "$(dirname "$target")/$source" ] || { echo "missing link source for $1: $(dirname "$target")/$source (install the owning package lock first)" >&2; exit 3; }
 ln -sfn "$source" "$target"; echo "$role $1 -> $source"
}
# Image-equivalent links (same targets as the Dockerfile).
link @capiro/meri-contracts ../../packages/contracts image
link @anthropic-ai/claude-agent-sdk ../../apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk image
link @aws-sdk/client-s3 ../../apps/artifacts/storage/node_modules/@aws-sdk/client-s3 image
# Test-only resolution links (not part of the image): pg for apps/control/conversations/test/*-pg.test.mjs,
# jszip for apps/artifacts/test independent checks.
link pg ../apps/runtime/node_modules/pg test-only
link jszip ../apps/worker/qualification/node_modules/jszip test-only
