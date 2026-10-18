/** Networked Bash: deny-by-default destinations through Meri's egress proxy fact, and per-call approval through the
 * canonical approval owner port. Scripted approval port and clock; no SDK, proxy or network process. */
import test from 'node:test';import assert from 'node:assert/strict';
import {assertCapabilityPolicy} from '../capabilities/policy.mjs';
import {admitBash,assertBashEgressFact,assertSandboxSettings,createBashSandbox} from '../capabilities/bash-sandbox.mjs';
import {createBashApprovalGate,BASH_APPROVAL_RECEIPT_SCHEMA,BASH_APPROVAL_REQUEST_SCHEMA,BASH_APPROVAL_SUBJECT_SCHEMA} from '../capabilities/bash-approval.mjs';
import {createSdkCapabilities} from '../capabilities/index.mjs';
import {BASH_EGRESS_SCHEMA,bashEgressDomainsSha256} from '../egress/bash-egress.mjs';
import {APPROVAL_RECEIPT_SCHEMA} from '../browser/approval-binding.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {binding,id} from '../../../control/conversations/test/application-fixture.mjs';
const cwd=`/workspace/conversations/${binding.conversationId}`;
const attested=Object.freeze({available:true,sdk:'0.3.295',cli:'2.1.295',weakerNestedSandbox:false,outerIsolationBoundary:true});
const DOMAINS=['pypi.org','*.github.com'];
const fact=(domains=DOMAINS,extra={})=>({schema:BASH_EGRESS_SCHEMA,httpProxyPort:41001,socksProxyPort:41002,domainsSha256:bashEgressDomainsSha256(domains),...extra});
const T0=1760486400000,clock=()=>T0;
let n=0;
/** Scripted canonical-owner receipt for `request` (the real owner authenticates, decides and consumes). */
function receipt(request,{decision='approved',schema=BASH_APPROVAL_RECEIPT_SCHEMA,tenantId=binding.tenantId,fields={}}={}){
 const k=String(++n).padStart(12,'0'),proposalId=`00000041-b0a1-4000-8000-${k}`;
 return {schema,proposalId,subjectSha256:request.subjectSha256,toolUseId:request.subject.toolUseId,
  decision:{proposalId,commandSha256:request.subjectSha256,decision,decidedAt:new Date(T0).toISOString(),expiresAt:new Date(T0+60000).toISOString(),approver:{tenantId,actorId:'approver-synthetic'},policyRevision:'approval-policy-1'},
  consumption:{consumed:true,consumptionId:`00000042-b0a1-4000-8000-${k}`,consumedAtMs:T0},...fields};
}
const port=(answer=r=>receipt(r))=>{const requests=[];return {requests,decide:async(request,{signal})=>{requests.push({request,signal});return typeof answer==='function'?answer(request):answer;}};};
const policy=(extra={})=>assertCapabilityPolicy({bash:true,sandboxNetworkDomains:DOMAINS,...extra});
const networked=(approvals=port(),extra={})=>createBashSandbox(policy(),{cwd,attestation:attested,egress:fact(),approvals,binding,now:clock,...extra});
const call=(p,input={command:'pip download requests'},toolUseID='toolu_bash_1',signal=new AbortController().signal)=>p.canUseTool('Bash',input,{signal,toolUseID});

test('networked Bash is admitted only with the egress fact for exactly its domains AND an approval port',()=>{
 const p=policy(),approvals=port();
 assert.equal(admitBash(p,attested),false,'no egress fact, no approvals');
 assert.equal(admitBash(p,attested,{egress:fact()}),false,'no approvals');
 assert.equal(admitBash(p,attested,{approvals}),false,'no egress fact');
 assert.equal(admitBash(p,attested,{egress:fact(),approvals}),true);
 assert.equal(admitBash(policy({sandboxNetworkDomains:[]}),attested),true,'network-less Bash needs neither');
 for(const bad of [fact(['pypi.org']),fact(DOMAINS,{socksProxyPort:41001}),fact(DOMAINS,{httpProxyPort:80}),fact(DOMAINS,{schema:'meri-bash-egress/0'}),{...fact(),extra:1}])
  assert.throws(()=>admitBash(p,attested,{egress:bad,approvals}),/BASH_EGRESS_FACT_REFUSED|INVALID_COMMAND/,JSON.stringify(bad));
 const c=createSdkCapabilities({bash:true,sandboxNetworkDomains:DOMAINS},{runOwner:{append:async()=>{}},binding,cwd,now:clock,newId:()=>id(1),bashSandbox:attested,bashEgress:fact()});
 assert.equal(c.bashAdmitted,false);assert.ok(c.options.disallowedTools===undefined||c.options.disallowedTools.includes('Bash'));
 const d=createSdkCapabilities({bash:true,sandboxNetworkDomains:DOMAINS},{runOwner:{append:async()=>{}},binding,cwd,now:clock,newId:()=>id(1),bashSandbox:attested,bashEgress:fact(),bashApprovals:approvals});
 assert.equal(d.bashAdmitted,true);assert.equal(d.options.sandbox.network.socksProxyPort,41002);assert.equal(d.options.sandbox.autoAllowBashIfSandboxed,false);
});

test('the fragment validator keeps networked Bash on Meri\'s proxy and off auto-allow; network-less Bash has no proxy ports',()=>{
 const sandbox=networked().sandbox;assert.doesNotThrow(()=>assertSandboxSettings(sandbox));
 const clone=v=>JSON.parse(JSON.stringify(v));
 for(const mutate of [s=>{s.autoAllowBashIfSandboxed=true;},s=>{delete s.network.httpProxyPort;},s=>{delete s.network.socksProxyPort;},s=>{s.network.socksProxyPort=s.network.httpProxyPort;},s=>{s.network.httpProxyPort=80;},s=>{s.network.httpProxyPort='41001';},
  s=>{s.network.allowedDomains=[];},s=>{s.network.allowedDomains=['93.184.215.14'];}]){
  const s=clone(sandbox);mutate(s);assert.throws(()=>assertSandboxSettings(s),/CAPABILITY_FRAGMENT_REFUSED|INVALID_COMMAND/,String(mutate));}
 const local=createBashSandbox(policy({sandboxNetworkDomains:[]}),{cwd,attestation:attested}).sandbox;assert.doesNotThrow(()=>assertSandboxSettings(local));
 for(const mutate of [s=>{s.autoAllowBashIfSandboxed=false;},s=>{s.network.httpProxyPort=41001;s.network.socksProxyPort=41002;}]){const s=clone(local);mutate(s);assert.throws(()=>assertSandboxSettings(s),/CAPABILITY_FRAGMENT_REFUSED/,String(mutate));}
});

test('an approved, consumed decision for the exact subject allows the call once, with the digested input',async()=>{
 const approvals=port(),p=networked(approvals),input={command:'pip download requests',description:'fetch'};
 const decision=await call(p,input);
 assert.deepEqual(decision,{behavior:'allow',updatedInput:input,toolUseID:'toolu_bash_1'});
 const [{request,signal}]=approvals.requests;assert.ok(signal instanceof AbortSignal);
 assert.equal(request.schema,BASH_APPROVAL_REQUEST_SCHEMA);assert.equal(request.subject.schema,BASH_APPROVAL_SUBJECT_SCHEMA);
 assert.deepEqual(request.subject.binding,binding);assert.equal(request.subject.tool,'Bash');assert.equal(request.subject.toolUseId,'toolu_bash_1');
 assert.equal(request.subject.inputSha256,canonicalSha256(input));assert.equal(request.subject.sandboxSha256,canonicalSha256(p.sandbox),'the approval names the exact sandbox it runs in');
 assert.equal(request.subject.domainsSha256,bashEgressDomainsSha256(DOMAINS));assert.equal(request.subjectSha256,canonicalSha256(request.subject));
 assert.equal(request.expiresAtMs,T0+120000);
 assert.equal((await p.canUseTool('Read',{file_path:'/x'},{signal:new AbortController().signal,toolUseID:'t'})),undefined,'other tools are not this gate\'s');
});

test('rejection, another subject, another tenant, a browser receipt, an unconsumed or replayed decision are all refused',async()=>{
 const cases=[
  [r=>receipt(r,{decision:'rejected'}),'BASH_APPROVAL_DENIED'],
  [r=>receipt({...r,subjectSha256:'0'.repeat(64)}),'BASH_APPROVAL_MISMATCH'],
  [r=>receipt(r,{tenantId:'tenant-other'}),'BASH_APPROVAL_MISMATCH'],
  [r=>receipt(r,{schema:APPROVAL_RECEIPT_SCHEMA}),'BASH_APPROVAL_DENIED'],
  [r=>receipt(r,{fields:{consumption:{consumed:false}}}),'BASH_APPROVAL_UNCONSUMED'],
  [()=>null,'BASH_APPROVAL_DENIED'],
  [()=>{throw new Error('owner down');},'BASH_APPROVAL_UNAVAILABLE'],
 ];
 for(const [answer,code] of cases){const d=await call(networked(port(answer)));assert.deepEqual(d,{behavior:'deny',message:code,toolUseID:'toolu_bash_1'},code);}
 let saved;const replay=networked(port(r=>saved??=receipt(r)));
 assert.equal((await call(replay)).behavior,'allow');
 assert.equal((await call(replay,{command:'pip download requests'},'toolu_bash_1')).message,'BASH_APPROVAL_REPLAY','one consumed decision authorizes one execution');
});

test('an unsandboxed request, a missing tool-use id, an oversized input, expiry and abort deny before anything runs',async()=>{
 const approvals=port(),p=networked(approvals);
 assert.equal((await call(p,{command:'id',dangerouslyDisableSandbox:true})).message,'BASH_UNSANDBOXED_REFUSED');
 assert.equal((await p.canUseTool('Bash',{command:'id'},{signal:new AbortController().signal})).message,'BASH_APPROVAL_UNAVAILABLE');
 assert.equal((await call(p,{command:'x'.repeat(20000)})).message,'BASH_APPROVAL_INPUT_LIMIT');
 assert.equal(approvals.requests.length,0,'none of these reached the owner');
 const never=networked({decide:()=>new Promise(()=>{})},{approvalDeadlineMs:1000});
 assert.equal((await call(never)).message,'BASH_APPROVAL_EXPIRED');
 const controller=new AbortController(),pending=call(networked({decide:()=>new Promise(()=>{})}),{command:'id'},'toolu_bash_2',controller.signal);controller.abort();
 assert.equal((await pending).message,'BASH_APPROVAL_UNAVAILABLE');
 assert.throws(()=>createBashApprovalGate({binding,approvals:{},now:clock,sandboxSha256:'a'.repeat(64),domainsSha256:'b'.repeat(64)}),/BASH_APPROVAL_CONFIGURATION/);
 assert.throws(()=>createBashSandbox(policy(),{cwd,attestation:attested,egress:fact(),approvals:port()}),/BASH_SANDBOX_CONFIGURATION/,'networked Bash needs the run binding and clock for its subject');
});
