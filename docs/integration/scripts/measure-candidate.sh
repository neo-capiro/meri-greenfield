#!/usr/bin/env bash
# Integrated-candidate launch measurement (D015 #4a re-pin): wait for the qualification build, register a migrator
# (d2-migrate) task-definition revision on the new image, run the repository's measurement override there, and save the
# receipt JSON. No credentials are read or printed; the measurement makes no network or AWS calls inside the task.
# Usage: measure-candidate.sh <build-id> <commit> <out-receipt.json>
set -euo pipefail
export AWS_PAGER='' MSYS_NO_PATHCONV=1 AWS_PROFILE=capiro-dev AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1
B="$1"; C="$2"; OUT="$3"
S=C:/Users/neoma/AppData/Local/Temp/claude/C--Users-neoma-OneDrive-Documents-Claude/b81da8ea-2099-4b5e-98f7-0b59fee31c83/scratchpad
R=C:/dev/fable/wt-meri-integration
while :; do ST=$(aws codebuild batch-get-builds --ids "$B" --query 'builds[0].buildStatus' --output text); [ "$ST" = IN_PROGRESS ] || break; sleep 20; done
echo "build $ST"; [ "$ST" = SUCCEEDED ] || exit 1
DIG=$(aws ecr describe-images --repository-name meri-greenfield/qualification-worker --query "sort_by(imageDetails[?imageTags && contains(join(',',imageTags),'product-$C')],&imagePushedAt)[-1].imageDigest" --output text)
echo "image $DIG"; [ "${DIG#sha256:}" != "$DIG" ] || exit 1
for i in $(seq 1 60); do SC=$(aws ecr describe-image-scan-findings --repository-name meri-greenfield/qualification-worker --image-id imageDigest=$DIG --query 'imageScanStatus.status' --output text 2>/dev/null || echo PENDING); [ "$SC" = COMPLETE ] && break; sleep 10; done
N=$(aws ecr describe-image-scan-findings --repository-name meri-greenfield/qualification-worker --image-id imageDigest=$DIG --query 'length(imageScanFindings.findings||`[]`)' --output text); echo "scan $SC findings $N"; [ "$SC" = COMPLETE ] && [ "$N" = 0 ] || exit 1
aws ecs describe-task-definition --task-definition meri-product-preview-d2-migrate:3 --query taskDefinition --output json > "$S/d2-migrate-3.json"
python3 - "$S/d2-migrate-3.json" "$S/d2-migrate-measure.json" "967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@$DIG" <<'EOF'
import json,sys
src,dst,image=sys.argv[1:]
t=json.load(open(src))
keep=['family','taskRoleArn','executionRoleArn','networkMode','containerDefinitions','volumes','placementConstraints','requiresCompatibilities','cpu','memory','runtimePlatform','ephemeralStorage']
d={k:t[k] for k in keep if k in t and t[k] is not None}
assert len(d['containerDefinitions'])==1 and d['containerDefinitions'][0]['name']=='d2-migrate'
d['containerDefinitions'][0]['image']=image
json.dump(d,open(dst,'w'))
EOF
TD=$(aws ecs register-task-definition --cli-input-json "file://$S/d2-migrate-measure.json" --query 'taskDefinition.taskDefinitionArn' --output text); echo "registered ${TD##*/}"
(cd "$R" && node infra/product-preview/first-chat/runtime-values.mjs measurement-override --shipped) > "$S/measure-overrides.json"
T=$(aws ecs run-task --cluster capiro-dev --launch-type FARGATE --platform-version 1.4.0 --task-definition "$TD" --network-configuration 'awsvpcConfiguration={subnets=[subnet-0920665f91c905f01],securityGroups=[sg-0c9f0505c552ce469,sg-0d5b5286baf28242e],assignPublicIp=DISABLED}' --overrides "file://$S/measure-overrides.json" --query 'tasks[0].taskArn' --output text)
echo "task ${T##*/}"; aws ecs wait tasks-stopped --cluster capiro-dev --tasks "$T"
aws ecs describe-tasks --cluster capiro-dev --tasks "$T" --query 'tasks[0].containers[0].[exitCode,reason]' --output text
aws logs get-log-events --log-group-name /meri/product-preview/migrator --log-stream-name "d2/d2-migrate/${T##*/}" --query 'events[].message' --output text | tr '\t' '\n' > "$S/measure-log.txt"
grep -m1 '^{"schema":"meri.first-chat-launch-measurement' "$S/measure-log.txt" > "$OUT" || { echo "no receipt"; head -c 1500 "$S/measure-log.txt"; exit 1; }
python3 -c "import json,sys;r=json.load(open(sys.argv[1]));print('receipt',r['schema'],'skills',str(r.get('skills'))[:120],'sdkOptions',str(r.get('sdkOptions'))[:160])" "$OUT"
