#!/usr/bin/env bash
# MUTATION (ecs register-task-definition). New revision = :2 with these changes only: the image digest,
# RELEASE_SHA, and DB_HOST/DATABASE_URL moved to the clone (O135). Verifies that after registering. The rendered task definition holds plain env values
# (DATABASE_URL and others), so the JSON files are deleted afterwards; only the ARN is kept.
set -euo pipefail
source "$(dirname "$0")/kit.env"
cd "$STATE"

digest="$(need image-digest)"
[ -s scan-gate.pass ] || stop "scan gate has not passed (run 03-scan-gate.sh)"
[ ! -s td-new-arn ] || stop "already registered: $(need td-new-arn)"
trap 'rm -f td-old.json td-new.json td-registered.json' EXIT

aws ecs describe-task-definition --task-definition "$ROLLBACK_TD" --query taskDefinition --output json > td-old.json
python - "$SOURCE_SHA" "$REGISTRY/$REPOSITORY@$digest" "$REGISTRY/$REPOSITORY@$ROLLBACK_DIGEST" "$ROLLBACK_SHA" "$CLONE_DB_HOST" <<'EOF'
import json, sys
sha, image, old_image, old_sha, clone_host = sys.argv[1:6]
td = json.load(open('td-old.json'))
for k in ('taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'compatibilities',
          'registeredAt', 'registeredBy', 'deregisteredAt'):
    td.pop(k, None)
(c,) = td['containerDefinitions']
assert c['name'] == 'core' and c['image'] == old_image, c['image']
c['image'] = image
(env,) = [e for e in c['environment'] if e['name'] == 'RELEASE_SHA']
assert env['value'] == old_sha, env['value']
env['value'] = sha
# O135: point Core at the copy-on-write clone instead of the shared live cluster.
# The rollback revision already serves the clone; only the image and RELEASE_SHA change.
(host,) = [e for e in c['environment'] if e['name'] == 'DB_HOST']
assert host['value'] == clone_host, host['value']
json.dump(td, open('td-new.json', 'w'))
EOF
arn="$(awst ecs register-task-definition --cli-input-json file://td-new.json --query taskDefinition.taskDefinitionArn)"
printf '%s\n' "$arn" > td-new-arn

aws ecs describe-task-definition --task-definition "$arn" --query taskDefinition --output json > td-registered.json
python - <<'EOF'
import json
# Identity and ECS-derived fields; every input field must match :2 exactly.
volatile = {'taskDefinitionArn', 'revision', 'registeredAt', 'registeredBy', 'status', 'deregisteredAt',
            'requiresAttributes', 'compatibilities'}
old = {k: v for k, v in json.load(open('td-old.json')).items() if k not in volatile}
new = {k: v for k, v in json.load(open('td-registered.json')).items() if k not in volatile}
oc, nc = old.pop('containerDefinitions')[0], new.pop('containerDefinitions')[0]
assert old == new, 'task-level fields differ'
diff = sorted(k for k in set(oc) | set(nc) if oc.get(k) != nc.get(k))
assert diff == ['environment', 'image'], diff
oe = {e['name']: e['value'] for e in oc['environment']}
ne = {e['name']: e['value'] for e in nc['environment']}
assert sorted(k for k in set(oe) | set(ne) if oe.get(k) != ne.get(k)) == ['RELEASE_SHA']
print('TD_DIFF_OK image + RELEASE_SHA')
EOF
echo "REGISTERED $arn"
