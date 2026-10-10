// W02-06 dedicated browser-host qualification PREPARATION (no provisioning).
//
// Standalone, bootstrapless CDK stack `MeriGreenfield-BrowserQualification` that
// prepares exactly one fresh standalone EC2 browser host on the NEW qualification
// VPC. It reuses ONLY the owner-reviewed new qualification VPC/subnet/endpoints
// (vpc-06e1941747e798f0a / subnet-0864c000b771df32c / sg-030c8a7ce5adea043 /
// pl-63a5400a); it does NOT import, look up or grant any current Capiro resource
// and the existing worker security group is never referenced or modified. No AWS
// call, key generation, image build, instance launch or deployment occurs here.
//
// This module is also the offline test reference. Importing it must NOT
// synthesize (synthesis runs only when executed directly). It exports the pinned
// component table, a deterministic user-data builder, and a JS mirror of the
// on-host Python classifier. security.test.mjs additionally drives the ACTUAL
// Python classifier via fake proc/command fixtures and asserts JS/Python parity.

import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  App, Stack, BootstraplessSynthesizer, RemovalPolicy, Tags, CfnOutput, CfnParameter,
  aws_ec2 as ec2, aws_iam as iam, aws_kms as kms, aws_logs as logs,
} from 'aws-cdk-lib';

export const TARGET = Object.freeze({ account: '967807252336', region: 'us-east-1', az: 'us-east-1a' });

export const QUALIFICATION_NETWORK = Object.freeze({
  vpcId: 'vpc-06e1941747e798f0a',
  subnetId: 'subnet-0864c000b771df32c',
  endpointSecurityGroupId: 'sg-030c8a7ce5adea043',
  s3PrefixListId: 'pl-63a5400a',
});

export const PINS = Object.freeze({
  // W02-16: refreshed to the statically accepted worker image
  // (W02-08-BUILD-3-STATIC-ACCEPTANCE.md). The previous digest
  // sha256:7327f045... is retained only as historical provenance and is no
  // longer an allowed candidate. All three identities below are required and
  // are pinned literals, never caller-supplied.
  image: '967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:bf55fdab91136344688e2c804598546e521b24d6cdbf4fde9e6a7131e6c2ec9c',
  imageRepository: 'meri-greenfield/qualification-worker',
  imageConfigId: 'sha256:6f313883ad219ebd5cc3d0dbd1df5cdf80f0f035eab5ab02c3cead4db568f471',
  imageRevision: '0be04d0799c9c527e300b47c19176cddb0eaa231',
  imageKind: 'worker-inventory-only',
  ami: 'ami-0fb0f484b75566814',
  amiOwner: '591542846629',
  amiArch: 'x86_64',
  ssmRecommendedVersion: 153,
  ecsAl2023Version: '2023.0.20261001',
  kernel: '6.1',
  docker: '25.0.16',
  ecsAgent: '1.107.0',
  ecsRecipeCommit: 'ef941b7278cfd81d9c4bb76d2add25f2480060e3',
  ecsRecipeDerivedMinimal: '2023.12.20260930.0',
  instanceType: 't3.large',
  rootVolumeGiB: 30,
  seccompMobyCommit: '6fdf0a663f15d71b6944cb0b2bc3abac221ff15c',
  seccompDefaultBytes: 12828,
  seccompDefaultSha256: '9c1025c88ccaa517b648da571961838744ea2137f176bfe6a48b21294cae9c76',
  seccompDerivedBytes: 17188,
  seccompDerivedSha256: 'e62f4c3e3e7ce6de099ba7a0e3df0881b7b407b74dc664aef70f76f6316385c6',
  seccompPreservedRules: 31,
  seccompAppendedRules: 5,
  chromiumCommit: '384c82079f60e0b79cdca6e49efd5cfceefa5b74',
  chromiumVersion: '155.0.8059.12',
  browserDeadlineSeconds: 120,
  guestLifetimeMinutes: 15,
  userDataLimitBytes: 16384,
  logGroupName: '/meri-greenfield/qualification/browser-host',
  runIdPattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
});

// Kept in parity with host-evidence.py (asserted by security.test.mjs).
export const BROWSER_ROOT = '/opt/meri-browsers';
export const BROWSER_EXE_PATTERN_SOURCE = '^/opt/meri-browsers/chromium-[0-9]+/chrome-linux/chrome$';
export const PINNED_IMAGE = PINS.image;
export const HOST_EVIDENCE_RULES = Object.freeze({
  browserBinaryRoot: BROWSER_ROOT,
  requireHostCapabilitiesZero: true,
  requireNoNewPrivs: 1,
  requireSeccompMode: 2,
  requireRendererFiltersBeyondBaseline: true,
});

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}
const readSibling = (name) => readFileSync(new URL(name, import.meta.url));

// ---------------------------------------------------------------------------
// Codex-owner D006 amendment: small digest/run-bound support-image loader.
// The scratch support container is CREATED/COPIED/REMOVED, NEVER STARTED. Source
// hashes bind the reviewed build to this per-run template; source code is not
// minified or embedded. Guest/cloud-init/Docker behavior remains UNRUN.
// ---------------------------------------------------------------------------

export function validateRunUUID(runUUID) {
  if (typeof runUUID !== 'string' || runUUID.length !== 36 || !new RegExp(PINS.runIdPattern).test(runUUID)) {
    throw new Error('An explicit canonical lowercase UUID is required (--run-uuid UUID)');
  }
  return runUUID;
}

export function shellQuote(value) {
  if (typeof value !== 'string' || value.includes('\0')) throw new Error('Invalid shell literal');
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function validateAssetsImage(assetsImage) {
  const repository = `${TARGET.account}.dkr.ecr.${TARGET.region}.amazonaws.com/${PINS.imageRepository}@sha256:`;
  if (typeof assetsImage !== 'string' || assetsImage.length !== repository.length + 64 ||
      !assetsImage.startsWith(repository) || !/^[0-9a-f]{64}$/.test(assetsImage.slice(repository.length))) {
    throw new Error('An explicit same-qualification-repository immutable digest is required (--assets-image REPO@sha256:HEX64)');
  }
  if (assetsImage === PINS.image) throw new Error('Support assets must use their own reviewed digest, distinct from the worker image');
  return assetsImage;
}

function exactSources() {
  return [
    { name: 'bootstrap.sh', target: 'bootstrap.sh', bytes: readSibling('bootstrap.sh') },
    { name: 'host-evidence.py', target: 'host-evidence.py', bytes: readSibling('host-evidence.py') },
    { name: 'seccomp.chromium-155-amd64.json', target: 'seccomp.json', bytes: readSibling('seccomp.chromium-155-amd64.json') },
  ].map((source) => {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(source.bytes);
    if (!source.bytes.equals(Buffer.from(text, 'utf8')) || !text.endsWith('\n') || text.includes('\0') || text.includes('\r')) {
      throw new Error(`Exact UTF-8/LF-only source required (must match the reviewed Git archive): ${source.name}`);
    }
    if (source.target === 'seccomp.json' && (source.bytes.length !== PINS.seccompDerivedBytes || sha256(source.bytes) !== PINS.seccompDerivedSha256)) {
      throw new Error('Pinned derived seccomp bytes/hash changed');
    }
    return source;
  });
}

function fullUserData(runUUID, assetsImage, sources) {
  validateRunUUID(runUUID);
  validateAssetsImage(assetsImage);
  const expected = Object.fromEntries(sources.map(({ target, bytes }) => [target, { bytes: bytes.length, sha256: sha256(bytes) }]));
  const verifier = `import hashlib,json,os,stat,sys
directory,expected=sys.argv[1],json.loads(sys.argv[2])
d=os.lstat(directory)
assert stat.S_ISDIR(d.st_mode) and d.st_uid==0 and stat.S_IMODE(d.st_mode)==0o700, 'unsafe asset directory'
assert set(os.listdir(directory))==set(expected), 'unexpected/missing assets'
for name,want in expected.items():
    path=os.path.join(directory,name)
    before=os.lstat(path)
    assert stat.S_ISREG(before.st_mode) and before.st_nlink==1 and before.st_uid==0, 'nonregular/link/nonroot asset'
    assert before.st_size==want['bytes'], 'asset size mismatch'
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    with os.fdopen(fd,'rb') as stream:
        opened=os.fstat(stream.fileno())
        assert (before.st_dev,before.st_ino)==(opened.st_dev,opened.st_ino), 'asset changed before open'
        content=stream.read(want['bytes']+1)
        after=os.fstat(stream.fileno())
    assert (opened.st_size,opened.st_mtime_ns,opened.st_ctime_ns)==(after.st_size,after.st_mtime_ns,after.st_ctime_ns), 'asset changed during read'
    assert len(content)==want['bytes'] and hashlib.sha256(content).hexdigest()==want['sha256'], 'asset hash mismatch'
    os.chmod(path,0o600,follow_symlinks=False)
`;
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
bounded 5 python3 - <<'__MERI_ASSET_PARENTS__'
import os,stat
for path in ('/opt','/run'):
    s=os.lstat(path)
    assert stat.S_ISDIR(s.st_mode) and s.st_uid==0 and not (s.st_mode & 0o022), 'unsafe loader parent directory'
__MERI_ASSET_PARENTS__
bounded 5 mkdir --mode=0700 -- "$HOST_DIR" || fail 'exclusive host directory unavailable'
bounded 5 mkdir --mode=0700 -- "$AUTH_DIR" || fail 'exclusive Docker credential directory unavailable'
AUTH_CREATED=1
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
bounded 15 python3 - "$HOST_DIR" ${shellQuote(JSON.stringify(expected))} <<'${delimiter}'
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

/** Exact run/digest loader; local source byte/hash expectations are unmodified. */
export function buildUserData(runUUID, assetsImage) {
  return fullUserData(runUUID, assetsImage, exactSources());
}

export function buildUserDataPayload(runUUID, assetsImage) {
  const sources = exactSources();
  const text = fullUserData(runUUID, assetsImage, sources);
  const raw = Buffer.from(text, 'utf8');
  const compressed = gzipSync(raw, { level: 9 });
  if (compressed.length > PINS.userDataLimitBytes) {
    throw new Error(`Compressed EC2 user-data ${compressed.length} exceeds ${PINS.userDataLimitBytes} bytes; no fallback`);
  }
  return {
    text, raw, compressed, base64: compressed.toString('base64'),
    metadata: {
      owner: 'Codex integration owner', decision: 'D006', encoding: 'gzip; API base64 exactly once', qualificationRun: runUUID,
      assetsImage, workerImage: PINS.image, assetContainerExecution: 'NEVER STARTED; create/cp/remove only',
      rawPayload: { bytes: raw.length, sha256: sha256(raw) },
      compressedPayload: { bytes: compressed.length, sha256: sha256(compressed), limitBytes: PINS.userDataLimitBytes },
      sources: Object.fromEntries(sources.map(({ name, bytes }) => [name, { bytes: bytes.length, sha256: sha256(bytes) }])),
      nativeCloudInitExecution: 'NOT RUN',
    },
  };
}

// ---------------------------------------------------------------------------
// JS mirror of the on-host Python classifier (parity asserted by tests)
// ---------------------------------------------------------------------------

const NODE_EXE = /(^|[\\/])node(\.exe)?$/i;
const HEX64 = /^[0-9a-f]{64}$/;
const inRoot = (exe) => typeof exe === 'string' && /^\/opt\/meri-browsers\/chromium-[0-9]+\/chrome-linux\/chrome$/.test(exe);
const isNode = (exe) => typeof exe === 'string' && NODE_EXE.test(exe);
const capZero = (v) => typeof v === 'string' && /^0+$/.test(v);
const threadOk = (t) => capZero(t.capEffHex) && capZero(t.capPrmHex) && t.noNewPrivs === 1 && t.seccomp === 2;
const validUidMap = (t) => typeof t === 'string' && t.trim().split('\n').some((l) => {
  const p = l.trim().split(/\s+/); return p.length >= 3 && p.slice(0, 3).every((x) => /^\d+$/.test(x)) && Number(p[2]) > 0;
});
function descends(proc, targetPid, byPid, maxDepth = 16) {
  let cur = proc, depth = 0;
  while (cur && depth < maxDepth) { if (cur.ppid === targetPid) return true; cur = byPid.get(cur.ppid); depth += 1; }
  return false;
}
const nsOf = (p, k) => (p && p.nsInodes && typeof p.nsInodes === 'object') ? p.nsInodes[k] : undefined;

export function classifyHostEvidence(observation = {}, expected = {}) {
  const o = observation || {}; const exp = expected || {}; const reasons = [];
  const procs = Array.isArray(o.processes) ? o.processes : [];
  const running = Array.isArray(o.runningContainers) ? o.runningContainers : [];
  const boot = o.bootId;
  const byPid = new Map(procs.filter((p) => Number.isInteger(p.pid)).map((p) => [p.pid, p]));
  const mainProc = byPid.get(o.mainPid);
  const baseline = o.containerSeccompFilters;
  const expectedSha = exp.exeSha256 || o.expectedExeSha256;

  if (exp.runId && o.runId !== exp.runId) reasons.push('observation runId does not match the required run');
  if (!o.runId) reasons.push('observation is not bound to a run');
  if (running.length !== 1) reasons.push(`expected exactly one running container this run, saw ${running.length}`);
  const target = running.length === 1 ? running[0] : undefined;
  if (!o.containerId || !target || target.id !== o.containerId) reasons.push('target container is not the single observed running container');
  if (target && o.runId && (target.labels || {})['meri.qualification.run'] !== o.runId) reasons.push('observed container label is not bound to the run');
  if (target && o.runId && !String(target.name || '').includes(o.runId)) reasons.push('observed container name is not bound to the run');
  if (procs.length === 0) reasons.push('no process evidence collected for the target container');
  if (!Number.isInteger(baseline) || baseline < 1) reasons.push('missing positive same-container seccomp baseline');
  if (procs.some((p) => boot && p.bootId && p.bootId !== boot)) reasons.push('process evidence crosses boot ids (possible PID reuse)');
  if (procs.some((p) => p.cgroup && o.containerId && !String(p.cgroup).includes(String(o.containerId).slice(0, 12)) && p.pid !== o.mainPid)) reasons.push('a process is outside the target container cgroup');

  const browser = procs.find((p) => p.type === 'browser' && inRoot(p.exe)) || null;
  const renderer = procs.find((p) => p.type === 'renderer' && inRoot(p.exe)) || null;
  if (procs.some((p) => (p.type === 'browser' || p.type === 'renderer') && isNode(p.exe))) reasons.push('a Node process was misidentified as a browser/renderer');
  if (!browser) reasons.push('no identified actual Chromium browser process for this run');
  if (!renderer) reasons.push('no identified actual Chromium renderer process for this run');

  const checkExe = (p, label) => {
    if (!p) return;
    if (!inRoot(p.exe)) reasons.push(`${label} executable is not the pinned Chromium path`);
    if (!(typeof p.exeSha256 === 'string' && HEX64.test(p.exeSha256))) reasons.push(`${label} executable hash missing/malformed`);
    else if (expectedSha && p.exeSha256 !== expectedSha) reasons.push(`${label} executable hash does not match the pinned value`);
  };
  checkExe(browser, 'browser'); checkExe(renderer, 'renderer');
  if (browser && browser.ppid !== o.mainPid && !descends(browser, o.mainPid, byPid)) reasons.push('browser is not a descendant of the container main process');
  if (browser && renderer && !descends(renderer, browser.pid, byPid)) reasons.push('renderer is not a descendant of the identified browser');

  for (const [label, p] of [['browser', browser], ['renderer', renderer]]) {
    if (!p) continue;
    const threads = Array.isArray(p.threads) ? p.threads : [];
    if (threads.length === 0) { reasons.push(`${label} has no thread evidence`); continue; }
    for (const th of threads) if (!threadOk(th)) reasons.push(`${label} thread ${th.tid} is not capsets0/NoNewPrivs1/Seccomp2`);
    if (!capZero(p.capEffHex) || !capZero(p.capPrmHex)) reasons.push(`${label} retains host capabilities (CapEff/CapPrm != 0)`);
    if (p.noNewPrivs !== 1) reasons.push(`${label} NoNewPrivs is not 1`);
    if (p.seccomp !== 2) reasons.push(`${label} Seccomp mode is not 2`);
  }

  const rendererUserNs = nsOf(renderer, 'user');
  const baselines = new Set([nsOf(mainProc, 'user'), nsOf(browser, 'user')]);
  if (!rendererUserNs) reasons.push('renderer user namespace inode unavailable');
  else if (baselines.has(rendererUserNs)) reasons.push('renderer user namespace is not distinct from the host/container/browser baseline');
  if (!validUidMap(renderer ? renderer.uidMap : null)) reasons.push('renderer user namespace has no valid UID mapping');

  if (renderer) {
    const filters = (renderer.threads || []).map((t) => t.seccompFilters).filter(Number.isInteger);
    if (filters.length === 0) reasons.push('renderer seccomp filter counts unavailable');
    else if (Math.min(...filters) <= (baseline || 0)) reasons.push('renderer seccomp filters do not exceed the container baseline (min across threads)');
  }
  return { ok: reasons.length === 0, reasons, browserPid: browser ? browser.pid : null, rendererPid: renderer ? renderer.pid : null };
}

// ---------------------------------------------------------------------------
// Synthesized stack (only when executed directly)
// ---------------------------------------------------------------------------

const LOG_KEY_ACTIONS = ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'];

export class BrowserQualificationStack extends Stack {
  constructor(scope, id, runUUID, assetsImage) {
    validateRunUUID(runUUID);
    validateAssetsImage(assetsImage);
    super(scope, id, {
      env: { account: TARGET.account, region: TARGET.region },
      synthesizer: new BootstraplessSynthesizer(),
      description: 'New isolated browser-host qualification host; no source access, no Capiro imports',
    });
    const run = new CfnParameter(this, 'QualificationRun', {
      type: 'String', description: 'Exactly one owner-supplied qualification run UUID; bound to the instance tag, container and all evidence',
      allowedPattern: PINS.runIdPattern,
      default: runUUID, allowedValues: [runUUID],
    });
    new CfnParameter(this, 'QualificationAssetsImage', {
      type: 'String', description: 'Exactly one reviewed immutable support-image digest; must match literal loader and metadata',
      default: assetsImage, allowedValues: [assetsImage],
    });
    const userData = buildUserDataPayload(runUUID, assetsImage);
    this.templateOptions.metadata = { BrowserQualificationUserData: userData.metadata };
    const vpc = ec2.Vpc.fromVpcAttributes(this, 'QualificationVpc', {
      vpcId: QUALIFICATION_NETWORK.vpcId, availabilityZones: [TARGET.az],
    });
    const endpointSg = ec2.SecurityGroup.fromSecurityGroupId(this, 'QualificationEndpointSg', QUALIFICATION_NETWORK.endpointSecurityGroupId);

    const key = new kms.Key(this, 'HostKey', {
      alias: 'alias/meri-greenfield/qualification-browser-host',
      description: 'Encrypts the browser-host root volume and CloudWatch logs only',
      enableKeyRotation: true, removalPolicy: RemovalPolicy.RETAIN,
    });
    const logGroup = new logs.LogGroup(this, 'BrowserHostLogs', {
      logGroupName: PINS.logGroupName, retention: logs.RetentionDays.ONE_MONTH,
      encryptionKey: key, removalPolicy: RemovalPolicy.RETAIN,
    });
    key.addToResourcePolicy(new iam.PolicyStatement({
      principals: [new iam.ServicePrincipal(`logs.${TARGET.region}.amazonaws.com`)],
      actions: LOG_KEY_ACTIONS, resources: ['*'],
      conditions: { ArnEquals: { 'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${TARGET.region}:${TARGET.account}:log-group:${PINS.logGroupName}` } },
    }));

    const hostRole = new iam.Role(this, 'BrowserHostRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com', {
        conditions: { StringEquals: { 'aws:SourceAccount': TARGET.account } },
      }),
      description: 'Browser host: same-repository ECR pull, its own log stream writes and scoped log key use only',
    });
    hostRole.addToPolicy(new iam.PolicyStatement({ actions: ['ecr:GetAuthorizationToken'], resources: ['*'] }));
    hostRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ecr:BatchCheckLayerAvailability', 'ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
      resources: [`arn:aws:ecr:${TARGET.region}:${TARGET.account}:repository/${PINS.imageRepository}`],
    }));
    logGroup.grantWrite(hostRole);
    hostRole.addToPolicy(new iam.PolicyStatement({
      actions: LOG_KEY_ACTIONS, resources: [key.keyArn],
      conditions: { StringEquals: { 'kms:ViaService': `logs.${TARGET.region}.amazonaws.com` } },
    }));

    const hostSg = new ec2.SecurityGroup(this, 'BrowserHostSecurityGroup', {
      vpc, allowAllOutbound: false,
      description: 'Browser host: egress to the NEW qualification endpoints and ECR layer prefix list only',
    });
    // NEW ingress-rule resource on the NEW endpoint SG; existing worker SG untouched.
    const endpointIngress = new ec2.CfnSecurityGroupIngress(this, 'HostToEndpointIngress', {
      groupId: QUALIFICATION_NETWORK.endpointSecurityGroupId,
      sourceSecurityGroupId: hostSg.securityGroupId,
      ipProtocol: 'tcp', fromPort: 443, toPort: 443,
      description: 'New browser host to new private endpoints',
    });
    hostSg.addEgressRule(endpointSg, ec2.Port.tcp(443), 'Only the new qualification endpoints');
    hostSg.addEgressRule(ec2.Peer.prefixList(QUALIFICATION_NETWORK.s3PrefixListId), ec2.Port.tcp(443), 'ECR regional image-layer S3 gateway endpoint');

    const subnet = ec2.Subnet.fromSubnetAttributes(this, 'QualificationSubnet', {
      subnetId: QUALIFICATION_NETWORK.subnetId, availabilityZone: TARGET.az,
    });
    const instance = new ec2.Instance(this, 'BrowserHost', {
      vpc, vpcSubnets: { subnets: [subnet] },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.LARGE),
      machineImage: ec2.MachineImage.genericLinux({ [TARGET.region]: PINS.ami }),
      creditSpecification: ec2.CpuCredits.STANDARD,
      securityGroup: hostSg, role: hostRole,
      associatePublicIpAddress: false,
      httpTokens: ec2.HttpTokens.REQUIRED, httpPutResponseHopLimit: 1, httpProtocolIpv6: false, instanceMetadataTags: false,
      instanceInitiatedShutdownBehavior: ec2.InstanceInitiatedShutdownBehavior.TERMINATE,
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(PINS.rootVolumeGiB, {
          volumeType: ec2.EbsDeviceVolumeType.GP3, encrypted: true, kmsKey: key, deleteOnTermination: true,
        }),
      }],
    });
    // CfnInstance UserData is already API base64. Do not wrap in Fn::Base64.
    instance.instance.userData = userData.base64;
    // Explicit readiness dependencies (not only the IAM policy reference).
    instance.node.addDependency(endpointIngress);
    instance.node.addDependency(logGroup);
    instance.node.addDependency(key);
    Tags.of(instance).add('QualificationRun', run.valueAsString);

    new CfnOutput(this, 'InstanceId', { value: instance.instanceId });
    new CfnOutput(this, 'HostSecurityGroupId', { value: hostSg.securityGroupId });
    new CfnOutput(this, 'HostRoleArn', { value: hostRole.roleArn });
    new CfnOutput(this, 'LogGroupName', { value: logGroup.logGroupName });
    new CfnOutput(this, 'KeyArn', { value: key.keyArn });
    new CfnOutput(this, 'QualificationRunId', { value: run.valueAsString });
  }
}

function main() {
  if (process.argv.length !== 6 || process.argv[2] !== '--run-uuid' || process.argv[4] !== '--assets-image') {
    throw new Error('Usage: node infra/browser-qualification/app.mjs --run-uuid CANONICAL_UUID --assets-image SAME_REPO@sha256:HEX64');
  }
  const runUUID = validateRunUUID(process.argv[3]);
  const assetsImage = validateAssetsImage(process.argv[5]);
  const app = new App({ outdir: 'cdk.out/browser-qualification' });
  Tags.of(app).add('Project', 'meri-greenfield');
  Tags.of(app).add('Environment', 'qualification');
  Tags.of(app).add('Owner', 'Codex-integration');
  Tags.of(app).add('SourcesEnabled', 'false');
  new BrowserQualificationStack(app, 'MeriGreenfield-BrowserQualification', runUUID, assetsImage);
  app.synth();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
