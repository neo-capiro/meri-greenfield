#!/usr/bin/env bash
# READ-ONLY. What Core is serving now: deployments, the running task's image digest, target health,
# recent Core log lines and target-group status codes. Prints SERVING_NEW, SERVING_ROLLBACK or a STOP.
set -euo pipefail
source "$(dirname "$0")/kit.env"
cd "$STATE"

new_digest="$([ -s image-digest ] && tr -d '\r\n' < image-digest || true)"
aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" \
  --query 'services[0].deployments[].[status,taskDefinition,rolloutState,desiredCount,runningCount]' --output table
tasks="$(awst ecs list-tasks --cluster "$CLUSTER" --service-name "$SERVICE" --desired-status RUNNING --query 'taskArns')"
[ -n "$tasks" ] || stop "no running Core task"
digests="$(awst ecs describe-tasks --cluster "$CLUSTER" --tasks $tasks --query 'tasks[].containers[?name==`core`].imageDigest[]' | tr '\t' '\n' | sort -u)"
echo "running digests: $digests"
aws elbv2 describe-target-health --target-group-arn "$TG_ARN" \
  --query 'TargetHealthDescriptions[].[Target.Id,TargetHealth.State,TargetHealth.Reason]' --output table

since="$([ -s roll-started-at ] && tr -d '\r\n' < roll-started-at || date -u -d '-15 min' +%FT%TZ)"
start_ms="$(( $(date -u -d "$since" +%s) * 1000 ))"
echo "--- Core log lines since $since matching error/exception/listen"
awst logs filter-log-events --log-group-name "$CORE_LOG_GROUP" --start-time "$start_ms" \
  --filter-pattern '?ERROR ?Error ?Exception ?listening ?"Nest application"' --query 'events[-20:].message' | tr '\t' '\n' | tail -20
tg_dim="${TG_ARN#*:targetgroup/}"
for m in HTTPCode_Target_2XX_Count HTTPCode_Target_4XX_Count HTTPCode_Target_5XX_Count; do
  sum="$(awst cloudwatch get-metric-statistics --namespace AWS/ApplicationELB --metric-name "$m" \
    --dimensions "Name=TargetGroup,Value=targetgroup/$tg_dim" "Name=LoadBalancer,Value=$(awst elbv2 describe-target-groups --target-group-arns "$TG_ARN" --query 'TargetGroups[0].LoadBalancerArns[0]' | sed 's#.*:loadbalancer/##')" \
    --start-time "$since" --end-time "$(date -u +%FT%TZ)" --period 60 --statistics Sum --query 'sum(Datapoints[].Sum)')"
  echo "$m since $since: ${sum:-0}"
done

if [ -n "$new_digest" ] && [ "$digests" = "$new_digest" ]; then echo SERVING_NEW
elif [ "$digests" = "$ROLLBACK_DIGEST" ]; then echo SERVING_ROLLBACK
else stop "mixed or unexpected digests (deployment still in progress?)"; fi
