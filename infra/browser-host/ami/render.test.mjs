import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,chmodSync,existsSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as ami from './render.mjs';
import {validateBrowserHostLayout} from '../../../apps/runtime/browser-host-service/installed.mjs';
import {BUNDLE_FILES,PROTECTED_ROOT,PROTECTED_HELPER,PROTECTED_PROGRAM} from '../../../apps/runtime/native-processing-host/protected-bootstrap.mjs';
import {createNativeBootstrapDocument,NATIVE_BOOTSTRAP_PROGRAM,NATIVE_BOOTSTRAP_NODE} from '../../../apps/runtime/native-processing-host/bootstrap-document.mjs';
import {compileProvisionedBrowserHostTemplate} from '../provisioned-stack.mjs';
import {BROWSER_HOST_REPOSITORY} from '../registry-stack.mjs';

const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
const input=()=>({sourceCommit:'a'.repeat(40),imageDigest:'sha256:'+'b'.repeat(64),helperSha256:'1'.repeat(64),nativeHostRelayHelperSha256:'2'.repeat(64),programSha256:'3'.repeat(64)});
const sha=text=>createHash('sha256').update(text).digest('hex');
const dockerfile=readFileSync(new URL('../../../apps/runtime/Dockerfile.browser-host',import.meta.url),'utf8');
const posix=path=>process.platform==='win32'?path.replace(/\\/gu,'/').replace(/^([A-Za-z]):/u,(_,d)=>`/${d.toLowerCase()}`):path;
const syntax=(name,text)=>{const dir=mkdtempSync(join(tmpdir(),'ami-'));const file=join(dir,name);writeFileSync(file,text);
 const r=spawnSync(bash,['-n',posix(file)],{encoding:'utf8'});assert.equal(r.status,0,`${name}: ${r.stderr}`);};

test('the profile is the browser layout the host reads, bound to the build facts, with one stable digest',()=>{
 const profile=ami.renderProfile(input()),parsed=JSON.parse(profile.text);
 assert.equal(profile.sha256,sha(profile.text));assert.equal(profile.text,ami.renderProfile(input()).text);
 assert.deepEqual(Object.keys(parsed).sort(),['bootstrapSha256','helperSha256','imageDigest','layout','programSha256','sourceCommit']);
 assert.equal(parsed.bootstrapSha256,parsed.programSha256);
 assert.equal(Object.hasOwn(parsed,'bootId')||Object.hasOwn(parsed,'instanceId'),false,'dynamic identity is separate');
 const layout=validateBrowserHostLayout(parsed.layout);
 assert.equal(layout.paths.helperPath,PROTECTED_HELPER);assert.equal(layout.network.privateInterfaceName,'ens5');
 assert.deepEqual(layout.limits,{deadlineMaxMs:5000,maxFreshMs:5000,localSettleMs:5000,memoryBytes:2147483648,pidsMax:512,cpuQuotaUs:200000,periodUs:100000});
 assert.notEqual(ami.renderProfile({...input(),sourceCommit:'c'.repeat(40)}).sha256,profile.sha256);
});

test('every identity and path of the profile is what the image actually creates',()=>{
 for(const [name,uid] of Object.entries({sdk:1001,browser:2002,hostRelay:3001,localRelay:3002,proxy:3003}))
  assert.equal(ami.BROWSER_HOST_LAYOUT.identities[name].uid,uid),assert.match(dockerfile,new RegExp(`addgroup -g ${uid} \\S+ && adduser -D -H -u ${uid} `,'u'));
 assert.match(dockerfile,/\/opt\/meri\/meri-host-launcher/u);assert.match(dockerfile,/\/opt\/meri\/meri-host-relay-launcher/u);
 assert.match(dockerfile,/chromium-1247/u);assert.match(dockerfile,/PLAYWRIGHT_BROWSERS_PATH=\/opt\/meri\/browsers/u);
 assert.ok(dockerfile.includes(`ln -s /opt/meri/apps/runtime/native-processing-host/protected-bootstrap.mjs ${NATIVE_BOOTSTRAP_PROGRAM}`));
 assert.equal(PROTECTED_PROGRAM,NATIVE_BOOTSTRAP_PROGRAM);assert.equal(NATIVE_BOOTSTRAP_NODE,ami.BROWSER_HOST_LAYOUT.paths.nodePath);
 assert.equal(ami.PROTECTED_ROOT,PROTECTED_ROOT);assert.deepEqual([...ami.BUNDLE_FILES],Object.values(BUNDLE_FILES));
 assert.equal(createNativeBootstrapDocument().mainSteps[0].inputs.runCommand[0],`${NATIVE_BOOTSTRAP_NODE} ${NATIVE_BOOTSTRAP_PROGRAM}`);
});

test('the log group and repository are the ones the static stacks create and the instance role may use',()=>{
 const t=compileProvisionedBrowserHostTemplate({vpcId:'vpc-0123456789abcdef0',vpcCidr:'10.42.0.0/16',controlSecurityGroupId:'sg-0123456789abcdef0',imageRepository:ami.REPOSITORY,logGroupName:ami.LOG_GROUP});
 assert.equal(t.Resources.BrowserHostLogGroup.Properties.LogGroupName,ami.LOG_GROUP);
 assert.equal(ami.REPOSITORY,BROWSER_HOST_REPOSITORY);assert.equal(ami.LISTENER_PORT,9444);assert.equal(ami.INSTANCE_TYPE,'c7g.large');
});

test('the input is closed and exact, and a build result must be a clean arm64 scan of the browser repository',()=>{
 for(const bad of [{...input(),extra:1},{...input(),sourceCommit:'z'},{...input(),imageDigest:'sha256:x'},{...input(),helperSha256:'1'.repeat(63)},
  {...input(),nativeHostRelayHelperSha256:'1'.repeat(64)},null,[]])
  assert.throws(()=>ami.validateAmiInput(bad),{code:'BROWSER_HOST_AMI_RENDER_REFUSED'});
 const result=()=>({repository:ami.REPOSITORY,platform:'linux/arm64',scanStatus:'COMPLETE',findingSeverityCounts:{MEDIUM:3},sourceCommit:'a'.repeat(40),imageDigest:input().imageDigest,
  hashes:{helperSha256:'1'.repeat(64),nativeHostRelayHelperSha256:'2'.repeat(64),programSha256:'3'.repeat(64)}});
 assert.deepEqual({...ami.inputFromBuildResult(result())},input());
 for(const bad of [{...result(),repository:'meri-greenfield/qualification-worker'},{...result(),platform:'linux/amd64'},{...result(),scanStatus:'FAILED'},
  {...result(),findingSeverityCounts:{HIGH:1}},{...result(),findingSeverityCounts:{CRITICAL:1}},{...result(),hashes:{}}])
  assert.throws(()=>ami.inputFromBuildResult(bad),{code:'BROWSER_HOST_AMI_RENDER_REFUSED'});
});

test('the host run script starts the preloaded image by digest with the one privileged container and logs to the host log group',()=>{
 const text=ami.runScript(input());syntax('run.sh',text);
 assert.match(text,/exec \/usr\/bin\/docker run --rm --pull never --name meri-host --privileged --network host --pid host --cgroupns host/u);
 assert.ok(text.includes(`967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/browser-host@${input().imageDigest}`));
 assert.ok(text.includes('awslogs-group=/meri-greenfield/browser-host'));assert.ok(text.includes('"awslogs-stream=$instance"'));
 for(const name of ami.BUNDLE_FILES)assert.ok(text.includes(name),name);
 assert.ok(text.includes('-v /var/lib/meri/native-bootstrap:/var/lib/meri/native-bootstrap'));assert.ok(text.includes('-v /var/lib/meri/browser-workspaces:/var/lib/meri/browser-workspaces'));
 assert.doesNotMatch(text,/--no-sandbox|docker\.sock|-e |--env|password|secret|latest/iu);
});

test('the units wait for the installed bundle and never enable the host service directly',()=>{
 assert.match(ami.HOST_PATH_UNIT,/PathExists=\/var\/lib\/meri\/native-bootstrap\/installed\.json/u);assert.match(ami.HOST_PATH_UNIT,/Unit=meri-host\.service/u);
 assert.match(ami.HOST_UNIT,/Restart=no/u);assert.match(ami.HOST_UNIT,/ConditionPathExists=\/var\/lib\/meri\/native-bootstrap\/installed\.json/u);
 assert.doesNotMatch(ami.HOST_UNIT,/\[Install\]/u);
 assert.match(ami.IDENTITY_UNIT,/Before=amazon-ssm-agent\.service/u);assert.match(ami.IDENTITY_UNIT,/Type=oneshot/u);
 assert.match(ami.SYSCTL,/^user\.max_user_namespaces = 15000$/mu);assert.match(ami.SYSCTL,/^-kernel\.unprivileged_userns_clone = 1$/mu);
 assert.deepEqual(JSON.parse(ami.DOCKER_DAEMON),{bridge:'none',iptables:false,ip6tables:false,'live-restore':false,'log-level':'warn'});
});

test('the guest bake pins every hash, keeps the registry credential out of the image and ships no identity',()=>{
 const text=ami.renderGuestBake(input());syntax('guest-bake.sh',text);
 const profile=ami.renderProfile(input());
 for(const value of [input().helperSha256,input().nativeHostRelayHelperSha256,input().programSha256,profile.sha256,input().imageDigest,ami.NODE_VERSION])assert.ok(text.includes(value),value);
 const at=needle=>{const i=text.indexOf(needle);assert.ok(i>=0,needle);return i;};
 assert.ok(at('docker login')<at('docker pull'));assert.ok(at('docker pull')<at('rm -rf "$scratch"'));assert.ok(at('export DOCKER_CONFIG=$scratch')<at('docker login'));
 assert.ok(at('rm -rf /root/.docker')>at('docker pull'));
 assert.ok(at('dnf install -y docker')<at('systemctl enable --now docker.service'));assert.ok(at('sysctl --system')<at('systemctl enable --now docker.service'));
 assert.ok(at('rm -rf /opt/meri/browsers /opt/meri/browser-host/node_modules')>at('docker cp "$cid:/opt/meri/."'));
 assert.match(text,/systemctl enable meri-host-identity\.service meri-host\.path/u);assert.match(text,/systemctl disable meri-host\.service/u);
 assert.doesNotMatch(text,/systemctl enable[^\n]*meri-host\.service/u);
 assert.match(text,/rm -f \/var\/lib\/meri\/native-bootstrap\/identity\.json/u);
 assert.match(text,/setpriv --reuid=65534 --regid=65534 --clear-groups unshare --user true/u);
 assert.match(text,/NATIVE_PROTECTED_BOOTSTRAP_REFUSED/u);assert.match(text,/aarch64/u);assert.match(text,/truncate -s 0 \/etc\/machine-id/u);
 assert.doesNotMatch(text,/AKIA|BEGIN [A-Z ]*PRIVATE KEY|--no-sandbox/u);
 assert.equal(text,ami.renderGuestBake(input()),'deterministic');
});

test('each file embedded in the guest bake is exactly the reviewed text, including the profile whose digest is the deployment input',()=>{
 const text=ami.renderGuestBake(input());
 const embedded=new Map([...text.matchAll(/cat > (\S+) <<'MERI_EOF'\n([\s\S]*?)MERI_EOF\n/gu)].map(m=>[m[1],m[2]]));
 assert.equal(embedded.get('/var/lib/meri/native-bootstrap/profile.json'),ami.renderProfile(input()).text);
 assert.equal(embedded.get(ami.IDENTITY_SCRIPT),ami.identityScript());assert.equal(embedded.get(ami.RUN_SCRIPT),ami.runScript(input()));
 assert.equal(embedded.get('/etc/systemd/system/meri-host.service'),ami.HOST_UNIT);assert.equal(embedded.get('/etc/sysctl.d/99-meri-browser-host.conf'),ami.SYSCTL);
 assert.equal(embedded.size,8);
});

function runIdentity({instance='i-0123456789abcdef0',boot='123e4567-e89b-42d3-a456-426614174000',tokenFails=false}={}){
 const dir=mkdtempSync(join(tmpdir(),'identity-')),bin=join(dir,'bin'),root=join(dir,'root'),bootFile=join(dir,'boot_id');
 spawnSync(bash,['-c',`mkdir -p ${posix(bin)}`]);
 writeFileSync(bootFile,boot+'\n');
 writeFileSync(join(bin,'curl'),`#!/bin/bash\nargs="$*"\nif [[ $args == *latest/api/token* ]]; then ${tokenFails?'exit 22':'printf TOKEN'}; fi\nif [[ $args == *"X-aws-ec2-metadata-token: TOKEN"*instance-id* ]]; then printf '%s' '${instance}'; fi\n`,{mode:0o755});
 chmodSync(join(bin,'curl'),0o755);
 const script=join(dir,'identity.sh');
 // Windows ACLs refuse chmod 0700 for Git Bash, so there the directory is made plainly; the permission assertions run on POSIX only.
 let text=ami.identityScript({root:posix(root),bootIdPath:posix(bootFile)});if(process.platform==='win32')text=text.replace('install -d -m 0700 "$root"','mkdir -p "$root"');
 writeFileSync(script,text);
 const result=spawnSync(bash,['-c',`PATH=${posix(bin)}:$PATH bash ${posix(script)}`],{encoding:'utf8'});
 return {result,file:join(root,'identity.json'),root};
}
test('the identity script writes the live boot and instance ids, atomically and privately, and nothing on any failure',()=>{
 const ok=runIdentity();assert.equal(ok.result.status,0,ok.result.stderr);
 assert.deepEqual(JSON.parse(readFileSync(ok.file,'utf8')),{bootId:'123e4567-e89b-42d3-a456-426614174000',instanceId:'i-0123456789abcdef0'});
 if(process.platform!=='win32'){assert.equal(statSync(ok.file).mode&0o077,0);assert.equal(statSync(ok.root).mode&0o077,0);}
 for(const bad of [{instance:'not-an-instance'},{boot:'nope'},{tokenFails:true}]){
  const r=runIdentity(bad);assert.notEqual(r.result.status,0);assert.equal(existsSync(r.file),false);
 }
});

test('the guest report and the described image are checked field by field',()=>{
 const report=()=>({marker:'MERI_BAKE_VERIFICATION',ok:true,kernel:'6.1.150-175.280.amzn2023.aarch64',node:ami.NODE_VERSION,imageDigest:input().imageDigest,helperSha256:input().helperSha256,
  nativeHostRelayHelperSha256:input().nativeHostRelayHelperSha256,programSha256:input().programSha256,profileSha256:ami.renderProfile(input()).sha256,identityUnit:'enabled',
  hostPath:'enabled',hostService:'static',sshd:'disabled',userns:true,identityFilePresent:false,dockerCredentials:false});
 assert.equal(ami.verifyGuestReport(report(),input()).profileSha256,ami.renderProfile(input()).sha256);
 for(const over of [{ok:false},{node:'v20.0.0'},{imageDigest:'sha256:'+'f'.repeat(64)},{profileSha256:'0'.repeat(64)},...['enabled','disabled','masked','inactive','unknown'].map(hostService=>({hostService})),{identityFilePresent:true},
  {dockerCredentials:true},{userns:false},{sshd:'enabled'},{kernel:'bad kernel'}])
  assert.throws(()=>ami.verifyGuestReport({...report(),...over},input()),/BROWSER_HOST_AMI_GUEST_REPORT_REFUSED/u);
 const image=()=>({ImageId:'ami-0123456789abcdef0',Name:'n',Architecture:'arm64',State:'available',ImdsSupport:'v2.0',VirtualizationType:'hvm',EnaSupport:true,RootDeviceType:'ebs',
  RootDeviceName:'/dev/xvda',Public:false,BlockDeviceMappings:[{DeviceName:'/dev/xvda',Ebs:{Encrypted:true,VolumeSize:30,VolumeType:'gp3',DeleteOnTermination:true}}]});
 assert.equal(ami.verifyImage(image()).imageId,'ami-0123456789abcdef0');
 const mutate=fn=>{const i=image();fn(i);return i;};
 for(const bad of [mutate(i=>{i.Architecture='x86_64';}),mutate(i=>{i.ImdsSupport=undefined;}),mutate(i=>{i.BlockDeviceMappings[0].Ebs.Encrypted=false;}),
  mutate(i=>{i.BlockDeviceMappings[0].Ebs.VolumeSize=8;}),mutate(i=>{i.BlockDeviceMappings[0].Ebs.VolumeType='gp2';}),mutate(i=>{i.Public=true;}),
  mutate(i=>{i.BlockDeviceMappings.push({DeviceName:'/dev/sdb',Ebs:{}});}),undefined])
  assert.throws(()=>ami.verifyImage(bad),{code:'BROWSER_HOST_AMI_IMAGE_REFUSED'});
});

test('the CLI renders into a new private directory, refuses an existing one, and names the image from the commit and digest',()=>{
 const dir=mkdtempSync(join(tmpdir(),'render-')),result=join(dir,'result.json');
 writeFileSync(result,JSON.stringify({repository:ami.REPOSITORY,platform:'linux/arm64',scanStatus:'COMPLETE',findingSeverityCounts:{},sourceCommit:input().sourceCommit,imageDigest:input().imageDigest,
  hashes:{helperSha256:input().helperSha256,nativeHostRelayHelperSha256:input().nativeHostRelayHelperSha256,programSha256:input().programSha256}}));
 const script=fileURLToPath(new URL('./render.mjs',import.meta.url)),out=join(dir,'out');
 const first=spawnSync(process.execPath,[script,'render','--result',result,'--out',out],{encoding:'utf8'});
 assert.equal(first.status,0,first.stderr);
 const summary=JSON.parse(first.stdout);assert.equal(summary.amiName,`meri-browser-host-${'a'.repeat(12)}-${'b'.repeat(12)}`);
 assert.equal(summary.profileSha256,ami.renderProfile(input()).sha256);assert.equal(readFileSync(join(out,'profile.json'),'utf8'),ami.renderProfile(input()).text);
 assert.equal(readFileSync(join(out,'guest-bake.sh'),'utf8'),ami.renderGuestBake(input()));
 assert.notEqual(spawnSync(process.execPath,[script,'render','--result',result,'--out',out],{encoding:'utf8'}).status,0);
});
