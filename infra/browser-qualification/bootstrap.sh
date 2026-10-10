#!/bin/bash
# Codex owner completion of closed Hermes partial. PREPARATION ONLY.
# Original900s loader timer survives. No resets/install/fallback/worker credentials.
set -euo pipefail
umask 077
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
export AWS_MAX_ATTEMPTS=1 AWS_RETRY_MODE=standard AWS_PAGER=''
export AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null
HOST_DIR=/opt/meri-browser-host
EVIDENCE_DIR=/var/log/meri-browser-host
WORK_DIR=/workspace/browser-host
AUTH_DIR='' CONTROL_DIR='' CID='' OBSERVER_PID='' LOGIN_DONE=0 RUN_RC=255 EVIDENCE_CREATED=0 CONTROL_CREATED=0
SECONDS=0
BOOTSTRAP_DEADLINE=480
WORK_DEADLINE=420
IN_CLEANUP=0
remaining() {
  local deadline="$WORK_DEADLINE"
  [ "$IN_CLEANUP" = 0 ] || deadline=$((BOOTSTRAP_DEADLINE-4))
  local left=$((deadline-SECONDS))
  [ "$left" -gt 0 ] || return 124
  printf '%s' "$left"
}
bounded() {
  local budget="$1"; shift
  local left; left="$(remaining)" || return 124
  [ "$budget" -le "$left" ] || budget="$left"
  /usr/bin/timeout --signal=TERM --kill-after=2s "${budget}s" "$@"
}
join_observer() {
  local until=$((SECONDS+$1)) rc
  [ -n "$OBSERVER_PID" ] || return 0
  # Both are Bash builtins; wait runs ONLY after the child is observed gone.
  while kill -0 "$OBSERVER_PID" 2>/dev/null; do
    [ "$SECONDS" -lt "$until" ] || return 1
    bounded 1 sleep 0.1 || return 1
  done
  if wait "$OBSERVER_PID"; then rc=0; else rc=$?; fi
  OBSERVER_PID=''
  return "$rc"
}
cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  set +e
  IN_CLEANUP=1
  # Recover only our exclusive cidfile if create returned uncertainly.
  if [ "$EVIDENCE_CREATED" = 1 ] && [ -z "$CID" ] && [ -f "$EVIDENCE_DIR/browser.cid" ] && [ ! -L "$EVIDENCE_DIR/browser.cid" ]; then CID="$(<"$EVIDENCE_DIR/browser.cid")"; fi
  if [[ "$CID" =~ ^[0-9a-f]{64}$ ]]; then
    bounded 10 docker stop -t 3 "$CID" >/dev/null 2>&1
    bounded 5 docker rm "$CID" >/dev/null 2>&1
  fi
  if [ -n "$OBSERVER_PID" ]; then
    kill -TERM "$OBSERVER_PID" 2>/dev/null
    if ! join_observer 8; then
      if [ -n "$OBSERVER_PID" ]; then kill -KILL "$OBSERVER_PID" 2>/dev/null; join_observer 3; fi
    fi
  fi
  if [ -n "$AUTH_DIR" ] && [ -d "$AUTH_DIR" ] && [ ! -L "$AUTH_DIR" ]; then
    [ "$LOGIN_DONE" = 0 ] || bounded 5 docker --config "$AUTH_DIR" logout "${IMAGE%%/*}" >/dev/null 2>&1
    bounded 3 rm -f -- "$AUTH_DIR/config.json"
    bounded 3 rmdir -- "$AUTH_DIR"
  fi
  if [ "$CONTROL_CREATED" = 1 ]; then bounded 3 rmdir -- "$CONTROL_DIR" >/dev/null 2>&1; fi
  if [ "$EVIDENCE_CREATED" = 1 ] && [ -d "$EVIDENCE_DIR" ] && [ ! -L "$EVIDENCE_DIR" ]; then printf 'supervisor-exit=%s\n' "$rc" >>"$EVIDENCE_DIR/verdict.txt"; fi
  bounded 3 sync >/dev/null 2>&1
  /usr/bin/timeout --signal=KILL 2s /sbin/poweroff -f >/dev/null 2>&1 || true
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
RUN="${BROWSER_HOST_RUN:?run id required}"
IMAGE="${BROWSER_HOST_IMAGE:?worker image required}"
ASSETS="${BROWSER_HOST_ASSETS_IMAGE:?support image required}"
LOG_GROUP="${BROWSER_HOST_LOG_GROUP:?log group required}"
SECCOMP_SHA="${BROWSER_HOST_SECCOMP_SHA256:?profile hash required}"
REGION=us-east-1
CONTAINER_NAME="meri-browser-probe-$RUN"
OBSERVER="$HOST_DIR/host-evidence.py"
SECCOMP="$HOST_DIR/seccomp.json"
AUTH_DIR="/run/meri-browser-pull-$RUN"
CONTROL_DIR="/run/meri-browser-docker-$RUN"
TIMER_UNIT="meri-browser-assets-poweroff-$RUN"
STREAM="host-$RUN"
fail() { printf 'browser-host FAILED: %s\n' "$*" >&2; exit 1; }
[ "$EUID" -eq 0 ] && [ -x /sbin/poweroff ] && [ -x /usr/bin/timeout ] || fail 'root/poweroff/timeout required'
bounded 5 mkdir --mode=0700 -- "$EVIDENCE_DIR" || fail 'exclusive evidence directory unavailable'
EVIDENCE_CREATED=1
active="$(bounded 5 systemctl is-active "$TIMER_UNIT.timer")" || fail 'existing timer inactive'
target="$(bounded 5 systemctl show "$TIMER_UNIT.timer" --property=Unit --value)" || fail 'timer target unreadable'
next="$(bounded 5 systemctl show "$TIMER_UNIT.timer" --property=NextElapseUSecMonotonic --value)" || fail 'timer schedule unreadable'
[ "$active" = active ] && [ "$target" = "$TIMER_UNIT.service" ] || fail 'timer state/target mismatch'
[[ -n "$next" && "$next" != 0 && "$next" != n/a && "$next" != infinity ]] || fail 'timer next deadline missing'
bounded 5 python3 "$OBSERVER" --timer-state "$active" "$target" "$next" --run-id "$RUN" --out "$EVIDENCE_DIR/timer.json" >/dev/null || fail 'existing timer leaves insufficient bootstrap budget'
for command in python3 aws docker runc containerd ldconfig systemctl sha256sum chown; do command -v "$command" >/dev/null || fail 'prerequisite absent'; done
[ "$(bounded 5 sha256sum "$SECCOMP")" = "$SECCOMP_SHA  $SECCOMP" ] || fail 'profile hash mismatch'
bounded 5 python3 - "$HOST_DIR" "$WORK_DIR" <<'__PARENTS__'
import os,stat,sys
for path in ('/opt','/run','/var/log',sys.argv[1]):
 s=os.lstat(path);assert stat.S_ISDIR(s.st_mode) and s.st_uid==0 and not(s.st_mode&0o022),'unsafe host parent'
if os.path.lexists(sys.argv[2]):raise SystemExit('workspace already exists')
if os.path.lexists('/workspace'):
 s=os.lstat('/workspace');assert stat.S_ISDIR(s.st_mode) and s.st_uid==0 and not(s.st_mode&0o022),'unsafe workspace parent'
__PARENTS__
# Host Docker control uses an exclusive EMPTY config after pull credential purge.
# Worker receives only immutable image ENV; no host environment is passed.
for variable in ${!DOCKER_@}; do unset "$variable"; done
bounded 3 mkdir --mode=0700 -- "$CONTROL_DIR" || fail 'exclusive empty Docker control config unavailable'
CONTROL_CREATED=1
export DOCKER_CONFIG="$CONTROL_DIR"
version() {
  bounded 5 python3 "$OBSERVER" --parse-version "$1" "$2" --out "$EVIDENCE_DIR/version-$1.json" >/dev/null || fail 'version rejected'
}
version aws "$(bounded 10 aws --version 2>&1)"
version docker "$(bounded 10 docker version --format '{{.Server.Version}}')"
version runc "$(bounded 10 runc --version 2>&1)"
version containerd "$(bounded 10 containerd --version 2>&1)"
version libseccomp "$(bounded 10 ldconfig -p)"
bounded 5 python3 - "$EVIDENCE_DIR" <<'__VERSIONS__' >"$EVIDENCE_DIR/versions.json"
import json,os,sys
assert sys.version_info[:2]==(3,9), 'unreviewed guest Python major/minor'
out={}
for k in ('aws','docker','runc','containerd','libseccomp'):
 with open(os.path.join(sys.argv[1],'version-'+k+'.json')) as f:r=json.load(f)
 assert r['ok'] is True;out[k]=r['normalized']
print(json.dumps(out))
__VERSIONS__
bounded 20 python3 "$OBSERVER" --preflight-only --out "$EVIDENCE_DIR/preflight.json" >/dev/null || fail 'host preflight failed'
for unit in ecs ecs-volume-plugin amazon-ssm-agent snap.amazon-ssm-agent.amazon-ssm-agent.service sshd ssh; do
  [ "$(bounded 5 systemctl is-enabled "$unit" 2>/dev/null || true)" = masked ] || fail 'agent is not masked'
  state="$(bounded 5 systemctl is-active "$unit" 2>/dev/null || true)"
  [[ "$state" = inactive || "$state" = failed ]] || fail 'agent inactivity unconfirmed'
done
ready=0
for attempt in {1..10}; do
  if bounded 3 docker info >/dev/null 2>&1; then ready=1; break; fi
  bounded 1 sleep 0.5
done
[ "$ready" = 1 ] || fail 'Docker readiness unconfirmed'
bounded 5 mkdir --mode=0700 -- "$AUTH_DIR" || fail 'exclusive pull config unavailable'
bounded 25 aws ecr get-login-password --region "$REGION" --cli-connect-timeout 5 --cli-read-timeout 20 2>/dev/null |
  bounded 25 docker --config "$AUTH_DIR" login --username AWS --password-stdin "${IMAGE%%/*}" >/dev/null 2>&1 || fail 'scoped login failed'
LOGIN_DONE=1
bounded 100 docker --config "$AUTH_DIR" pull "$IMAGE" >/dev/null 2>&1 || fail 'immutable worker pull failed'
bounded 5 docker --config "$AUTH_DIR" logout "${IMAGE%%/*}" >/dev/null 2>&1 || fail 'logout failed'
bounded 3 rm -f -- "$AUTH_DIR/config.json"
bounded 3 rmdir -- "$AUTH_DIR" || fail 'credential purge failed'
LOGIN_DONE=0
[ ! -e "$AUTH_DIR" ] && [ ! -L "$AUTH_DIR" ] || fail 'pull credentials remain'
bounded 3 mkdir -p -- /workspace
bounded 3 mkdir --mode=0700 -- "$WORK_DIR"
bounded 3 mkdir --mode=0700 -- "$WORK_DIR/conversation" "$WORK_DIR/config" "$WORK_DIR/home"
bounded 5 chown -R 10001:10001 "$WORK_DIR" || fail 'fresh workspace ownership failed'
# One create and one attach/start; default private PID mode verified in inspect.
CID="$(bounded 15 docker create --pull never --name "$CONTAINER_NAME" --cidfile "$EVIDENCE_DIR/browser.cid" \
  --label "meri.qualification.run=$RUN" --user 10001:10001 \
  --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
  --security-opt "seccomp=$SECCOMP" --ipc private --restart=no --no-healthcheck \
  --pids-limit 512 --memory 4g --cpus 2 --shm-size 1g \
  --tmpfs /tmp:rw,noexec,nosuid,size=512m -v "$WORK_DIR":/workspace:rw \
  --log-driver local --log-opt max-size=4m --log-opt max-file=1 \
  --entrypoint node "$IMAGE" /opt/meri-worker/probes/browser.mjs)" || fail 'browser create failed'
[[ "$CID" =~ ^[0-9a-f]{64}$ ]] && [ "$(<"$EVIDENCE_DIR/browser.cid")" = "$CID" ] || fail 'owned ID mismatch'
python3 "$OBSERVER" --watch --container-name "$CONTAINER_NAME" --run-id "$RUN" --out "$EVIDENCE_DIR/host-evidence.json" >"$EVIDENCE_DIR/observer.log" 2>&1 &
OBSERVER_PID=$!
bounded 1 sleep 0.5
left="$(remaining)" || fail 'whole work deadline reached'
[ "$left" -gt 4 ] || fail 'no remaining capture budget'
capture_budget=$((left-3)); [ "$capture_budget" -le 120 ] || capture_budget=120
set +e
bounded $((capture_budget+3)) python3 "$OBSERVER" --capture-browser "$CID" --deadline "$capture_budget" --out-dir "$EVIDENCE_DIR" --out "$EVIDENCE_DIR/capture.json" >"$EVIDENCE_DIR/capture-cli.json" 2>&1
CAPTURE_RC=$?
set -e
bounded 10 docker stop -t 3 "$CID" >/dev/null 2>&1 || fail 'owned container stop uncertain'
bounded 8 docker inspect "$CID" >"$EVIDENCE_DIR/container-inspect.json" || fail 'final inspect unavailable'
RUN_RC="$(bounded 5 python3 - "$EVIDENCE_DIR/container-inspect.json" <<'__EXIT__'
import json,sys
with open(sys.argv[1]) as f:r=json.load(f)
assert len(r)==1 and r[0]['State']['Running'] is False
v=r[0]['State']['ExitCode'];assert type(v) is int;print(v)
__EXIT__
)" || fail 'authoritative stopped exit unavailable'
printf '%s' "$RUN_RC" >"$EVIDENCE_DIR/authoritative-exit"
kill -TERM "$OBSERVER_PID" 2>/dev/null || true
OBSERVER_RC=0
join_observer 12 || OBSERVER_RC=$?
[ -z "$OBSERVER_PID" ] || fail 'observer join uncertain'
bounded 3 python3 - "$OBSERVER_RC" <<'__JOIN__' >"$EVIDENCE_DIR/observer-join.json"
import json,sys
print(json.dumps(dict(reaped=True,status=int(sys.argv[1]),forced=False)))
__JOIN__
bounded 15 python3 "$OBSERVER" --assemble-run-record "$EVIDENCE_DIR" --run-id "$RUN" --status "$RUN_RC" --assets-image "$ASSETS" --worker-image "$IMAGE" --out "$EVIDENCE_DIR/assemble.json" >/dev/null || fail 'complete assembly failed'
QUALIFIED=0
bounded 10 python3 "$OBSERVER" --fixture-run "$EVIDENCE_DIR/run-record.json" --run-id "$RUN" --out "$EVIDENCE_DIR/verification.json" >/dev/null && QUALIFIED=1
bounded 15 python3 "$OBSERVER" --export-protocol "$EVIDENCE_DIR/export-spec.json" --out "$EVIDENCE_DIR/export-plan.json" >/dev/null || fail 'complete plan failed'
bounded 10 python3 "$OBSERVER" --export-batches "$EVIDENCE_DIR/export-plan.json" --out-dir "$EVIDENCE_DIR/batches" >/dev/null || fail 'complete batches failed'
bounded 10 aws logs create-log-stream --log-group-name "$LOG_GROUP" --log-stream-name "$STREAM" --region "$REGION" --cli-connect-timeout 3 --cli-read-timeout 6 >/dev/null 2>&1 || fail 'fresh stream creation failed'
for batch in "$EVIDENCE_DIR"/batches/batch-*.json; do
  bounded 15 aws logs put-log-events --log-group-name "$LOG_GROUP" --log-stream-name "$STREAM" --region "$REGION" --cli-connect-timeout 3 --cli-read-timeout 10 --log-events "file://$batch" >"$batch.response" 2>&1 || fail 'PutLogEvents failed'
  bounded 3 python3 "$OBSERVER" --put-response "$batch.response" >/dev/null || fail 'PutLogEvents rejected/malformed'
done
[ "$CAPTURE_RC" = 0 ] && [ "$QUALIFIED" = 1 ] && [ "$OBSERVER_RC" = 0 ] && [ "$RUN_RC" = 0 ] || fail 'diagnostic export complete; run NOT qualified'
printf 'complete evidence candidate; external owner gates pending run=%s\n' "$RUN" >>"$EVIDENCE_DIR/verdict.txt"
