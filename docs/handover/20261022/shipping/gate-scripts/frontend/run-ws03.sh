#!/bin/bash
# O209: run the WS03 joined gateway suites (57 identities) in the isolated loopback harness.
# Backend capiro-backend ca4de503 (git archive), frontend = composed A1 7f8a3969 (git archive). Loopback only; no credentials.
set -u
G=${WS03_INPUTS:?dir with backend.tar, frontend.tar, check-report.cjs}; W=${GATE_WORKDIR:-/opt/ws03}; EV=$W/evidence
rm -rf $W && mkdir -p $W/be $W/fe $EV
tar -xf $G/backend.tar -C $W/be
tar -xf $G/frontend.tar -C $W/fe
cp $G/check-report.cjs $W/check-report.cjs
cat > $W/inner.sh <<'IN'
set -u
cd /w/fe && npm ci --ignore-scripts --no-audit --no-fund > /w/evidence/fe-install.log 2>&1; echo "fe install $?"
cd /w/be && corepack enable >/dev/null 2>&1; pnpm --version
pnpm install --frozen-lockfile > /w/evidence/be-install.log 2>&1; echo "be install $?"
(pnpm --filter @capiro/workspace... -r --if-present run prisma:generate || npx prisma generate --schema prisma/schema.prisma) > /w/evidence/be-generate.log 2>&1; echo "be generate $?"
WS03_FRONTEND_CHECKOUT=/w/fe WS03_GATEWAY_REPORT=/w/evidence/ws03-vitest.json \
  pnpm --filter @capiro/workspace exec jest --config jest.config.cjs --runInBand \
  --testMatch '**/test/support/ws03-gateway-authority.ts' --json --outputFile=/w/evidence/ws03-wrapper-jest.json \
  > /w/evidence/ws03-wrapper.log 2>&1
echo "wrapper exit $?"
node /w/check-report.cjs /w/evidence/ws03-vitest.json /w/fe > /w/evidence/check.json 2> /w/evidence/check.err; echo "check exit $?"
IN
docker run --rm --network bridge -v $W:/w -w /w node:24 bash /w/inner.sh > $G/ws03-result.txt 2>&1
cp -r $EV $G/ws03-evidence
cat $G/ws03-result.txt
