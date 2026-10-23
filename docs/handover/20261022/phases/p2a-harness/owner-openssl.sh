#!/usr/bin/env bash
# Review run (not for commit): a P0 node group in the runtime IMAGE with the openssl CLI added (the TLS owner tests
# generate certificates with it; §13.4). Same overlay as in-image.sh. Usage: IMAGE SOURCE_DIR TEST_FILES...
set -uo pipefail
image=$1; source_root=$2; shift 2
c=p2a-owner-openssl
docker rm -f $c >/dev/null 2>&1
docker run -d --name $c --memory 3g --user 0 --entrypoint sh "$image" -c "sleep 3600" >/dev/null
docker exec --user 0 $c sh -c 'apk add --no-cache openssl >/dev/null 2>&1 || (apt-get update >/dev/null && apt-get install -y openssl >/dev/null)'
docker exec --user 0 $c sh -c 'command -v openssl'
git -C "$source_root" -c tar.umask=0022 archive HEAD | docker exec -i --user 0 $c sh -c 'cd /opt/meri && tar -xf -'
docker exec --user 0 $c sh -c 'find /opt/meri/apps /opt/meri/packages /opt/meri/infra /opt/meri/docs /opt/meri/scripts -name node_modules -prune -o -exec chown 1000:1000 {} +'
docker exec --user 1000 --workdir /opt/meri --env MERI_REVIEW_SOURCE_ROOT=/opt/meri $c \
  timeout 1500 node --experimental-test-module-mocks --test --test-concurrency=1 --test-reporter=tap "$@"
echo "exit=$?"
docker rm -f $c >/dev/null 2>&1
