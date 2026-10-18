#!/usr/bin/env bash
# N21 G3 Linux verification: measure the image without a profile (embedded override) and with the proposed preview
# capability profile (--shipped). Build + measurement only; nothing is deployed or activated.
set -euo pipefail
export AWS_PAGER='' MSYS_NO_PATHCONV=1 AWS_PROFILE=capiro-dev AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1
S=C:/Users/neoma/AppData/Local/Temp/claude/C--Users-neoma-OneDrive-Documents-Claude/b81da8ea-2099-4b5e-98f7-0b59fee31c83/scratchpad
bash $S/measure-candidate.sh "$1" "$2" $S/n21-receipt-noprofile.json
TD=$(aws ecs list-task-definitions --family-prefix meri-product-preview-d2-migrate --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text | head -1)
echo "profile run on ${TD##*/}"
T=$(aws ecs run-task --cluster capiro-dev --launch-type FARGATE --platform-version 1.4.0 --task-definition "$TD" --network-configuration 'awsvpcConfiguration={subnets=[subnet-0920665f91c905f01],securityGroups=[sg-0c9f0505c552ce469,sg-0d5b5286baf28242e],assignPublicIp=DISABLED}' --overrides "file://$S/measure-overrides-profile.json" --query 'tasks[0].taskArn' --output text)
echo "task ${T##*/}"; aws ecs wait tasks-stopped --cluster capiro-dev --tasks "$T"
aws ecs describe-tasks --cluster capiro-dev --tasks "$T" --query 'tasks[0].containers[0].[exitCode,reason]' --output text
aws logs get-log-events --log-group-name /meri/product-preview/migrator --log-stream-name "d2/d2-migrate/${T##*/}" --query 'events[].message' --output text | tr '\t' '\n' > "$S/measure-log-profile.txt"
grep -m1 '^{"schema":"meri.first-chat-launch-measurement' "$S/measure-log-profile.txt" > $S/n21-receipt-profile.json || { echo "no profile receipt"; head -c 2500 "$S/measure-log-profile.txt"; exit 1; }
python3 -c "import json,sys;r=json.load(open(sys.argv[1]));print('profile receipt',r['schema'],'gates',r.get('gates'),'invariant',r.get('launchTemplateRunInvariant'),'sdk',r['sdkOptions']['sha256'][:12])" $S/n21-receipt-profile.json
