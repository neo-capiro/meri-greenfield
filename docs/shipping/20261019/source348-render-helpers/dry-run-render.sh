#!/usr/bin/env bash
# OFFLINE DRY RUN of the Meri first-chat render with THROWAWAY private inputs. It proves the public packet and the dependency layout render end to
# end; it does NOT establish real-input readiness (real certificates, pins, bearer, membership, database logins) or live readiness.
#
# What it uses: the public candidates from the packet (read-only; a COPY gets the throwaway PKI's pins), a throwaway PKI from the repository's own
# pki.py, fake database logins, a fake bearer-shaped file and fake ids, all generated under a temporary directory that is deleted on exit.
# What it never touches: any real private directory, any credential, any AWS or Core call. Network: none (run install-render-deps.sh first).
#
#   bash dry-run-render.sh <checkout path> <expected node digest hex> <expected proxy digest hex> [packet dir relative to the checkout]
#   default packet dir: docs/shipping/20261019/source348-public-render
# Requirements: Node 24.x, Python 3 with the `cryptography` package (what pki.py already needs), dependencies installed in the checkout.
set -uo pipefail
R="${1:?usage: dry-run-render.sh <checkout> <node digest hex> <proxy digest hex> [packet dir]}"
NODE_DIGEST="${2:?node digest}"; PROXY_DIGEST="${3:?proxy digest}"
PACKET="${4:-docs/shipping/20261019/source348-public-render}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PUB="$R/$PACKET"; F="$R/infra/product-preview/first-chat"
T="$(mktemp -d)"; trap 'rm -rf "$T"; echo "throwaway material deleted"' EXIT
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) TM="$(cygpath -m "$T")" ;; *) TM="$T" ;; esac
echo "== 1. throwaway PKI (30 days), fake database logins, fake bearer-shaped file"
python -I "$F/pki.py" "$TM/pki" --days 30 | cut -c1-120
node -e "const c=require('crypto'),fs=require('fs');const r=n=>c.randomBytes(n).toString('hex');
fs.writeFileSync(process.argv[1]+'/pki/db-logins.json',JSON.stringify({control:r(16),modelOwner:r(16),issuer:r(16)}));
fs.writeFileSync(process.argv[1]+'/identity',c.randomBytes(48).toString('base64url'));" "$TM"
echo "== 2. COPY of the public deployment candidate with the throwaway pins (the public file is not modified)"
node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const p=JSON.parse(fs.readFileSync(process.argv[2]+'/pki/pins.json','utf8')).certificates;
for(const k of Object.keys(d.pinsDer)){if(!p[k])throw Error('throwaway pins lack '+k);d.pinsDer[k]=p[k].der;d.pinsPem[k]=p[k].pem;}
fs.writeFileSync(process.argv[2]+'/deployment-inputs.dryrun.json',JSON.stringify(d,null,1));console.log('pins swapped:',Object.keys(d.pinsDer).length);" "$PUB/deployment-inputs.candidate.json" "$TM"
echo "== 3. fake core values and fake task-definition revisions -> stage3.json (the repository's own stage3-deploy.mjs)"
node -e "const fs=require('fs');
fs.writeFileSync(process.argv[1]+'/core.json',JSON.stringify({coreOrigin:'https://first-chat-preview.app-dev.capiro.ai',frontendOrigin:'https://portfolio-preview.app.capiro.ai',tenantId:'dryrun-tenant',actorId:'dryrun-actor',clientId:'11111111-1111-4111-8111-111111111111',identityCredentialPath:process.argv[1]+'/identity'}));
const fam=['meri-product-preview-control','meri-product-preview-temporal-worker','meri-product-preview-temporal-issuer','meri-product-preview-owner','meri-product-preview-proxy','meri-product-preview-runner'];
const arn=(f,n)=>'arn:aws:ecs:us-east-1:967807252336:task-definition/'+f+':'+n;
fs.writeFileSync(process.argv[1]+'/latest.tsv',fam.flatMap(f=>[f+'\t'+arn(f,30),f+'\t'+arn(f,29)]).join('\n')+'\n');" "$TM"
node "$F/stage3-deploy.mjs" stage3-input --deployment-inputs "$TM/deployment-inputs.dryrun.json" --foundation-outputs "$F/foundation-outputs.json" --latest "$TM/latest.tsv" --out "$TM/stage3.json" 2>&1 | cut -c1-120
echo "== 4. render (the repository's own validators run here)"
( cd "$R" && node infra/product-preview/first-chat/render-material.mjs --deployment-inputs "$TM/deployment-inputs.dryrun.json" --private "$TM/pki" --core "$TM/core.json" --runtime "$PUB/runtime-values.candidate.json" --stage3 "$TM/stage3.json" --out "$TM/rendered" ) 2>&1 | cut -c1-120 | head -5
rc=${PIPESTATUS[0]}; echo "render exit: $rc"
echo "== 5. digest check against the expected images"
node "$HERE/verify-rendered.mjs" "$TM/rendered" "$NODE_DIGEST" "$PROXY_DIGEST"; vrc=$?
[ "$rc" = 0 ] && [ "$vrc" = 0 ] && echo "DRY_RUN_OK (throwaway inputs only: not real-input or live readiness)" || { echo "DRY_RUN_FAILED"; exit 1; }
