#!/usr/bin/env bash
# Clean-checkout procedure: install every package lock exactly, in dependency order, with the image recipe's flags
# (npm ci --ignore-scripts), then run the local baseline suites. No lock, package source or root link is changed;
# run-suites.mjs sets MERI_REVIEW_SOURCE_ROOT to this checkout and scrubs ambient credentials from every suite.
# Usage: clean-checkout.sh --out DIR [--allow-root] [--only name,name]
# Exit: run-suites.mjs exit code (0 all suites passed, 1 a suite failed); 2 usage; 3 setup refused or an install failed.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
[ "${1:-}" = --help ] && { sed -n '2,6p' "${BASH_SOURCE[0]}"; exit 0; }
[ "${1:-}" = --out ] && [ -n "${2:-}" ] || { echo "usage: clean-checkout.sh --out DIR [run-suites options]" >&2; exit 2; }
# contracts before ui-stream (file:../contracts), the root before the packages that resolve its tools, then the
# image recipe's order (apps/runtime/Dockerfile), then the qualification packages.
LOCKS=(packages/contracts . apps/runtime apps/worker/conversation packages/ui-stream packages/window-resolution
 apps/control/conversations apps/artifacts/storage apps/control/qualification-temporal
 apps/control/qualification-sdk-fixture/service apps/control/qualification-sdk-fixture/state apps/proxy/qualification
 apps/worker/qualification)
# Every package lock is installed; test evidence locks have no package.json and are not packages.
found="$(cd "$REPO" && find . \( -name node_modules -o -name evidence -o -name .git \) -prune -o -name package-lock.json -printf '%h\n' | sed 's|^\./||;s|^\.$|.|' | sort)"
[ "$found" = "$(printf '%s\n' "${LOCKS[@]}" | sort)" ] || { echo "refusing: package locks differ from the procedure list" >&2; exit 3; }
# npm ci deletes node_modules; never follow a link into another checkout's install.
for dir in "${LOCKS[@]}"; do [ ! -L "$REPO/$dir/node_modules" ] || { echo "refusing: $dir/node_modules is a symlink" >&2; exit 3; }; done
for dir in "${LOCKS[@]}"; do
 echo "[clean-checkout] npm ci $dir" >&2
 (cd "$REPO/$dir" && npm ci --ignore-scripts --no-audit --no-fund) >&2 || { echo "install failed: $dir" >&2; exit 3; }
done
exec node "$REPO/scripts/qualification/local-baseline/run-suites.mjs" --repo "$REPO" "$@"
