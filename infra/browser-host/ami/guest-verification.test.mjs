import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as ami from './render.mjs';

const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
const posix=path=>process.platform==='win32'?path.replace(/\\/gu,'/').replace(/^([A-Za-z]):/u,(_,d)=>`/${d.toLowerCase()}`):path;
const script=fileURLToPath(new URL('./render.mjs',import.meta.url));
const input={sourceCommit:'a'.repeat(40),imageDigest:'sha256:'+'b'.repeat(64),helperSha256:'1'.repeat(64),nativeHostRelayHelperSha256:'2'.repeat(64),programSha256:'3'.repeat(64)};
const report=()=>({marker:'MERI_BAKE_VERIFICATION',ok:true,kernel:'6.1.150-175.280.amzn2023.aarch64',node:ami.NODE_VERSION,imageDigest:input.imageDigest,
 helperSha256:input.helperSha256,nativeHostRelayHelperSha256:input.nativeHostRelayHelperSha256,programSha256:input.programSha256,profileSha256:ami.renderProfile(input).sha256,
 identityUnit:'enabled',hostPath:'enabled',hostService:'static',sshd:'disabled',userns:true,identityFilePresent:false,dockerCredentials:false});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const temporaryDirectories=[];
after(()=>{for(const dir of temporaryDirectories){assert.equal(dirname(resolve(dir)),resolve(tmpdir()));rmSync(dir,{recursive:true,force:true});}});
function files(text,{inputText=JSON.stringify(input),existingFailure}={}){
 const dir=mkdtempSync(join(tmpdir(),'meri-guest-verification-')),inputFile=join(dir,'input.json'),reportFile=join(dir,'stdout.txt'),failure=join(dir,'failure.json');
 temporaryDirectories.push(dir);
 writeFileSync(inputFile,inputText);writeFileSync(reportFile,text);if(existingFailure!==undefined)writeFileSync(failure,existingFailure);
 return {dir,inputFile,reportFile,failure};
}
function verify(text,options){
 const f=files(text,options),r=spawnSync(process.execPath,[script,'verify-guest','--input',f.inputFile,'--report',f.reportFile,'--failure-out',f.failure],{encoding:'utf8'});
 return {...f,r,diagnostic:existsSync(f.failure)?readFileSync(f.failure,'utf8'):null};
}

test('static host-service report matches the protected path-triggered unit; all identity/security fields stay exact',()=>{
 assert.doesNotMatch(ami.HOST_UNIT,/\[Install\]|WantedBy=/u);
 assert.match(ami.HOST_UNIT,/ConditionPathExists=\/var\/lib\/meri\/native-bootstrap\/installed.json/u);
 assert.match(ami.HOST_PATH_UNIT,/PathExists=\/var\/lib\/meri\/native-bootstrap\/installed.json/u);
 assert.match(ami.HOST_PATH_UNIT,/Unit=meri-host.service/u);
 assert.deepEqual(ami.verifyGuestReport(report(),input),{kernel:report().kernel,profileSha256:report().profileSha256});
 const changes=[...['enabled','disabled','masked','inactive','unknown'].map(hostService=>({hostService})),
  {marker:'OTHER'},{ok:false},{node:'v20.0.0'},{imageDigest:'sha256:'+'f'.repeat(64)},
  ...['helperSha256','nativeHostRelayHelperSha256','programSha256','profileSha256'].map(k=>({[k]:'f'.repeat(64)})),
  {identityUnit:'disabled'},{hostPath:'disabled'},{userns:false},{identityFilePresent:true},{dockerCredentials:true},{sshd:'enabled'},{kernel:'bad kernel'},
  {unexpected:'never accepted'}];
 for(const change of changes)assert.throws(()=>ami.verifyGuestReport({...report(),...change},input),/BROWSER_HOST_AMI_GUEST_REPORT_REFUSED/u);
});

test('final nonblank record accepts CLI trailing whitespace and CRLF without searching for an earlier valid marker',()=>{
 const line=JSON.stringify(report());
 for(const text of [line,line+'\n',line+'\r\n\r\n \t\r\n','diagnostic line\n'+line+'\n\n'])
  assert.deepEqual(ami.verifyGuestReport(ami.parseGuestReport(text),input),ami.verifyGuestReport(report(),input));
 for(const text of ['', '\r\n \t\n','not json',line+'\nnot json\n',line+'\n{"marker":"OTHER"}\n','x'.repeat(65537)])
  assert.throws(()=>ami.verifyGuestReport(ami.parseGuestReport(text),input),/BROWSER_HOST_AMI_GUEST_REPORT_REFUSED/u);
});

test('actual CLI accepts formatted static report and writes no refusal artifact',()=>{
 const f=verify('earlier diagnostic\r\n'+JSON.stringify(report())+'\r\n\r\n');
 assert.equal(f.r.status,0,f.r.stderr);assert.equal(f.r.stderr,'');assert.equal(f.diagnostic,null);
 assert.deepEqual(JSON.parse(f.r.stdout),{kernel:report().kernel,profileSha256:report().profileSha256});
});

test('evidence CLI uses the same final-record contract before writing success',()=>{
 for(const valid of [true,false]){
  const f=files(JSON.stringify(report())+(valid?'\r\n\r\n':'\nnot json\n')),described=join(f.dir,'described.json'),out=join(f.dir,'evidence.json');
  writeFileSync(described,JSON.stringify({Images:[{ImageId:'ami-0123456789abcdef0',Name:'synthetic',Architecture:'arm64',State:'available',ImdsSupport:'v2.0',
   VirtualizationType:'hvm',EnaSupport:true,RootDeviceType:'ebs',RootDeviceName:'/dev/xvda',Public:false,
   BlockDeviceMappings:[{DeviceName:'/dev/xvda',Ebs:{Encrypted:true,VolumeSize:30,VolumeType:'gp3',DeleteOnTermination:true}}]}]}));
  const r=spawnSync(process.execPath,[script,'evidence','--input',f.inputFile,'--report',f.reportFile,'--described',described,'--base-ami','synthetic','--builder','synthetic','--out',out],{encoding:'utf8'});
  assert.equal(r.status===0,valid,r.stderr);assert.equal(existsSync(out),valid);
  if(valid)assert.equal(JSON.parse(readFileSync(out,'utf8')).profileSha256,report().profileSha256);
  else assert.match(r.stderr,/BROWSER_HOST_AMI_GUEST_REPORT_REFUSED:json/u);
 }
});

test('actual CLI retains bounded public input/reason on empty, malformed, wrong marker/identity/state and extra fields',()=>{
 const secret='DO_NOT_RETAIN_PRIVATE_TEXT';
 for(const [text,reason] of [[' \n\r\n','empty'],['{'+secret,'json'],
  [JSON.stringify({...report(),marker:secret}),'marker'],[JSON.stringify({...report(),profileSha256:'f'.repeat(64)}),'profileSha256'],
  [JSON.stringify({...report(),hostService:'disabled'}),'hostService'],[JSON.stringify({...report(),unexpected:secret}),'shape']]){
  const f=verify(text);assert.equal(f.r.status,1);assert.equal(f.r.stdout,'');
  assert.match(f.r.stderr,new RegExp('BROWSER_HOST_AMI_GUEST_REPORT_REFUSED:'+reason));
  assert(f.diagnostic.length<4096);assert(!f.diagnostic.includes(secret));
  const d=JSON.parse(f.diagnostic);assert.equal(d.status,'FAILED_GUEST_VERIFICATION');assert.equal(d.reason,'BROWSER_HOST_AMI_GUEST_REPORT_REFUSED:'+reason);
  assert.deepEqual(d.reportFile,{bytes:Buffer.byteLength(text),sha256:sha(text)});assert.deepEqual(d.expectedInput,input);
  if(reason==='empty')assert.equal(d.finalLine.bytes,0);
  if(reason==='hostService')assert.equal(d.observed.hostService,'disabled');
  if(reason==='profileSha256')assert.equal(d.observed.profileSha256,'f'.repeat(64));
 }
});

test('malformed input remains distinct and diagnostic failure never overwrites evidence or hides the original refusal',()=>{
 const bad=verify(JSON.stringify(report()),{inputText:'{"private":"DO_NOT_RETAIN"'});
 assert.equal(bad.r.status,1);assert.match(bad.r.stderr,/BROWSER_HOST_AMI_GUEST_INPUT_REFUSED:json/u);
 const d=JSON.parse(bad.diagnostic);assert.equal(d.reason,'BROWSER_HOST_AMI_GUEST_INPUT_REFUSED:json');assert.equal(d.expectedInput,undefined);assert(!bad.diagnostic.includes('DO_NOT_RETAIN'));
 const prior=verify('',{existingFailure:'foreign evidence'});
 assert.equal(prior.r.status,1);assert.equal(prior.diagnostic,'foreign evidence');
 assert.match(prior.r.stderr,/BROWSER_HOST_AMI_GUEST_DIAGNOSTIC_WRITE_REFUSED/u);assert.match(prior.r.stderr,/BROWSER_HOST_AMI_GUEST_REPORT_REFUSED:empty/u);
});

test('expected env-i refusal stays quiet; wrong status/text and an unexpected later failure still trigger ERR',()=>{
 const guest=ami.renderGuestBake(input),block=guest.slice(guest.indexOf('if bootstrap_err='),guest.indexOf('\n\n# Protected root'));
 assert(block.startsWith('if bootstrap_err='));assert(!guest.includes('set +e'));
 assert.equal(spawnSync(bash,['-n'],{input:guest,encoding:'utf8'}).status,0);
 for(const [rc,message,unexpected,success] of [[1,'NATIVE_PROTECTED_BOOTSTRAP_REFUSED',false,true],
  [0,'NATIVE_PROTECTED_BOOTSTRAP_REFUSED',false,false],[2,'NATIVE_PROTECTED_BOOTSTRAP_REFUSED',false,false],[1,'WRONG_REFUSAL',false,false],
  [1,'NATIVE_PROTECTED_BOOTSTRAP_REFUSED',true,false]]){
  const text=`set -Eeuo pipefail\nexec 3>&1\ntrap 'echo UNEXPECTED_ERR >&3' ERR\nenv(){ printf '%s' '${message}' >&2; return ${rc}; }\n${block}\n${unexpected?'false':'printf CHECK_PASSED'}\n`;
  const r=spawnSync(bash,['--noprofile','--norc'],{input:text,encoding:'utf8'});
  assert.equal(r.status===0,success,JSON.stringify({rc,message,unexpected,stderr:r.stderr}));
  if(success){assert.equal(r.stdout,'CHECK_PASSED');assert.equal(r.stderr,'');}else assert.match(r.stdout,/UNEXPECTED_ERR/u);
 }
});

test('actual driver capture/verify boundary survives blank CLI formatting and retains refusal before later steps',()=>{
 const bake=readFileSync(new URL('./bake.sh',import.meta.url),'utf8'),start=bake.indexOf('call \'{"marker":"PLAN"}\' ssm get-command-invocation');
 const boundary=bake.slice(start,bake.indexOf('\n\nstep 7',start));assert(start>0);assert(!boundary.includes('tail -n 1'));
 for(const text of [JSON.stringify(report())+'\r\n\r\n',' \n','{"marker":',''+JSON.stringify({...report(),hostService:'disabled'})]){
  const f=files(text),work=join(f.dir,'work');mkdirSync(work);mkdirSync(join(work,'render'));writeFileSync(join(work,'render/input.json'),JSON.stringify(input));
  const driver=join(f.dir,'boundary.sh');
  writeFileSync(driver,`set -Eeuo pipefail\nwork='${posix(work)}'\nhere='${posix(fileURLToPath(new URL('.',import.meta.url)))}'\nEVIDENCE_OUT='${posix(f.failure)}'\nmode=run\ncommand_id=synthetic\nbuilder=synthetic\ncall(){ cat '${posix(f.reportFile)}'; }\n${boundary}\nprintf VERIFIED\n`);
  const r=spawnSync(bash,['--noprofile','--norc',driver],{encoding:'utf8'});
  assert.equal(readFileSync(join(work,'report.txt'),'utf8'),text,'driver must preserve the actual formatted input');
  if(text.includes('"hostService":"static"')){assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'VERIFIED');assert(!existsSync(f.failure));}
  else{assert.equal(r.status,1);assert(!r.stdout.includes('VERIFIED'));assert.equal(JSON.parse(readFileSync(f.failure,'utf8')).status,'FAILED_GUEST_VERIFICATION');}
 }
});
