#!/usr/bin/env bash
# LOCAL (WSL Docker; pulls images from ECR read-only, no AWS mutation). Runs the proxy product unit-test modules
# inside a product image as uid 10001, --network none, read-only root.
#   live  (default, before 01)  serving image 734a20ec with apps/proxy replaced by a source tree in a local derived
#                               image (root-owned, 0644/0755 like the real build; the reviewed-file checks deny
#                               group-writable files, so neither /mnt/c bind mounts nor git's default 0664 tar modes work).
#                               Runs the serving source (34851020) as baseline and THIS commit, then compares.
#                               Valid while the runtime pins (assembly pins, runtime packages, Dockerfile) are unchanged.
#   built (after 02)            the new product image exactly as built.
# Gate (live): no module that passes on the baseline fails on this commit. 4 of 27 modules fail in any local run because
# their fixtures live outside the image (node binary/owner, repo infra/, scripts/); they are reported, not gated.
set -euo pipefail
source "$(dirname "$0")/kit.env"
MODE="${1:-live}"
wsl_path() { wsl -d Ubuntu-24.04 -- wslpath -a "$1" | tr -d '\r'; }
W="$(wsl_path "$KIT_DIR")"

aws ecr get-login-password | wsl -d Ubuntu-24.04 -- docker login --username AWS --password-stdin "${REPOSITORY_URI%%/*}" >/dev/null
git -C "$REPO" ls-tree -r --name-only "$COMMIT" apps/proxy/product | grep -E '(^|/)test_[^/]*\.py$' | sed 's#\.py$##; s#/#.#g' > "$STATE/test-modules.txt"
run() { # $1 = label, $2 = image, $3 = source commit or "" (built image as is)
  local tar=""
  if [ -n "$3" ]; then git -C "$REPO" -c tar.umask=0022 archive --format=tar "$3" apps/proxy > "$STATE/tree-$1.tar"; tar="$W/state/tree-$1.tar"; fi
  wsl -d Ubuntu-24.04 -- bash "$W/05-in-image-tests.wsl.sh" "$1" "$2" "$tar" "$W/state"
  rm -f "$STATE/tree-$1.tar"
}
case "$MODE" in
  live)
    run base "$LIVE_PROXY" "$LIVE_PROXY_COMMIT"
    run head "$LIVE_PROXY" "$COMMIT"
    python3 -I -B - "$STATE/in-image-base.tsv" "$STATE/in-image-head.tsv" <<'EOF'
import sys
read = lambda p: {l.split("\t")[0]: l.split("\t")[1] for l in open(p, encoding="utf-8") if l.strip()}
base, head = map(read, sys.argv[1:])
regressed = sorted(m for m in head if base.get(m) == "0" and head[m] != "0")
new_failing = sorted(m for m in head if m not in base and head[m] != "0")
fixed = sorted(m for m in head if base.get(m) not in (None, "0") and head[m] == "0")
print("modules", len(head), "passing", sum(v == "0" for v in head.values()), "baselineFailing", sorted(m for m, v in base.items() if v != "0"))
print("fixed", fixed, "newModulesFailing", new_failing)
if regressed or new_failing: sys.exit(f"IN_IMAGE_REGRESSION {regressed + new_failing}")
print("IN_IMAGE_TESTS_NO_REGRESSION")
EOF
    ;;
  built) run built "$REPOSITORY_URI@$(need product-digest)" "" ;;
  *) stop "usage: 05-in-image-tests.sh [live|built]" ;;
esac
wsl -d Ubuntu-24.04 -- docker logout "${REPOSITORY_URI%%/*}" >/dev/null
