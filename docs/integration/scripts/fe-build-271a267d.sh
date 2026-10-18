#!/usr/bin/env bash
# Frontend preview image build for the #92 integration head 271a267da93aa952a89b208d1f42eed0ffb080c2 (contracts 0.1.10).
# tree-equivalent git archive + source-commit.txt (verified), exact-version S3 upload, ONE CodeBuild start.
set -euo pipefail
export AWS_PAGER='' MSYS_NO_PATHCONV=1 AWS_PROFILE=capiro-dev AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1
R=C:/dev/main/fable-lanes/frontend-integration
O=C:/dev/fable/frontend-meri-wire/build
C=271a267da93aa952a89b208d1f42eed0ffb080c2
T=5fe8d2217044090a5bd0653a3e5e88daecf8fce8
B=capiro-portfolio-preview-source-967807252336-us-east-1
Z=C:/dev/fable/frontend-meri-wire/portfolio-source-$C.zip
cd "$R"
test "$(git rev-parse HEAD)" = "$C"; test "$(git rev-parse HEAD^{tree})" = "$T"
test "$(git ls-remote origin refs/heads/fable/frontend-integration-20261018 | cut -f1)" = "$C"
rm -f "$Z"
git -c core.autocrlf=false archive --format=zip -o "$Z" HEAD
python3 scripts/verify-preview-archive.py "$Z" "$R" HEAD "$C" "$T" > "$O/verify-archive-$C.json"
cat "$O/verify-archive-$C.json" | head -c 600; echo
b64=$(python3 -c "import hashlib,base64,sys;print(base64.b64encode(hashlib.sha256(open(sys.argv[1],'rb').read()).digest()).decode())" "$Z")
aws s3api put-object --bucket $B --key inputs/portfolio-source.zip --body "$Z" --checksum-algorithm SHA256 --checksum-sha256 "$b64" --output json > "$O/put-object-$C.json"
V=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['VersionId'])" "$O/put-object-$C.json")
aws s3api head-object --bucket $B --key inputs/portfolio-source.zip --version-id "$V" --checksum-mode ENABLED --output json > "$O/head-object-$C.json"
python3 - "$Z" "$V" "$b64" "$O/head-object-$C.json" <<'EOF'
import json,sys,os
z,v,b64,h=sys.argv[1:];d=json.load(open(h))
assert d['VersionId']==v and d['ContentLength']==os.path.getsize(z) and d['ChecksumSHA256']==b64,'HEAD_MISMATCH'
print(json.dumps({'s3Version':v,'bytes':d['ContentLength'],'sha256b64':b64}))
EOF
test -f "$O/$C.buildspec.yml"
python3 - "$O/start-build-4.template.json" "$O/$C.buildspec.yml" "$V" "$C" "$O/start-build-8.json" <<'EOF'
import json,sys
tpl,spec,v,c,out=sys.argv[1:]
t=json.load(open(tpl,encoding='utf-8'))
t['buildspecOverride']=open(spec,encoding='utf-8').read()
t['sourceVersion']=v
for e in t['environmentVariablesOverride']:
    if e['name']=='EXPECTED_S3_VERSION': e['value']=v
    if e['name']=='EXPECTED_SHA': e['value']=c
t['idempotencyToken']='fe-'+c[:8]+'-'+v[:8]+'-20261018e'
json.dump(t,open(out,'w',encoding='utf-8'),indent=1)
print('start-build-8.json ready')
EOF
aws codebuild start-build --cli-input-json "file://$O/start-build-8.json" --output json > "$O/start-build-8-result.json"
python3 -c "import json,sys;b=json.load(open(sys.argv[1]))['build'];print(json.dumps({'id':b['id'],'status':b['buildStatus'],'sourceVersion':b.get('sourceVersion')}))" "$O/start-build-8-result.json"
