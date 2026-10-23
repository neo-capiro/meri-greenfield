#!/bin/bash
set -u; G=${WS03_INPUTS:?}; W=${GATE_WORKDIR:-/opt/ws03}
cat > $W/inner2.sh <<'IN'
set -u
cd /w/be && corepack enable >/dev/null 2>&1
pnpm --filter "@capiro/workspace^..." -r --if-present run build > /w/evidence/be-deps-build.log 2>&1; echo "deps build $?"; tail -3 /w/evidence/be-deps-build.log
rm -f /w/evidence/ws03-vitest.json /w/evidence/ws03-wrapper-jest.json
WS03_FRONTEND_CHECKOUT=/w/fe WS03_GATEWAY_REPORT=/w/evidence/ws03-vitest.json \
  pnpm --filter @capiro/workspace exec jest --config jest.config.cjs --runInBand \
  --testMatch '**/test/support/ws03-gateway-authority.ts' --json --outputFile=/w/evidence/ws03-wrapper-jest.json \
  > /w/evidence/ws03-wrapper.log 2>&1
echo "wrapper exit $?"; grep -E "^Tests:|^Test Suites:" /w/evidence/ws03-wrapper.log
node /w/check-report.cjs /w/evidence/ws03-vitest.json /w/fe > /w/evidence/check.json 2> /w/evidence/check.err; echo "check exit $?"
IN
docker run --rm --network bridge -v $W:/w -w /w node:24 bash /w/inner2.sh > $G/ws03-result2.txt 2>&1
rm -rf $G/ws03-evidence && cp -r $W/evidence $G/ws03-evidence; cat $G/ws03-result2.txt
