#!/usr/bin/env bash
# Builds the Meri model-proxy ship kit for ONE commit and runs every non-mutating step:
#   tools at the commit, deterministic seal (proxy-context.zip), dry StartBuild request through the
#   repository's own start script, Meri-candidate coherence, read-only preflight. Never mutates AWS.
# Usage (Git Bash): bash make-proxy-kit.sh <commit-ish> [--artifacts DIR] [--with-tests]
#   --with-tests also runs 05-in-image-tests.sh live (WSL Docker, about 5 minutes).
# Output: C:/dev/fable/ship-proxy-<sha8>/ with numbered scripts; see its README.md.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO=C:/dev/fable/meri-greenfield
ARTIFACTS=C:/dev/fable/proxy-artifacts-b7fc
PROXY_BRANCH=fable/adj-proxy-admission-20261020
CANDIDATE_BRANCH=fable/meri-first-chat-candidate-20261020
refuse() { echo "MAKE_PROXY_KIT_REFUSED: $*" >&2; exit 2; }

[ $# -ge 1 ] || refuse "usage: make-proxy-kit.sh <commit-ish> [--artifacts DIR]"
TARGET="$1"; shift
WITH_TESTS=0
while [ $# -gt 0 ]; do case "$1" in --artifacts) ARTIFACTS="$2"; shift 2 ;; --with-tests) WITH_TESTS=1; shift ;; *) refuse "unknown argument $1" ;; esac; done

# The seal is byte-reproducible only with CPython 3.14's zlib: 3.14 reproduces the live 34851020 input
# (ba24c7fa..., 252,117,916 B) exactly, 3.11 produces a different (still valid) deflate stream.
[ "$(python3 -c 'import sys;print("%d.%d"%sys.version_info[:2])')" = 3.14 ] || refuse "python3 must be CPython 3.14"

git -C "$REPO" fetch -q origin "$PROXY_BRANCH" "$CANDIDATE_BRANCH"
COMMIT="$(git -C "$REPO" rev-parse "$TARGET^{commit}")"
O="C:/dev/fable/ship-proxy-${COMMIT:0:8}"
[ ! -e "$O" ] || refuse "$O exists: a kit for this commit was already made"
mkdir -p "$O/tools" "$O/dry" "$O/readback" "$O/state"

# 1. Tools exactly as committed at COMMIT (the build script is also pinned by sha256 in the buildspec).
for f in proxy-image-context.py proxy-image-start.sh proxy-image-build.sh; do
  git -C "$REPO" show "$COMMIT:infra/product-preview/$f" > "$O/tools/$f"
done

# 2. Seal.
( cd "$O" && python3 -I -B tools/proxy-image-context.py --repository "$REPO" --commit "$COMMIT" \
    --artifacts "$ARTIFACTS" --output proxy-context.zip ) > "$O/seal.json" || refuse "seal refused"
ZIP_SHA256="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["zipSha256"])' "$O/seal.json")"
echo "$ZIP_SHA256  $O/proxy-context.zip" | sha256sum -c - >/dev/null || refuse "sealed zip hash"

# 3. Dry StartBuild request through the repository's own start script (DRY_RUN: no upload, no build).
MERI_REPO="$REPO" bash "$O/tools/proxy-image-start.sh" "$COMMIT" "$O" "$ZIP_SHA256" \
  > "$O/dry/start-build.request.dry.json" 2> "$O/dry/verify.stderr.txt" || refuse "dry request refused (dry/verify.stderr.txt)"

# 4. Coherence with the Meri candidate: render/stage3 read the proxy config from the Meri kit commit, so that
# commit must carry this apps/proxy tree. Informational here; 04-feed-meri-kit.sh enforces it for the real kit.
python3 - "$O/readback/coherence.json" "$COMMIT" "$(git -C "$REPO" rev-parse "$COMMIT:apps/proxy")" \
  "$(git -C "$REPO" rev-parse "origin/$CANDIDATE_BRANCH")" "$(git -C "$REPO" rev-parse "origin/$CANDIDATE_BRANCH:apps/proxy")" <<'EOF'
import json, sys
out, commit, tree, cand, cand_tree = sys.argv[1:]
json.dump({"proxyCommit": commit, "proxyTree": tree, "candidateHead": cand, "candidateTree": cand_tree,
           "sameProxyTree": tree == cand_tree}, open(out, "w"), indent=1)
EOF

# 5. kit.env, scripts, README.
sed -e "s|@COMMIT@|$COMMIT|g" -e "s|@ZIP_SHA256@|$ZIP_SHA256|g" -e "s|@REPO@|$REPO|g" -e "s|@ARTIFACTS@|$ARTIFACTS|g" \
  "$HERE/templates/kit.env" > "$O/kit.env"
for f in "$HERE"/templates/*.sh; do cp "$f" "$O/"; done
sed -e "s|@COMMIT@|$COMMIT|g" -e "s|@ZIP_SHA256@|$ZIP_SHA256|g" -e "s|@KIT@|$O|g" "$HERE/templates/README.md" > "$O/README.md"

# 6. Read-only preflight now (re-run it right before 01).
bash "$O/00-preflight.sh" | tee "$O/readback/preflight.txt"
[ "$WITH_TESTS" = 0 ] || bash "$O/05-in-image-tests.sh" live 2>&1 | tee "$O/readback/in-image-live.txt"
echo "PROXY_KIT_READY commit=$COMMIT kit=$O zipSha256=$ZIP_SHA256"
