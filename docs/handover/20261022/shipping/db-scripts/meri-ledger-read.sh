#!/usr/bin/env bash
# READ-ONLY: list meri_migration_ledger.applied on the live capiro DB via a d2-migrate:7 command override.
set -euo pipefail
export AWS_PROFILE=capiro-dev AWS_REGION=us-east-1 MSYS_NO_PATHCONV=1
JS='const {createRequire}=require("node:module");const r=createRequire(process.cwd()+"/infra/product-preview/first-chat-migrate.mjs");const {Client}=r("pg");const fs=require("fs");(async()=>{const c=new Client({ssl:{ca:fs.readFileSync("/run/meri/rds-ca.pem","utf8")}});await c.connect();await c.query("BEGIN READ ONLY");const q=await c.query("SELECT * FROM meri_migration_ledger.applied ORDER BY 1");console.log("LEDGER_COLS",q.fields.map(f=>f.name).join(","));for(const row of q.rows)console.log("LEDGER",JSON.stringify(row));console.log("LEDGER_COUNT",q.rows.length);await c.query("ROLLBACK");await c.end();})().catch(e=>{console.log("LEDGER_ERR",e.message);process.exit(1)})'
CMD="set -euo pipefail; umask 077; printf '%s' \"\$MERI_D2_RDS_CA_PEM\" > /run/meri/rds-ca.pem; unset MERI_D2_RDS_CA_PEM; exec node -e '$JS'"
OV=$(python -c 'import json,sys;print(json.dumps({"containerOverrides":[{"name":"d2-migrate","command":[sys.argv[1]]}]}))' "$CMD")
NET=$(aws ecs describe-services --cluster capiro-dev --services meri-product-preview-control --query 'services[0].networkConfiguration' --output json | tr -d '\r\n ')
T=$(aws ecs run-task --cluster capiro-dev --launch-type FARGATE --task-definition meri-product-preview-d2-migrate:7 --network-configuration "$NET" --overrides "$OV" --started-by fable-ledger-read --query 'tasks[0].taskArn' --output text | tr -d '\r')
echo "task $T"; aws ecs wait tasks-stopped --cluster capiro-dev --tasks "$T" || true
aws ecs describe-tasks --cluster capiro-dev --tasks "$T" --query 'tasks[0].[containers[0].exitCode,stoppedReason]' --output text
LG=$(aws ecs describe-task-definition --task-definition meri-product-preview-d2-migrate:7 --query 'taskDefinition.containerDefinitions[0].logConfiguration.options' --output json)
G=$(echo "$LG" | python -c 'import json,sys;print(json.load(sys.stdin)["awslogs-group"])'); P=$(echo "$LG" | python -c 'import json,sys;print(json.load(sys.stdin)["awslogs-stream-prefix"])')
aws logs filter-log-events --log-group-name "$G" --log-stream-name-prefix "$P/d2-migrate/${T##*/}" --query 'events[].message' --output text | tr '\t' '\n' | grep -o 'LEDGER.*' | cut -c1-220
