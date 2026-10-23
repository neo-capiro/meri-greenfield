#!/usr/bin/env bash
# Review run (not for commit): one proxy module, full output, in IMAGE on SOURCE's committed tree (same setup as proxy-modules.py).
# Usage: one-module.sh IMAGE SOURCE_DIR MODULE [EXTRA_FILE_TO_COPY_INTO_TEST_DIR]
set -uo pipefail
image=$1; source=$2; module=$3; extra=${4:-}
name=p2a-one-module
docker rm -f $name >/dev/null 2>&1
docker run -d --name $name --network none --user 0 --entrypoint sleep $image 3600 >/dev/null
git -C $source -c tar.umask=0022 archive HEAD | docker exec -i --user 0 $name sh -c 'mkdir -p /src && cd /src && tar -xf - && chown -R root:root /src && chmod -R go-w /src'
if [ -n "$extra" ]; then
  docker cp "$extra" $name:/src/apps/proxy/product/test/
  docker exec --user 0 $name sh -c 'chown -R root:root /src/apps/proxy/product/test && chmod -R go-w /src/apps/proxy/product/test'
fi
docker exec --user 0 $name sh -c 'command -v node openssl; node --version 2>&1; ls /src/node_modules 2>&1 | head -3'
docker exec --user 10001 --workdir /src --env AWS_EC2_METADATA_DISABLED=true $name timeout 600 /opt/meri-proxy-venv/bin/python -B -m unittest -v $module 2>&1
echo "exit=$?"
docker rm -f $name >/dev/null 2>&1
