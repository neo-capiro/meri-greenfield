#!/usr/bin/env bash
# Dependency-only helper. Installs the packages the Meri first-chat render needs into ONE checkout of the Meri source, reproducing the layout of
# apps/runtime/Dockerfile (lines 8-24 and 41): eight lockfile installs plus three directory links.
#
# Why: `npm ci` at the repository root alone cannot run infra/product-preview/first-chat/render-material.mjs. The render imports apps/runtime, which
# needs @aws-sdk/client-ecs (declared only in apps/runtime/package.json) and @capiro/meri-contracts (a link to packages/contracts).
#
# Scope: public npm packages only, --ignore-scripts as in the image build. It reads no credential, no private file and no network resource other
# than the npm registry, and it writes only inside <checkout>/node_modules and the nested node_modules folders (all git-ignored, so `git status`
# stays clean). It never edits a lockfile.
#
#   bash install-render-deps.sh <checkout path>     (Git Bash on Windows, or any POSIX shell on Linux/macOS; Node 24.x)
set -euo pipefail
R="${1:?usage: install-render-deps.sh <checkout path>}"
cd "$R"
node -e "if(process.versions.node.split('.')[0]!=='24'){console.error('Node 24.x required, found '+process.version);process.exit(1);}"
echo "== root"; npm ci --ignore-scripts --no-audit --no-fund --loglevel=error
for p in apps/runtime apps/worker/conversation packages/ui-stream packages/window-resolution apps/control/conversations; do
  echo "== $p"; npm ci --prefix "$p" --ignore-scripts --no-audit --no-fund --loglevel=error
done
for p in apps/artifacts/storage apps/artifacts/generation; do
  echo "== $p (omit dev)"; npm ci --prefix "$p" --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error
done
echo "== directory links"
mkdir -p node_modules/@capiro node_modules/@anthropic-ai node_modules/@aws-sdk
link() {  # link <target relative to the checkout> <link path relative to the checkout>
  [ -e "$2" ] && { echo "exists  $2"; return 0; }
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)  # Windows: a directory junction needs no special privilege (the Dockerfile uses symlinks)
      powershell.exe -NoProfile -NonInteractive -Command "New-Item -ItemType Junction -Path '$(cygpath -w "$PWD/$2")' -Target '$(cygpath -w "$PWD/$1")' | Out-Null" ;;
    *) ln -s "$(realpath --relative-to="$(dirname "$2")" "$1")" "$2" ;;
  esac
  echo "linked  $2"
}
link packages/contracts node_modules/@capiro/meri-contracts
link apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk node_modules/@anthropic-ai/claude-agent-sdk
link apps/artifacts/storage/node_modules/@aws-sdk/client-s3 node_modules/@aws-sdk/client-s3
echo "== the render must now import"
node infra/product-preview/first-chat/render-material.mjs --help 2>&1 | grep -q '^Usage' && echo "RENDER_IMPORTS_OK" || { echo "RENDER_IMPORT_FAILED"; exit 1; }
echo "git status entries (expect 0): $(git status --short | wc -l)"
