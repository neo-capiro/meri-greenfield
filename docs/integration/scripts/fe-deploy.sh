#!/usr/bin/env bash
# Wait for a frontend preview CodeBuild, require a clean ECR scan, then deploy it as the next preview task-def revision
# through the reviewed template (only ImageUri changes vs the previous parameter file).
# Usage: fe-deploy.sh <build-id> <commit> <prev-params.json> <new-params.json> <change-set-name>
set -euo pipefail
export AWS_PAGER='' MSYS_NO_PATHCONV=1 AWS_PROFILE=capiro-dev AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1
B="$1"; C="$2"; PREV="$3"; NEW="$4"; CS="$5"
D=C:/dev/fable/frontend-meri-wire
cd "$D"
while :; do
  ST=$(aws codebuild batch-get-builds --ids "$B" --query 'builds[0].buildStatus' --output text)
  [ "$ST" = IN_PROGRESS ] || break; sleep 20
done
echo "build $ST"
[ "$ST" = SUCCEEDED ] || { aws codebuild batch-get-builds --ids "$B" --query 'builds[0].phases[?phaseStatus!=`SUCCEEDED`].[phaseType,phaseStatus,contexts[0].message]' --output text | cut -c1-600; exit 1; }
DIG=$(aws ecr describe-images --repository-name capiro/portfolio-preview --image-ids imageTag=$C --query 'imageDetails[0].imageDigest' --output text)
echo "digest $DIG"
for i in $(seq 1 60); do
  SC=$(aws ecr describe-image-scan-findings --repository-name capiro/portfolio-preview --image-id imageDigest=$DIG --query 'imageScanStatus.status' --output text 2>/dev/null || echo PENDING)
  [ "$SC" = COMPLETE ] && break; sleep 10
done
F=$(aws ecr describe-image-scan-findings --repository-name capiro/portfolio-preview --image-id imageDigest=$DIG --query 'length(imageScanFindings.findings||`[]`)' --output text)
echo "scan $SC findings $F"
[ "$SC" = COMPLETE ] && [ "$F" = "0" ] || { echo "scan not clean"; exit 1; }
python3 - "$PREV" "$NEW" "$DIG" <<'EOF'
import json,sys
prev,new,dig=sys.argv[1:]
p=json.load(open(prev,encoding='utf-8'))
n=0
for e in p:
    if e['ParameterKey']=='ImageUri': e['ParameterValue']=e['ParameterValue'].split('@')[0]+'@'+dig; n+=1
assert n==1
json.dump(p,open(new,'w',encoding='utf-8'),indent=2)
EOF
diff <(python3 -m json.tool "$PREV") <(python3 -m json.tool "$NEW") || true
aws cloudformation create-change-set --stack-name Capiro-Portfolio-Preview-Service --change-set-name "$CS" --change-set-type UPDATE \
  --template-body file://REVIEWED_PREVIEW_TEMPLATE.yml --parameters "file://$NEW" --capabilities CAPABILITY_IAM \
  --description "Meri preview image $C (Fable)" --query Id --output text
aws cloudformation wait change-set-create-complete --stack-name Capiro-Portfolio-Preview-Service --change-set-name "$CS"
aws cloudformation describe-change-set --stack-name Capiro-Portfolio-Preview-Service --change-set-name "$CS" --output json > "change-set-describe-${C:0:8}.json"
python3 -c "
import json,sys;d=json.load(open(sys.argv[1]));print(d['Status']);[print(c['ResourceChange']['Action'],c['ResourceChange']['LogicalResourceId'],c['ResourceChange'].get('Replacement')) for c in d['Changes']]
assert len(d['Changes'])==2 and {c['ResourceChange']['LogicalResourceId'] for c in d['Changes']}=={'PreviewTaskDefinition','PreviewService'}" "change-set-describe-${C:0:8}.json"
aws cloudformation execute-change-set --stack-name Capiro-Portfolio-Preview-Service --change-set-name "$CS"
aws cloudformation wait stack-update-complete --stack-name Capiro-Portfolio-Preview-Service && echo "stack UPDATE_COMPLETE"
aws ecs wait services-stable --cluster capiro-portfolio-preview --services capiro-portfolio-preview && echo "service stable"
TD=$(aws ecs describe-services --cluster capiro-portfolio-preview --services capiro-portfolio-preview --query 'services[0].taskDefinition' --output text)
echo "${TD##*/}"; aws ecs describe-task-definition --task-definition "$TD" --query 'taskDefinition.containerDefinitions[0].image' --output text
