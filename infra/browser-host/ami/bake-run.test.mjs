import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,chmodSync,readFileSync,existsSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as ami from './render.mjs';

// These tests RUN bake.sh (not --plan) against a shim `aws` that keeps a tiny fake EC2 in a state directory, so the exit paths
// are exercised: every exit terminates the builder, found by id and by the run tag, and a failure after imaging records the image.
const root=fileURLToPath(new URL('../../../',import.meta.url));
const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
const script='infra/browser-host/ami/bake.sh';
const posix=path=>process.platform==='win32'?path.replace(/\\/gu,'/').replace(/^([A-Za-z]):/u,(_,d)=>`/${d.toLowerCase()}`):path;
const INSTANCE='i-0123456789abcdef0',IMAGE='ami-0fedcba9876543210',SNAPSHOT='snap-0123456789abcdef0',BASE='ami-0123456789abcdef0';
const input={sourceCommit:'a'.repeat(40),imageDigest:'sha256:'+'b'.repeat(64),helperSha256:'1'.repeat(64),nativeHostRelayHelperSha256:'2'.repeat(64),programSha256:'3'.repeat(64)};

const SHIM=`#!/bin/bash
# fake aws: $4 service, $5 operation (after --region us-east-1 --no-cli-pager)
echo "$*" >> "$SHIM_STATE/calls.log"
svc=$4 op=$5 all="$*"
case "$svc $op" in
 "sts get-caller-identity") echo arn:aws:iam::967807252336:user/shim ;;
 "ssm get-parameter") echo ${BASE} ;;
 "ec2 describe-images")
   if [[ $all == *"Name=name,"* ]]; then :
   elif [[ $all == *"Name=tag:MeriBakeRun"* ]]; then [[ -f $SHIM_STATE/image ]] && echo ${IMAGE} || echo None
   elif [[ $all == *"--image-ids ${BASE}"* ]]; then echo "arm64 amazon ebs /dev/xvda"
   elif [[ $all == *SnapshotId* ]]; then echo ${SNAPSHOT}
   elif [[ $all == *"Images[0].State"* ]]; then echo "\${SHIM_IMAGE_STATE:-available}"
   else cat "$SHIM_DESCRIBED"; fi ;;
 "ec2 describe-instances")
   if [[ $all == *"Name=tag:MeriBakeRun"* ]]; then [[ -f $SHIM_STATE/instance && ! -f $SHIM_STATE/terminated ]] && echo ${INSTANCE}; true
   elif [[ -n \${SHIM_LEFTOVER:-} ]]; then echo ${INSTANCE}; fi ;;
 "ec2 run-instances")
   touch "$SHIM_STATE/instance"
   case "\${SHIM_RUN_INSTANCES:-ok}" in ok) echo ${INSTANCE} ;; error) echo "RequestExpired" >&2; exit 1 ;; garbage) echo None ;; esac ;;
 "ec2 create-image") touch "$SHIM_STATE/image"; echo ${IMAGE} ;;
 "ec2 terminate-instances") touch "$SHIM_STATE/terminated"; echo "terminated" ;;
 "ec2 describe-volumes") echo 0 ;;
 "ssm describe-instance-information") echo Online ;;
 "ssm send-command") echo cmd-1 ;;
 "ssm get-command-invocation")
   if [[ $all == *StandardOutputContent* ]]; then cat "$SHIM_REPORT"; else echo "\${SHIM_STATUS:-Success}"; fi ;;
 *) : ;;
esac
exit 0
`;

function run(scenario={}){
 const dir=mkdtempSync(join(tmpdir(),'bakerun-')),bin=join(dir,'bin'),state=join(dir,'state');
 mkdirSync(bin);mkdirSync(state);
 writeFileSync(join(bin,'aws'),SHIM,{mode:0o755});chmodSync(join(bin,'aws'),0o755);
 writeFileSync(join(bin,'sleep'),'#!/bin/bash\nexit 0\n',{mode:0o755});chmodSync(join(bin,'sleep'),0o755);
 const result=join(dir,'result.json');
 writeFileSync(result,JSON.stringify({repository:ami.REPOSITORY,platform:'linux/arm64',scanStatus:'COMPLETE',findingSeverityCounts:{},sourceCommit:input.sourceCommit,imageDigest:input.imageDigest,
  hashes:{helperSha256:input.helperSha256,nativeHostRelayHelperSha256:input.nativeHostRelayHelperSha256,programSha256:input.programSha256}}));
 const report=join(dir,'report.json');
 writeFileSync(report,JSON.stringify({marker:'MERI_BAKE_VERIFICATION',ok:true,kernel:'6.1.150-175.280.amzn2023.aarch64',node:ami.NODE_VERSION,imageDigest:input.imageDigest,helperSha256:input.helperSha256,
  nativeHostRelayHelperSha256:input.nativeHostRelayHelperSha256,programSha256:input.programSha256,profileSha256:ami.renderProfile(input).sha256,identityUnit:'enabled',hostPath:'enabled',
  hostService:'disabled',sshd:'disabled',userns:true,identityFilePresent:false,dockerCredentials:false})+'\n');
 const described=join(dir,'described.json');
 writeFileSync(described,JSON.stringify({Images:[{ImageId:IMAGE,Name:'n',Architecture:'arm64',State:'available',ImdsSupport:scenario.badImage?undefined:'v2.0',VirtualizationType:'hvm',EnaSupport:true,
  RootDeviceType:'ebs',RootDeviceName:'/dev/xvda',Public:false,BlockDeviceMappings:[{DeviceName:'/dev/xvda',Ebs:{Encrypted:true,VolumeSize:30,VolumeType:'gp3',DeleteOnTermination:true,SnapshotId:SNAPSHOT}}]}]}));
 const evidence=join(dir,'evidence.json');
 const env={...process.env,BUILD_RESULT:posix(result),SUBNET_ID:'subnet-0123456789abcdef0',SECURITY_GROUP_ID:'sg-0123456789abcdef0',INSTANCE_PROFILE_NAME:'profile',EVIDENCE_OUT:posix(evidence),
  PATH:`${posix(bin)}:${process.env.PATH}`,SHIM_STATE:posix(state),SHIM_REPORT:posix(report),SHIM_DESCRIBED:posix(described),...scenario.env};
 const r=spawnSync(bash,[script],{cwd:root,encoding:'utf8',env,timeout:120000});
 const calls=existsSync(join(state,'calls.log'))?readFileSync(join(state,'calls.log'),'utf8').split('\n').filter(Boolean):[];
 return {r,calls,evidence,state,has:name=>existsSync(join(state,name))};
}
const nonceOf=calls=>/Key=MeriBakeRun,Value=([0-9a-f]{16})/u.exec(calls.find(c=>c.includes('run-instances'))??'')?.[1];
const called=(calls,needle)=>calls.filter(c=>c.includes(needle));

test('a clean run terminates the builder once, images it, and leaves a success record',()=>{
 const {r,calls,evidence}=run();
 assert.equal(r.status,0,r.stderr);
 assert.equal(called(calls,'terminate-instances').length,1);
 assert.ok(calls.findIndex(c=>c.includes('create-image'))<calls.findIndex(c=>c.includes('modify-image-attribute --image-id '+IMAGE)));
 const body=JSON.parse(readFileSync(evidence,'utf8'));
 assert.equal(body.amiId,IMAGE);assert.equal(body.schema,'meri-browser-host-ami-evidence/1');assert.equal(body.status,undefined);assert.equal(body.deploymentInputs['bootstrapSpec.profileSha256'],ami.renderProfile(input).sha256);
});

test('every retry gets a fresh client token and run tag while the name stays the same',()=>{
 const a=run(),b=run();
 const token=calls=>/--client-token (\S+)/u.exec(calls.find(c=>c.includes('run-instances')))[1];
 assert.notEqual(token(a.calls),token(b.calls));assert.equal(token(a.calls).slice(0,34),token(b.calls).slice(0,34));
 assert.equal(token(a.calls).endsWith(nonceOf(a.calls)),true);assert.notEqual(nonceOf(a.calls),nonceOf(b.calls));
 assert.ok(token(a.calls).length<=64);
});

test('an instance EC2 created for a call that never returned is found by the run tag and terminated',()=>{
 for(const mode of ['error','garbage']){
  const {r,calls,evidence}=run({env:{SHIM_RUN_INSTANCES:mode}});
  assert.notEqual(r.status,0,mode);
  const nonce=nonceOf(calls);assert.match(nonce,/^[0-9a-f]{16}$/u);
  assert.ok(called(calls,'describe-instances').some(c=>c.includes(`Name=tag:MeriBakeRun,Values=${nonce}`)),'looked up by the run tag');
  assert.equal(called(calls,`terminate-instances --instance-ids ${INSTANCE}`).length,1,mode);
  assert.equal(called(calls,'create-image').length,0);assert.equal(existsSync(evidence),false);
 }
});

test('a failed guest bake terminates the builder and creates no image',()=>{
 const {r,calls,evidence,has}=run({env:{SHIM_STATUS:'Failed'}});
 assert.notEqual(r.status,0);assert.match(r.stderr,/guest bake ended with status Failed/);
 assert.equal(called(calls,'terminate-instances').length,1);assert.equal(called(calls,'create-image').length,0);
 assert.equal(has('image'),false);assert.equal(existsSync(evidence),false);
});

test('a failure after imaging terminates the builder and records the image and snapshot ids',()=>{
 const {r,calls,evidence}=run({badImage:true});
 assert.notEqual(r.status,0);
 assert.equal(called(calls,'terminate-instances').length,1);
 const body=JSON.parse(readFileSync(evidence,'utf8'));
 assert.equal(body.status,'FAILED_AFTER_IMAGING');assert.equal(body.amiId,IMAGE);assert.deepEqual(body.snapshotIds,[SNAPSHOT]);
 assert.match(body.run,/^[0-9a-f]{16}$/u);assert.ok(body.exitCode!==0);assert.match(r.stderr,/FAILED AFTER IMAGING/);
 const state=run({env:{SHIM_IMAGE_STATE:'failed'}});
 assert.notEqual(state.r.status,0);assert.equal(JSON.parse(readFileSync(state.evidence,'utf8')).amiId,IMAGE);
});

test('a builder of the same name that is still alive blocks a rerun before anything is launched',()=>{
 const {r,calls}=run({env:{SHIM_LEFTOVER:'1'}});
 assert.notEqual(r.status,0);assert.match(r.stderr,/still alive/);
 assert.equal(called(calls,'run-instances').length,0);
});
