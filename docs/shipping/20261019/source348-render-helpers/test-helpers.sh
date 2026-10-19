#!/usr/bin/env bash
# Focused tests for the three helpers (verify-rendered.mjs, dry-run-render.sh guards, install-render-deps.sh guards).
# Fake data only, in one temporary directory that is removed by the same guarded cleanup the dry run uses; no network, no AWS, no private input, no render,
# no product suites.
#   bash test-helpers.sh        -> PASS/FAIL per case, then TESTS_OK or TESTS_FAILED; exit 0 only when every case passed and the cleanup succeeded.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd -P)"
# shellcheck disable=SC1091
source "$HERE/dry-run-render.sh"      # functions only (main does not run when sourced): safe_remove_tmp, exact_regular_file, same_dir
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "PASS  $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL  $1"; }
skip() { echo "SKIP  $1"; }
expect() { local want="$1" name="$2"; shift 2; "$@" >/dev/null 2>&1; local rc=$?; if [ "$rc" = "$want" ]; then ok "$name"; else bad "$name (exit $rc, wanted $want)"; fi; }

TROOT="$(cd "${TMPDIR:-/tmp}" && pwd -P)"
ROOT="$(mktemp -d "$TROOT/helpertest.XXXXXXXX")"; ROOT="$(cd "$ROOT" && pwd -P)"
cleanup() { safe_remove_tmp "$ROOT" "$TROOT" helpertest || { echo "TEST_CLEANUP_FAILED $ROOT" >&2; return 1; }; }
trap 'cleanup || exit 1' EXIT
if command -v cygpath >/dev/null 2>&1; then RM="$(cygpath -m "$ROOT")"; else RM="$ROOT"; fi

# mkdirlink <link> <target dir>: a directory link without special privilege (a junction on Windows, ln -s elsewhere); paths travel as data.
mkdirlink() {
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) LINK_PATH="$(cygpath -w "$1")" LINK_TARGET="$(cygpath -w "$2")" powershell.exe -NoProfile -NonInteractive -Command 'New-Item -ItemType Junction -Path $env:LINK_PATH -Target $env:LINK_TARGET | Out-Null' ;;
    *) ln -s "$2" "$1" ;;
  esac
}

echo "== verify-rendered.mjs"
A=$(printf 'a%.0s' $(seq 1 64)); B=$(printf 'b%.0s' $(seq 1 64)); SA=$(printf '1%.0s' $(seq 1 40)); SB=$(printf '2%.0s' $(seq 1 40))
mk() {  # mk <dir>: a consistent fake render output with every field the verifier requires
  node -e "
const fs=require('fs');const d=process.argv[1],A=process.argv[2],B=process.argv[3],SA=process.argv[4],SB=process.argv[5];const now=Date.now(),day=86400000;
const roles={};
for(const r of ['control','temporal-worker','temporal-issuer','model-owner','model-proxy']){
  const px=r==='model-proxy',dg='sha256:'+(px?B:A),sc=px?SB:SA,path='/run/meri/'+r+'.json',map={};map[path]='d'.repeat(64);map['/run/meri/'+r+'.other']='e'.repeat(64);
  fs.mkdirSync(d+'/'+r,{recursive:true});
  fs.writeFileSync(d+'/'+r+'/expected.json',JSON.stringify({schemaVersion:1,role:r,sourceCommit:sc,imageDigest:dg,sha256ByPath:map,materialContractSha256:'c'.repeat(64)}));
  roles[r]={configPath:path,configSha256:'d'.repeat(64),materialContractSha256:'c'.repeat(64),imageDigest:dg,sourceCommit:sc,sha256ByPath:map};}
fs.writeFileSync(d+'/summary.json',JSON.stringify({schemaVersion:1,generatedAtMs:now,roles,validity:{validityDays:7,notAfterMs:now+7*day,notAfter:new Date(now+7*day).toISOString(),grantAndDeadlineMs:now+900000,earliestCertificateNotAfter:new Date(now+30*day).toISOString()}}));
" "$1" "$A" "$B" "$SA" "$SB"
}
msum() { node -e "const fs=require('fs');const p=process.argv[1]+'/summary.json';const s=JSON.parse(fs.readFileSync(p));(new Function('s',process.argv[2]))(s);fs.writeFileSync(p,JSON.stringify(s));" "$1" "$2"; }       # msum <dir> <js on s>
mexp() { node -e "const fs=require('fs');const p=process.argv[1]+'/'+process.argv[2]+'/expected.json';const e=JSON.parse(fs.readFileSync(p));(new Function('e',process.argv[3]))(e);fs.writeFileSync(p,JSON.stringify(e));" "$1" "$2" "$3"; }   # mexp <dir> <role> <js on e>
V="node $HERE/verify-rendered.mjs"
n=0; fresh() { n=$((n+1)); mk "$RM/v$n"; echo "$RM/v$n"; }
d=$(fresh);                                                                  expect 0 "consistent render passes"                                    $V "$d" "$A" "$B" "$SA" "$SB"
expect 2 "short source SHA is a usage error"                                 $V "$d" "$A" "$B" "${SA:0:12}" "$SB"
expect 2 "missing source arguments is a usage error"                         $V "$d" "$A" "$B"
expect 1 "wrong node source commit fails"                                    $V "$d" "$A" "$B" "$SB" "$SB"
expect 1 "wrong proxy digest fails"                                          $V "$d" "$A" "$A" "$SA" "$SB"
d=$(fresh); rm -f "$d/summary.json";                                         expect 1 "absent summary.json fails"                                   $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); echo '{not json' > "$d/summary.json";                            expect 1 "unreadable summary.json fails"                               $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); msum "$d" "delete s.roles['model-owner']";                       expect 1 "role missing from summary fails"                             $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); msum "$d" "s.roles.control.materialContractSha256='e'.repeat(64)"; expect 1 "materialContractSha256 mismatch fails"                      $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); msum "$d" "s.roles['temporal-worker'].sha256ByPath['/run/meri/temporal-worker.json']='e'.repeat(64)"; expect 1 "sha256ByPath mismatch fails"  $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); msum "$d" "s.roles['model-proxy'].configSha256='e'.repeat(64)";  expect 1 "config pin mismatch fails"                                    $V "$d" "$A" "$B" "$SA" "$SB"
echo "-- absent or malformed values must not compare equal"
d=$(fresh); mexp "$d" control "delete e.materialContractSha256"; msum "$d" "delete s.roles.control.materialContractSha256"; expect 1 "materialContractSha256 absent in BOTH files fails" $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); mexp "$d" control "e.materialContractSha256='zz'"; msum "$d" "s.roles.control.materialContractSha256='zz'"; expect 1 "malformed materialContractSha256 equal in both files fails" $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); mexp "$d" control "e.sha256ByPath={}"; msum "$d" "s.roles.control.sha256ByPath={}";                          expect 1 "empty sha256ByPath in both files fails"         $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); mexp "$d" control "e.sha256ByPath['/run/meri/control.other']='short'"; msum "$d" "s.roles.control.sha256ByPath['/run/meri/control.other']='short'"; expect 1 "malformed sha256ByPath value in both files fails" $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); mexp "$d" control "delete e.sha256ByPath"; msum "$d" "delete s.roles.control.sha256ByPath";                    expect 1 "sha256ByPath absent in both files fails"        $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); msum "$d" "delete s.roles.control.sourceCommit";                                                               expect 1 "summary sourceCommit absent fails"              $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); msum "$d" "s.roles.control.sourceCommit='3'.repeat(40)";                                                       expect 1 "summary sourceCommit differs from expected.json fails" $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); mexp "$d" control "delete e.sourceCommit"; msum "$d" "delete s.roles.control.sourceCommit";                    expect 1 "sourceCommit absent in both files fails"        $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); mexp "$d" control "delete e.imageDigest"; msum "$d" "delete s.roles.control.imageDigest";                      expect 1 "imageDigest absent in both files fails"         $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); mexp "$d" control "e.imageDigest='$A'"; msum "$d" "s.roles.control.imageDigest='$A'";                          expect 1 "imageDigest without the sha256: prefix in both files fails" $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); msum "$d" "delete s.roles.control.configPath";                                                                 expect 1 "configPath absent fails"                        $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); msum "$d" "delete s.roles.control.configSha256";                                                               expect 1 "configSha256 absent fails"                      $V "$d" "$A" "$B" "$SA" "$SB"
echo "-- expected.json that is valid JSON but not an object"
for body in '[]' '5' '"str"' 'true' '[{"role":"control"}]'; do
  d=$(fresh); printf '%s' "$body" > "$d/control/expected.json"; expect 1 "expected.json containing $body fails" $V "$d" "$A" "$B" "$SA" "$SB"
done
d=$(fresh); printf '%s' '{}' > "$d/model-proxy/expected.json"; expect 1 "expected.json containing {} fails" $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); printf '%s' 'null' > "$d/temporal-issuer/expected.json"; expect 1 "expected.json containing null fails" $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); node -e "const fs=require('fs');const p=process.argv[1]+'/summary.json';const s=JSON.parse(fs.readFileSync(p));s.roles=[];fs.writeFileSync(p,JSON.stringify(s));" "$d"; expect 1 "summary.roles as an array fails" $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); node -e "const fs=require('fs');const p=process.argv[1]+'/summary.json';const s=JSON.parse(fs.readFileSync(p));s.roles.control=[];fs.writeFileSync(p,JSON.stringify(s));" "$d"; expect 1 "a summary role entry that is an array fails" $V "$d" "$A" "$B" "$SA" "$SB"
echo "-- validity fields"
d=$(fresh); msum "$d" "delete s.validity";                                                                                 expect 1 "validity absent fails"                          $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); msum "$d" "delete s.validity.validityDays";                                                                    expect 1 "validityDays absent fails"                      $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); msum "$d" "delete s.validity.earliestCertificateNotAfter";                                                     expect 1 "earliestCertificateNotAfter absent fails"       $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); msum "$d" "s.validity.notAfter='not a date'";                                                                  expect 1 "malformed notAfter fails"                       $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); msum "$d" "s.validity.notAfter=new Date(s.validity.notAfterMs+3600000).toISOString()";                          expect 1 "notAfter inconsistent with notAfterMs fails"    $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); msum "$d" "s.validity.earliestCertificateNotAfter=s.validity.notAfter";                                        expect 1 "window not ending before the earliest certificate notAfter fails" $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); msum "$d" "s.validity.notAfterMs=Date.now()-1000;s.validity.notAfter=new Date(s.validity.notAfterMs).toISOString();s.generatedAtMs=s.validity.notAfterMs-7*86400000"; expect 1 "an already-ended validity window fails" $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); msum "$d" "delete s.generatedAtMs";                                                                            expect 1 "generatedAtMs absent fails"                     $V "$d" "$A" "$B" "$SA" "$SB"
d=$(fresh); msum "$d" "s.validity.validityDays=3";                                                                         expect 1 "notAfterMs not generatedAtMs + validityDays fails" $V "$d" "$A" "$B" "$SA" "$SB"

echo "== dry-run-render.sh guards"
D="$HERE/dry-run-render.sh"
expect 2 "wrong argument count is refused"                                   bash "$D" "$RM"
expect 2 "non-hex digest is refused"                                         bash "$D" "$RM" "zz" "$B"
expect 2 "nonexistent checkout is refused"                                   bash "$D" "$RM/nope" "$A" "$B"
mkdir -p "$ROOT/notmeri";                                                    expect 2 "directory that is not a git checkout is refused"             bash "$D" "$RM/notmeri" "$A" "$B"
git init -q "$ROOT/emptyrepo" 2>/dev/null;                                   expect 2 "git checkout without the Meri render files is refused"        bash "$D" "$RM/emptyrepo" "$A" "$B"
echo "-- exact_regular_file (containment, no links)"
FC="$ROOT/fc"; mkdir -p "$FC/a" "$ROOT/outside"; echo x > "$FC/a/b.txt"; echo x > "$ROOT/outside/b.txt"
expect 0 "a regular file at the expected resolved path passes"               exact_regular_file "$RM/fc" a/b.txt
expect 1 "a missing file fails"                                              exact_regular_file "$RM/fc" a/missing.txt
expect 1 "a directory is not a regular file"                                 exact_regular_file "$RM/fc" a
mkdirlink "$FC/lnk" "$ROOT/outside" >/dev/null 2>&1
expect 1 "a parent directory that is a link to outside the checkout fails"   exact_regular_file "$RM/fc" lnk/b.txt
mkdir -p "$FC/real"; echo x > "$FC/real/c.txt"; mkdirlink "$FC/alias" "$FC/real" >/dev/null 2>&1
expect 1 "a parent link that redirects to another directory inside the checkout also fails (the resolved path must equal the expected one)" exact_regular_file "$RM/fc" alias/c.txt
if MSYS=winsymlinks:nativestrict ln -s "$ROOT/outside/b.txt" "$FC/a/file-link.txt" 2>/dev/null && node -e "process.exit(require('fs').lstatSync(process.argv[1]).isSymbolicLink()?0:1)" "$RM/fc/a/file-link.txt"; then
  expect 1 "a symlinked file fails" exact_regular_file "$RM/fc" a/file-link.txt
else skip "cannot create a real file symlink here (needs privilege or Developer Mode); the parent-link cases above cover redirection"; fi
echo "-- safe_remove_tmp (sourced)"
cat > "$ROOT/guard-test.sh" <<'EOS'
set -uo pipefail
source "$1"
f=0
t() { if [ "$2" = "0" ]; then echo "PASS  $1"; else echo "FAIL  $1"; f=1; fi; }
root="$(mktemp -d "$3/g.XXXXXXXX")"; root="$(cd "$root" && pwd -P)"      # a scratch root INSIDE the test's own guarded temporary directory; no manual recursive removal here
mkdir "$root/dryrun.ok"; echo x > "$root/dryrun.ok/f"
safe_remove_tmp "$root/dryrun.ok" "$root" >/dev/null 2>&1 && [ ! -e "$root/dryrun.ok" ]; t "removes a validated dryrun.* child" $?
mkdir "$root/other.x"; safe_remove_tmp "$root/other.x" "$root" >/dev/null 2>&1; r=$?; [ $r -ne 0 ] && [ -d "$root/other.x" ]; t "refuses a directory without the dryrun. prefix" $?
mkdir "$root/custom.y"; safe_remove_tmp "$root/custom.y" "$root" custom >/dev/null 2>&1 && [ ! -e "$root/custom.y" ]; t "accepts the prefix passed as the third argument" $?
mkdir "$root/dryrun.z"; safe_remove_tmp "$root/dryrun.z" "$root" custom >/dev/null 2>&1; r=$?; [ $r -ne 0 ] && [ -d "$root/dryrun.z" ]; t "refuses a name that does not match the passed prefix" $?
safe_remove_tmp "$root" "$root" >/dev/null 2>&1; r=$?; [ $r -ne 0 ] && [ -d "$root" ]; t "refuses the temporary root itself" $?
safe_remove_tmp "" "$root" >/dev/null 2>&1; r=$?; [ $r -ne 0 ]; t "refuses an empty path" $?
safe_remove_tmp "$root/dryrun.missing" "$root" >/dev/null 2>&1; r=$?; [ $r -ne 0 ]; t "refuses a nonexistent path" $?
mkdir -p "$root/sub/dryrun.deep"; safe_remove_tmp "$root/sub/dryrun.deep" "$root" >/dev/null 2>&1; r=$?; [ $r -ne 0 ] && [ -d "$root/sub/dryrun.deep" ]; t "refuses a grandchild of the temporary root" $?
mkdir "$root/dryrun.stuck"; rm() { return 1; }; out="$(safe_remove_tmp "$root/dryrun.stuck" "$root" 2>&1)"; rc=$?; unset -f rm
{ [ $rc -ne 0 ] && echo "$out" | grep -q CLEANUP_FAILED; }; t "reports a failed removal (CLEANUP_FAILED) and returns non-zero" $?
echo "$f" > "$2"
EOS
bash "$ROOT/guard-test.sh" "$D" "$ROOT/guard-fail" "$ROOT" 2>&1 | cut -c1-170
[ "$(cat "$ROOT/guard-fail" 2>/dev/null || echo 9)" = 0 ] && ok "safe_remove_tmp guard verdict (9 cases)" || bad "safe_remove_tmp guard verdict (9 cases)"

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
( source "$I"; [ "${#INSTALLED_LOCKS[@]}" = 8 ] ) && ok "exactly eight installed lockfiles are scanned by default" || bad "exactly eight installed lockfiles are scanned by default"
echo "-- inherited environment scrub"
( source "$I"; set +e
  export npm_config_registry=https://registry.invalid NPM_CONFIG__AUTH=secretvalue npm_config_userconfig=/x NPM_TOKEN=tok NODE_AUTH_TOKEN=tok2
  export HTTPS_PROXY=http://proxyuser:proxypw@proxy.invalid:1 ALL_PROXY=proxyuser2@proxy.invalid:3 http_proxy=http://proxy.invalid:2 HTTP_PROXY=http://proxy.invalid:4
  scrub_npm_environment > "$ROOT/scrub.out" 2>&1
  left_npm="$(env | grep -ci '^npm_config_')"
  [ "$left_npm" = 0 ] && [ -z "${NPM_TOKEN:-}" ] && [ -z "${NODE_AUTH_TOKEN:-}" ] && echo "PASS  every inherited npm_config_*/NPM_CONFIG_* variable and the npm token variables are removed" || echo "FAIL  npm_config/token variables removed (left: $left_npm)"
  [ -z "${HTTPS_PROXY:-}" ] && [ -z "${ALL_PROXY:-}" ] && echo "PASS  credential-bearing proxy variables are removed (with and without a scheme)" || echo "FAIL  credential-bearing proxy variables removed"
  [ "${http_proxy:-}" = "http://proxy.invalid:2" ] && [ "${HTTP_PROXY:-}" = "http://proxy.invalid:4" ] && echo "PASS  proxy variables without credentials are kept" || echo "FAIL  plain proxy variables kept"
  { grep -q "npm_config_registry" "$ROOT/scrub.out" && grep -q "HTTPS_PROXY" "$ROOT/scrub.out" && ! grep -Eq "secretvalue|proxypw|proxyuser|tok2" "$ROOT/scrub.out"; } && echo "PASS  names are printed, values never" || echo "FAIL  names printed, values never" ) | tee "$ROOT/scrub.verdict"
[ "$(grep -c '^PASS' "$ROOT/scrub.verdict")" = 4 ] && ok "environment scrub verdict (4 cases)" || bad "environment scrub verdict (4 cases)"
echo "-- anonymous npm configuration (two distinct empty files; npm rejects one file loaded as both user and global config)"
EU="$ROOT/empty-user.npmrc"; EG="$ROOT/empty-global.npmrc"; : > "$EU"; : > "$EG"
if command -v cygpath >/dev/null 2>&1; then EUN="$(cygpath -m "$EU")"; EGN="$(cygpath -m "$EG")"; else EUN="$EU"; EGN="$EG"; fi
got="$(npm_config_userconfig="$EUN" npm_config_globalconfig="$EGN" npm config get userconfig 2>/dev/null)"
case "$got" in *empty-user.npmrc) ok "npm accepts two distinct empty config files" ;; *) bad "npm accepts two distinct empty config files (got: $got)" ;; esac
npm_config_userconfig="$EUN" npm_config_globalconfig="$EUN" npm config get userconfig >/dev/null 2>&1; [ $? -ne 0 ] && ok "the single-file variant is what npm rejects (why two files are used)" || bad "single-file variant unexpectedly accepted"
grep -q 'INSTALL_EMPTY_USER="$(mktemp)"; INSTALL_EMPTY_GLOBAL="$(mktemp)"' "$I" && grep -q 'npm_config_userconfig="$native_user" npm_config_globalconfig="$native_global"' "$I" && ok "install-render-deps.sh uses distinct user/global empty files" || bad "install-render-deps.sh uses distinct user/global empty files"
echo "-- install-render-deps.sh entry point against a stub checkout and a stub npm (exit status, scrub, links, idempotence)"
if [ "$(node -p "process.versions.node.split('.')[0]")" != "24" ]; then
  skip "the entry-point test needs Node 24.x (the script itself refuses other majors)"
else
  FK="$ROOT/fakecheckout"; mkdir -p "$FK"; ( cd "$FK" && git init -q )
  for l in package-lock.json apps/runtime/package-lock.json apps/worker/conversation/package-lock.json packages/ui-stream/package-lock.json packages/window-resolution/package-lock.json apps/control/conversations/package-lock.json apps/artifacts/storage/package-lock.json apps/artifacts/generation/package-lock.json; do
    mkdir -p "$FK/$(dirname "$l")"; echo '{"packages":{}}' > "$FK/$l"
  done
  mkdir -p "$FK/infra/product-preview/first-chat" "$FK/packages/contracts" "$FK/apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk" "$FK/apps/artifacts/storage/node_modules/@aws-sdk/client-s3"
  echo "console.log('Usage: stub render');" > "$FK/infra/product-preview/first-chat/render-material.mjs"
  mkdir -p "$ROOT/stubbin"
  cat > "$ROOT/stubbin/npm" <<'EOS'
#!/usr/bin/env bash
{ env | grep -i '^npm_config_' | cut -d= -f1 | tr 'A-Z' 'a-z'; echo "--"; env | grep -i '_proxy=' | cut -d= -f1; } >> "${STUB_ENV_LOG:?}"
exit 0
EOS
  chmod +x "$ROOT/stubbin/npm"
  STUB_ENV_LOG="$ROOT/stub-env.log" PATH="$ROOT/stubbin:$PATH" npm_config_registry=https://registry.invalid HTTPS_PROXY=http://proxyuser:proxypw@proxy.invalid:1 http_proxy=http://proxy.invalid:2 bash "$I" "$FK" > "$ROOT/stub-install.log" 2>&1; rc=$?
  [ "$rc" = 0 ] && ok "a successful install exits 0 (the EXIT trap must not turn success into failure)" || { bad "a successful install exits 0 (exit $rc)"; tail -5 "$ROOT/stub-install.log"; }
  grep -q RENDER_IMPORTS_OK "$ROOT/stub-install.log" && ok "the entry point reports RENDER_IMPORTS_OK" || bad "the entry point reports RENDER_IMPORTS_OK"
  grep -q "scrubbed environment variables (names only):.*npm_config_registry" "$ROOT/stub-install.log" && grep -q "HTTPS_PROXY" "$ROOT/stub-install.log" && ! grep -q "proxypw" "$ROOT/stub-install.log" && ok "the entry point reports the scrubbed variable names and never a value" || bad "the entry point reports the scrubbed variable names and never a value"
  seen_cfg="$(sed -n '1,/^--$/p' "$ROOT/stub-env.log" | grep -v '^--$' | sort -u | tr '\n' ' ')"
  [ "$seen_cfg" = "npm_config_globalconfig npm_config_userconfig " ] && ok "npm itself sees only the two empty-config overrides among npm_config_* variables" || bad "npm sees only the two overrides (saw: $seen_cfg)"
  sed -n '/^--$/,$p' "$ROOT/stub-env.log" | grep -qi '^https_proxy$' && bad "npm must not see the credential-bearing HTTPS_PROXY" || ok "npm does not see the credential-bearing proxy variable"
  sed -n '/^--$/,$p' "$ROOT/stub-env.log" | grep -q '^http_proxy$' && ok "npm still sees the credential-free proxy variable" || bad "npm still sees the credential-free proxy variable"
  ( cd "$FK" && source "$I" && set +e && same_dir node_modules/@capiro/meri-contracts packages/contracts && same_dir node_modules/@anthropic-ai/claude-agent-sdk apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk && same_dir node_modules/@aws-sdk/client-s3 apps/artifacts/storage/node_modules/@aws-sdk/client-s3 ) && ok "all three links resolve to the intended packages" || bad "all three links resolve to the intended packages"
  STUB_ENV_LOG="$ROOT/stub-env2.log" PATH="$ROOT/stubbin:$PATH" bash "$I" "$FK" > "$ROOT/stub-install2.log" 2>&1; rc2=$?
  [ "$rc2" = 0 ] && [ "$(grep -c '^exists' "$ROOT/stub-install2.log")" = 3 ] && ok "a second run exits 0 and accepts the three existing links" || bad "a second run exits 0 and accepts the three existing links (exit $rc2)"
fi

echo
echo "cases passed: $PASS, failed: $FAIL"
if [ "$FAIL" = 0 ]; then echo TESTS_OK; exit 0; else echo TESTS_FAILED; exit 1; fi
