#!/usr/bin/env bash
# MUTATION (O145). Before 16: C12's 0020 is the last entry of the `integration` stage; live ledger = ordinals 1-22 only.
# 1) Aurora snapshot  2) d2-migrate revision = :7 with this release's image only  3) run stage `integration`
# 4) read back: the task exits 0 and the log shows every integration entry applied, ending with 0020.
# Rollback: restore from the snapshot (the integration objects are new and Meri-owned; nothing existing changes).
set -euo pipefail
export AWS_PROFILE=capiro-dev AWS_REGION=us-east-1 MSYS_NO_PATHCONV=1
cd "$(dirname "$0")"
CLUSTER_DB=capiro-dev-data-auroracluster23d869c0-ltmz40k47ewv
SNAP=meri-pre-integration-c12-20261021
IMAGE=967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:5164a6e00508c74f68ee5753d10c99b3275d70573bcff878a126458e9c9f17f4
mkdir -p migrate-integration

if ! aws rds describe-db-cluster-snapshots --db-cluster-snapshot-identifier $SNAP >/dev/null 2>&1; then
  aws rds create-db-cluster-snapshot --db-cluster-identifier $CLUSTER_DB --db-cluster-snapshot-identifier $SNAP \
    --tags Key=Purpose,Value=meri-integration-stage --query 'DBClusterSnapshot.Status' --output text
fi
aws rds wait db-cluster-snapshot-available --db-cluster-snapshot-identifier $SNAP
echo "SNAPSHOT_AVAILABLE $SNAP"

if [ ! -s migrate-integration/td-arn ]; then
  aws ecs describe-task-definition --task-definition meri-product-preview-d2-migrate:7 --query taskDefinition --output json > migrate-integration/td7.json
  python - "$IMAGE" <<'EOF'
import json, sys
td = json.load(open('migrate-integration/td7.json'))
for k in ('taskDefinitionArn','revision','status','requiresAttributes','compatibilities','registeredAt','registeredBy','deregisteredAt'):
    td.pop(k, None)
(c,) = td['containerDefinitions']
assert c['name'] == 'd2-migrate'
c['image'] = sys.argv[1]
json.dump(td, open('migrate-integration/td-new.json', 'w'))
EOF
  aws ecs register-task-definition --cli-input-json file://migrate-integration/td-new.json \
    --query taskDefinition.taskDefinitionArn --output text | tr -d '\r' > migrate-integration/td-arn
  rm -f migrate-integration/td7.json migrate-integration/td-new.json
fi
TD=$(cat migrate-integration/td-arn); echo "migrate TD $TD"

NET=$(aws ecs describe-services --cluster capiro-dev --services meri-product-preview-control --query 'services[0].networkConfiguration' --output json | tr -d '\r\n ')
T=$(aws ecs run-task --cluster capiro-dev --launch-type FARGATE --task-definition "$TD" --network-configuration "$NET" \
  --overrides '{"containerOverrides":[{"name":"d2-migrate","environment":[{"name":"MERI_D2_STAGE","value":"integration"}]}]}' \
  --started-by fable-integration-c12 --query 'tasks[0].taskArn' --output text | tr -d '\r')
echo "task $T"; echo "$T" > migrate-integration/task-arn
aws ecs wait tasks-stopped --cluster capiro-dev --tasks "$T" || true
read -r code reason < <(aws ecs describe-tasks --cluster capiro-dev --tasks "$T" --query 'tasks[0].[containers[0].exitCode,stoppedReason]' --output text | tr -d '\r')
LG=$(aws ecs describe-task-definition --task-definition "$TD" --query 'taskDefinition.containerDefinitions[0].logConfiguration.options' --output json)
G=$(echo "$LG" | python -c 'import json,sys;print(json.load(sys.stdin)["awslogs-group"])'); P=$(echo "$LG" | python -c 'import json,sys;print(json.load(sys.stdin)["awslogs-stream-prefix"])')
aws logs filter-log-events --log-group-name "$G" --log-stream-name-prefix "$P/d2-migrate/${T##*/}" --query 'events[].message' --output text \
  | tr '\t' '\n' > migrate-integration/log.txt
grep -o '"event":"[a-z]*"[^}]*' migrate-integration/log.txt | cut -c1-160
[ "$code" = 0 ] || { echo "STOP: integration migrate exited $code ($reason)"; exit 1; }
grep -q '0020_initial_generations.sql' migrate-integration/log.txt || { echo "STOP: 0020 not in the applied log"; exit 1; }
echo "INTEGRATION_STAGE_OK"
