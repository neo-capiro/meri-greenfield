#!/usr/bin/env bash
# MUTATION (ecs register-task-definition + run-task; schema change on the CLONE only — O135, O140).
# Live migrations run as the Aurora master user (capiro-dev-api-*-migrate). The clone inherits that login,
# so this registers a one-off family `capiro-preview-core-clone-migrate`: the new Core image, Core's env
# (DB_HOST = clone), master DB_USER/DB_PASSWORD (from admin-migrate), the scoped role capiro-preview-core-clone-migrate-exec
# (ECR pull + logs + read of the master secret only) and Core's log group.
# It runs the image's `migrate` verb (prisma migrate deploy; never edits the ledger). After 04, before 05.
set -euo pipefail
export PYTHONUTF8=1 PYTHONIOENCODING=utf-8
source "$(dirname "$0")/kit.env"
cd "$STATE"

arn="$(need td-new-arn)"
[ ! -s migrate-clone.pass ] || stop "already migrated: $(cat migrate-clone.pass)"
trap 'rm -f core-td.json admin-td.json migrate-td.json' EXIT
aws ecs describe-task-definition --task-definition "$arn" --query taskDefinition --output json > core-td.json
aws ecs describe-task-definition --task-definition capiro-dev-api-admin-migrate --query taskDefinition --output json > admin-td.json
python - "$CLONE_DB_HOST" <<'EOF'
import json, sys
clone = sys.argv[1]
core, admin = json.load(open('core-td.json')), json.load(open('admin-td.json'))
(c,), (a,) = core['containerDefinitions'], admin['containerDefinitions']
env = {e['name']: e['value'] for e in c['environment']}
assert env['DB_HOST'] == clone, env['DB_HOST']
master = {s['name']: s['valueFrom'] for s in a['secrets']}
assert '/capiro/dev/aurora/master' in master['DB_USER'] and '/capiro/dev/aurora/master' in master['DB_PASSWORD']
td = {
  'family': 'capiro-preview-core-clone-migrate',
  'executionRoleArn': 'arn:aws:iam::967807252336:role/capiro-preview-core-clone-migrate-exec',
  'networkMode': 'awsvpc', 'requiresCompatibilities': ['FARGATE'],
  'cpu': core['cpu'], 'memory': core['memory'],
  'runtimePlatform': core.get('runtimePlatform', {'cpuArchitecture': 'X86_64', 'operatingSystemFamily': 'LINUX'}),
  'containerDefinitions': [{
    'name': 'core', 'image': c['image'], 'essential': True, 'command': ['migrate'],
    'environment': [{'name': k, 'value': env[k]} for k in ('DB_HOST', 'DB_PORT', 'DB_NAME', 'NODE_ENV') if k in env],
    'secrets': [{'name': 'DB_USER', 'valueFrom': master['DB_USER']}, {'name': 'DB_PASSWORD', 'valueFrom': master['DB_PASSWORD']}],
    'logConfiguration': c['logConfiguration'],
  }],
}
json.dump(td, open('migrate-td.json', 'w'))
print('migrate TD: image', c['image'].split('@')[-1][:19], 'host', clone)
EOF
mtd="$(awst ecs register-task-definition --cli-input-json file://migrate-td.json --query taskDefinition.taskDefinitionArn)"
echo "registered $mtd"
lg="$CORE_LOG_GROUP" pfx=core

net="$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" --query 'services[0].networkConfiguration' --output json | tr -d '\r\n ')"
task="$(awst ecs run-task --cluster "$CLUSTER" --launch-type FARGATE --task-definition "$mtd" \
  --network-configuration "$net" --started-by fable-migrate-clone --query 'tasks[0].taskArn')"
echo "migrate task: $task"
aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$task" || true
read -r code reason < <(awst ecs describe-tasks --cluster "$CLUSTER" --tasks "$task" \
  --query 'tasks[0].[containers[0].exitCode,stoppedReason]')
aws logs filter-log-events --log-group-name "$lg" --log-stream-name-prefix "$pfx/core/${task##*/}" \
  --query 'events[].message' --output text | tr '\t' '\n' | tail -40
[ "$code" = 0 ] || stop "migrate exited $code ($reason)"
printf '%s %s %s\n' "$task" "$mtd" "$(date -u +%FT%TZ)" > migrate-clone.pass
echo "MIGRATE_CLONE_OK"
