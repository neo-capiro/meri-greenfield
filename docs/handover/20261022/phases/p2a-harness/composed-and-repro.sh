#!/usr/bin/env bash
# Review run (not for commit): in the pinned proxy IMAGE, on SOURCE's committed tree plus the runtime image's installed
# root node_modules (the composed test spawns the Node owner), run test_pair_lease_composed verbosely and then the F1
# reproduction (answered owner refusals vs the carrier-reset quota). Usage: IMAGE SOURCE_DIR NODE_MODULES_DIR REPRO_FILE
set -uo pipefail
image=$1; source=$2; nm=$3; repro=$4
c=p2a-composed
docker rm -f $c >/dev/null 2>&1
docker run -d --name $c --network none --user 0 --entrypoint sleep $image 3600 >/dev/null
git -C $source -c tar.umask=0022 archive HEAD | docker exec -i --user 0 $c sh -c 'mkdir -p /src && cd /src && tar -xf -'
docker cp $nm/node_modules $c:/src/node_modules
docker cp $repro $c:/src/apps/proxy/product/test/
docker exec --user 0 $c sh -c 'chown -R root:root /src && chmod -R go-w /src'
run() { docker exec --user 10001 --workdir /src --env AWS_EC2_METADATA_DISABLED=true --env LITELLM_LOCAL_MODEL_COST_MAP=True $c \
  timeout 600 /opt/meri-proxy-venv/bin/python -B -m unittest -v "$@" 2>&1 | grep -v LiteLLM; }
echo "== composed"; run apps.proxy.product.test.test_pair_lease_composed
echo "== repro"; run apps.proxy.product.test.$(basename $repro .py)
docker rm -f $c >/dev/null 2>&1
echo COMPOSEDDONE
