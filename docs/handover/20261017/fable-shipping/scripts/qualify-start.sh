#!/usr/bin/env bash
# One Meri product-image qualification attempt for an already sealed source.
# Usage: MERI_AWS_PROFILE=<profile> qualify-start.sh <full-commit> <inputs-dir-with-sealed-zip-and-manifest>
# Resumes after a completed upload (attempt.txt present). Never starts twice: an existing
# start-build.request.json refuses. Read the build back on any uncertain outcome.
# Conditional KMS uploads, closed request, verifier, recipe, size check, ONE StartBuild.
set -euo pipefail
C="$1"; O="$(cd "$2" && pwd)"; command -v cygpath >/dev/null && O="$(cygpath -m "$O")"
export AWS_PAGER='' AWS_MAX_ATTEMPTS=1 MSYS_NO_PATHCONV=1
P=(--profile "${MERI_AWS_PROFILE:?set an existing authorized profile}" --region us-east-1)
B=meri-greenfield-qual-build-967807252336-us-east-1
K=arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042
REPO="${MERI_REPO:-$(git -C "$(dirname "$0")" rev-parse --show-toplevel)}"
cd "$O"
if [ ! -e attempt.txt ]; then
existing=$(aws "${P[@]}" s3api list-object-versions --bucket $B --prefix "inputs/product-runtime/$C/" --query 'length(Versions || `[]`)' --output text)
test "$existing" = 0
for f in product-source.zip product-source-members.json; do
  b64=$(python3 -c "import hashlib,base64;print(base64.b64encode(hashlib.sha256(open('$f','rb').read()).digest()).decode())")
  aws "${P[@]}" s3api put-object --bucket $B --key "inputs/product-runtime/$C/$f" --body "$f" --if-none-match '*' \
    --checksum-algorithm SHA256 --checksum-sha256 "$b64" --server-side-encryption aws:kms --ssekms-key-id $K --output json > "put-$f.json"
  v=$(python3 -c "import json;print(json.load(open('put-$f.json'))['VersionId'])")
  aws "${P[@]}" s3api head-object --bucket $B --key "inputs/product-runtime/$C/$f" --version-id "$v" --checksum-mode ENABLED --output json > "head-$f.json"
  python3 - "$f" "$v" "$b64" "$K" <<'EOF'
import json,sys,os
f,v,b64,k=sys.argv[1:];h=json.load(open('head-'+f+'.json'))
assert h['VersionId']==v and h['ContentLength']==os.path.getsize(f) and h['ChecksumSHA256']==b64 and h['ChecksumType']=='FULL_OBJECT' and h['ServerSideEncryption']=='aws:kms' and h['SSEKMSKeyId']==k, 'HEAD_MISMATCH'
EOF
done
python3 - "$C" "$B" <<'EOF'
import json,secrets,sys,hashlib
C,B=sys.argv[1:]
rows={r['path']:r['sha256'] for r in json.load(open('product-source-members.json'))['files']}
sha=lambda f:hashlib.sha256(open(f,'rb').read()).hexdigest()
v=lambda f:json.load(open('put-'+f+'.json'))['VersionId']
att=secrets.token_hex(16); open('attempt.txt','x').write(att+'\n')
req={"schemaVersion":2,"sourceCommit":C,
 "archive":{"bucket":B,"key":f"inputs/product-runtime/{C}/product-source.zip","versionId":v('product-source.zip'),"sha256":sha('product-source.zip')},
 "manifest":{"bucket":B,"key":f"inputs/product-runtime/{C}/product-source-members.json","versionId":v('product-source-members.json'),"sha256":sha('product-source-members.json')},
 "dockerfileSha256":rows["apps/runtime/Dockerfile"],
 "nodeImageUri":"public.ecr.aws/docker/library/node@sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63","nodeVersion":"v24.21.0",
 "runtimeBaseImageUri":"cgr.dev/chainguard/wolfi-base@sha256:030e45cb37187dff322bbefe9658bcaec31b824a5d523380771a64864c9f45d4",
 "runtimePackagesSha256":rows["infra/product-preview/runtime-packages.lock.json"],
 "runnerSha256":rows["apps/runtime/conversation-runner.mjs"],"runtimeUser":"1000:1000",
 "codeBuildProjectArn":"arn:aws:codebuild:us-east-1:967807252336:project/meri-greenfield-qualification-build",
 "ecrRepositoryUri":"967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker",
 "imageTag":f"product-{C}-{att}",
 "verifierSha256":rows["infra/product-preview/image-build-source.py"],"producerSha256":rows["infra/product-preview/image-build-producer.py"]}
open('request.json','x').write(json.dumps(req,indent=2)+'\n')
EOF
fi
A=$(tr -d '\n' < attempt.txt)
cd "$REPO"
python3 -I -B -S infra/product-preview/image-build-source.py verify --request "$O/request.json" --archive "$O/product-source.zip" --manifest "$O/product-source-members.json"
node --input-type=module - "$O/request.json" "$O/product-buildspec.json" <<'NODE'
import {readFileSync, writeFileSync} from 'node:fs';
import {createProductImageBuildRecipe} from './infra/product-preview/image-build-recipe.mjs';
const recipe=createProductImageBuildRecipe(JSON.parse(readFileSync(process.argv[2],'utf8')));
writeFileSync(process.argv[3], recipe.buildspecJson, {flag:'wx'});
console.log(JSON.stringify({buildspecSha256:recipe.buildspecSha256, requestSha256:recipe.requestSha256}));
NODE
node docs/handover/20261017/fable-shipping/scripts/check-product-buildspec.mjs "$O/request.json"
cd "$O"
aws "${P[@]}" ecr describe-images --repository-name meri-greenfield/qualification-worker --image-ids "imageTag=product-$C-$A" >/dev/null 2>&1 && { echo TAG_EXISTS; exit 3; }
active=$(aws "${P[@]}" codebuild list-builds-for-project --project-name meri-greenfield-qualification-build --max-items 3 --query 'ids' --output text | head -1)
aws "${P[@]}" codebuild batch-get-builds --ids $active --query 'builds[?buildComplete==`false`].id' --output text | grep -q . && { echo ACTIVE_BUILD; exit 3; }
python3 - "$A" "$C" "$B" <<'EOF'
import json,sys
a,C,B=sys.argv[1:]
req={"projectName":"meri-greenfield-qualification-build","sourceTypeOverride":"S3","sourceLocationOverride":f"{B}/inputs/product-runtime/{C}/product-source.zip","sourceVersion":json.load(open('put-product-source.zip.json'))['VersionId'],"buildspecOverride":open('product-buildspec.json').read(),"idempotencyToken":a,"timeoutInMinutesOverride":30,"queuedTimeoutInMinutesOverride":5,"autoRetryLimitOverride":0,"artifactsOverride":{"type":"S3","location":B,"path":f"results/product-image/{C}/{a}","name":"/","namespaceType":"NONE","packaging":"NONE","encryptionDisabled":False}}
open('start-build.request.json','x').write(json.dumps(req))
open('intent-start.json','x').write(json.dumps({"attempt":a,"intent":"start-once"}))
EOF
aws "${P[@]}" codebuild start-build --cli-input-json file://start-build.request.json --query 'build.{id:id,status:buildStatus,src:sourceVersion,retry:autoRetryConfig}' --output json | tee start-build.result.json
