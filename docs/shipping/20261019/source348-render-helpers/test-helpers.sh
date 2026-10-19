#!/usr/bin/env bash
# Focused tests for the three helpers (verify-rendered.mjs, dry-run-render.sh guards, install-render-deps.sh link/lockfile guards).
# Fake data only, in temporary directories; no network, no AWS, no private input. It does not run the product suites or a render.
#   bash test-helpers.sh        -> prints PASS/FAIL per case and a final TESTS_OK / TESTS_FAILED; exit 0 only when every case passed.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd -P)"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS  $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL  $1"; }
expect() { local want="$1" name="$2"; shift 2; "$@" >/dev/null 2>&1; local rc=$?; if [ "$rc" = "$want" ]; then ok "$name"; else bad "$name (exit $rc, wanted $want)"; fi; }
ROOT="$(mktemp -d)"; trap 'rm -rf -- "$ROOT"' EXIT
if command -v cygpath >/dev/null 2>&1; then RM="$(cygpath -m "$ROOT")"; else RM="$ROOT"; fi

echo "== verify-rendered.mjs"
A=$(printf 'a%.0s' $(seq 1 64)); B=$(printf 'b%.0s' $(seq 1 64)); SA=$(printf '1%.0s' $(seq 1 40)); SB=$(printf '2%.0s' $(seq 1 40))
mk() {  # mk <dir>: a consistent fake render output
  local d="$1" r
  for r in control temporal-worker temporal-issuer model-owner model-proxy; do
    mkdir -p "$d/$r"
    if [ "$r" = model-proxy ]; then dg="$B"; sc="$SB"; else dg="$A"; sc="$SA"; fi
    echo "{\"role\":\"$r\",\"imageDigest\":\"sha256:$dg\",\"sourceCommit\":\"$sc\",\"materialContractSha256\":\"$(printf 'c%.0s' $(seq 1 64))\",\"sha256ByPath\":{\"/run/meri/$r.json\":\"$(printf 'd%.0s' $(seq 1 64))\"}}" > "$d/$r/expected.json"
  done
  node -e "const fs=require('fs');const roles={};for(const r of ['control','temporal-worker','temporal-issuer','model-owner','model-proxy']){const e=JSON.parse(fs.readFileSync(process.argv[1]+'/'+r+'/expected.json','utf8'));roles[r]={materialContractSha256:e.materialContractSha256,sha256ByPath:e.sha256ByPath,imageDigest:e.imageDigest,configPath:'/run/meri/'+r+'.json',configSha256:'d'.repeat(64)};}
fs.writeFileSync(process.argv[1]+'/summary.json',JSON.stringify({schemaVersion:1,roles,validity:{notAfter:'2026-10-26T00:00:00.000Z',earliestCertificateNotAfter:'2026-11-16T00:00:00.000Z',validityDays:7}}));" "$d"
}
V="node $HERE/verify-rendered.mjs"
mk "$RM/r1";                                                     expect 0 "consistent render passes" $V "$RM/r1" "$A" "$B" "$SA" "$SB"
expect 2 "short source SHA is a usage error"                     $V "$RM/r1" "$A" "$B" "${SA:0:12}" "$SB"
expect 2 "missing source arguments is a usage error"             $V "$RM/r1" "$A" "$B"
expect 1 "wrong node source commit fails"                        $V "$RM/r1" "$A" "$B" "$SB" "$SB"
expect 1 "wrong proxy digest fails"                              $V "$RM/r1" "$A" "$A" "$SA" "$SB"
mk "$RM/r2"; rm -f "$RM/r2/summary.json";                        expect 1 "absent summary.json fails"          $V "$RM/r2" "$A" "$B" "$SA" "$SB"
mk "$RM/r3"; echo '{not json' > "$RM/r3/summary.json";           expect 1 "unreadable summary.json fails"      $V "$RM/r3" "$A" "$B" "$SA" "$SB"
mk "$RM/r4"; node -e "const fs=require('fs');const p=process.argv[1]+'/summary.json';const s=JSON.parse(fs.readFileSync(p));delete s.roles['model-owner'];fs.writeFileSync(p,JSON.stringify(s));" "$RM/r4"
expect 1 "role missing from summary fails"                       $V "$RM/r4" "$A" "$B" "$SA" "$SB"
mk "$RM/r5"; node -e "const fs=require('fs');const p=process.argv[1]+'/summary.json';const s=JSON.parse(fs.readFileSync(p));s.roles.control.materialContractSha256='e'.repeat(64);fs.writeFileSync(p,JSON.stringify(s));" "$RM/r5"
expect 1 "summary/expected materialContractSha256 mismatch fails" $V "$RM/r5" "$A" "$B" "$SA" "$SB"
mk "$RM/r6"; node -e "const fs=require('fs');const p=process.argv[1]+'/summary.json';const s=JSON.parse(fs.readFileSync(p));s.roles['temporal-worker'].sha256ByPath['/run/meri/temporal-worker.json']='e'.repeat(64);fs.writeFileSync(p,JSON.stringify(s));" "$RM/r6"
expect 1 "summary/expected sha256ByPath mismatch fails"          $V "$RM/r6" "$A" "$B" "$SA" "$SB"
mk "$RM/r7"; node -e "const fs=require('fs');const p=process.argv[1]+'/summary.json';const s=JSON.parse(fs.readFileSync(p));s.roles['model-proxy'].configSha256='e'.repeat(64);fs.writeFileSync(p,JSON.stringify(s));" "$RM/r7"
expect 1 "config pin mismatch fails"                             $V "$RM/r7" "$A" "$B" "$SA" "$SB"

echo "== dry-run-render.sh guards"
D="$HERE/dry-run-render.sh"
expect 2 "wrong argument count is refused"                       bash "$D" "$RM"
expect 2 "non-hex digest is refused"                             bash "$D" "$RM" "zz" "$B"
expect 2 "nonexistent checkout is refused"                       bash "$D" "$RM/nope" "$A" "$B"
mkdir -p "$ROOT/notmeri"; expect 2 "directory that is not a git checkout is refused" bash "$D" "$RM/notmeri" "$A" "$B"
git init -q "$ROOT/emptyrepo" 2>/dev/null;                       expect 2 "git checkout without the Meri render files is refused" bash "$D" "$RM/emptyrepo" "$A" "$B"
echo "-- safe_remove_tmp (sourced)"
cat > "$ROOT/guard-test.sh" <<'EOS'
set -uo pipefail
source "$1"
f=0
t() { if [ "$2" = "0" ]; then echo "PASS  $1"; else echo "FAIL  $1"; f=1; fi; }
root="$(mktemp -d)"; root="$(cd "$root" && pwd -P)"
mkdir "$root/dryrun.ok"; echo x > "$root/dryrun.ok/f"
safe_remove_tmp "$root/dryrun.ok" "$root" >/dev/null 2>&1 && [ ! -e "$root/dryrun.ok" ]; t "removes a validated dryrun.* child" $?
mkdir "$root/other.x"; safe_remove_tmp "$root/other.x" "$root" >/dev/null 2>&1; r=$?; [ $r -ne 0 ] && [ -d "$root/other.x" ]; t "refuses a directory without the dryrun. prefix" $?
safe_remove_tmp "$root" "$root" >/dev/null 2>&1; r=$?; [ $r -ne 0 ] && [ -d "$root" ]; t "refuses the temporary root itself" $?
safe_remove_tmp "" "$root" >/dev/null 2>&1; r=$?; [ $r -ne 0 ]; t "refuses an empty path" $?
safe_remove_tmp "$root/dryrun.missing" "$root" >/dev/null 2>&1; r=$?; [ $r -ne 0 ]; t "refuses a nonexistent path" $?
mkdir -p "$root/sub/dryrun.deep"; safe_remove_tmp "$root/sub/dryrun.deep" "$root" >/dev/null 2>&1; r=$?; [ $r -ne 0 ] && [ -d "$root/sub/dryrun.deep" ]; t "refuses a grandchild of the temporary root" $?
mkdir "$root/dryrun.stuck"; rm() { return 1; }; out="$(safe_remove_tmp "$root/dryrun.stuck" "$root" 2>&1)"; rc=$?; unset -f rm
{ [ $rc -ne 0 ] && echo "$out" | grep -q CLEANUP_FAILED; }; t "reports a failed removal (CLEANUP_FAILED) and returns non-zero" $?
command rm -rf -- "$root"
echo "$f" > "$2"
EOS
bash "$ROOT/guard-test.sh" "$D" "$ROOT/guard-fail" 2>&1 | cut -c1-160
[ "$(cat "$ROOT/guard-fail" 2>/dev/null || echo 9)" = 0 ] && ok "safe_remove_tmp guard verdict (7 cases)" || bad "safe_remove_tmp guard verdict (7 cases)"

echo "== install-render-deps.sh guards (sourced)"
I="$HERE/install-render-deps.sh"
cat > "$ROOT/links-test.sh" <<'EOS'
set -uo pipefail
source "$1"
set +e
cd "$2"
f=0
mkdir -p "pk g/real" "pk g/other" "nm"   # a directory name with a space, plus one with a quote below: paths must be data, not code
mkdir -p "q'uote/real"
link "nm/good" "../pk g/real" "pk g/real" >/dev/null 2>&1 || { echo "FAIL  creates a link to a path containing a space"; f=1; }
same_dir "nm/good" "pk g/real" && echo "PASS  link resolves to the intended package (space in path)" || { echo "FAIL  link resolves (space in path)"; f=1; }
link "nm/good" "../pk g/real" "pk g/real" 2>&1 | grep -q "exists" && echo "PASS  an existing correct link is accepted" || { echo "FAIL  an existing correct link is accepted"; f=1; }
link "nm/good" "../pk g/other" "pk g/other" >/dev/null 2>&1; [ $? -ne 0 ] && echo "PASS  an existing link to the WRONG package is refused" || { echo "FAIL  wrong existing link refused"; f=1; }
link "nm/quoted" "../q'uote/real" "q'uote/real" >/dev/null 2>&1 && same_dir "nm/quoted" "q'uote/real" && echo "PASS  a path containing a single quote is treated as data" || { echo "FAIL  single-quote path"; f=1; }
link "nm/missing" "../nowhere" "nowhere" >/dev/null 2>&1; [ $? -ne 0 ] && echo "PASS  a missing target directory is refused" || { echo "FAIL  missing target refused"; f=1; }
mkdir -p "plain"; echo x > "plain/file"; link "plain/file" "../x" "pk g/real" >/dev/null 2>&1; [ $? -ne 0 ] && echo "PASS  an existing non-link path is refused" || { echo "FAIL  non-link refused"; f=1; }
echo "$f" > "$3"
EOS
bash "$ROOT/links-test.sh" "$I" "$ROOT" "$ROOT/links-fail" 2>&1 | cut -c1-160
[ "$(cat "$ROOT/links-fail" 2>/dev/null || echo 9)" = 0 ] && ok "link guards verdict (7 cases)" || bad "link guards verdict (7 cases)"
echo "-- lockfile host / .npmrc guard"
mkdir -p "$ROOT/lk/a"
echo '{"packages":{"node_modules/x":{"resolved":"https://registry.npmjs.org/x/-/x-1.0.0.tgz"},"node_modules/l":{"resolved":"../l","link":true}}}' > "$ROOT/lk/a/package-lock.json"
( source "$I"; check_lock_hosts "$ROOT/lk" a/package-lock.json >/dev/null 2>&1 ) && ok "registry-only lockfiles are accepted (link entries ignored)" || bad "registry-only lockfiles are accepted"
echo '{"packages":{"node_modules/y":{"resolved":"https://example.invalid/y.tgz"}}}' > "$ROOT/lk/a/package-lock.json"
( source "$I"; check_lock_hosts "$ROOT/lk" a/package-lock.json >/dev/null 2>&1 ); [ $? -ne 0 ] && ok "a non-registry resolved URL is refused" || bad "a non-registry resolved URL is refused"
echo '{"packages":{}}' > "$ROOT/lk/a/package-lock.json"; echo "registry=https://private.invalid/" > "$ROOT/lk/.npmrc"
( source "$I"; check_lock_hosts "$ROOT/lk" a/package-lock.json >/dev/null 2>&1 ); [ $? -ne 0 ] && ok "a project .npmrc is refused" || bad "a project .npmrc is refused"
echo '{"packages":{"node_modules/z":{"resolved":"file:vendor/z.tgz"}}}' > "$ROOT/lk/a/package-lock.json"; mkdir -p "$ROOT/lk/b"; echo '{"packages":{"node_modules/x":{"resolved":"https://registry.npmjs.org/x/-/x-1.0.0.tgz"}}}' > "$ROOT/lk/b/package-lock.json"; rm -f "$ROOT/lk/.npmrc"
( source "$I"; check_lock_hosts "$ROOT/lk" b/package-lock.json >/dev/null 2>&1 ) && ok "a lockfile that is not in the scanned list (vendored file: entry) is not scanned" || bad "unlisted lockfile wrongly scanned"
( source "$I"; check_lock_hosts "$ROOT/lk" a/package-lock.json >/dev/null 2>&1 ); [ $? -ne 0 ] && ok "a vendored file: entry in a scanned lockfile is refused" || bad "vendored file: entry in a scanned lockfile refused"
( source "$I"; check_lock_hosts "$ROOT/lk" b/package-lock.json c/package-lock.json >/dev/null 2>&1 ); [ $? -ne 0 ] && ok "a missing listed lockfile is refused" || bad "missing listed lockfile refused"
( source "$I"; [ "${#INSTALLED_LOCKS[@]}" = 8 ] && ok "exactly eight installed lockfiles are scanned by default" || exit 1 ) || bad "exactly eight installed lockfiles are scanned by default"
echo "-- anonymous npm configuration (two distinct empty files; npm rejects one file loaded as both user and global config)"
EU="$ROOT/empty-user.npmrc"; EG="$ROOT/empty-global.npmrc"; : > "$EU"; : > "$EG"
if command -v cygpath >/dev/null 2>&1; then EUN="$(cygpath -m "$EU")"; EGN="$(cygpath -m "$EG")"; else EUN="$EU"; EGN="$EG"; fi
got="$(npm_config_userconfig="$EUN" npm_config_globalconfig="$EGN" npm config get userconfig 2>/dev/null)"
case "$got" in *empty-user.npmrc) ok "npm accepts two distinct empty config files" ;; *) bad "npm accepts two distinct empty config files (got: $got)" ;; esac
npm_config_userconfig="$EUN" npm_config_globalconfig="$EUN" npm config get userconfig >/dev/null 2>&1; [ $? -ne 0 ] && ok "the single-file variant is what npm rejects (why two files are used)" || bad "single-file variant unexpectedly accepted"
echo "-- the install entry point sets the override with two distinct files"
grep -q 'INSTALL_EMPTY_USER="$(mktemp)"; INSTALL_EMPTY_GLOBAL="$(mktemp)"' "$I" && grep -q 'npm_config_userconfig="$native_user" npm_config_globalconfig="$native_global"' "$I" && ok "install-render-deps.sh uses distinct user/global empty files" || bad "install-render-deps.sh uses distinct user/global empty files"
echo "-- install-render-deps.sh entry point against a stub checkout and a stub npm (exit status, links, idempotence)"
if [ "$(node -p "process.versions.node.split('.')[0]")" != "24" ]; then
  echo "SKIP  the entry-point test needs Node 24.x (the script itself refuses other majors)"
else
  FC="$ROOT/fakecheckout"; mkdir -p "$FC"; ( cd "$FC" && git init -q )
  for l in package-lock.json apps/runtime/package-lock.json apps/worker/conversation/package-lock.json packages/ui-stream/package-lock.json packages/window-resolution/package-lock.json apps/control/conversations/package-lock.json apps/artifacts/storage/package-lock.json apps/artifacts/generation/package-lock.json; do
    mkdir -p "$FC/$(dirname "$l")"; echo '{"packages":{}}' > "$FC/$l"
  done
  mkdir -p "$FC/infra/product-preview/first-chat" "$FC/packages/contracts" "$FC/apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk" "$FC/apps/artifacts/storage/node_modules/@aws-sdk/client-s3"
  echo "console.log('Usage: stub render');" > "$FC/infra/product-preview/first-chat/render-material.mjs"
  mkdir -p "$ROOT/stubbin"; printf '#!/usr/bin/env bash
exit 0
' > "$ROOT/stubbin/npm"; chmod +x "$ROOT/stubbin/npm"
  PATH="$ROOT/stubbin:$PATH" bash "$I" "$FC" > "$ROOT/stub-install.log" 2>&1; rc=$?
  [ "$rc" = 0 ] && ok "a successful install exits 0 (the EXIT trap must not turn success into failure)" || { bad "a successful install exits 0 (exit $rc)"; tail -5 "$ROOT/stub-install.log"; }
  grep -q RENDER_IMPORTS_OK "$ROOT/stub-install.log" && ok "the entry point reports RENDER_IMPORTS_OK" || bad "the entry point reports RENDER_IMPORTS_OK"
  ( cd "$FC" && source "$I" && set +e && same_dir node_modules/@capiro/meri-contracts packages/contracts && same_dir node_modules/@anthropic-ai/claude-agent-sdk apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk && same_dir node_modules/@aws-sdk/client-s3 apps/artifacts/storage/node_modules/@aws-sdk/client-s3 ) && ok "all three links resolve to the intended packages" || bad "all three links resolve to the intended packages"
  PATH="$ROOT/stubbin:$PATH" bash "$I" "$FC" > "$ROOT/stub-install2.log" 2>&1; rc2=$?
  [ "$rc2" = 0 ] && [ "$(grep -c '^exists' "$ROOT/stub-install2.log")" = 3 ] && ok "a second run exits 0 and accepts the three existing links" || bad "a second run exits 0 and accepts the three existing links (exit $rc2)"
fi

echo
echo "cases passed: $PASS, failed: $FAIL"
[ "$FAIL" = 0 ] && { echo TESTS_OK; exit 0; } || { echo TESTS_FAILED; exit 1; }
