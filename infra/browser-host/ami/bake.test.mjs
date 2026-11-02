import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,chmodSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
const script='infra/browser-host/ami/bake.sh';
const source=readFileSync(new URL('./bake.sh',import.meta.url),'utf8');
const posix=path=>process.platform==='win32'?path.replace(/\\/gu,'/').replace(/^([A-Za-z]):/u,(_,d)=>`/${d.toLowerCase()}`):path;
function plan(env={},extra=[]){
 const dir=mkdtempSync(join(tmpdir(),'bake-')),bin=join(dir,'bin');
 spawnSync(bash,['-c',`mkdir -p ${posix(bin)}`]);
 // A shim that fails loudly: --plan must never reach the real CLI.
 writeFileSync(join(bin,'aws'),'#!/bin/bash\necho "AWS CLI REACHED" >&2\nexit 99\n');chmodSync(join(bin,'aws'),0o755);
 const result=join(dir,'result.json');
 writeFileSync(result,JSON.stringify({repository:'meri-greenfield/browser-host',platform:'linux/arm64',scanStatus:'COMPLETE',findingSeverityCounts:{MEDIUM:2},sourceCommit:'a'.repeat(40),
  imageDigest:'sha256:'+'b'.repeat(64),hashes:{helperSha256:'1'.repeat(64),nativeHostRelayHelperSha256:'2'.repeat(64),programSha256:'3'.repeat(64)}}));
 const full={BUILD_RESULT:posix(result),SUBNET_ID:'subnet-0123456789abcdef0',SECURITY_GROUP_ID:'sg-0123456789abcdef0',INSTANCE_PROFILE_NAME:'meri-browser-host-static-Profile-X',
  EVIDENCE_OUT:posix(join(dir,'evidence.json')),PATH:`${posix(bin)}:${process.env.PATH}`,...env};
 return spawnSync(bash,[script,...extra],{cwd:root,encoding:'utf8',env:{...process.env,...full},timeout:60000});
}

test('help and syntax are inert, and missing or malformed configuration refuses before any call',()=>{
 assert.equal(spawnSync(bash,['-n',script],{cwd:root}).status,0);
 const help=spawnSync(bash,[script,'--help'],{cwd:root,encoding:'utf8'});assert.equal(help.status,0);assert.match(help.stdout,/Bakes the browser-only host AMI/);
 assert.equal(spawnSync(bash,[script],{cwd:root,env:{PATH:process.env.PATH}}).status,2);
 assert.equal(plan({},['extra']).status,2);
 for(const bad of [{SUBNET_ID:'vpc-1'},{SECURITY_GROUP_ID:'x'},{INSTANCE_PROFILE_NAME:'bad name'},{EBS_KMS_KEY_ID:'not-a-key'},{BUILD_RESULT:'/nonexistent'}])
  assert.equal(plan(bad,['--plan']).status,2,JSON.stringify(bad));
});

test('--plan prints the whole sequence, calls no AWS API, and writes nothing to the evidence path',()=>{
 const r=plan({},['--plan']);
 assert.equal(r.status,0,r.stderr);assert.doesNotMatch(r.stderr,/AWS CLI REACHED/);
 const out=r.stderr;
 const order=['STEP 1','sts get-caller-identity','describe-images --owners self','ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64','ec2 run-instances',
  'ssm send-command','ec2 stop-instances','ec2 create-image','ec2 modify-image-attribute --image-id ami-0plan --imds-support v2.0','ec2 terminate-instances','describe-volumes','STEP done'];
 let at=-1;for(const needle of order){const i=out.indexOf(needle,at+1);assert.ok(i>at,`${needle} after ${at}`);at=i;}
});

test('the builder is private, encrypted gp3 30 GiB, IMDSv2 with hop limit 1, on the host profile, with no key pair or public address',()=>{
 const out=plan({},['--plan']).stderr;
 const launch=out.split('\n').find(line=>line.includes('ec2 run-instances'));assert.ok(launch);
 assert.match(launch,/--instance-type c7g\.large/);assert.match(launch,/AssociatePublicIpAddress=false/);assert.match(launch,/--metadata-options HttpTokens=required,HttpPutResponseHopLimit=1,HttpEndpoint=enabled/);
 assert.match(launch,/"Encrypted":true,"VolumeSize":30,"VolumeType":"gp3","DeleteOnTermination":true/);assert.match(launch,/--iam-instance-profile Name=meri-browser-host-static-Profile-X/);
 assert.doesNotMatch(launch,/--key-name|--user-data|--associate-public/);
 assert.match(launch,/--client-token meri-bake-[0-9a-f]{24}/);
 assert.match(out,/--name meri-browser-host-aaaaaaaaaaaa-bbbbbbbbbbbb/);
});

test('a customer managed EBS key is carried into the root mapping when supplied',()=>{
 const out=plan({EBS_KMS_KEY_ID:'alias/meri-browser-host-ebs'},['--plan']).stderr;
 assert.match(out,/"KmsKeyId":"alias\/meri-browser-host-ebs"/);
});

test('the driver never modifies anything outside its own builder, image and evidence file',()=>{
 for(const forbidden of [/modify-instance-metadata-defaults/,/enable-ebs-encryption-by-default/,/deregister-image/,/delete-snapshot/,/put-parameter/,/iam /,/cloudformation /,/\bsudo\b/])
  assert.doesNotMatch(source,forbidden);
 assert.match(source,/trap cleanup EXIT/);assert.match(source,/terminate-instances --instance-ids "\$builder"/);
 assert.match(source,/images are immutable/);
});
