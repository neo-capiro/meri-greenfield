#!/usr/bin/env bash
# READ-ONLY: live shared DB Prisma ledger + clients.account_owner_version definition, for agent 4's cleanup.
# Uses capiro-dev-api-db-inspect:68 (entryPoint node -e; env DB_USER/DB_PASS/DB_HOST/DB_PORT/DB_NAME; Prisma client).
set -euo pipefail
export AWS_PROFILE=capiro-dev AWS_REGION=us-east-1 MSYS_NO_PATHCONV=1
TD=capiro-dev-api-db-inspect:68
read -r -d '' JS <<'EOF' || true
process.env.DATABASE_URL=`postgresql://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASS)}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?sslmode=require`;
const {PrismaClient}=require('/app/apps/api/node_modules/@prisma/client');const p=new PrismaClient();
const q=s=>p.$queryRawUnsafe(s);
(async()=>{
 const m=await q("SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back, applied_steps_count::int AS steps FROM _prisma_migrations ORDER BY migration_name, started_at");
 for(const r of m)console.log('MIG',r.migration_name,r.finished?'FINISHED':'NOT_FINISHED',r.rolled_back?'ROLLED_BACK':'-',r.steps);
 const col=await q("SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name LIKE 'account_owner%'");
 for(const r of col)console.log('COL',JSON.stringify(r));
 const con=await q("SELECT conname, pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conrelid='public.clients'::regclass AND conname LIKE '%account_owner%'");
 for(const r of con)console.log('CON',r.conname,r.d);
 const t=await q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('client_ordered_owners','client_activity_commands','client_objectives','prospect_contacts','user_portfolio_layouts','engagement_plans','client_objective_work_intents')");
 console.log('TABLES_PRESENT',t.map(r=>r.table_name).join(',')||'none');
 await p.$disconnect();
})().catch(e=>{console.log('ERR',e.message);process.exit(1)});
EOF
OV=$(python -c 'import json,sys;print(json.dumps({"containerOverrides":[{"name":"inspect","command":[sys.argv[1]]}]}))' "$JS")
NET=$(aws ecs describe-services --cluster capiro-dev --services capiro-preview-first-chat-core --query 'services[0].networkConfiguration' --output json | tr -d '\r\n ')
T=$(aws ecs run-task --cluster capiro-dev --launch-type FARGATE --task-definition $TD --network-configuration "$NET" --overrides "$OV" --started-by fable-core-ledger-read --query 'tasks[0].taskArn' --output text | tr -d '\r')
echo "task $T"; aws ecs wait tasks-stopped --cluster capiro-dev --tasks "$T" || true
aws ecs describe-tasks --cluster capiro-dev --tasks "$T" --query 'tasks[0].[containers[0].exitCode,stoppedReason]' --output text
aws logs filter-log-events --log-group-name /capiro/dev/api --log-stream-name-prefix "db-inspect-ba4a-baseline-before-1f669ea7/inspect/${T##*/}" --query 'events[].message' --output text | tr '\t' '\n' | grep -E '^(MIG|COL|CON|TABLES_PRESENT|ERR)'
