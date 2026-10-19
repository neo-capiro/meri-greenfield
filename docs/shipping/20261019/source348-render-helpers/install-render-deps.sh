#!/usr/bin/env bash
# Dependency-only helper. Installs the packages the Meri first-chat render needs into ONE checkout of the Meri source, reproducing the layout of
# apps/runtime/Dockerfile (lines 8-24 and 41): eight lockfile installs plus three directory links with the Dockerfile's fixed relative targets.
#
# Why: `npm ci` at the repository root alone cannot run infra/product-preview/first-chat/render-material.mjs. The render imports apps/runtime, which
# needs @aws-sdk/client-ecs (declared only in apps/runtime/package.json) and @capiro/meri-contracts (a link to packages/contracts).
#
# Scope and safety:
#  - Public npm packages only, --ignore-scripts as in the image build. Before installing, the script refuses if any tracked lockfile resolves a package
#    from a host other than registry.npmjs.org, or if the checkout carries a project .npmrc.
#  - Anonymous access is REQUIRED: npm is run with empty user and global configuration files (so no auth token or private registry/scope setting from
#    your own npm configuration can be used) and NPM_TOKEN / NODE_AUTH_TOKEN unset. If your network policy needs an authenticated proxy or registry, the
#    install fails rather than sending a credential.
#  - It writes only inside <checkout>/node_modules and the nested node_modules folders (git-ignored; `git status` stays clean) and never edits a lockfile.
#  - An existing link is accepted only if it resolves to the intended package; otherwise the script stops.
#  - Tested on Windows (Git Bash, Node 24). The POSIX branch uses the Dockerfile's fixed relative targets and is untested here; no macOS/Linux claim.
#
#   bash install-render-deps.sh <checkout path>     (Node 24.x)
set -euo pipefail

is_windows() { case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) return 0 ;; *) return 1 ;; esac; }

# same_dir <a> <b>: both exist and resolve (links followed) to the same directory. Paths are passed to node as data, never interpolated into code.
same_dir() {
  node -e "const fs=require('fs');try{process.exit(fs.realpathSync(process.argv[1])===fs.realpathSync(process.argv[2])?0:1)}catch{process.exit(1)}" "$1" "$2"
}

# link <link path> <fixed relative target, as apps/runtime/Dockerfile writes it> <intended directory>   (all relative to the current directory)
link() {
  local linkpath="$1" reltarget="$2" intended="$3"
  [ -d "$intended" ] || { echo "LINK_TARGET_MISSING $intended" >&2; return 1; }
  if [ -e "$linkpath" ] || [ -L "$linkpath" ]; then
    if same_dir "$linkpath" "$intended"; then echo "exists  $linkpath (resolves to the intended package)"; return 0; fi
    echo "LINK_EXISTS_BUT_WRONG $linkpath" >&2; return 1
  fi
  if is_windows; then
    # A directory junction needs no special privilege. The two paths travel as environment values (data), not inside the PowerShell command text.
    LINK_PATH="$(cygpath -w "$PWD/$linkpath")" LINK_TARGET="$(cygpath -w "$PWD/$intended")" \
      powershell.exe -NoProfile -NonInteractive -Command 'New-Item -ItemType Junction -Path $env:LINK_PATH -Target $env:LINK_TARGET | Out-Null'
  else
    ln -s "$reltarget" "$linkpath"
  fi
  same_dir "$linkpath" "$intended" || { echo "LINK_DID_NOT_RESOLVE $linkpath" >&2; return 1; }
  echo "linked  $linkpath"
}

# The eight lockfiles this helper installs from (the same eight apps/runtime/Dockerfile installs). Other tracked lockfiles (for example the qualification
# fixtures, which reference a vendored in-repo tarball) are not installed by this helper and are not scanned.
INSTALLED_LOCKS=(package-lock.json apps/runtime/package-lock.json apps/worker/conversation/package-lock.json packages/ui-stream/package-lock.json
  packages/window-resolution/package-lock.json apps/control/conversations/package-lock.json apps/artifacts/storage/package-lock.json apps/artifacts/generation/package-lock.json)

# check_lock_hosts <checkout> [lockfile relative path ...]: refuse if an installed lockfile resolves a package from anywhere but registry.npmjs.org,
# if a listed lockfile is missing, or if a project .npmrc exists. Defaults to the eight installed lockfiles.
check_lock_hosts() {
  local root="$1"; shift
  local locks=("$@"); [ "${#locks[@]}" -gt 0 ] || locks=("${INSTALLED_LOCKS[@]}")
  if find "$root" -name .npmrc -not -path '*/node_modules/*' -print -quit | grep -q .; then echo "NPMRC_PRESENT_IN_CHECKOUT" >&2; return 1; fi
  node -e "
const fs=require('fs'),path=require('path');
const root=process.argv[1],files=process.argv.slice(2);
let bad=0,total=0;
for(const rel of files){const f=path.join(root,rel);if(!fs.existsSync(f)){console.error('LOCKFILE_MISSING '+rel);process.exit(1);}
 const l=JSON.parse(fs.readFileSync(f,'utf8'));for(const [k,v] of Object.entries(l.packages||{})){if(typeof v.resolved!=='string'||v.link)continue;total++;
 if(!v.resolved.startsWith('https://registry.npmjs.org/')){bad++;if(bad<=5)console.error('NON_REGISTRY_RESOLVED '+rel+' '+k);}}}
console.log('lockfiles scanned: '+files.length+', registry entries: '+total+', non-registry: '+bad);process.exit(bad?1:0);" "$root" "${locks[@]}"
}

main() {
  local R="${1:?usage: install-render-deps.sh <checkout path>}"
  cd "$R"
  node -e "if(process.versions.node.split('.')[0]!=='24'){console.error('Node 24.x required, found '+process.version);process.exit(1);}"
  check_lock_hosts "$PWD"
  # npm refuses to load one file as both the user and the global configuration ("double-loading config"), so two distinct empty files are used.
  # The two files are globals on purpose: the EXIT trap runs after main has returned, when function-locals no longer exist (under `set -u` that
  # would turn a successful install into exit status 1).
  local native_user native_global
  INSTALL_EMPTY_USER="$(mktemp)"; INSTALL_EMPTY_GLOBAL="$(mktemp)"
  trap 'rm -f -- "${INSTALL_EMPTY_USER:-}" "${INSTALL_EMPTY_GLOBAL:-}"' EXIT
  if is_windows; then native_user="$(cygpath -m "$INSTALL_EMPTY_USER")"; native_global="$(cygpath -m "$INSTALL_EMPTY_GLOBAL")"; else native_user="$INSTALL_EMPTY_USER"; native_global="$INSTALL_EMPTY_GLOBAL"; fi
  export npm_config_userconfig="$native_user" npm_config_globalconfig="$native_global"
  unset NPM_TOKEN NODE_AUTH_TOKEN || true
  echo "== root"; npm ci --ignore-scripts --no-audit --no-fund --loglevel=error
  local p
  for p in apps/runtime apps/worker/conversation packages/ui-stream packages/window-resolution apps/control/conversations; do
    echo "== $p"; npm ci --prefix "$p" --ignore-scripts --no-audit --no-fund --loglevel=error
  done
  for p in apps/artifacts/storage apps/artifacts/generation; do
    echo "== $p (omit dev)"; npm ci --prefix "$p" --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error
  done
  echo "== directory links (fixed targets, as apps/runtime/Dockerfile line 41)"
  mkdir -p node_modules/@capiro node_modules/@anthropic-ai node_modules/@aws-sdk
  link node_modules/@capiro/meri-contracts ../../packages/contracts packages/contracts
  link node_modules/@anthropic-ai/claude-agent-sdk ../../apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk
  link node_modules/@aws-sdk/client-s3 ../../apps/artifacts/storage/node_modules/@aws-sdk/client-s3 apps/artifacts/storage/node_modules/@aws-sdk/client-s3
  echo "== the render must now import"
  node infra/product-preview/first-chat/render-material.mjs --help 2>&1 | grep -q '^Usage' && echo "RENDER_IMPORTS_OK" || { echo "RENDER_IMPORT_FAILED"; return 1; }
  echo "git status entries (expect 0): $(git status --short | wc -l)"
}

# Run only when executed, not when sourced (the focused tests source this file).
if [ "${BASH_SOURCE[0]}" = "$0" ]; then main "$@"; fi
