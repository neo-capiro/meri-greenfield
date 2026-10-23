#!/usr/bin/env bash
# Inside WSL, called by 05-in-image-tests.sh. $1 label, $2 image@digest, $3 apps/proxy tar ("" = test the image as is),
# $4 output dir. With a tar, builds a local derived image whose /opt/meri/apps/proxy is that tree (git modes, root-owned).
set -uo pipefail
# The reviewed-file checks deny group/other-writable files. git archive records 0664 (tar.umask 0002) and WSL extracts as
# root, which keeps recorded modes, so extraction applies umask 022 explicitly (the sealer normalizes to 0644/0755 too).
umask 022
LABEL="$1"; IMAGE="$2"; TAR="$3"; OUT="$4"
docker pull -q "$IMAGE" >/dev/null || exit 1
TEST_IMAGE="$IMAGE"
if [ -n "$TAR" ]; then
  ctx="$(mktemp -d)"; tar -x --no-same-permissions -C "$ctx" -f "$TAR"
  printf '%s\n' 'ARG BASE' 'FROM ${BASE}' 'USER root' 'RUN ["/bin/sh","-c","rm -rf /opt/meri/apps/proxy"]' \
    'COPY apps/proxy /opt/meri/apps/proxy' 'USER 10001:10001' > "$ctx/Dockerfile"
  TEST_IMAGE="meri-proxy-kit-test:$LABEL"
  docker build -q --network none --build-arg "BASE=$IMAGE" -t "$TEST_IMAGE" "$ctx" >/dev/null || { rm -rf "$ctx"; exit 1; }
  rm -rf "$ctx"
fi
: > "$OUT/in-image-$LABEL.tsv"
while read -r m; do
  m="${m%$'\r'}"; [ -n "$m" ] || continue
  log="$OUT/in-image-$LABEL-$m.log"
  timeout 300 docker run --rm --network none --read-only --tmpfs /tmp:rw,size=256m --user 10001:10001 \
    --cap-drop ALL --security-opt no-new-privileges --entrypoint /opt/meri-proxy-venv/bin/python \
    "$TEST_IMAGE" -E -B -m unittest "$m" > "$log" 2>&1
  rc=$?
  printf '%s\t%s\t%s\n' "$m" "$rc" "$(grep -E '^(Ran [0-9]+ tests|OK|FAILED)' "$log" | tr '\n' ' ')" | tee -a "$OUT/in-image-$LABEL.tsv"
done < "$OUT/test-modules.txt"
[ -z "$TAR" ] || docker rmi -f "$TEST_IMAGE" >/dev/null
