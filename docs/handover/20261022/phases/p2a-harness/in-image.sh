#!/usr/bin/env bash
# Exit: 0 test success; 1+ test/container failure; 2 usage error; 124 timeout.
set -euo pipefail
if [[ ${1:-} == --help ]]; then
  echo 'Usage: in-image.sh IMAGE SOURCE_DIRECTORY TIMEOUT_SECONDS [node test options] TEST_FILES...'
  exit 0
fi
if [[ $# -lt 4 || ! $3 =~ ^[1-9][0-9]*$ ]]; then
  echo 'Usage: in-image.sh IMAGE SOURCE_DIRECTORY TIMEOUT_SECONDS [node test options] TEST_FILES...' >&2
  exit 2
fi
image=$1
source_root=$(cd "$2" && pwd)
limit=$3
shift 3
container="meri-p0-node-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker run -d --name "$container" --network none --memory 3g --user 0 --entrypoint sh \
  "$image" -c "sleep $((limit + 300))" >/dev/null
# Preserve the image dependency trees; only committed source is overlaid.
git -C "$source_root" -c tar.umask=0022 archive HEAD | \
  docker exec -i --user 0 "$container" sh -c 'cd /opt/meri && tar -xf -'
docker exec --user 0 "$container" sh -c \
  'find /opt/meri/apps /opt/meri/packages /opt/meri/infra /opt/meri/docs /opt/meri/scripts -name node_modules -prune -o -exec chown 1000:1000 {} +'
docker exec --user 1000 --workdir /opt/meri --env MERI_REVIEW_SOURCE_ROOT=/opt/meri "$container" \
  timeout "$limit" node --experimental-test-module-mocks --test --test-concurrency=1 --test-reporter=tap "$@"
