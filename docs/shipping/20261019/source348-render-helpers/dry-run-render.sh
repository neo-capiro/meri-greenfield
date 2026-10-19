#!/usr/bin/env bash
# OFFLINE DRY RUN of the Meri first-chat render with THROWAWAY private inputs. TESTED-PATH EVIDENCE ONLY: it shows that the public packet, the pinned
# images, the measured runtime values and the dependency layout render end to end. It does NOT establish real-input readiness (real certificates, pins,
# bearer, membership, database logins), live readiness or private-material qualification.
#
# What it uses: the public candidates of the fixed packet directory below (read-only; a COPY gets the throwaway PKI's pins), a throwaway PKI from the
# repository's own pki.py, fake database logins, a fake bearer-shaped file and fake ids, all generated in one temporary directory that is validated
# before it is removed. What it never touches: any real private directory, any credential, any AWS or Core call. Network: none (run
# install-render-deps.sh first).
#
#   bash dry-run-render.sh <checkout> <node digest, 64 hex> <proxy digest, 64 hex>
# The expected source commits are read from the public deployment candidate (images.nodeRuntimeSourceCommit / images.proxySourceCommit) and must be
# full 40-hex SHAs. The packet directory is fixed on purpose (no argument): only the public packet is ever used.
# Requirements: Node 24.x, Python 3 with the `cryptography` package (what pki.py already needs), dependencies installed in the checkout.
set -uo pipefail

PACKET="docs/shipping/20261019/source348-public-render"

refuse() { echo "DRY_RUN_REFUSED $*" >&2; exit 2; }

# same_dir <a> <b>: both exist and resolve to the same directory (paths are data for node, never code).
same_dir() { node -e "const fs=require('fs');try{process.exit(fs.realpathSync(process.argv[1])===fs.realpathSync(process.argv[2])?0:1)}catch{process.exit(1)}" "$1" "$2"; }

# safe_remove_tmp <dir> <temp root>: removes <dir> only if it is a real directory (not a link) named dryrun.* whose parent is exactly the resolved
# temporary root; reports a failed removal instead of hiding it. Returns non-zero when anything is refused or left behind.
safe_remove_tmp() {
  local d="${1:-}" root="${2:-}"
  [ -n "$d" ] && [ -n "$root" ] || { echo "CLEANUP_REFUSED empty path" >&2; return 1; }
  [ -d "$d" ] && [ ! -L "$d" ] || { echo "CLEANUP_REFUSED not a real directory" >&2; return 1; }
  local canon; canon="$(cd "$d" && pwd -P)" || { echo "CLEANUP_REFUSED unresolvable path" >&2; return 1; }
  [ "$canon" != "$root" ] && [ "$(dirname "$canon")" = "$root" ] || { echo "CLEANUP_REFUSED not a direct child of the temporary root" >&2; return 1; }
  case "$(basename "$canon")" in dryrun.*) ;; *) echo "CLEANUP_REFUSED unexpected directory name" >&2; return 1 ;; esac
  rm -rf -- "$canon" || true
  if [ -e "$canon" ]; then echo "CLEANUP_FAILED throwaway material remains in $canon" >&2; return 1; fi
  echo "throwaway material deleted"
}

main() {
  [ "$#" -eq 3 ] || refuse "usage: dry-run-render.sh <checkout> <node digest 64 hex> <proxy digest 64 hex>"
  local NODE_DIGEST="$2" PROXY_DIGEST="$3"
  [[ "$NODE_DIGEST" =~ ^[a-f0-9]{64}$ ]] && [[ "$PROXY_DIGEST" =~ ^[a-f0-9]{64}$ ]] || refuse "digests must be 64 lowercase hex characters"
  local R; R="$(cd "$1" 2>/dev/null && pwd -P)" || refuse "checkout not found"
  local top; top="$(git -C "$R" rev-parse --show-toplevel 2>/dev/null)" || refuse "not a git checkout"
  same_dir "$top" "$R" || refuse "give the checkout root, not a subdirectory"
  local F="$R/infra/product-preview/first-chat" PUB="$R/$PACKET"
  [ -f "$F/render-material.mjs" ] && [ -f "$F/stage3-deploy.mjs" ] && [ -f "$F/pki.py" ] || refuse "not a Meri source checkout"
  [ -f "$PUB/deployment-inputs.candidate.json" ] && [ -f "$PUB/runtime-values.candidate.json" ] || refuse "public packet files not found at $PACKET"
  local HERE; HERE="$(cd "$(dirname "$0")" && pwd -P)"
  local PY="" c   # the first Python that can import `cryptography` (pki.py needs it); a bare python3 on PATH may lack it
  for c in python python3; do if command -v "$c" >/dev/null 2>&1 && "$c" -I -c 'import cryptography' >/dev/null 2>&1; then PY="$c"; break; fi; done
  [ -n "$PY" ] || refuse "no Python 3 with the cryptography package found (pki.py needs it)"
  local NODE_SRC PROXY_SRC
  NODE_SRC="$(node -e "console.log(require(process.argv[1]).images.nodeRuntimeSourceCommit)" "$PUB/deployment-inputs.candidate.json")"
  PROXY_SRC="$(node -e "console.log(require(process.argv[1]).images.proxySourceCommit)" "$PUB/deployment-inputs.candidate.json")"
  [[ "$NODE_SRC" =~ ^[a-f0-9]{40}$ ]] && [[ "$PROXY_SRC" =~ ^[a-f0-9]{40}$ ]] || refuse "the candidate does not carry full 40-hex source commits"

  local TM
  DRY_ROOT="$(cd "${TMPDIR:-/tmp}" && pwd -P)" || refuse "no temporary directory"
  DRY_T="$(mktemp -d "$DRY_ROOT/dryrun.XXXXXXXX")" || refuse "cannot create a temporary directory"
  DRY_T="$(cd "$DRY_T" && pwd -P)"
  trap 'safe_remove_tmp "$DRY_T" "$DRY_ROOT" || exit 1' EXIT   # the guard re-validates the resolved path before any recursive removal
  if command -v cygpath >/dev/null 2>&1; then TM="$(cygpath -m "$DRY_T")"; else TM="$DRY_T"; fi

  echo "== 1. throwaway PKI (30 days), fake database logins, fake bearer-shaped file"
  "$PY" -I "$F/pki.py" "$TM/pki" --days 30 | cut -c1-120
  node -e "const c=require('crypto'),fs=require('fs');const r=n=>c.randomBytes(n).toString('hex');
fs.writeFileSync(process.argv[1]+'/pki/db-logins.json',JSON.stringify({control:r(16),modelOwner:r(16),issuer:r(16)}));
fs.writeFileSync(process.argv[1]+'/identity',c.randomBytes(48).toString('base64url'));" "$TM"
  echo "== 2. COPY of the public deployment candidate with the throwaway pins (the public file is not modified)"
  node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const p=JSON.parse(fs.readFileSync(process.argv[2]+'/pki/pins.json','utf8')).certificates;
for(const k of Object.keys(d.pinsDer)){if(!p[k])throw Error('throwaway pins lack '+k);d.pinsDer[k]=p[k].der;d.pinsPem[k]=p[k].pem;}
fs.writeFileSync(process.argv[2]+'/deployment-inputs.dryrun.json',JSON.stringify(d,null,1));console.log('pins swapped:',Object.keys(d.pinsDer).length);" "$PUB/deployment-inputs.candidate.json" "$TM"
  echo "== 3. fake core values and fake task-definition revisions -> stage3.json (the repository's own stage3-deploy.mjs)"
  node -e "const fs=require('fs');
fs.writeFileSync(process.argv[1]+'/core.json',JSON.stringify({coreOrigin:'https://first-chat-preview.app-dev.capiro.ai',frontendOrigin:'https://portfolio-preview.app.capiro.ai',tenantId:'dryrun-tenant',actorId:'dryrun-actor',clientId:'11111111-1111-4111-8111-111111111111',identityCredentialPath:process.argv[1]+'/identity'}));
const fam=['meri-product-preview-control','meri-product-preview-temporal-worker','meri-product-preview-temporal-issuer','meri-product-preview-owner','meri-product-preview-proxy','meri-product-preview-runner'];
const arn=(f,n)=>'arn:aws:ecs:us-east-1:967807252336:task-definition/'+f+':'+n;
fs.writeFileSync(process.argv[1]+'/latest.tsv',fam.flatMap(f=>[f+'\t'+arn(f,30),f+'\t'+arn(f,29)]).join('\n')+'\n');" "$TM"
  node "$F/stage3-deploy.mjs" stage3-input --deployment-inputs "$TM/deployment-inputs.dryrun.json" --foundation-outputs "$F/foundation-outputs.json" --latest "$TM/latest.tsv" --out "$TM/stage3.json" 2>&1 | cut -c1-120
  echo "== 4. render (the repository's own validators run here)"
  ( cd "$R" && node infra/product-preview/first-chat/render-material.mjs --deployment-inputs "$TM/deployment-inputs.dryrun.json" --private "$TM/pki" --core "$TM/core.json" --runtime "$PUB/runtime-values.candidate.json" --stage3 "$TM/stage3.json" --out "$TM/rendered" ) 2>&1 | cut -c1-120 | head -5
  local rc=${PIPESTATUS[0]}; echo "render exit: $rc"
  echo "== 5. digest, source and summary cross-check against the expected images"
  node "$HERE/verify-rendered.mjs" "$TM/rendered" "$NODE_DIGEST" "$PROXY_DIGEST" "$NODE_SRC" "$PROXY_SRC"; local vrc=$?
  if [ "$rc" = 0 ] && [ "$vrc" = 0 ]; then echo "DRY_RUN_OK (throwaway inputs only: tested-path evidence, not real-input or live readiness)"; else echo "DRY_RUN_FAILED"; return 1; fi
}

# Run only when executed, not when sourced (the focused tests source this file).
if [ "${BASH_SOURCE[0]}" = "$0" ]; then main "$@"; fi
