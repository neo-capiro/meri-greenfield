#!/usr/bin/env bash
# Installs the dependencies the render needs into ONE checkout of the Meri source, exactly as apps/runtime/Dockerfile does (lines 8-24 and 41):
# eight lockfile installs plus the three directory links. Root `npm ci` alone is NOT enough: the render imports apps/runtime, which needs
# @aws-sdk/client-ecs (declared only in apps/runtime/package.json) and @capiro/meri-contracts (a link to packages/contracts).
# Public npm packages only; --ignore-scripts as in the image build; no credentials; node_modules is git-ignored so `git status` stays clean.
#   bash install-render-deps.sh <checkout path>        (Git Bash on Windows; Node >=24 <25)
set -euo pipefail
R="${1:?usage: install-render-deps.sh <checkout path>}"
cd "$R"
node -e "const v=process.versions.node.split('.')[0]; if(Number(v)!==24){console.error('Node 24.x required, found '+process.version);process.exit(1);}"
echo "== root"; npm ci --ignore-scripts --no-audit --no-fund --loglevel=error
for p in apps/runtime apps/worker/conversation packages/ui-stream packages/window-resolution apps/control/conversations; do
  echo "== $p"; npm ci --prefix "$p" --ignore-scripts --no-audit --no-fund --loglevel=error
done
for p in apps/artifacts/storage apps/artifacts/generation; do
  echo "== $p (omit dev)"; npm ci --prefix "$p" --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error
done
echo "== directory links (Windows junctions in place of the Dockerfile's symlinks)"
mkdir -p node_modules/@capiro node_modules/@anthropic-ai node_modules/@aws-sdk
link() {
  local src dst
  src="$(cygpath -w "$R/$1")"; dst="$(cygpath -w "$R/$2")"
  [ -e "$R/$2" ] && { echo "exists  $2"; return 0; }
  powershell.exe -NoProfile -NonInteractive -Command "New-Item -ItemType Junction -Path '$dst' -Target '$src' | Out-Null" && echo "linked  $2"
}
link packages/contracts node_modules/@capiro/meri-contracts
link apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk node_modules/@anthropic-ai/claude-agent-sdk
link apps/artifacts/storage/node_modules/@aws-sdk/client-s3 node_modules/@aws-sdk/client-s3
echo "== the render must now import"
node infra/product-preview/first-chat/render-material.mjs --help 2>&1 | grep -q "^Usage" && echo "RENDER_IMPORTS_OK" || { echo "RENDER_IMPORT_FAILED"; exit 1; }
echo "git status entries (expect 0): $(git status --short | wc -l)"
