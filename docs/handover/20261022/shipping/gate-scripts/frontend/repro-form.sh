#!/bin/bash
set -u; W=/opt/ws03; R=/opt/ws03-repro; rm -rf $R; cp -a $W/fe $R
V=$(grep -A3 "\"node_modules/@playwright/test\"" $R/package-lock.json | grep -o "\"version\": \"[0-9.]*\"" | head -1 | grep -o "[0-9][0-9.]*"); echo "playwright $V"
# Local-only diagnostic: include method + URL in the guard error (not committed anywhere).
sed -i 's#"Unexpected API request in isolated Settings form harness",#`Unexpected API request in isolated Settings form harness: ${route.request().method()} ${route.request().url()}`,#' $R/apps/web/tests/browser/settings-security-form.spec.ts
grep -n 'Unexpected API request' $R/apps/web/tests/browser/settings-security-form.spec.ts
docker run --rm --ipc=host -v $R:/w -w /w mcr.microsoft.com/playwright:v$V-noble bash -c "npm run test:browser --workspace @capiro/web -- --workers=1 --reporter=line tests/browser/settings-security-form.spec.ts 2>&1 | tail -40"
