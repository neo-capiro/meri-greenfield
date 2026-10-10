// W02-06 offline checks. Drives the ACTUAL authoritative Python observer
// (infra/browser-qualification/host-evidence.py) and the reviewed replay
// harnesses, synthesizes the CDK template with a clearly SYNTHETIC same-repo
// digest, and statically checks bootstrap.sh and the pinned seccomp data. The
// legacy JS classifyHostEvidence in app.mjs is UNQUALIFIED and NOT used here.
// No AWS/network/credential/native/container/browser execution occurs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash, randomUUID } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const INFRA = join(REPO, 'infra', 'browser-qualification');
const OBS = join(INFRA, 'host-evidence.py');
const TMP = join(REPO, '.task-inputs', 'observer-audit', 'tmp-' + randomUUID());
const RUN = 'b0ae553a-a4c1-44c8-93b4-45afc6ed0139';
const BOOT = 'd7895c58-cc4e-44ef-88d8-887a82b56e1e';
const CID = 'c'.repeat(64);
const EXE = '/opt/meri-browsers/chromium-1247/chrome-linux64/chrome';
const PIN = 'adf078f8f80eb9e980a07b4418af23b0f4008a83bc5756d5588055bc4d76c5a0';
// W02-16: the statically accepted worker tuple (W02-08-BUILD-3-STATIC-ACCEPTANCE.md).
// The previous digest 7327... is retained only as OLD_IMAGE (historical provenance).
const IMAGE = '967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:bf55fdab91136344688e2c804598546e521b24d6cdbf4fde9e6a7131e6c2ec9c';
const OLD_IMAGE = '967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:7327f04575b09a633730b0ffe4b5fdeeeffe151a5c0db6dc027cc6edb8960d75';
const CONFIG_ID = 'sha256:6f313883ad219ebd5cc3d0dbd1df5cdf80f0f035eab5ab02c3cead4db568f471';
const REVISION = '0be04d0799c9c527e300b47c19176cddb0eaa231';
const KIND = 'worker-inventory-only';
const SUBSTITUTE = 'sha256:' + 'f'.repeat(64);
const SUPPORT = '967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:' + 'a'.repeat(64);
const CGROUP = '0::/system.slice/docker-' + CID + '.scope';
const NS = (n) => Object.fromEntries(['user', 'mnt', 'pid', 'net', 'ipc', 'uts', 'cgroup'].map((k) => [k, `${k}:[${n + 1}]`]));
const CAPS0 = Object.fromEntries(['capInhHex', 'capPrmHex', 'capEffHex', 'capBndHex', 'capAmbHex'].map((k) => [k, '0000000000000000']));

mkdirSync(TMP, { recursive: true });
// Test-only Python selection (defaults to python3). The guest/product code never
// reads this; it only lets an offline run select an existing interpreter without
// touching machine PATH.
const PYTHON = process.env.MERI_TEST_PYTHON || 'python3';
const py = (args) => spawnSync(PYTHON, ['-B', OBS, ...args], { encoding: 'utf8', cwd: REPO });
const pyJson = (args) => { const r = py(args); assert.ok(r.status === 0 || r.status === 3, r.stderr + r.stdout); return JSON.parse(r.stdout); };
const write = (name, value) => { const p = join(TMP, name); writeFileSync(p, typeof value === 'string' ? value : JSON.stringify(value, null, 2)); return p; };

function thread(tid, filters) { return { tid, hostUids: [10001, 10001, 10001, 10001], hostGids: [10001, 10001, 10001, 10001], seccompFilters: filters, noNewPrivs: 1, seccomp: 2, ...CAPS0 }; }
function proc(pid, parent, kind, userN, filters) {
  return { pid, ppid: parent, hostUids: [10001, 10001, 10001, 10001], hostGids: [10001, 10001, 10001, 10001],
    type: kind, exe: kind === 'main' ? '/usr/local/bin/node' : EXE, exeSha256: kind === 'main' ? null : PIN,
    cmdline: [], starttimeTicks: '100', bootId: BOOT, cgroup: CGROUP, uidMap: '0 10001 1', nsInodes: NS(userN),
    threads: [thread(pid, filters), thread(pid + 1000, filters)], noNewPrivs: 1, seccomp: 2, ...CAPS0 };
}
function observation() {
  return { runId: RUN, containerId: CID, mainPid: 100, bootId: BOOT, containerSeccompFilters: 1, hostNamespaces: NS(0),
    runningContainers: [{ id: CID, name: 'meri-browser-probe-' + RUN, image: IMAGE, labels: { 'meri.qualification.run': RUN } }],
    processes: [proc(100, 1, 'main', 1, 1), proc(110, 100, 'browser', 1, 1), proc(120, 110, 'renderer', 2, 2)] };
}
function sourceManifest() {
  return Object.fromEntries([['observer','host-evidence.py'],['bootstrap','bootstrap.sh'],['seccomp','seccomp.chromium-155-amd64.json']].map(([key,name])=>{
    const raw=readFileSync(join(INFRA,name));return [key,{bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')}];
  }));
}
function context() { return {run:RUN,supportImage:SUPPORT,workerImage:IMAGE,profileSha:'e62f4c3e3e7ce6de099ba7a0e3df0881b7b407b74dc664aef70f76f6316385c6',source:sourceManifest()}; }
function browserPayload() {
  // Source oracle: actual buildBrowserSteps/runBoundedSequence with injected
  // MCP/filesystem fakes; browser.mjs SHA c09bd204...481e0. No native query.
  const root='/workspace/qualification-browser/probe-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const bp={pid:10,exe:EXE,argv:[EXE,'--user-data-dir='+root+'/profile']};
  const rp={pid:11,exe:EXE,type:'renderer',argv:[EXE,'--type=renderer']};
  const pe=()=>({namespaces:NS(1),status:'Uid:10001 | NoNewPrivs:1 | Seccomp:2',uid_map:'0 10001 1',gid_map:'0 10001 1'});
  const hash='9c5b8230bb9d09771b17001fae93ff5604794fcc59cc755f679f2ec0614a090c';
  return {probe:'browser',ok:true,sandboxVerified:true,uid:10001,serverVersion:{name:'Playwright',version:'1.64.0-alpha-1790635538000'},browserVersion:'155.0.8059.12',
    versionData:{userAgent:'Mozilla/5.0 Chrome/155.0.8059.12',text:'Chromium155.0.8059.12'},reasons:[],disablingFlags:[],effectiveFlagsSource:'proc',
    tools:['browser_get_config'],stepSequence:{order:['get_config','nav-fixture','snapshot','download-nav','download-bytes','version-nav','version-eval','sandbox-nav','sandbox-eval'],
      ran:['get_config','nav-fixture','snapshot','download-nav','download-bytes','version-nav','version-eval','sandbox-nav','sandbox-eval'],notRun:[],stoppedAfter:null,
      details:{get_config:'ok','nav-fixture':'ok',snapshot:'marker present','download-nav':'ok','download-bytes':'bytes match','version-nav':'ok','version-eval':'155.0.8059.12','sandbox-nav':'ok','sandbox-eval':'rows captured'}},
    download:{found:true,file:'meri-fixture.txt',bytes:31,sha256:hash,expectedSha256:hash,payloadMatches:true},
    sandbox:{text:'Sandbox',rows:[['Layer 1 Sandbox','Namespace'],['Seccomp-BPF sandbox','Yes']],evaluation:'adequately sandboxed'},
    browserProcess:bp,rendererProcess:rp,processes:[{...bp,ppid:9,type:'browser'},{...rp,ppid:10}],
    procEvidence:{self:pe(),browser:pe(),renderer:pe()},prelaunch:{synthetic:true},
    rawResults:{get_config:'{}',nav:'Page operation complete',snapshot:'meri-loopback-ok',download:'Page operation complete',versionNav:'Page operation complete',version:'{"userAgent":"Mozilla/5.0 Chrome/155.0.8059.12"}',sandboxNav:'Page operation complete',sandbox:'{"rows":[["Layer 1 Sandbox","Namespace"],["Seccomp-BPF sandbox","Yes"]]}'},
    stderr:'',evidencePaths:[root]};
}
const SAFE_ENV={PATH:'/opt/meri-venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',NODE_VERSION:'24.21.0',YARN_VERSION:'1.22.22',HOME:'/workspace/home',TMPDIR:'/tmp',CLAUDE_CONFIG_DIR:'/workspace/config',PLAYWRIGHT_BROWSERS_PATH:'/opt/meri-browsers',NODE_ENV:'production',MERI_QUALIFICATION_ONLY:'true',MERI_SOURCES_ENABLED:'false',CHROMIUM_SANDBOX_REQUIRED:'true'};
function inspect() {
  return {Id:CID,Name:'/meri-browser-probe-'+RUN,Image:CONFIG_ID,Config:{Image:IMAGE,User:'10001:10001',Entrypoint:['node'],Cmd:['/opt/meri-worker/probes/browser.mjs'],WorkingDir:'/workspace/conversation',Labels:{'meri.qualification.run':RUN,'org.opencontainers.image.revision':REVISION,'meri.qualification.kind':KIND},Env:Object.entries(SAFE_ENV).map(([k,v])=>k+'='+v)},
    HostConfig:{NetworkMode:'none',CapDrop:['ALL'],CapAdd:null,SecurityOpt:['no-new-privileges','seccomp=/opt/meri-browser-host/seccomp.json'],ReadonlyRootfs:true,Privileged:false,PidMode:'',IpcMode:'private',PidsLimit:512,Memory:4*1024**3,NanoCpus:2*10**9,ShmSize:1024**3,Devices:[],DeviceRequests:[],VolumesFrom:null,Binds:['/workspace/browser-host:/workspace:rw'],Tmpfs:{'/tmp':'rw,noexec,nosuid,size=512m'}},
    Mounts:[{Destination:'/workspace',Source:'/workspace/browser-host',RW:true,Type:'bind'}],State:{Status:'exited',Running:false,ExitCode:0,OOMKilled:false,Error:''}};
}
function runRecord() {
  const browser=browserPayload();
  return {runId:RUN,status:0,supportImage:SUPPORT,workerImage:IMAGE,profile:{path:'/opt/meri-browser-host/seccomp.json',sha256:context().profileSha},source:sourceManifest(),
    observer:{ok:true,runId:RUN,bestOk:true,bestClassification:{ok:true},bestObservation:observation(),unsafeClassification:null},browser,inspect:inspect(),imageID:CONFIG_ID,
    versions:{aws:'2.30.0',docker:'25.0.16',runc:'1.3.0',containerd:'1.7.0',libseccomp:'2'},pythonVersion:'3.9.25',preflight:{ok:true,checks:{}},exit:'0',
    browserStdout:JSON.stringify(browser),browserStderr:'',capture:{ok:true,status:0,timedOut:false,overflow:false,error:null,clientReaped:true},observerJoin:{reaped:true,status:0,forced:false},timer:{ok:true,active:'active',target:'meri-browser-assets-poweroff-'+RUN+'.service',next:'15min',uptime:10,remainingSeconds:890}};
}
const verify=(rec,extra=[])=>{rec.browserStdout=JSON.stringify(rec.browser);return pyJson(['--fixture-run',write('rr.json',rec),'--run-id',RUN,...extra]);};

test('pinned seccomp data is exact and unmodified', () => {
  const def = readFileSync(join(INFRA, 'seccomp.default.docker-25.0.16.json'));
  const der = readFileSync(join(INFRA, 'seccomp.chromium-155-amd64.json'));
  assert.equal(def.length, 12828); assert.equal(der.length, 17188);
  const crypto = { createHash };
  assert.equal(createHash('sha256').update(def).digest('hex'), '9c1025c88ccaa517b648da571961838744ea2137f176bfe6a48b21294cae9c76');
  assert.equal(createHash('sha256').update(der).digest('hex'), 'e62f4c3e3e7ce6de099ba7a0e3df0881b7b407b74dc664aef70f76f6316385c6');
  const parsed = JSON.parse(der.toString('utf8'));
  assert.equal(parsed.syscalls.length, 36);
  const tail = parsed.syscalls.slice(31);
  assert.deepEqual(tail.map((r) => r.names[0]), ['clone', 'clone', 'clone', 'unshare', 'chroot']);
  assert.deepEqual(tail.map((r) => (r.args ? r.args[0].value : null)), [268435473, 1879048209, 536870929, 268435456, null]);
  assert.ok(tail.every((r) => r.action === 'SCMP_ACT_ALLOW' && r.includes.arches[0] === 'amd64'));
  assert.equal(der.toString('utf8').endsWith('\n'), true);
});

test('synthesized browser-host stack has the exact pinned identities', () => {
  const r = spawnSync('node', ['infra/browser-qualification/app.mjs', '--run-uuid', RUN, '--assets-image', SUPPORT], { cwd: REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const t = JSON.parse(readFileSync(join(REPO, 'cdk.out', 'browser-qualification', 'MeriGreenfield-BrowserQualification.template.json'), 'utf8'));
  const R = t.Resources; const of = (ty) => Object.values(R).filter((x) => x.Type === ty);
  assert.equal(of('AWS::EC2::Instance').length, 1);
  assert.equal(of('AWS::EC2::SecurityGroup').length, 1);
  assert.equal(of('AWS::EC2::SecurityGroupIngress').length, 1);
  assert.equal(of('AWS::EC2::SecurityGroupEgress').length, 2);
  assert.equal(of('AWS::IAM::Role').length, 1); assert.equal(of('AWS::IAM::Policy').length, 1);
  assert.equal(of('AWS::IAM::InstanceProfile').length, 1); assert.equal(of('AWS::KMS::Key').length, 1);
  assert.equal(of('AWS::Logs::LogGroup').length, 1);
  for (const ty of ['AWS::EC2::NatGateway', 'AWS::EC2::InternetGateway', 'AWS::EC2::VPCPeeringConnection', 'AWS::ECS::Service']) assert.equal(of(ty).length, 0);
  const inst = of('AWS::EC2::Instance')[0].Properties;
  assert.equal(inst.ImageId, 'ami-0fb0f484b75566814');
  assert.equal(inst.InstanceType, 't3.large');
  assert.equal(inst.CreditSpecification.CPUCredits, 'standard');
  assert.equal(inst.InstanceInitiatedShutdownBehavior, 'terminate');
  assert.equal(inst.MetadataOptions.HttpTokens, 'required');
  assert.equal(inst.MetadataOptions.HttpPutResponseHopLimit, 1);
  assert.equal(inst.MetadataOptions.HttpProtocolIpv6, 'disabled');
  assert.equal(inst.MetadataOptions.InstanceMetadataTags, 'disabled');
  assert.equal(inst.KeyName, undefined);
  assert.equal(inst.NetworkInterfaces[0].AssociatePublicIpAddress, false);
  assert.equal(inst.NetworkInterfaces[0].SubnetId, 'subnet-0864c000b771df32c');
  assert.equal(inst.BlockDeviceMappings[0].Ebs.Encrypted, true);
  assert.equal(inst.BlockDeviceMappings[0].Ebs.DeleteOnTermination, true);
  assert.equal(inst.BlockDeviceMappings[0].Ebs.KmsKeyId['Fn::GetAtt'][0].startsWith('HostKey'), true);
  assert.deepEqual(t.Parameters.QualificationRun.AllowedValues, [RUN]);
  assert.deepEqual(t.Parameters.QualificationAssetsImage.AllowedValues, [SUPPORT]);
  const policy = JSON.stringify(of('AWS::IAM::Policy')[0].Properties.PolicyDocument);
  assert.match(policy, /ecr:GetAuthorizationToken/); assert.match(policy, /ecr:BatchGetImage/);
  assert.match(policy, /logs:PutLogEvents/); assert.match(policy, /kms:ViaService/);
  assert.ok(!/s3:|sts:|ec2:|ssm:|ecs:/.test(policy));
  const ingress = of('AWS::EC2::SecurityGroupIngress')[0].Properties;
  assert.equal(ingress.GroupId, 'sg-030c8a7ce5adea043'); assert.equal(ingress.FromPort, 443);
  const egress = of('AWS::EC2::SecurityGroupEgress').map((e) => e.Properties);
  assert.ok(egress.some((e) => e.DestinationPrefixListId === 'pl-63a5400a'));
  assert.ok(!JSON.stringify(t).includes('Fn::ImportValue') && !JSON.stringify(t).includes('BootstrapVersion'));
  const ud = gunzipSync(Buffer.from(inst.UserData, 'base64')).toString('utf8');
  assert.match(ud, /BROWSER_HOST_ASSETS_IMAGE/); assert.match(ud, /meri-never-execute-assets/);
  assert.match(ud, /create --pull never/); assert.ok(ud.includes(RUN));
  assert.match(ud, /BROWSER_HOST_WORKER_CONFIG_ID/); assert.match(ud, /BROWSER_HOST_WORKER_REVISION/);
  assert.ok(ud.includes(CONFIG_ID)); assert.ok(ud.includes(REVISION)); assert.ok(ud.includes(KIND));
  assert.ok(ud.includes(IMAGE));
});

test('bootstrap uses verified seccomp directly and the existing bounded timer', () => {
  const b = readFileSync(join(INFRA, 'bootstrap.sh'), 'utf8');
  assert.match(b, /HOST_DIR=\/opt\/meri-browser-host/);
  assert.match(b, /SECCOMP="\$HOST_DIR\/seccomp\.json"/);
  assert.ok(!b.includes('seccomp.compact')); assert.ok(!/json\.dumps\(json\.load/.test(b));
  assert.match(b, /systemctl is-active "\$TIMER_UNIT\.timer"/);
  assert.match(b, /NextElapseUSecMonotonic/);
  assert.match(b, /--property=Unit --value/);
  assert.ok(!b.includes('--on-active')); assert.ok(!/sleep 900/.test(b));
  assert.match(b, /trap cleanup EXIT/);
  assert.match(b, /remaining\(\)/); assert.match(b, /BOOTSTRAP_DEADLINE/);
  assert.match(b, /DOCKER_CONFIG|AUTH_DIR/); assert.match(b, /--password-stdin/); assert.match(b, /logout/);
  assert.equal(b.split('\n').filter((l) => /\bdocker create\b/.test(l)).length, 1);
  assert.ok(!/\bdocker run\b/.test(b));
  assert.match(b, /--network none/); assert.match(b, /--read-only/); assert.match(b, /--cap-drop ALL/);
  assert.match(b, /no-new-privileges/); assert.match(b, /--pids-limit 512/); assert.match(b, /--memory 4g/);
  assert.match(b, /--cpus 2/); assert.match(b, /--shm-size 1g/); assert.match(b, /--entrypoint node/);
  assert.match(b, /--capture-browser/);
  assert.match(b, /capture_budget.*120/);
  assert.match(b, /BOOTSTRAP_DEADLINE=480/);
  assert.match(b, /WORK_DEADLINE=420/);
  assert.match(b, /--timer-state/);
  assert.match(b, /sys\.version_info\[:2\]==\(3,9\)/);
  assert.match(b, /"\$WORK_DIR\/conversation" "\$WORK_DIR\/config" "\$WORK_DIR\/home"/);
  assert.ok(!/bounded \d+ wait/.test(b));
  assert.ok(b.indexOf("trap cleanup EXIT") < b.indexOf("bounded 5 mkdir"));
  assert.ok(b.indexOf("pull credentials remain") < b.indexOf("docker create"));
  assert.ok(!/log-driver awslogs/.test(b)); assert.ok(!/\s-e \s|--env /.test(b));
  assert.match(b, /put-log-events/); assert.match(b, /--put-response/);
  assert.match(b, /AWS_MAX_ATTEMPTS=1/); assert.match(b, /AWS_PAGER=''/);
  assert.match(b, /enableKeyRotation|chown -R 10001:10001/);
  // W02-16 provenance guard: pinned ref + config ID + OCI revision + kind before create.
  assert.match(b, /# >>> WORKER-PROVENANCE-GUARD/);
  assert.match(b, /# <<< WORKER-PROVENANCE-GUARD <<</);
  assert.ok(b.indexOf('WORKER-PROVENANCE-GUARD (offline-extractable') < b.indexOf('docker create'));
  assert.match(b, /BROWSER_HOST_WORKER_CONFIG_ID/);
  assert.match(b, /BROWSER_HOST_WORKER_REVISION/);
  assert.match(b, /org\.opencontainers\.image\.revision/);
  assert.match(b, /docker inspect/);
});

test('worker provenance guard fails closed before the sole browser create', () => {
  const b = readFileSync(join(INFRA, 'bootstrap.sh'), 'utf8');
  const start = b.indexOf('# >>> WORKER-PROVENANCE-GUARD');
  const end = b.indexOf('# <<< WORKER-PROVENANCE-GUARD');
  assert.ok(start >= 0 && end > start, 'guard markers present');
  const guard = b.slice(b.indexOf('\n', start) + 1, b.lastIndexOf('\n', end));
  assert.match(guard, /docker inspect/);
  assert.match(guard, /org\.opencontainers\.image\.revision/);
  // Extract and EXECUTE the actual guard with an injected fake docker; every
  // provenance failure must make zero browser creates/starts, the honest tuple
  // reaches the one-create boundary exactly once. This exercises the candidate
  // guard rather than asserting string order or a duplicated predicate.
  const harness = [
    'FAKE_META="$1"',
    'set -euo pipefail',
    'CREATES=0 STARTS=0',
    'bounded(){ local b="$1"; shift; "$@"; }',
    'fail(){ printf "FAIL: %s\\n" "$1" >&2; exit 1; }',
    'docker(){ case "$1" in inspect) printf "%s\\n" "$FAKE_META";; create) CREATES=$((CREATES+1));; start) STARTS=$((STARTS+1));; esac; }',
    `IMAGE=${JSON.stringify(IMAGE)}`,
    `WORKER_CONFIG_ID=${JSON.stringify(CONFIG_ID)}`,
    `WORKER_REVISION=${JSON.stringify(REVISION)}`,
    `WORKER_KIND=${JSON.stringify(KIND)}`,
    guard,
    'docker create --pull never "$IMAGE"',
    'docker start "$IMAGE"',
    'printf "creates=%s starts=%s\\n" "$CREATES" "$STARTS"',
  ].join('\n');
  const run = (meta) => spawnSync('bash', ['-c', harness, 'meri', meta], { encoding: 'utf8' });
  const good = run([CONFIG_ID, IMAGE, REVISION, KIND].join('|'));
  assert.equal(good.status, 0, good.stderr);
  assert.match(good.stdout, /creates=1 starts=1/);
  const bad = [
    ['missing-provenance', ''],
    ['wrong-config-iid', [SUBSTITUTE, IMAGE, REVISION, KIND].join('|')],
    ['wrong-immutable-ref', [CONFIG_ID, OLD_IMAGE, REVISION, KIND].join('|')],
    ['wrong-revision', [CONFIG_ID, IMAGE, 'a'.repeat(40), KIND].join('|')],
    ['wrong-kind', [CONFIG_ID, IMAGE, REVISION, 'worker-full'].join('|')],
  ];
  for (const [name, meta] of bad) {
    const r = run(meta);
    assert.notEqual(r.status, 0, name);
    assert.equal(r.stdout.trim(), '', `${name}: no create/start boundary reached`);
  }
});

test('codex and owner observer replays remain truthful (module-aware)', () => {
  // After extraction the moved collector/classifier/poll bodies resolve their
  // DEFINING module globals, so the raw fixtures (which patch the entry alias `m`)
  // must be replayed through the reviewed module-aware harness. It keeps the exact
  // fixture bytes and all 23 + 33 case names/results, verifies the fixture hashes
  // before use and adds explicit state-identity / effective-patch-routing cases.
  const r = spawnSync(PYTHON, ['-B', join(INFRA, 'module-regressions.py')], { cwd: REPO, encoding: 'utf8' });
  // Preserve complete replay facts once per fresh invocation, including failures.
  writeFileSync(join(TMP, 'module-regressions.stdout.json'), r.stdout, { flag: 'wx' });
  writeFileSync(join(TMP, 'module-regressions.stderr.txt'), r.stderr, { flag: 'wx' });
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(r.stdout);
  assert.equal(s.ok, true, r.stdout);
  // Two codex executions (direct + embedded inside owner) and one owner summary.
  assert.equal(s.codexDirect.count, 23); assert.equal(s.codexDirect.failed, 0);
  assert.equal(s.codexEmbedded.count, 23); assert.equal(s.codexEmbedded.failed, 0);
  assert.equal(s.owner.count, 33); assert.equal(s.owner.failed, 0);
  assert.equal(s.newCases.failed, 0, JSON.stringify(s.newCases));
  assert.equal(s.integrity.failed, 0, JSON.stringify(s.integrity));
  assert.deepEqual(s.errors, {});
  assert.ok(Object.values(s.fixtures).every((v) => v === 'verified'));
});

test('run record accepts only a complete honest run', () => {
  const good = runRecord();
  assert.equal(verify(good).ok, true, JSON.stringify(verify(good)));
  const cases = {
    'status-137': (r) => { r.status = 137; },
    'exit-137': (r) => { r.inspect.State.ExitCode = 137; },
    'still-running': (r) => { r.inspect.State.Running = true; },
    'oom-killed': (r) => { r.inspect.State.OOMKilled = true; },
    'error-state': (r) => { r.inspect.State.Error = 'boom'; },
    'missing-inspect-id': (r) => { r.inspect.Id = ''; },
    'wrong-run': (r) => { r.observer.runId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; },
    'wrong-image': (r) => { r.inspect.Config.Image = 'other'; },
    'old-worker-digest': (r) => { r.workerImage = OLD_IMAGE; r.inspect.Config.Image = OLD_IMAGE; },
    'joint-iid-substitution': (r) => { r.imageID = SUBSTITUTE; r.inspect.Image = SUBSTITUTE; },
    'record-iid-differs': (r) => { r.imageID = SUBSTITUTE; },
    'inspect-iid-differs': (r) => { r.inspect.Image = SUBSTITUTE; },
    'missing-record-iid': (r) => { r.imageID = ''; },
    'malformed-record-iid': (r) => { r.imageID = 'sha256:XYZ'; },
    'missing-inspect-image': (r) => { r.inspect.Image = ''; },
    'wrong-revision-label': (r) => { r.inspect.Config.Labels['org.opencontainers.image.revision'] = 'a'.repeat(40); },
    'missing-revision-label': (r) => { delete r.inspect.Config.Labels['org.opencontainers.image.revision']; },
    'wrong-kind-label': (r) => { r.inspect.Config.Labels['meri.qualification.kind'] = 'worker-full'; },
    'missing-kind-label': (r) => { delete r.inspect.Config.Labels['meri.qualification.kind']; },
    'observer-not-best': (r) => { r.observer.bestOk = false; },
    'unsafe-classification': (r) => { r.observer.unsafeClassification = { ok: false }; },
    'unqualified-observation': (r) => { r.observer.bestObservation.processes[2].capEffHex = '1'; },
    'browser-sandbox-fail': (r) => { r.browser.ok = false; r.browser.sandboxVerified = false; r.browser.reasons = ['sandbox']; },
    'browser-missing-substep': (r) => { r.browser.stepSequence.ran = r.browser.stepSequence.ran.slice(0, 3); },
    'browser-download-mismatch': (r) => { r.browser.download.payloadMatches = false; },
    'credential-env': (r) => { r.inspect.Config.Env = ['AWS_ACCESS_KEY_ID=synthetic']; },
    'docker-socket': (r) => { r.inspect.Mounts.push({ Destination: '/var/run/docker.sock', RW: true }); },
    'cap-add': (r) => { r.inspect.HostConfig.CapAdd = ['SYS_ADMIN']; },
    'seccomp-unconfined': (r) => { r.inspect.HostConfig.SecurityOpt = ['no-new-privileges', 'seccomp=unconfined']; },
    'nnp-false': (r) => { r.inspect.HostConfig.SecurityOpt = ['no-new-privileges=false', 'seccomp=/opt/meri-browser-host/seccomp.json']; },
    'negative-bounds': (r) => { r.inspect.HostConfig.Memory = -1; },
    'wrong-entrypoint': (r) => { r.inspect.Config.Entrypoint = ['sh']; },
    'wrong-command': (r) => { r.inspect.Config.Cmd = ['arbitrary']; },
    'extra-mount': (r) => { r.inspect.Mounts.push({ Destination: '/host', RW: true }); },
  };
  for (const [name, mutate] of Object.entries(cases)) { const r = runRecord(); mutate(r); assert.equal(verify(r).ok, false, name); }
});

test('export protocol is complete and reconstruction is strict', () => {
  const big = 'x'.repeat(20000);
  const spec = { runId: RUN, context: context(), records: { a: 'complete-small-record', b: big, c: 'later-required-record' } };
  const plan = pyJson(['--export-protocol', write('spec.json', spec)]);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  assert.ok(plan.manifest.records.find((r) => r.name === 'b').chunks >= 4);
  const evPath = write('events.json', plan.events);
  assert.equal(pyJson(['--validate-export', evPath, '--run-id', RUN]).ok, true);
  const ev = JSON.parse(readFileSync(evPath, 'utf8'));
  const chunkIdx = ev.findIndex((e) => JSON.parse(e.message).kind === 'chunk');
  const variants = {
    loss: (x) => x.splice(chunkIdx, 1),
    duplicate: (x) => x.splice(chunkIdx, 0, x[chunkIdx]),
    hash: (x) => { const d = JSON.parse(x[chunkIdx].message); d.sha256 = 'b'.repeat(64); x[chunkIdx].message = JSON.stringify(d); },
    run: (x) => { const d = JSON.parse(x[chunkIdx].message); d.run = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; x[chunkIdx].message = JSON.stringify(d); },
    truncation: (x) => { const d = JSON.parse(x[chunkIdx].message); d.data = d.data.slice(0, 4); x[chunkIdx].message = JSON.stringify(d); },
    missing_end: (x) => x.pop(),
    reorder: (x) => { const i = x.findIndex((e) => JSON.parse(e.message).kind === 'chunk' && JSON.parse(e.message).index === 1); const j = x.findIndex((e) => JSON.parse(e.message).kind === 'chunk' && JSON.parse(e.message).index === 0); [x[i], x[j]] = [x[j], x[i]]; },
  };
  for (const [name, mutate] of Object.entries(variants)) {
    const x = JSON.parse(JSON.stringify(ev)); mutate(x);
    assert.equal(pyJson(['--validate-export', write('bad.json', x), '--run-id', RUN]).ok, false, name);
  }
  assert.equal(pyJson(['--export-protocol', write('huge.json', { runId: RUN, records: { z: 'y'.repeat(9 * 1024 * 1024) } })]).ok, false);
});

test('PutLogEvents classifier rejects errors and any rejected index (even zero)', () => {
  const ok = (doc) => pyJson(['--put-response', write('put.json', JSON.stringify(doc))]);
  assert.equal(ok({}).ok, true);
  assert.equal(ok({nextSequenceToken:'synthetic'}).ok,true);
  assert.equal(ok({nextSequenceToken:0}).ok,false);
  assert.equal(ok({rejectedLogEventsInfo:null}).ok,false);
  assert.equal(ok({ rejectedLogEventsInfo: {} }).ok, true);
  for (const key of ['expiredLogEventEndIndex', 'tooOldLogEventEndIndex', 'tooNewLogEventStartIndex']) {
    assert.equal(ok({ rejectedLogEventsInfo: { [key]: 0 } }).ok, false, key);
  }
  assert.equal(ok({ rejectedLogEventsInfo: { expiredLogEventEndIndex: 5 } }).ok, false);
  assert.equal(ok({ rejectedLogEventsInfo: { unknownIndex: 0 } }).ok, false);
  assert.equal(ok({ extra: 1 }).ok, false);
  assert.equal(ok({ error: 'boom' }).ok, false);
  const malformed = py([ '--put-response', write('put2.json', 'not-json') ]);
  assert.equal(malformed.status, 3);
});

test('python sources compile without bytecode side effects', () => {
  const code=String.raw`import ast,pathlib,re,sys
root=pathlib.Path(sys.argv[1]);ast.parse((root/'host-evidence.py').read_text(),feature_version=(3,9))
names=('__init__','config','evidence_io','classification','collection','poll')
mods=[root/'host_evidence'/(n+'.py') for n in names]
assert {p.name for p in (root/'host_evidence').iterdir()}=={p.name for p in mods}
for f in mods:ast.parse(f.read_text(),feature_version=(3,9))
b=(root/'bootstrap.sh').read_text()
parts=re.findall(r"<<'(__[A-Z]+__)'.*?\n(.*?)\n\1",b,re.S)
assert len(parts)==4,len(parts)
for _,source in parts:ast.parse(source,feature_version=(3,9))
print('Python3.9 grammar: observer +4 embedded Python blocks; author '+sys.version)`;
  const r = spawnSync(PYTHON, ['-B', '-c', code, INFRA], { cwd: REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!existsSync(join(INFRA, '__pycache__')));
  assert.ok(!existsSync(join(INFRA, 'host_evidence', '__pycache__')));
});

test('Codex owner: frozen collector/classifier/poll/version bodies remain byte-identical to4fd85f7', () => {
  const code=String.raw`import ast,pathlib,subprocess,sys
root=pathlib.Path(sys.argv[1]);base=subprocess.check_output(['git','show','4fd85f7:infra/browser-qualification/host-evidence.py'],text=True)
files=[root/'host-evidence.py']+[root/'host_evidence'/(n+'.py') for n in ('__init__','config','evidence_io','classification','collection','poll')]
def bodies(t):
 d={}
 for n in ast.parse(t).body:
  if isinstance(n,(ast.FunctionDef,ast.ClassDef)):d.setdefault(n.name,[]).append(ast.get_source_segment(t,n))
 return d
b=bodies(base)
exclude={'verify_run_record','build_export_plan','classify_put_response','_load_json','_dump','main','_install_signals'}
frozen={k:v[0] for k,v in b.items() if k not in exclude};assert len(frozen)==39,len(frozen)
seen={}
for fl in files:
 for name,segs in bodies(fl.read_text()).items():seen.setdefault(name,[]).extend(segs)
for name,text in frozen.items():
 assert name in seen,'missing '+name
 assert len(seen[name])==1,'duplicate definition '+name+' x'+str(len(seen[name]))
 assert seen[name][0]==text,'body changed '+name
dups=[n for n,s in seen.items() if len(s)>1];assert not dups,dups
print('39 frozen bodies present exactly once across entry +6 modules')`;
  const r=spawnSync(PYTHON,['-B','-c',code,INFRA],{cwd:REPO,encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/exactly once across entry/);
});

test('Codex owner: original timer window accepts raw/formatted systemd values and rejects ambiguous or insufficient schedules', () => {
  const code=String.raw`import importlib.util,json,sys,pathlib
sys.path.insert(0,str(pathlib.Path(sys.argv[1]).resolve().parent))
s=importlib.util.spec_from_file_location('m',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
run=sys.argv[2];target='meri-browser-assets-poweroff-'+run+'.service'
good=[('900000000',10,890),('15min',10,890),('14min 59s',10,889),('8min 10s',10,480),('900s',0,900)]
for value,uptime,left in good:
 r=m.timer_record('active',target,value,run,uptime);assert r['ok'] is True and r['remainingSeconds']==left,r
bad=[('0',10),('n/a',10),('infinity',10),('',10),('900',10),('8min',1),('16min',0),('15min',True),('15min',float('nan')),('15min',float('inf')),('15min',-1),('15 min',10),('14min bogus',10)]
for value,uptime in bad:
 r=m.timer_record('active',target,value,run,uptime);assert r['ok'] is False,r;json.dumps(r,allow_nan=False)
assert not m.timer_record('inactive',target,'15min',run,10)['ok']
assert not m.timer_record('active','foreign.service','15min',run,10)['ok']
assert not m.timer_record('active',target,'15min','INVALID',10)['ok']
print(json.dumps({'positive':len(good),'negative':len(bad)+3}))`;
  const r=spawnSync(PYTHON,['-B','-c',code,OBS,RUN],{cwd:REPO,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),{positive:5,negative:16});
});

test('Codex owner: actual-flow facts, image environment/mounts and full output cannot be forged into passing', () => {
  const cases={
    booleanStatus:r=>r.status=false,booleanExit:r=>r.inspect.State.ExitCode=false,
    missingSupport:r=>delete r.supportImage,badSupport:r=>r.supportImage='untrusted/repo@sha256:'+'a'.repeat(64),sameSupportWorker:r=>r.supportImage=IMAGE,
    imageIDMismatch:r=>r.imageID='sha256:'+'f'.repeat(64),foreignWorkspace:r=>r.inspect.Mounts[0].Source='/root/.aws',
    arbitraryEnv:r=>r.inspect.Config.Env.push('NODE_OPTIONS=--require=/workspace/inject.mjs'),duplicateEnv:r=>r.inspect.Config.Env.push(r.inspect.Config.Env[0]),
    stringUID:r=>r.browser.uid='0',wrongExe:r=>r.browser.browserProcess.exe='/bin/sh',noVersion:r=>delete r.browser.versionData,
    noReasons:r=>delete r.browser.reasons,noInventory:r=>r.browser.processes=[],
    duplicateSandbox:r=>r.browser.sandbox.rows.unshift(['Layer 1 Sandbox','None']),
    substringNNP:r=>r.inspect.HostConfig.SecurityOpt[0]='prefix-no-new-privileges',missingPrivilege:r=>delete r.inspect.HostConfig.Privileged,
    wrongProfile:r=>{r.profile.path='/tmp/other';r.inspect.HostConfig.SecurityOpt[1]='seccomp=/tmp/other';},
    wrongSource:r=>r.source.observer.sha256='b'.repeat(64),missingObserverOK:r=>delete r.observer.ok,
    missingJoin:r=>delete r.observerJoin,forcedJoin:r=>r.observerJoin.forced=true,unreapedCapture:r=>r.capture.clientReaped=false,
    missingTimer:r=>delete r.timer,noSchedule:r=>r.timer.next='0',wrongStepDetail:r=>r.browser.stepSequence.details.snapshot='missing marker',
    missingGuestVersion:r=>delete r.pythonVersion,wrongGuestVersion:r=>r.pythonVersion='3.14.7',
  };
  for(const[name,mutate] of Object.entries(cases)){const r=runRecord();mutate(r);assert.equal(verify(r).ok,false,name);}
  const partial=runRecord();partial.browserStdout='{"probe":"browser"';
  assert.equal(pyJson(['--fixture-run',write('partial-stdout.json',partial),'--run-id',RUN]).ok,false);
  const optional=runRecord();optional.browser.tools=[];optional.browser.stepSequence.ran.shift();optional.browser.stepSequence.notRun=['get_config'];optional.browser.stepSequence.details.get_config='browser_get_config tool absent';delete optional.browser.rawResults.get_config;
  assert.equal(verify(optional).ok,true,'actual optional get_config absence is not a browser failure');
  const inline=runRecord();inline.inspect.HostConfig.SecurityOpt[1]='seccomp='+readFileSync(join(INFRA,'seccomp.chromium-155-amd64.json'),'utf8');
  assert.equal(verify(inline).ok,true,'serialized Docker profile retains exact reviewed rules');
});

test('Codex owner: strict export fields/counts/context/bounds and reconstruction bytes', () => {
  const plan=pyJson(['--export-protocol',write('owner-spec.json',{runId:RUN,context:context(),records:{a:'small',b:'x'.repeat(14000)}})]);
  assert.equal(plan.ok,true);assert.ok(plan.events.every(e=>Number.isInteger(e.timestamp)&&e.timestamp>Date.UTC(2026,0,1)));
  const parsed=()=>plan.events.map(e=>JSON.parse(e.message));
  const variants={extra:d=>d[0].unknown='x',huge:d=>d[0].unknown='x'.repeat(20000),contextMissing:d=>delete d.at(-2).context,
    countWrong:d=>{d.at(-2).count=99;d.at(-1).records=99;},chunkCount:d=>d[0].count=999,
    duplicateManifest:d=>d.at(-2).records.push(structuredClone(d.at(-2).records[0])),negativeIndex:d=>d[0].index=-1,
    booleanBytes:d=>d[0].bytes=true,contextRun:d=>d.at(-2).context.run='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    sourceHash:d=>d.at(-2).context.source.seccomp.sha256='b'.repeat(64),nan:d=>d.at(-2).totalRawBytes=null};
  for(const[name,mutate] of Object.entries(variants)){
    const docs=parsed();mutate(docs);docs.at(-1).manifestSha256=createHash('sha256').update(JSON.stringify(docs.at(-2),Object.keys(docs.at(-2)).sort())).digest('hex');
    // Wrong hashes are NOT the only guard: recompute canonical hash in Python below.
    const code='import importlib.util,json,hashlib,sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(sys.argv[1])));s=importlib.util.spec_from_file_location("m",sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);d=json.load(open(sys.argv[2]));d[-1]["manifestSha256"]=hashlib.sha256(m._finite_json(d[-2]).encode()).hexdigest();print(json.dumps(m.validate_export([{"timestamp":1,"message":m._finite_json(x)} for x in d])))';
    const r=spawnSync(PYTHON,['-B','-c',code,OBS,write('owner-mutated.json',docs)],{cwd:REPO,encoding:'utf8'});
    assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).ok,false,name);
  }
  assert.equal(pyJson(['--validate-export',write('one-event.json',[{timestamp:1,message:JSON.stringify({kind:'end',run:RUN,stream:'host-'+RUN})}])]).ok,false);
  const valid=pyJson(['--validate-export',write('owner-events.json',plan.events),'--run-id',RUN]);
  assert.equal(valid.reconstructed.a,'small');assert.equal(valid.reconstructed.b,'x'.repeat(14000));
  const duplicateKey=structuredClone(plan.events);duplicateKey[0].message=duplicateKey[0].message.replace('"index":0','"index":99,"index":0');
  assert.equal(pyJson(['--validate-export',write('duplicate-key.json',duplicateKey)]).ok,false);
});

test('Codex owner: bounded capture and assembly use injected pipes/processes only and retain full records', () => {
  const fixture=write('owner-good.json',runRecord());
  const code=String.raw`
import copy,importlib.util,json,os,pathlib,sys,tempfile
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(sys.argv[1]).resolve().parent))
s=importlib.util.spec_from_file_location('m',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
root=pathlib.Path(sys.argv[2]).parent
checks=[]
def check(name,yes):checks.append(dict(name=name,passed=bool(yes)))
class Stream:
 def __init__(self,fd):self.fd=fd
 def fileno(self):return self.fd
 def close(self):pass
class Proc:
 def __init__(self,mode):self.mode=mode;self.pid=424242;self.stdout=Stream(100);self.stderr=Stream(101);self.kills=0;self.waits=0
 def wait(self,timeout):self.waits+=1;return -9 if self.kills else 0
 def kill(self):self.kills+=1
class Selector:
 def __init__(self):self.keys={}
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def register(self,f,e,d):self.keys[f.fd]=SimpleNamespace(fileobj=f,data=d)
 def unregister(self,f):self.keys.pop(f.fd)
 def select(self,t):return [(k,1) for k in list(self.keys.values())]
for mode in ('good','timeout','overflow','late'):
 out=pathlib.Path(tempfile.mkdtemp(dir=root,prefix='fake-capture-'));p=Proc(mode);parts={100:[b'stdout',b''],101:[b'stderr',b'']};ticks=iter([0,0,0,121] if mode=='late' else [0,2] if mode=='timeout' else [])
 def clock():return next(ticks,0)
 def read(fd,n):return b'x'*(m.CAPTURE_FILE_MAX+1) if mode=='overflow' else parts[fd].pop(0)
 launched=[]
 def popen(argv,**kwargs):launched.append((argv,kwargs));return p
 with patch.object(m.os,'read',side_effect=read),patch.object(m,'process_platform_linux',return_value=False):
  r=m.capture_browser('c'*64,str(out),1 if mode=='timeout' else 120,popen,Selector,clock)
 check(mode+'-verdict',r['ok']==(mode=='good'));check(mode+'-reaped',r['clientReaped'] and p.waits==1)
 check(mode+'-one-owned-start',len(launched)==1 and launched[0][0]==['docker','start','--attach','c'*64] and launched[0][1]['start_new_session'] is True)
 if mode in ('timeout','overflow'):check(mode+'-killed',p.kills==1)
 if mode=='good':check('full-two-pipes',(out/'browser.stdout').read_bytes()==b'stdout' and (out/'browser.stderr').read_bytes()==b'stderr')
r=json.load(open(sys.argv[2]));out=pathlib.Path(tempfile.mkdtemp(dir=root,prefix='fake-assembly-'))
r['observer']['retainedFullEvidence']='x'*100000;r['browser']['prelaunch']['retainedFullEvidence']='y'*100000;r['browserStdout']=json.dumps(r['browser']);r['browserStderr']='z'*100000
mapping={'host-evidence.json':r['observer'],'container-inspect.json':[r['inspect']],'versions.json':r['versions'],'preflight.json':r['preflight'],'timer.json':r['timer'],'capture.json':r['capture'],'observer-join.json':r['observerJoin']}
for name,value in mapping.items():(out/name).write_text(json.dumps(value))
for name,value in {'browser.stdout':r['browserStdout'],'browser.stderr':r['browserStderr'],'authoritative-exit':'0'}.items():(out/name).write_text(value)
with patch.object(m.sys,'version_info',(3,9,25)):
 a=m.assemble_run_record(str(out),r['runId'],0,r['supportImage'],r['workerImage'])
check('assemble-complete-positive',m.verify_run_record(a)['ok']);check('full-stdout-no-tail',a['browserStdout']==r['browserStdout']);check('full-stderr-no-tail',a['browserStderr']==r['browserStderr']);check('full-best-observation',a['observer']['retainedFullEvidence']=='x'*100000)
spec=m.assemble_export_records(a,r['runId']);p=m.build_export_protocol(spec['records'],r['runId'],spec['context']);v=m.validate_export(p['events'],r['runId'],expected_context=spec['context'])
check('full-protocol-positive',v['ok']);check('full-stdout-reconstructed',v['reconstructed']['browserStdout']==r['browserStdout']);check('full-stderr-reconstructed',v['reconstructed']['browserStderr']==r['browserStderr'])
wrong=copy.deepcopy(spec['context']);wrong['supportImage']=wrong['supportImage'].split('@')[0]+'@sha256:'+'b'*64
check('owner-context-mismatch',not m.validate_export(p['events'],r['runId'],expected_context=wrong)['ok'])
bad=copy.deepcopy(p);bad['batches']=[[0]]
try:m.render_export_batches(bad,str(out/'bad-batches'));rejected=False
except ValueError:rejected=True
check('tampered-batches-before-write',rejected and not(out/'bad-batches').exists())
check('epoch-timestamp-denied',not m.build_export_protocol({'a':'x'},r['runId'],spec['context'],0)['ok'])
print(json.dumps(dict(passed=sum(c['passed'] for c in checks),failed=sum(not c['passed'] for c in checks),checks=checks)))
`;
  const r=spawnSync(PYTHON,['-B','-c',code,OBS,fixture],{cwd:REPO,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout);assert.equal(result.failed,0,JSON.stringify(result));
  write('owner-capture-results.json',result);
});
