// @ts-check
/** Deterministic source of everything the browser-only host AMI contains beyond the base operating system, so each file can
 * be reviewed and tested as text before any instance exists: the reviewed `profile.json` (whose SHA-256 is the deployment
 * input `bootstrapSpec.profileSha256`), the identity, host and path systemd units, the two small root scripts they run,
 * the sysctl and Docker daemon settings, and the guest bake script an SSM Run Command executes on the builder instance.
 * It reads nothing, calls no AWS client and writes only through the CLI below. The inputs are the facts the image build
 * (infra/browser-host/image-build.sh) recorded: source commit, image digest and the three pinned hashes. See README.md. */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const REFUSED='BROWSER_HOST_AMI_RENDER_REFUSED';
const HEX64=/^[0-9a-f]{64}$/u;
const sha256=text=>createHash('sha256').update(text).digest('hex');

export const ACCOUNT='967807252336';
export const REGION='us-east-1';
export const REPOSITORY='meri-greenfield/browser-host';
export const REGISTRY=`${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com`;
export const LOG_GROUP='/meri-greenfield/browser-host';
export const INSTANCE_TYPE='c7g.large';
export const ROOT_VOLUME_GIB=30;
export const NODE_VERSION='v24.22.1';
export const LISTENER_PORT=9444;
export const BASE_AMI_PARAMETER='/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64';
/** Fixed protected layout the bootstrap program and the host service read (native-processing-host/protected-bootstrap.mjs). */
export const PROTECTED_ROOT='/var/lib/meri/native-bootstrap';
export const BUNDLE_FILES=Object.freeze(['host.server.key','host.server.crt','host.client.key','host.client.crt','ca.pem','control-ca.pem']);
export const IDENTITY_SCRIPT='/usr/local/sbin/meri-host-identity';
export const RUN_SCRIPT='/usr/local/sbin/meri-host-run';

/** The browser layout of the reviewed profile (infra values from BROWSER-HOST-PATH-20261102.md step 2; the limits equal the
 * fixture of apps/runtime/browser-host-service/installed.test.mjs; every identity is the one the Dockerfile creates). */
export const BROWSER_HOST_LAYOUT=Object.freeze({kind:'browser-host',
 limits:{deadlineMaxMs:5000,maxFreshMs:5000,localSettleMs:5000,memoryBytes:2147483648,pidsMax:512,cpuQuotaUs:200000,periodUs:100000},
 paths:{helperPath:'/opt/meri/meri-host-launcher',hostRelayHelperPath:'/opt/meri/meri-host-relay-launcher',nodePath:'/usr/local/bin/node',
  cliPath:'/opt/meri/browser-host/node_modules/@playwright/mcp/cli.js',browsersPath:'/opt/meri/browsers',workspaceRoot:'/var/lib/meri/browser-workspaces'},
 identities:{sdk:{uid:1001,gid:1001},browser:{uid:2002,gid:2002},hostRelay:{uid:3001,gid:3001},localRelay:{uid:3002,gid:3002},proxy:{uid:3003,gid:3003}},
 network:{privateInterfaceName:'ens5',browserProxyPort:3128}});

/** @param {unknown} raw */
export function validateAmiInput(raw){
 if(raw===null||typeof raw!=='object'||Array.isArray(raw))fail(REFUSED);
 const v=/** @type {Record<string,unknown>} */(raw);
 if(Object.keys(v).sort().join(',')!=='helperSha256,imageDigest,nativeHostRelayHelperSha256,programSha256,sourceCommit')fail(REFUSED);
 if(typeof v.sourceCommit!=='string'||!/^[0-9a-f]{40}$/u.test(v.sourceCommit)||typeof v.imageDigest!=='string'||!/^sha256:[0-9a-f]{64}$/u.test(v.imageDigest))fail(REFUSED);
 for(const key of ['helperSha256','nativeHostRelayHelperSha256','programSha256'])if(typeof v[key]!=='string'||!HEX64.test(/** @type {string} */(v[key])))fail(REFUSED);
 if(v.helperSha256===v.nativeHostRelayHelperSha256)fail(REFUSED);
 return Object.freeze({sourceCommit:/** @type {string} */(v.sourceCommit),imageDigest:/** @type {string} */(v.imageDigest),helperSha256:/** @type {string} */(v.helperSha256),
  nativeHostRelayHelperSha256:/** @type {string} */(v.nativeHostRelayHelperSha256),programSha256:/** @type {string} */(v.programSha256)});
}

/** The image build's result.json holds exactly these facts. @param {any} result */
export function inputFromBuildResult(result){
 if(result===null||typeof result!=='object'||result.repository!==REPOSITORY||result.platform!=='linux/arm64'||result.scanStatus!=='COMPLETE'||
  (result.findingSeverityCounts?.HIGH??0)!==0||(result.findingSeverityCounts?.CRITICAL??0)!==0)fail(REFUSED);
 const h=result.hashes??{};
 return validateAmiInput({sourceCommit:result.sourceCommit,imageDigest:result.imageDigest,helperSha256:h.helperSha256,
  nativeHostRelayHelperSha256:h.nativeHostRelayHelperSha256,programSha256:h.programSha256});
}

/** The reviewed profile. `bootstrapSha256` is the SHA-256 of the fixed bootstrap program (runbook step 2), equal to
 * `programSha256`; the deployment's `bootstrapSha256`, `imageDigest` and `sourceCommit` must equal these values. */
export function renderProfile(input){
 const i=validateAmiInput(input);
 const profile={programSha256:i.programSha256,helperSha256:i.helperSha256,sourceCommit:i.sourceCommit,imageDigest:i.imageDigest,
  bootstrapSha256:i.programSha256,layout:structuredClone(BROWSER_HOST_LAYOUT)};
 const text=JSON.stringify(profile,null,1)+'\n';
 return Object.freeze({text,sha256:sha256(text)});
}

/** @param {{root?:string,bootIdPath?:string,imds?:string}} [options] test seams only; production uses the defaults */
export function identityScript({root=PROTECTED_ROOT,bootIdPath='/proc/sys/kernel/random/boot_id',imds='http://169.254.169.254'}={}){
 return `#!/bin/bash
# Writes the live boot id and instance id the protected bootstrap binds every request to. Runs at each boot before the SSM
# agent; the AMI carries no identity file. IMDSv2 only (token first); any failure leaves no file and the bootstrap refuses.
set -Eeuo pipefail
umask 077
root=${root}
token=$(curl -sS --fail --max-time 5 -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' ${imds}/latest/api/token)
instance=$(curl -sS --fail --max-time 5 -H "X-aws-ec2-metadata-token: $token" ${imds}/latest/meta-data/instance-id)
boot=$(tr -d '\\n' < ${bootIdPath})
[[ $instance =~ ^i-[0-9a-f]{8,17}$ ]] || exit 1
[[ $boot =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]] || exit 1
install -d -m 0700 "$root"
tmp=$(mktemp "$root/.identity.XXXXXX")
printf '{"bootId":"%s","instanceId":"%s"}\\n' "$boot" "$instance" > "$tmp"
mv -f "$tmp" "$root/identity.json"
`;
}

/** @param {{imageDigest:string}} input */
export function runScript(input){
 const i=validateAmiInput({sourceCommit:'0'.repeat(40),helperSha256:'1'.repeat(64),nativeHostRelayHelperSha256:'2'.repeat(64),programSha256:'3'.repeat(64),...input});
 return `#!/bin/bash
# Starts the browser host service once the protected bundle is complete. The image is preloaded by digest and never pulled
# here. The container is the one privileged process of the host: it owns the cgroups, the network namespaces and the
# launcher helpers; every browser, relay and proxy process is dropped to its fixed unprivileged identity by the helpers.
set -Eeuo pipefail
root=${PROTECTED_ROOT}
for name in ${BUNDLE_FILES.join(' ')} installed.json profile.json identity.json; do
  [[ -f $root/$name ]] || { echo "missing $name" >&2; exit 1; }
done
mkdir -p /run/netns
mountpoint -q /run/netns || mount --bind /run/netns /run/netns
mount --make-rshared /run/netns
instance=$(grep -o '"instanceId":"i-[0-9a-f]*"' "$root/identity.json" | cut -d'"' -f4)
[[ $instance =~ ^i-[0-9a-f]{8,17}$ ]] || exit 1
exec /usr/bin/docker run --rm --pull never --name meri-host --privileged --network host --pid host --cgroupns host \\
  --log-driver awslogs --log-opt awslogs-region=${REGION} --log-opt awslogs-group=${LOG_GROUP} --log-opt "awslogs-stream=$instance" \\
  --log-opt mode=non-blocking --log-opt max-buffer-size=4m \\
  -v /sys/fs/cgroup:/sys/fs/cgroup -v /run/netns:/run/netns:rshared \\
  -v ${PROTECTED_ROOT}:${PROTECTED_ROOT} -v ${BROWSER_HOST_LAYOUT.paths.workspaceRoot}:${BROWSER_HOST_LAYOUT.paths.workspaceRoot} \\
  ${REGISTRY}/${REPOSITORY}@${i.imageDigest}
`;
}

export const IDENTITY_UNIT=`[Unit]
Description=Meri host identity (boot id and instance id for the protected bootstrap)
Wants=network-online.target
After=network-online.target
Before=amazon-ssm-agent.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=${IDENTITY_SCRIPT}

[Install]
WantedBy=multi-user.target
`;
export const HOST_PATH_UNIT=`[Unit]
Description=Start the Meri browser host once the protected bundle is installed

[Path]
PathExists=${PROTECTED_ROOT}/installed.json
Unit=meri-host.service

[Install]
WantedBy=multi-user.target
`;
export const HOST_UNIT=`[Unit]
Description=Meri browser-only host service
Requires=docker.service meri-host-identity.service
After=docker.service meri-host-identity.service network-online.target
ConditionPathExists=${PROTECTED_ROOT}/installed.json

[Service]
Type=simple
Restart=no
TimeoutStopSec=60
ExecStart=${RUN_SCRIPT}
ExecStop=/usr/bin/docker stop --time 30 meri-host
`;
/** Chromium's namespace sandbox needs unprivileged user namespaces; the second key exists on some kernels only. */
export const SYSCTL=`user.max_user_namespaces = 15000
-kernel.unprivileged_userns_clone = 1
`;
/** Every host container uses the host network, so Docker needs no bridge and must not install firewall rules beside the
 * host nft guard of the egress proxy uid. */
export const DOCKER_DAEMON=JSON.stringify({bridge:'none',iptables:false,'ip6tables':false,'live-restore':false,'log-level':'warn'},null,1)+'\n';

/** @param {{sourceCommit:string,imageDigest:string,helperSha256:string,nativeHostRelayHelperSha256:string,programSha256:string}} input */
export function renderGuestBake(input){
 const i=validateAmiInput(input);
 const profile=renderProfile(i);
 const ref=`${REGISTRY}/${REPOSITORY}@${i.imageDigest}`;
 const files=[
  ['/etc/sysctl.d/99-meri-browser-host.conf',SYSCTL,'0644'],
  ['/etc/docker/daemon.json',DOCKER_DAEMON,'0644'],
  [IDENTITY_SCRIPT,identityScript(),'0700'],
  [RUN_SCRIPT,runScript(i),'0700'],
  ['/etc/systemd/system/meri-host-identity.service',IDENTITY_UNIT,'0644'],
  ['/etc/systemd/system/meri-host.path',HOST_PATH_UNIT,'0644'],
  ['/etc/systemd/system/meri-host.service',HOST_UNIT,'0644'],
  [`${PROTECTED_ROOT}/profile.json`,profile.text,'0600'],
 ];
 for(const [,text] of files)if(text.includes('MERI_EOF'))fail(REFUSED);
 const write=([path,text,mode])=>`install -d -m 0755 "$(dirname ${path})"\ninstall -m ${mode} -o root -g root /dev/null ${path}\ncat > ${path} <<'MERI_EOF'\n${text}MERI_EOF\nchmod ${mode} ${path}\n`;
 return `#!/bin/bash
# Guest bake for the browser-only host AMI, run once as root on a temporary builder instance (AL2023 arm64) by SSM Run
# Command. Verbose output goes to /var/log/meri-bake.log; only the final verification line is printed. Any failed step
# aborts before an image is created. The registry credential lives in a scratch Docker config deleted before the end.
set -Eeuo pipefail
umask 022
exec 3>&1
exec >>/var/log/meri-bake.log 2>&1
trap 'echo "bake failed at line $LINENO" >&3' ERR
REF=${ref}
DIGEST=${i.imageDigest}
EXPECT_HELPER=${i.helperSha256}
EXPECT_RELAY=${i.nativeHostRelayHelperSha256}
EXPECT_PROGRAM=${i.programSha256}
EXPECT_PROFILE=${profile.sha256}
EXPECT_NODE=${NODE_VERSION}
[[ $(uname -m) == aarch64 ]]
grep -q '^ID="amzn"' /etc/os-release && grep -q '^VERSION_ID="2023"' /etc/os-release

dnf install -y docker
${files.slice(0,2).map(write).join('')}sysctl --system
systemctl enable --now docker.service

# Image by digest, with a scratch credential that never reaches the AMI.
scratch=$(mktemp -d)
export DOCKER_CONFIG=$scratch
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${REGISTRY}
docker pull --platform linux/arm64 "$REF"
unset DOCKER_CONFIG
rm -rf "$scratch"
docker image inspect --format '{{json .RepoDigests}}' "$REF" | grep -q "$DIGEST"
[[ $(docker image inspect --format '{{.Architecture}}' "$REF") == arm64 ]]

# Node and the /opt/meri closure the SSM bootstrap document runs on the host, taken from the image itself.
cid=$(docker create --platform linux/arm64 "$REF")
install -d -m 0755 -o root -g root /opt/meri
docker cp "$cid:/usr/local/bin/node" /usr/local/bin/node
docker cp "$cid:/opt/meri/." /opt/meri/
docker rm "$cid"
rm -rf /opt/meri/browsers /opt/meri/browser-host/node_modules
chown -R root:root /opt/meri
chmod -R go-w /opt/meri
chmod 0755 /usr/local/bin/node
chmod 0700 /opt/meri/meri-host-launcher /opt/meri/meri-host-relay-launcher
[[ $(/usr/local/bin/node --version) == "$EXPECT_NODE" ]]
[[ $(sha256sum /opt/meri/meri-host-launcher | cut -d' ' -f1) == "$EXPECT_HELPER" ]]
[[ $(sha256sum /opt/meri/meri-host-relay-launcher | cut -d' ' -f1) == "$EXPECT_RELAY" ]]
[[ $(sha256sum /opt/meri/native-bootstrap.mjs | cut -d' ' -f1) == "$EXPECT_PROGRAM" ]]
if bootstrap_err=$(env -i /usr/local/bin/node /opt/meri/native-bootstrap.mjs 2>&1 >/dev/null); then
  bootstrap_rc=0
else
  bootstrap_rc=$?
fi
[[ $bootstrap_rc == 1 && $bootstrap_err == NATIVE_PROTECTED_BOOTSTRAP_REFUSED ]]

# Protected root, reviewed profile, identity script and units. The AMI ships no identity and no bundle.
install -d -m 0700 -o root -g root ${PROTECTED_ROOT}
install -d -m 0755 -o root -g root ${BROWSER_HOST_LAYOUT.paths.workspaceRoot}
${files.slice(2).map(write).join('')}[[ $(sha256sum ${PROTECTED_ROOT}/profile.json | cut -d' ' -f1) == "$EXPECT_PROFILE" ]]
rm -f ${PROTECTED_ROOT}/identity.json ${PROTECTED_ROOT}/installed.json ${PROTECTED_ROOT}/prepare.json
systemctl daemon-reload
systemctl enable meri-host-identity.service meri-host.path
systemctl disable meri-host.service 2>/dev/null || true
systemctl disable --now sshd.service 2>/dev/null || true
rm -rf /root/.ssh /home/ec2-user/.ssh /etc/ssh/ssh_host_*

# Chromium's namespace sandbox must work for an unprivileged user on this kernel.
setpriv --reuid=65534 --regid=65534 --clear-groups unshare --user true

# Sanitise for imaging: no credentials, no history, no machine identity, no package cache.
rm -rf /root/.docker /root/.aws /root/.bash_history /var/lib/cloud/instances /var/lib/cloud/instance /var/lib/cloud/data
cloud-init clean --logs || true
dnf clean all
truncate -s 0 /etc/machine-id
rm -f /var/lib/systemd/random-seed
journalctl --rotate && journalctl --vacuum-time=1s || true
rm -rf /tmp/* /var/tmp/*
rm -f /root/meri-bake.sh
sync

state() { systemctl is-enabled "$1" 2>/dev/null || true; }
kernel=$(uname -r)
{
  printf '{"marker":"MERI_BAKE_VERIFICATION","ok":true,"kernel":"%s","node":"%s","imageDigest":"%s","helperSha256":"%s","nativeHostRelayHelperSha256":"%s",' "$kernel" "$EXPECT_NODE" "$DIGEST" "$EXPECT_HELPER" "$EXPECT_RELAY"
  printf '"programSha256":"%s","profileSha256":"%s","identityUnit":"%s","hostPath":"%s","hostService":"%s","sshd":"%s","userns":true,' "$EXPECT_PROGRAM" "$EXPECT_PROFILE" "$(state meri-host-identity.service)" "$(state meri-host.path)" "$(state meri-host.service)" "$(state sshd.service)"
  printf '"identityFilePresent":%s,"dockerCredentials":%s}\\n' "$([[ -e ${PROTECTED_ROOT}/identity.json ]] && echo true || echo false)" "$([[ -e /root/.docker/config.json ]] && echo true || echo false)"
} >&3
`;
}

/** The checks the driver applies to the verification line the guest printed. @param {any} observed @param {ReturnType<typeof validateAmiInput>} input */
export function verifyGuestReport(observed,input){
 const i=validateAmiInput(input);
 const profile=renderProfile(i);
 const expected={marker:'MERI_BAKE_VERIFICATION',ok:true,node:NODE_VERSION,imageDigest:i.imageDigest,helperSha256:i.helperSha256,
  nativeHostRelayHelperSha256:i.nativeHostRelayHelperSha256,programSha256:i.programSha256,profileSha256:profile.sha256,identityUnit:'enabled',
  hostPath:'enabled',hostService:'static',userns:true,identityFilePresent:false,dockerCredentials:false};
 if(observed===null||typeof observed!=='object'||Array.isArray(observed)||
  Object.keys(observed).sort().join(',')!==[...Object.keys(expected),'kernel','sshd'].sort().join(','))fail('BROWSER_HOST_AMI_GUEST_REPORT_REFUSED:shape');
 for(const [key,value] of Object.entries(expected))if(observed?.[key]!==value)fail(`BROWSER_HOST_AMI_GUEST_REPORT_REFUSED:${key}`);
 if(typeof observed.kernel!=='string'||!/^[0-9][0-9A-Za-z._-]{1,80}$/u.test(observed.kernel)||observed.sshd==='enabled')fail('BROWSER_HOST_AMI_GUEST_REPORT_REFUSED:sshd');
 return Object.freeze({kernel:observed.kernel,profileSha256:profile.sha256});
}

/** The guest emits one final JSON record. CLI formatting may add blank lines;
 * never fall back to an earlier marker when the final nonblank line is invalid. */
export function parseGuestReport(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>65536)fail('BROWSER_HOST_AMI_GUEST_REPORT_REFUSED:size');
 const line=text.trimEnd().split('\n').at(-1);
 if(!line)fail('BROWSER_HOST_AMI_GUEST_REPORT_REFUSED:empty');
 try{return JSON.parse(line);}catch{fail('BROWSER_HOST_AMI_GUEST_REPORT_REFUSED:json');}
}

/** Failure evidence contains only the known public record fields and byte/hash
 * identities. Never persist arbitrary stdout, malformed JSON or error messages. */
function guestRefusal({reason,inputBytes,reportBytes,input,observed}){
 const publicReport={};
 for(const key of ['helperSha256','nativeHostRelayHelperSha256','programSha256','profileSha256'])
  if(typeof observed?.[key]==='string'&&HEX64.test(observed[key]))publicReport[key]=observed[key];
 for(const key of ['identityUnit','hostPath','hostService','sshd'])
  if(['enabled','disabled','static','masked','indirect','linked','not-found'].includes(observed?.[key]))publicReport[key]=observed[key];
 for(const key of ['ok','userns','identityFilePresent','dockerCredentials'])if(typeof observed?.[key]==='boolean')publicReport[key]=observed[key];
 if(observed?.marker==='MERI_BAKE_VERIFICATION')publicReport.marker=observed.marker;
 if(typeof observed?.imageDigest==='string'&&/^sha256:[0-9a-f]{64}$/u.test(observed.imageDigest))publicReport.imageDigest=observed.imageDigest;
 if(typeof observed?.node==='string'&&/^v[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/u.test(observed.node))publicReport.node=observed.node;
 if(typeof observed?.kernel==='string'&&/^[0-9][0-9A-Za-z._-]{1,80}$/u.test(observed.kernel))publicReport.kernel=observed.kernel;
 const identity=bytes=>bytes===undefined?null:{bytes:bytes.length,sha256:sha256(bytes)};
 const last=reportBytes===undefined?undefined:Buffer.from(reportBytes.toString('utf8').trimEnd().split('\n').at(-1)??'');
 return {status:'FAILED_GUEST_VERIFICATION',reason,inputFile:identity(inputBytes),reportFile:identity(reportBytes),finalLine:identity(last),
  ...(input?{expectedInput:input}:{}),observed:publicReport};
}

/** The AMI as EC2 describes it after imaging and the IMDS attribute change. @param {any} image */
export function verifyImage(image){
 const root=image?.BlockDeviceMappings?.find(m=>m.DeviceName===image.RootDeviceName);
 const ok=image?.Architecture==='arm64'&&image.State==='available'&&image.ImdsSupport==='v2.0'&&image.VirtualizationType==='hvm'&&image.EnaSupport===true&&
  image.RootDeviceType==='ebs'&&image.Public===false&&root?.Ebs?.Encrypted===true&&root.Ebs.VolumeSize===ROOT_VOLUME_GIB&&root.Ebs.VolumeType==='gp3'&&
  root.Ebs.DeleteOnTermination===true&&image.BlockDeviceMappings.length===1;
 if(!ok)fail('BROWSER_HOST_AMI_IMAGE_REFUSED');
 return Object.freeze({imageId:image.ImageId,name:image.Name});
}

export function amiName(input){
 const i=validateAmiInput(input);
 return `meri-browser-host-${i.sourceCommit.slice(0,12)}-${i.imageDigest.slice(7,19)}`;
}

/** @param {string[]} argv */
export function main(argv){
 const arg=name=>{const at=argv.indexOf(name);return at<0?undefined:argv[at+1];};
 const command=argv[0];
 if(command==='render'){
  const result=arg('--result'),out=arg('--out');if(!result||!out)fail(REFUSED);
  const input=inputFromBuildResult(JSON.parse(readFileSync(result,'utf8')));
  if(existsSync(out))fail(REFUSED);mkdirSync(out,{recursive:false,mode:0o700});
  const profile=renderProfile(input);
  const guest=renderGuestBake(input);
  writeFileSync(join(out,'guest-bake.sh'),guest,{flag:'wx',mode:0o600});
  writeFileSync(join(out,'profile.json'),profile.text,{flag:'wx',mode:0o600});
  writeFileSync(join(out,'input.json'),JSON.stringify(input,null,1)+'\n',{flag:'wx',mode:0o600});
  process.stdout.write(JSON.stringify({amiName:amiName(input),profileSha256:profile.sha256,guestBakeSha256:sha256(guest),bootstrapSha256:input.programSha256})+'\n');
 }else if(command==='verify-guest'){
  let inputBytes,reportBytes,input,observed;
  try{
   inputBytes=readFileSync(String(arg('--input')));reportBytes=readFileSync(String(arg('--report')));
   let raw;try{raw=JSON.parse(inputBytes.toString('utf8'));}catch{fail('BROWSER_HOST_AMI_GUEST_INPUT_REFUSED:json');}
   input=validateAmiInput(raw);observed=parseGuestReport(reportBytes.toString('utf8'));
   process.stdout.write(JSON.stringify(verifyGuestReport(observed,input))+'\n');
  }catch(error){
   const out=arg('--failure-out'),reason=/^BROWSER_HOST_AMI_[A-Z_]+(?::[A-Za-z0-9]+)?$/u.test(error?.code??'')?error.code:'BROWSER_HOST_AMI_GUEST_INPUT_READ_REFUSED';
   if(out)try{writeFileSync(out,JSON.stringify(guestRefusal({reason,inputBytes,reportBytes,input,observed}),null,1)+'\n',{flag:'wx',mode:0o600});}
   catch{process.stderr.write('BROWSER_HOST_AMI_GUEST_DIAGNOSTIC_WRITE_REFUSED\n');}
   throw error;
  }
 }else if(command==='verify-image'){
  const described=JSON.parse(readFileSync(String(arg('--described')),'utf8'));
  process.stdout.write(JSON.stringify(verifyImage(described.Images?.[0]))+'\n');
 }else if(command==='evidence'){
  const input=validateAmiInput(JSON.parse(readFileSync(String(arg('--input')),'utf8')));
  const report=verifyGuestReport(parseGuestReport(readFileSync(String(arg('--report')),'utf8')),input);
  const image=verifyImage(JSON.parse(readFileSync(String(arg('--described')),'utf8')).Images?.[0]);
  const out=String(arg('--out'));
  const body={schema:'meri-browser-host-ami-evidence/1',amiId:image.imageId,amiName:image.name,baseAmiId:arg('--base-ami'),builderInstanceId:arg('--builder'),
   instanceType:INSTANCE_TYPE,rootVolume:{gib:ROOT_VOLUME_GIB,type:'gp3',encrypted:true},imdsSupport:'v2.0',kernel:report.kernel,
   sourceCommit:input.sourceCommit,imageDigest:input.imageDigest,helperSha256:input.helperSha256,nativeHostRelayHelperSha256:input.nativeHostRelayHelperSha256,
   programSha256:input.programSha256,profileSha256:report.profileSha256,
   deploymentInputs:{'launch.ImageId':image.imageId,'launch.InstanceType':INSTANCE_TYPE,imageDigest:input.imageDigest,sourceCommit:input.sourceCommit,
    bootstrapSha256:input.programSha256,'bootstrapSpec.programSha256':input.programSha256,'bootstrapSpec.profileSha256':report.profileSha256,
    'bootstrapSpec.hostEndpoint.port':LISTENER_PORT}};
  writeFileSync(out,JSON.stringify(body,null,1)+'\n',{flag:'wx',mode:0o600});
  process.stdout.write(`${out}\n`);
 }else fail(REFUSED);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{main(process.argv.slice(2));}catch(error){process.stderr.write(`${error?.code??'BROWSER_HOST_AMI_RENDER_REFUSED'}\n`);process.exitCode=1;}
}
