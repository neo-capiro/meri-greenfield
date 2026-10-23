#!/usr/bin/env bash
# Manual repair: re-pairs the Meri model owner and proxy (decision O59). 16-execute-model now does this itself (O94);
# use this only when a pair goes bad outside a release.
# Both fix their pair identity on first read and retire on a different partner, and the rolling 200/100 update races
# the owner's ~3 min pair wait. So stop both, wait until neither family has a task, start both at the same moment,
# then wait until both run and the proxy has logged no gate=pair refusal for 75 s. Desired count returns to the
# template's 1, so no lasting drift. Same task-definition revisions: no render or pin changes.
set -euo pipefail
export AWS_PAGER='' MSYS_NO_PATHCONV=1
P=(--profile capiro-dev --region us-east-1)
C=(--cluster capiro-dev)
svc() { echo "meri-product-preview-$1"; }
for s in owner proxy; do aws ecs update-service "${P[@]}" "${C[@]}" --service "$(svc $s)" --desired-count 0 --query service.desiredCount --output text >/dev/null & done; wait
until [ "$(aws ecs list-tasks "${P[@]}" "${C[@]}" --family "$(svc owner)" --query 'length(taskArns)' --output text)" = 0 ] \
   && [ "$(aws ecs list-tasks "${P[@]}" "${C[@]}" --family "$(svc proxy)" --query 'length(taskArns)' --output text)" = 0 ]; do sleep 5; done
echo "both stopped $(date -u +%H:%M:%SZ)"
for s in owner proxy; do aws ecs update-service "${P[@]}" "${C[@]}" --service "$(svc $s)" --desired-count 1 --query service.desiredCount --output text >/dev/null & done; wait
echo "both started $(date -u +%H:%M:%SZ)"
until [ "$(aws ecs describe-services "${P[@]}" "${C[@]}" --services "$(svc owner)" "$(svc proxy)" --query 'length(services[?runningCount==`1`])' --output text)" = 2 ]; do sleep 5; done
START=$(date +%s); echo "both running $(date -u +%H:%M:%SZ)"
until [ $(( $(date +%s) - START )) -ge 75 ] \
   && [ "$(aws logs filter-log-events "${P[@]}" --log-group-name /meri/product-preview/proxy --start-time $(( ($(date +%s) - 75) * 1000 )) --filter-pattern '"gate=pair"' --query 'length(events)' --output text)" = 0 ] \
   && [ "$(aws logs filter-log-events "${P[@]}" --log-group-name /meri/product-preview/owner --start-time $(( ($(date +%s) - 75) * 1000 )) --filter-pattern UNAVAILABLE --query 'length(events)' --output text)" = 0 ]; do sleep 10; done
echo "PAIR_READY $(date -u +%H:%M:%SZ)"
