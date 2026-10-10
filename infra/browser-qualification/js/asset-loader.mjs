// D006 v2 finite fourteen-file loader. Import is inert; native admission is separate.
import { PINS, TARGET, validateRunUUID, validateAssetsImage } from './config.mjs';
import { sha256, sourceObject } from './asset-sources.mjs';
import { ASSET_VERIFIER } from './asset-verifier.mjs';

export function shellQuote(value) {
  if (typeof value !== 'string' || value.includes('\0')) throw new Error('Invalid shell literal');
  return `'${value.replaceAll("'", "'\\''")}'`;
}
function fullUserData(runUUID, assetsImage, sources) {
  validateRunUUID(runUUID);
  validateAssetsImage(assetsImage);
  sourceObject(sources); // validate the complete finite set before generating commands.
  const expected = Object.fromEntries(sources.map(({ target, bytes }) => [target, { bytes: bytes.length, sha256: sha256(bytes) }]));
  const verifier = ASSET_VERIFIER;
  const delimiter = `__MERI_ASSET_VERIFY_${sha256(Buffer.from(verifier))}__`;
  if (verifier.split('\n').includes(delimiter)) throw new Error('Verifier HEREDOC delimiter collision');
  return `#!/bin/bash
# Codex integration owner: D006 immutable support packaging; NOT qualification proof.
set -euo pipefail
umask 077
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
export AWS_MAX_ATTEMPTS=1 AWS_RETRY_MODE=standard AWS_PAGER=''
export AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null
export BROWSER_HOST_RUN=${shellQuote(runUUID)}
export BROWSER_HOST_IMAGE=${shellQuote(PINS.image)}
export BROWSER_HOST_WORKER_CONFIG_ID=${shellQuote(PINS.imageConfigId)}
export BROWSER_HOST_WORKER_REVISION=${shellQuote(PINS.imageRevision)}
export BROWSER_HOST_WORKER_KIND=${shellQuote(PINS.imageKind)}
export BROWSER_HOST_LOG_GROUP=${shellQuote(PINS.logGroupName)}
export BROWSER_HOST_SECCOMP_SHA256=${shellQuote(PINS.seccompDerivedSha256)}
export BROWSER_HOST_ASSETS_IMAGE=${shellQuote(assetsImage)}
HOST_DIR=/opt/meri-browser-host
AUTH_DIR="/run/meri-browser-assets-$BROWSER_HOST_RUN"
ASSET_NAME="meri-browser-assets-$BROWSER_HOST_RUN"
ASSET_ID=''
AUTH_CREATED=0
REGISTRY=${shellQuote(`${TARGET.account}.dkr.ecr.${TARGET.region}.amazonaws.com`)}
SECONDS=0
LOADER_DEADLINE=300
fail() { printf 'browser-host loader FAILED: %s\\n' "$1" >&2; exit 1; }
cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  set +e
  # Only our exclusive cidfile/returned ID; no browser ID, names or broad prune.
  if [ "$AUTH_CREATED" = 1 ] && [ -z "$ASSET_ID" ] && [ -f "$AUTH_DIR/asset.cid" ] && [ ! -L "$AUTH_DIR/asset.cid" ]; then ASSET_ID="$(<"$AUTH_DIR/asset.cid")"; fi
  if [[ "$ASSET_ID" =~ ^[0-9a-f]{64}$ ]]; then /usr/bin/timeout --signal=KILL 15s docker --config "$AUTH_DIR" rm "$ASSET_ID" >/dev/null 2>&1; fi
  if [ "$AUTH_CREATED" = 1 ] && [ -d "$AUTH_DIR" ] && [ ! -L "$AUTH_DIR" ]; then
    /usr/bin/timeout --signal=KILL 10s docker --config "$AUTH_DIR" logout "$REGISTRY" >/dev/null 2>&1
    /usr/bin/timeout --signal=KILL 5s rm -f -- "$AUTH_DIR/config.json" "$AUTH_DIR/asset.cid" >/dev/null 2>&1
    /usr/bin/timeout --signal=KILL 5s rmdir -- "$AUTH_DIR" >/dev/null 2>&1
  fi
  /usr/bin/timeout --signal=KILL 5s sync >/dev/null 2>&1
  /sbin/poweroff -f >/dev/null 2>&1 || true
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
[ "$EUID" -eq 0 ] && [ -x /sbin/poweroff ] && [ -x /usr/bin/timeout ] || fail 'root/poweroff/timeout required to arm containment'
bounded() {
  local budget="$1" remaining=$((LOADER_DEADLINE-SECONDS)); shift
  [ "$remaining" -gt 0 ] || fail 'whole loader deadline exceeded'
  [ "$budget" -le "$remaining" ] || budget="$remaining"
  /usr/bin/timeout --signal=TERM --kill-after=5s "\${budget}s" "$@"
}
# Timer is armed and observed active BEFORE other prerequisites, agents or ECR.
TIMER_UNIT="meri-browser-assets-poweroff-$BROWSER_HOST_RUN"
bounded 10 systemd-run --unit="$TIMER_UNIT" --on-active=900s --timer-property=AccuracySec=1s /sbin/poweroff -f >/dev/null 2>&1 || fail 'guest timer could not be armed'
bounded 5 systemctl is-active --quiet "$TIMER_UNIT.timer" || fail 'guest timer is not active'
[ "$(bounded 5 systemctl show "$TIMER_UNIT.timer" --property=Unit --value)" = "$TIMER_UNIT.service" ] || fail 'guest timer target mismatch'
# Stop/mask/verify all possible agents BEFORE acquiring instance-role credentials.
for unit in ecs ecs-volume-plugin amazon-ssm-agent snap.amazon-ssm-agent.amazon-ssm-agent.service sshd ssh; do
  bounded 10 systemctl disable --now "$unit" >/dev/null 2>&1 || true
  bounded 5 systemctl mask "$unit" >/dev/null 2>&1 || fail 'agent mask failed'
  [ "$(bounded 5 systemctl is-enabled "$unit" 2>/dev/null || true)" = masked ] || fail 'agent is not masked'
  state="$(bounded 5 systemctl is-active "$unit" 2>/dev/null || true)"
  [[ "$state" = inactive || "$state" = failed ]] || fail 'agent inactivity unconfirmed'
done
for command in python3 aws docker mkdir rm rmdir; do command -v "$command" >/dev/null 2>&1 || fail 'loader prerequisite missing'; done
bounded 5 python3 -I -B - <<'__MERI_ASSET_PARENTS__'
import os,stat
for path in ('/opt','/run'):
    s=os.lstat(path)
    assert stat.S_ISDIR(s.st_mode) and s.st_uid==0 and not (s.st_mode & 0o022), 'unsafe loader parent directory'
__MERI_ASSET_PARENTS__
bounded 5 mkdir --mode=0700 -- "$HOST_DIR" || fail 'exclusive host directory unavailable'
bounded 5 mkdir --mode=0700 -- "$AUTH_DIR" || fail 'exclusive Docker credential directory unavailable'
AUTH_CREATED=1
bounded 5 mkdir --mode=0700 -- "$HOST_DIR/host_evidence" || fail 'exclusive package directory unavailable'
ready=0
for attempt in {1..15}; do
  if bounded 5 docker --config "$AUTH_DIR" info >/dev/null 2>&1; then ready=1; break; fi
  bounded 2 sleep 1
done
[ "$ready" = 1 ] || fail 'Docker readiness unconfirmed'
[ "$(bounded 5 docker --config "$AUTH_DIR" version --format '{{.Server.Version}}')" = ${shellQuote(PINS.docker)} ] || fail 'unreviewed Docker daemon version'
# No password argument/file/echo/debug output. Both pipeline halves are bounded.
bounded 30 aws ecr get-login-password --region ${TARGET.region} --cli-connect-timeout 5 --cli-read-timeout 20 2>/dev/null |
  bounded 30 docker --config "$AUTH_DIR" login --username AWS --password-stdin "$REGISTRY" >/dev/null 2>&1 || fail 'scoped ECR login failed'
bounded 180 docker --config "$AUTH_DIR" pull "$BROWSER_HOST_ASSETS_IMAGE" >/dev/null 2>&1 || fail 'immutable asset pull failed'
ASSET_ID="$(bounded 20 docker --config "$AUTH_DIR" create --pull never --name "$ASSET_NAME" --cidfile "$AUTH_DIR/asset.cid" \\
  --label "meri.qualification.assets.run=$BROWSER_HOST_RUN" --network none --user 10001:10001 --read-only \\
  --cap-drop ALL --security-opt no-new-privileges --restart=no --no-healthcheck --log-driver=none \\
  --entrypoint /meri-never-execute-assets "$BROWSER_HOST_ASSETS_IMAGE")" || fail 'asset create failed'
[[ "$ASSET_ID" =~ ^[0-9a-f]{64}$ ]] || fail 'asset ID malformed'
[ "$(<"$AUTH_DIR/asset.cid")" = "$ASSET_ID" ] || fail 'asset ID/cidfile mismatch'
inspect="$(bounded 10 docker --config "$AUTH_DIR" inspect --format '{{.Id}} {{.State.Status}} {{.State.Running}} {{.Config.Image}} {{.HostConfig.NetworkMode}} {{.HostConfig.ReadonlyRootfs}} {{.HostConfig.Privileged}} {{len .Mounts}}' "$ASSET_ID")" || fail 'asset identity unavailable'
[ "$inspect" = "$ASSET_ID created false $BROWSER_HOST_ASSETS_IMAGE none true false 0" ] || fail 'asset identity/state/config mismatch'
${sources.map(({ target }) => `bounded 30 docker --config "$AUTH_DIR" cp "$ASSET_ID:/meri-host-assets/${target}" "$HOST_DIR/${target}" >/dev/null 2>&1 || fail 'asset copy failed'`).join('\n')}
bounded 15 python3 -I -B - "$HOST_DIR" ${shellQuote(JSON.stringify(expected))} <<'${delimiter}'
${verifier}${delimiter}
# Prove removal BEFORE the browser observer can see any container.
bounded 15 docker --config "$AUTH_DIR" rm "$ASSET_ID" >/dev/null 2>&1 || fail 'asset removal failed'
remaining_asset="$(bounded 10 docker --config "$AUTH_DIR" container ls --all --no-trunc --filter "id=$ASSET_ID" --format '{{.ID}}')" || fail 'asset removal readback failed'
[ -z "$remaining_asset" ] || fail 'asset removal unconfirmed'
bounded 10 docker --config "$AUTH_DIR" logout "$REGISTRY" >/dev/null 2>&1 || fail 'asset credential logout failed'
bounded 5 rm -f -- "$AUTH_DIR/config.json" "$AUTH_DIR/asset.cid"
bounded 5 rmdir -- "$AUTH_DIR"
ASSET_ID=''
AUTH_CREATED=0
[ ! -e "$AUTH_DIR" ] && [ ! -L "$AUTH_DIR" ] || fail 'asset credentials remain'
# The timer survives exec; bootstrap adds its own trap/bounds. No asset start/run.
exec /bin/bash "$HOST_DIR/bootstrap.sh"
`;
}

// Cross-module access without touching the frozen declaration span.
export { fullUserData };
