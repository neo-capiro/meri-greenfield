#!/usr/bin/env bash
# Exit: 0 test success; 1+ test/container failure; 2 usage error; 124 timeout.
set -euo pipefail
if [[ ${1:-} == --help ]]; then
  echo 'Usage: proxy-tests.sh IMAGE SOURCE_DIRECTORY TIMEOUT_SECONDS MODULE...'
  exit 0
fi
if [[ $# -lt 4 || ! $3 =~ ^[1-9][0-9]*$ ]]; then
  echo 'Usage: proxy-tests.sh IMAGE SOURCE_DIRECTORY TIMEOUT_SECONDS MODULE...' >&2
  exit 2
fi
image=$1
source_root=$(cd "$2" && pwd)
limit=$3
shift 3
container="meri-p0-python-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker run -d --name "$container" --network none --user 0 --entrypoint sleep \
  "$image" "$((limit + 300))" >/dev/null
# Reviewed-file checks require root-owned files with no group/world write bit.
git -C "$source_root" -c tar.umask=0022 archive HEAD | \
  docker exec -i --user 0 "$container" sh -c \
  'mkdir -p /src && cd /src && tar -xf - && chown -R root:root /src && chmod -R go-w /src'
docker exec --user 10001 --workdir /src "$container" \
  timeout "$limit" /opt/meri-proxy-venv/bin/python -B -m unittest -v "$@"
