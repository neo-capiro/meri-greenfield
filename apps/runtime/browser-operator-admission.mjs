/** One in-process operator capability, constructed only by trusted source composition.
 * No wire representation, environment selector, new ledger or execution/host allocation. */
import {X509Certificate} from 'node:crypto';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {sha256Der} from '../../packages/contracts/native-tls-kernel.mjs';
import {NATIVE_DECLARATION_V2,nativeObserverDeadline} from '../../packages/contracts/native-observer.mjs';
import {compileNativeDeployment} from './native-deployment-configuration.mjs';
import {nativeHostId} from './native-host-provisioning.mjs';
import {observerEntrypointConfiguration,OPERATOR_OBSERVER_CONFIGURATION} from './native-observer-entrypoint.mjs';
import {compileBrowserActivation,activationOpen} from '../worker/conversation/browser/activation.mjs';
import {assertNativeDeclaration,assertNativeObserverAllocationJoin} from '../control/browser-hosts/native-reservations.mjs';
const cases=new WeakMap(),fail=()=>{throw Object.assign(Error('OPERATOR_BROWSER_CASE_REFUSED'),{code:'OPERATOR_BROWSER_CASE_REFUSED'});};
const equal=(a,b)=>hash(a)===hash(b),finite=n=>Number.isSafeInteger(n)&&n>0;
const certPin=raw=>sha256Der(new X509Certificate(raw).raw);
export function assertOperatorBrowserAdmission(capability){const s=cases.get(capability);if(!s)fail();return capability;}
function state(capability){assertOperatorBrowserAdmission(capability);const s=cases.get(capability);if(s.revoked||s.now()>=s.expiresAtMs)fail();return s;}
/** `material` is the existing protected composeOperatorObserverMaterial result, never request data.
 * Selection names the fresh conversation and fixed prompt. The run id/worker binding do not
 * exist before its normal submission; capture them once from canonical admission, never invent rows. */
export function createOperatorBrowserAdmission({selection,material,expiresAtMs,sourceCommit,now=Date.now}){
 const target=data(own(selection,['tenantId','actorId','conversationId','promptSha256']));
 if(Object.values(target).some(v=>typeof v!=='string'||!v)||typeof now!=='function'||!finite(expiresAtMs)||expiresAtMs<=now()||
  !/^[a-f0-9]{64}$/u.test(target.promptSha256)||!finite(material?.retainUntilMs)||material.retainUntilMs<=expiresAtMs||material.native?.worker?.enabled!==true||material.native.worker.deployment!==undefined)fail();
 const deployment=compileNativeDeployment(data(material.native.worker.browserDeployment));
 const observer=observerEntrypointConfiguration(material.configuration),control=deployment.bootstrapSpec.control;
 if(deployment.sourceCommit!==sourceCommit||observer.schema!==OPERATOR_OBSERVER_CONFIGURATION||
  material.native.control?.host?.observer?.keyId!==observer.keyId||
  !deployment.physicalObserver?.bridgeFunctionVersionArn.startsWith(observer.functionArn+':')||
  !equal(observer.endpoint,{...control.endpoint,serverFingerprintSha256:certPin(control.serverCertificate)}))fail();
 const s={target,deployment,observer,control:data(material.native.control),expiresAtMs,cleanupCeilingMs:material.retainUntilMs,now,revoked:false,binding:null,executionDeadlineMs:null};
 const capability=Object.freeze({revoke(){s.revoked=true;}});cases.set(capability,s);return capability;
}
export function assertOperatorBrowserControl(capability,{configuration,sourceCommit}){
 const s=state(capability);
 if(activationOpen(compileBrowserActivation(configuration.browserActivation))||sourceCommit!==s.deployment.sourceCommit||
  !equal(configuration.uploads?.native??null,s.control))fail();
}
/** Runs after the existing canonical run/context/Core admission, before its durable claim/provider dispatch. */
export function bindOperatorBrowserInvocation(capability,{binding,run,request,expiresAtMs}){
 const s=state(capability);validateShape('RunBinding',binding);
 if(!equal(binding,run.binding)||run.state!=='queued'||!finite(expiresAtMs)||expiresAtMs<=s.now()||
  binding.writerFence!==1||['tenantId','actorId','conversationId'].some(k=>binding[k]!==s.target[k])||
  typeof request?.prompt!=='string'||hash(request.prompt)!==s.target.promptSha256)fail();
 if(s.binding!==null&&!equal(s.binding,binding))fail();
 const until=Math.min(expiresAtMs,s.expiresAtMs,s.executionDeadlineMs??Infinity);
 // The existing provisioner may lease through this execution deadline. Reserve its
 // original cleanup window before claiming or making this capability launch-eligible.
 if(nativeObserverDeadline(until)>s.cleanupCeilingMs)fail();
 if(s.binding===null){s.binding=data(binding);s.executionDeadlineMs=until;}
 return operatorBrowserDeadline(capability,{binding,deadlineMs:expiresAtMs});
}
/** Called at every admission join, also before cached demand/policy returns. Never an optional callback. */
export function operatorBrowserDeadline(capability,{binding,deadlineMs,executionId}){
 const s=state(capability);
 if(s.binding===null||!equal(binding,s.binding)||executionId!==undefined&&executionId!==hash(s.binding))fail();
 const until=Math.min(s.expiresAtMs,s.executionDeadlineMs,finite(deadlineMs)?deadlineMs:Infinity);
 if(until<=s.now())fail();return until;
}
export function assertOperatorBrowserHostMaterial(capability,{declaration,material}){
 const s=state(capability),b=s.deployment.bootstrapSpec,c=b.control;
 if(!declaration?.tls?.hostServer||!material?.hostServer||
  declaration.tls.hostServer.serverName!==c.endpoint.serverName||
  certPin(material.hostServer.cert)!==certPin(c.serverCertificate)||
  certPin(material.hostServer.clientCa)!==certPin(b.issuerCaCertificate)||
  certPin(material.privateClient?.cert)!==certPin(c.clientCertificate)||
  certPin(material.privateClient?.ca)!==certPin(b.issuerCaCertificate))fail();
}
/** The row is the same locked canonical allocation used by currentness; the writer already owns
 * bootstrap/instance/certificate admission. Only the exact operator selection is added here. */
export function operatorBrowserHostDeadline(capability,{binding,row,record,deadlineMs}){
 const until=operatorBrowserDeadline(capability,{binding,deadlineMs}),s=state(capability),a=record.allocation;
 const d=assertNativeDeclaration(row.declaration_json),expected=s.deployment;
 if(row.declaration_sha256!==hash(d)||!equal(record.originalBinding,s.binding)||a.hostMode!=='browser-only'||
  a.generation!==s.binding.writerFence||a.hostId!==nativeHostId({binding:s.binding,generation:s.binding.writerFence,hostMode:'browser-only'})||
  a.imageDigest!==expected.imageDigest||d.schema!==NATIVE_DECLARATION_V2)fail();
 assertNativeObserverAllocationJoin(a,d);
 for(const key of ['sourceCommit','imageDigest','bootstrapSha256','accountId','region','placement','launch','bootstrapSpec','physicalObserver','launchTagPolicy'])if(!equal(d[key],expected[key]))fail();
 if((d.nativeHelperSha256??null)!==(expected.nativeHelperSha256??null)||(d.maxLifetimeMs??600000)!==expected.maxLifetimeMs)fail();
 if(d.watchdog.input.cleanupCeilingMs>s.cleanupCeilingMs)fail();
 return Math.min(until,a.leaseDeadlineMs,record.hostCertificate.notAfterMs,record.serverCertificateNotAfterMs);
}
