#!/usr/bin/env bash
# Re-run the launch measurement on an already-registered migrator revision (same image) after a policy/allocation change.
# Usage: remeasure.sh <task-def family:rev> <out-receipt.json>
set -euo pipefail
export AWS_PAGER='' MSYS_NO_PATHCONV=1 AWS_PROFILE=capiro-dev AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1
TD="$1"; OUT="$2"
S=C:/Users/neoma/AppData/Local/Temp/claude/C--Users-neoma-OneDrive-Documents-Claude/b81da8ea-2099-4b5e-98f7-0b59fee31c83/scratchpad
R=C:/dev/fable/wt-meri-integration
(cd "$R" && node infra/product-preview/first-chat/runtime-values.mjs measurement-override --shipped) > "$S/measure-overrides.json"
T=$(aws ecs run-task --cluster capiro-dev --launch-type FARGATE --platform-version 1.4.0 --task-definition "$TD" --network-configuration 'awsvpcConfiguration={subnets=[subnet-0920665f91c905f01],securityGroups=[sg-0c9f0505c552ce469,sg-0d5b5286baf28242e],assignPublicIp=DISABLED}' --overrides "file://$S/measure-overrides.json" --query 'tasks[0].taskArn' --output text)
echo "task ${T##*/}"; aws ecs wait tasks-stopped --cluster capiro-dev --tasks "$T"
aws ecs describe-tasks --cluster capiro-dev --tasks "$T" --query 'tasks[0].containers[0].[exitCode,reason]' --output text
aws logs get-log-events --log-group-name /meri/product-preview/migrator --log-stream-name "d2/d2-migrate/${T##*/}" --query 'events[].message' --output text | tr '\t' '\n' > "$S/measure-log.txt"
grep -m1 '^{"schema":"meri.first-chat-launch-measurement' "$S/measure-log.txt" > "$OUT" || { echo "no receipt"; head -c 1500 "$S/measure-log.txt"; exit 1; }
python3 -c "import json,sys;r=json.load(open(sys.argv[1]));print('receipt',r['schema'],'skills',str(r.get('skills'))[:120],'sdkOptions',str(r.get('sdkOptions'))[:160])" "$OUT"
