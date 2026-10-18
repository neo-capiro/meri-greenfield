#!/usr/bin/env bash
# Redeploy cycle (no image change): re-render, deploy the three stacks, rescale all roles, report control/worker/public.
# Usage: redeploy-cycle.sh <attempt-archive-name> [DIAG_HOTPATCH=1 is read by patch-startup-retry-v2 via env passthrough]
set -o pipefail
export AWS_PAGER='' MSYS_NO_PATHCONV=1 AWS_PROFILE=capiro-dev AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1
S=C:/Users/neoma/AppData/Local/Temp/claude/C--Users-neoma-OneDrive-Documents-Claude/b81da8ea-2099-4b5e-98f7-0b59fee31c83/scratchpad
W=C:/dev/fable/meri-stage3-20261017T182918Z
R=C:/dev/fable/meri-source
F=infra/product-preview/first-chat
ARCH=${1:-attemptX}
cd "$R" || exit 1
for s in meri-product-preview-control meri-product-preview-temporal-worker; do aws ecs update-service --cluster capiro-dev --service "$s" --desired-count 0 >/dev/null; done
mkdir -p "$W/$ARCH" && mv "$W/rendered" "$W/stage3" "$W/stage3.json" "$W/latest.tsv" "$W/secret-versions.tsv" "$W/$ARCH/" 2>/dev/null
: > "$W/latest.tsv"
for f in meri-product-preview-control meri-product-preview-temporal-worker meri-product-preview-temporal-issuer meri-product-preview-owner meri-product-preview-proxy meri-product-preview-runner; do
  for st in ACTIVE INACTIVE; do
    printf '%s\t%s\n' "$f" "$(aws ecs list-task-definitions --family-prefix "$f" --status $st --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text | head -1)" >> "$W/latest.tsv"
  done
done
node $F/stage3-deploy.mjs stage3-input --deployment-inputs $F/deployment-inputs.json --foundation-outputs $F/foundation-outputs.json --latest "$W/latest.tsv" --out "$W/stage3.json" > "$W/stage3-input.out" || { cat "$W/stage3-input.out"; exit 1; }
# The runner's task definition is unchanged on a redeploy without an image change: pin it to its current revision.
node -e "const fs=require('fs');const f='$W/stage3.json',s=JSON.parse(fs.readFileSync(f,'utf8'));const cur=fs.readFileSync('$W/latest.tsv','utf8').split(/\r?\n/).find(l=>l.startsWith('meri-product-preview-runner')&&l.includes('task-definition/'));s.taskDefinitions.runner=cur.split(String.fromCharCode(9))[1];fs.writeFileSync(f,JSON.stringify(s,null,1));console.log(JSON.stringify(s.taskDefinitions).replace(/arn:aws:ecs:us-east-1:967807252336:task-definition\/meri-product-preview-/g,''))"
node -e "const d=require('$R/$F/image-scans.json');require('fs').writeFileSync('$W/image-scans.json',JSON.stringify({proxy:d.proxy,nodeRuntime:d.nodeRuntime}))"
node $F/render-material.mjs --deployment-inputs $F/deployment-inputs.json --private C:/dev/fable/meri-preview-private-pki --core "$W/core.json" --runtime $F/runtime-values.json --stage3 "$W/stage3.json" --out "$W/rendered" > "$W/render.out" || { cat "$W/render.out"; exit 1; }
head -c 60 "$W/render.out"; echo
: > "$W/secret-versions.tsv"
while read -r role key; do
  arn=$(node -e 'const d=require(process.argv[1]);process.stdout.write(d.secrets[process.argv[2]])' "$R/$F/deployment-inputs.json" "$key")
  v=$(aws secretsmanager put-secret-value --secret-id "$arn" --secret-string "file://$W/rendered/$role/bundle.json" --query VersionId --output text) || exit 1
  printf '%s\t%s\n' "$role" "$v" >> "$W/secret-versions.tsv"
done <<'EOF'
control control/material
temporal-worker worker/material
temporal-issuer issuer/material
model-owner owner/material
model-proxy proxy/material
EOF
node $F/stage3-deploy.mjs bindings --deployment-inputs $F/deployment-inputs.json --foundation-outputs "$W/foundation-live.json" --private-edge-outputs "$W/private-edge-outputs.json" --rendered "$W/rendered" --secret-versions "$W/secret-versions.tsv" --image-scans "$W/image-scans.json" --out "$W/stage3" > "$W/bindings.out" || { cat "$W/bindings.out"; exit 1; }
node "$S/attach-public-tg.mjs" "$W/stage3" || exit 1
node "$S/patch-startup-retry-v2.mjs" "$W/stage3/app.template.json" || exit 1
: > "$W/changesets.txt"
for s in issuer model app; do
  caps=""; [ "$s" = model ] && caps="--capabilities CAPABILITY_IAM"
  aws cloudformation deploy --stack-name "meri-first-chat-$s" --template-file "$W/stage3/$s.template.json" $caps --no-execute-changeset > /dev/null 2>&1
  CS=$(aws cloudformation list-change-sets --stack-name "meri-first-chat-$s" --query 'reverse(sort_by(Summaries,&CreationTime))[0].ChangeSetId' --output text)
  echo "$s $CS" >> "$W/changesets.txt"
  printf '%s: ' "$s"; aws cloudformation describe-change-set --change-set-name "$CS" --query 'Changes[].ResourceChange.[LogicalResourceId]' --output text | tr '\n' ' '; echo
done
while read -r s cs; do aws cloudformation execute-change-set --change-set-name "$cs" || exit 1; done < "$W/changesets.txt"
for s in issuer model app; do aws cloudformation wait stack-update-complete --stack-name "meri-first-chat-$s"; echo "$s=$?"; done
for s in app model issuer; do aws cloudformation describe-stacks --stack-name "meri-first-chat-$s" --query 'Stacks[0].Outputs' > "$W/$s.outputs.json"; done
node $F/stage3-deploy.mjs verify-outputs --bindings "$W/stage3" --app "$W/app.outputs.json" --model "$W/model.outputs.json" --issuer "$W/issuer.outputs.json" | head -c 50; echo
for s in meri-product-preview-owner meri-product-preview-proxy; do aws ecs update-service --cluster capiro-dev --service "$s" --desired-count 1 >/dev/null; done
timeout 400 aws ecs wait services-stable --cluster capiro-dev --services meri-product-preview-owner meri-product-preview-proxy meri-product-preview-temporal-issuer; echo "model-issuer-stable=$?"
T0=$(( $(date +%s) * 1000 ))
aws ecs update-service --cluster capiro-dev --service meri-product-preview-control --desired-count 1 >/dev/null
for i in $(seq 1 40); do sleep 10; n=$(aws logs filter-log-events --log-group-name /meri/product-preview/control --start-time "$T0" --filter-pattern '?listening ?tree' --query 'length(events)' --output text); [ "$n" != "0" ] && break; done
echo "== control"; aws logs filter-log-events --log-group-name /meri/product-preview/control --start-time "$T0" --query 'events[].message' --output text | tr '\t' '\n' | grep -E 'step|listening|RUNTIME_|hotpatch' | cut -c1-600 | head -14
aws ecs update-service --cluster capiro-dev --service meri-product-preview-temporal-worker --desired-count 1 >/dev/null
for i in $(seq 1 30); do sleep 10; m=$(aws logs filter-log-events --log-group-name /meri/product-preview/worker --start-time "$T0" --filter-pattern '?listening ?tree' --query 'length(events)' --output text); [ "$m" != "0" ] && break; done
echo "== worker"; aws logs filter-log-events --log-group-name /meri/product-preview/worker --start-time "$T0" --query 'events[].message' --output text | tr '\t' '\n' | grep -E 'step|listening|RUNTIME_' | cut -c1-600 | head -8
sleep 45
for tg in meri-preview-control-8080/03297203fa59801c meri-preview-control-8082/1732509ee5fbf759; do
  printf '%s ' "${tg%%/*}"; aws elbv2 describe-target-health --target-group-arn "arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup/$tg" --query 'TargetHealthDescriptions[].[TargetHealth.State,TargetHealth.Reason]' --output text | tr '\n' ' '; echo
done
curl -sS -w ' public %{http_code}\n' --max-time 10 https://meri-preview.capiro.ai/health/live | tail -c 300
