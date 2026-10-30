/** Trusted D005 supervisor client for the fixed private mTLS endpoints. No tool-facing method exposes
 * TLS material, endpoint selection, nonce, host identity or a way to mint/extend a lease. */
import https from 'node:https';
import {randomBytes} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {data,own,nativeSignal} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateSiteWorkflowManifest} from '../../browser/site-workflows/manifest.mjs';
import {assertSiteWorkflowSelection} from '../../../../../packages/contracts/site-workflow-selection.mjs';
import {validateBrowserPolicy} from '../../browser/policy.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity,MAX_HOST_CURRENTNESS_MS} from '../binding.mjs';
import {assertBrowserHostFacts} from '../../../../../packages/contracts/runtime-0.2/browser-host-facts.mjs';
import {assertBrowserCustody} from '../../../../../packages/runtime/browser-custody.mjs';
import {privateAddress,dnsName,fingerprint,tlsBytes,checkedCertificate,MAX_CERT_LIFETIME_MS} from './tls.mjs';
import {HOST_CONTROL_PATH,HOST_CONTROL_MAX_BYTES,HOST_CONTROL_PURPOSES,
 hostFactsRequest,hostFactsResponse,HOST_FACTS_PATH,HOST_FACTS_WIRE_MAX_BYTES,
 hostWorkflowRequest,hostWorkflowResponse,HOST_WORKFLOW_PATH,HOST_WORKFLOW_WIRE_MAX_BYTES,
 hostHoldRequest,hostHoldResponse,HOST_HOLD_PATH,HOST_HOLD_WIRE_MAX_BYTES,
 hostClientDnsName,makeHostControlRequest,hostControlResponse,encodeHostControl,decodeHostControl,
 hostDecideRequest,hostDecideResponse,HOST_DECIDE_PATH,HOST_DECIDE_MAX_BYTES,HOST_DECIDE_WIRE_MAX_BYTES,
 hostReceiptRequest,hostReceiptResponse,HOST_RECEIPT_PATH,HOST_RECEIPT_WIRE_MAX_BYTES} from './protocol.mjs';

const fail=()=>{throw Object.assign(new Error('HOST_CONTROL_UNAVAILABLE'),{code:'HOST_CONTROL_UNAVAILABLE'});};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
/** Envelope freshness: a trusted answer is checked at or before this clock and no older than the
 * configured max freshness. A future-dated or stale envelope is refused, not partially consumed. */
const fresh=(answer,nowMs,maxFreshMs)=>{
 if(!Number.isSafeInteger(answer.checkedAtMs)||!Number.isSafeInteger(answer.currentUntilMs))return false;
 if(answer.checkedAtMs>nowMs||answer.currentUntilMs<=nowMs)return false;
 return answer.currentUntilMs-answer.checkedAtMs<=maxFreshMs;
};
const bodyResponse=(res,signal,maxResponse)=>new Promise((resolve,reject)=>{
 let size=0,done=false;const chunks=[];
 const end=(error,bytes)=>{if(done)return;done=true;error?reject(error):resolve(bytes);};
 if(res.statusCode!==200||res.headers.location!==undefined||res.headers['content-type']!=='application/json'||
  res.headers['content-encoding']!==undefined){res.resume();return end(new Error('refused'));}
 const length=res.headers['content-length'];
 if(typeof length!=='string'||!/^[1-9][0-9]*$/u.test(length)||Number(length)>maxResponse){
  res.resume();return end(new Error('refused'));
 }
 signal.addEventListener('abort',()=>{res.destroy();end(new Error('aborted'));},{once:true});
 res.on('data',chunk=>{if(done)return;if(!Buffer.isBuffer(chunk)||size+chunk.length>maxResponse){
  res.destroy();end(new Error('refused'));return;}size+=chunk.length;chunks.push(chunk);});
 res.on('end',()=>size===Number(length)?end(null,Buffer.concat(chunks,size)):end(new Error('refused')));
 res.on('aborted',()=>end(new Error('aborted')));res.on('error',error=>end(error));
 res.on('close',()=>{if(!done)end(new Error('closed'));});
});

/** Endpoint is a literal private IPv4 address, plus separately pinned DNS SAN and DER fingerprint. This avoids
 * any DNS lookup in the SDK supervisor namespace. `tls` is runtime-supplied short-lived material. */
export function createHostCurrentnessClient({allocation,binding,hostIdentity,purpose,endpoint,tls,maxFreshMs,timeoutMs,
 now=Date.now,httpsModule=https}={}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding),i=assertD005HostIdentity(hostIdentity,b,a);
 if(!endpoint||!tls||!HOST_CONTROL_PURPOSES.includes(purpose)||typeof now!=='function'||typeof httpsModule?.request!=='function'||
  !Number.isSafeInteger(maxFreshMs)||maxFreshMs<1||maxFreshMs>MAX_HOST_CURRENTNESS_MS||
  !Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>Math.min(5000,maxFreshMs))fail();
 let address,serverName,serverFingerprintSha256,cert,key,ca;
 try{address=privateAddress(endpoint.address);serverName=dnsName(endpoint.serverName);
  serverFingerprintSha256=fingerprint(endpoint.serverFingerprintSha256);
  if(!Number.isSafeInteger(endpoint.port)||endpoint.port<1||endpoint.port>65535)fail();
  cert=tlsBytes(tls.cert);key=tlsBytes(tls.key);ca=tlsBytes(tls.ca);
 }catch{fail();}
 const clientDnsName=hostClientDnsName(a),lifetime=new AbortController();let closed=false;
 const localCertificate=()=>checkedCertificate(cert,{name:clientDnsName,nowMs:now(),notAfterMs:a.leaseDeadlineMs});
 // Refuse invalid credentials before opening a socket; recheck on every read as they age.
 try{localCertificate();}catch{fail();}
 /** One bounded, pinned exchange. The path, request and response bounds are fixed by the caller below;
   * nothing derived from a request, tool call or peer answer can select another endpoint. */
 async function perform(path,request,requestMax,maxResponse,signal,budgetMs=timeoutMs){
  const bytes=encodeHostControl(request,requestMax),cutoff=Math.min(budgetMs,a.leaseDeadlineMs-now());
  if(cutoff<1)fail();const started=performance.now();
  const timeout=AbortSignal.timeout(cutoff),combined=AbortSignal.any([lifetime.signal,timeout,...(signal?[signal]:[])]);
  const raw=await new Promise((resolve,reject)=>{
   let outbound;try{
    outbound=httpsModule.request({host:address,port:endpoint.port,path,method:'POST',
     servername:serverName,cert,key,ca,agent:false,rejectUnauthorized:true,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',
     signal:combined,headers:{'content-type':'application/json','content-length':String(bytes.length),'connection':'close'},
     checkServerIdentity(_name,peer){try{
      checkedCertificate(peer?.raw,{name:serverName,nowMs:now(),maxLifetimeMs:MAX_CERT_LIFETIME_MS,
       fingerprintSha256:serverFingerprintSha256});return undefined;
     }catch{return new Error('HOST_CONTROL_TLS_REFUSED');}}
    },res=>bodyResponse(res,combined,maxResponse).then(resolve,reject));
    outbound.on('error',reject);outbound.end(bytes);
   }catch(error){outbound?.destroy();reject(error);}
  });
  if(closed||combined.aborted||performance.now()-started>=cutoff)fail();
  return decodeHostControl(raw,maxResponse);
 }
 const nonce=()=>randomBytes(32).toString('hex');
 /** One bounded, canonical facts exchange. readFacts and the workflow maximum policy BOTH use this, so the
  * two paths can never observe different host identity, allocation or freshness semantics. */
 async function factsExchange(signal){
  localCertificate();
  const request=hostFactsRequest({schema:'meri-host-facts-request/1',allocation:a,binding:b,hostIdentity:i,nonce:nonce()});
  const response=await perform(HOST_FACTS_PATH,request,HOST_FACTS_WIRE_MAX_BYTES,HOST_FACTS_WIRE_MAX_BYTES,signal);
  const answer=hostFactsResponse(response,request);
  // A valid envelope nonce is not enough: the DOMAIN payload must validate against the canonical facts
  // contract for THIS exact binding, and its fresh cutoff must still be in the future.
  if(!fresh(answer,now(),maxFreshMs))fail();
  const facts=assertBrowserHostFacts(answer.facts,{binding:b});
  // The INNER payload must still be live too: an outer envelope cannot rescue an expired document.
  if(facts.currentUntilMs<=now()||facts.deadlineMs<=now())fail();
  return answer;
 }
 return Object.freeze({
  async readCurrent({allocation:requestedAllocation,binding:requestedBinding,policySha256,signal}={}){
   try{
    nativeSignal(signal);
    if(closed||signal?.aborted||!same(requestedAllocation,a)||!same(requestedBinding,b))fail();
    localCertificate();
    const request=makeHostControlRequest({allocation:a,binding:b,hostIdentity:i,purpose,policySha256,nonce:nonce(),signal});
    const response=await perform(HOST_CONTROL_PATH,request,HOST_CONTROL_MAX_BYTES,HOST_CONTROL_MAX_BYTES,signal);
    return hostControlResponse(response,request,{nowMs:now(),maxFreshMs});
   }catch{fail();}
  },
  /** Canonical facts3 for this exact allocated host and run. The answer is data only. */
  async readFacts({allocation:requestedAllocation,binding:requestedBinding,signal}={}){
   try{
    nativeSignal(signal);
    if(closed||signal?.aborted||!same(requestedAllocation,a)||!same(requestedBinding,b))fail();
    return await factsExchange(signal);
   }catch{fail();}
  },
  /** Borrowed canonical site-workflow resolution. The host receives the resolved manifest only. */
  async resolveBrowserWorkflow({binding:requestedBinding,signal}={}){
   try{
    nativeSignal(signal);
    if(closed||signal?.aborted||!same(requestedBinding,b))fail();
    localCertificate();
    const request=hostWorkflowRequest({schema:'meri-host-workflow-request/1',allocation:a,binding:b,hostIdentity:i,nonce:nonce()});
    const response=await perform(HOST_WORKFLOW_PATH,request,HOST_WORKFLOW_WIRE_MAX_BYTES,HOST_WORKFLOW_WIRE_MAX_BYTES,signal);
    const answer=hostWorkflowResponse(response,request);
    // Canonical shape of the resolved workflow payload, then REAL content admission: the manifest is
    // validated against the platform maximum taken from a FRESH canonical facts read on this same pinned
    // host (never from the incoming manifest), and its recomputed digest must equal the answered one.
    // CLOSED payload: exactly {manifest,manifestSha256,enabled}; any other member is refused.
    let workflow;
    try{workflow=own(data(answer.workflow),['manifest','manifestSha256','enabled']);}catch{fail();}
    if(workflow.enabled!==true||typeof workflow.manifestSha256!=='string'||
     !/^[0-9a-f]{64}$/u.test(workflow.manifestSha256)||!workflow.manifest||
     typeof workflow.manifest!=='object'||Array.isArray(workflow.manifest))fail();
    const facts=await factsExchange(signal);
    const policy=facts.facts.browserPolicy;
    if(!policy)fail(); // no active browser policy: no canonical workflow can be admitted
    const manifest=validateSiteWorkflowManifest(data(workflow.manifest),
     {platformMaximumOrigins:validateBrowserPolicy(data(policy)).allowedOrigins});
    // The SAVED canonical selection (from the same fresh facts) is the only thing that admits this
    // manifest: no selection, a foreign site/workflow/version or a changed digest is refused.
    if(facts.facts.siteWorkflow===undefined)fail();
    const pinned=assertSiteWorkflowSelection(data(facts.facts.siteWorkflow));
    if(manifest.siteId!==pinned.siteId||manifest.workflowId!==pinned.workflowId||
     manifest.version!==pinned.version)fail();
    if(canonicalSha256(manifest)!==pinned.manifestSha256||workflow.manifestSha256!==pinned.manifestSha256)fail();
    if(!fresh(answer,now(),maxFreshMs))fail();
    return Object.freeze({...answer,workflow:Object.freeze({manifest,manifestSha256:workflow.manifestSha256,
     enabled:workflow.enabled})});
   }catch{fail();}
  },
  /** Read-only verification that this host's takeover is ALREADY applied and still unreturned. */
  async holdBrowser({binding:requestedBinding,signal}={}){
   try{
    nativeSignal(signal);
    if(closed||signal?.aborted||!same(requestedBinding,b))fail();
    localCertificate();
    const request=hostHoldRequest({schema:'meri-host-hold-request/1',allocation:a,binding:b,hostIdentity:i,nonce:nonce()});
    const response=await perform(HOST_HOLD_PATH,request,HOST_HOLD_WIRE_MAX_BYTES,HOST_HOLD_WIRE_MAX_BYTES,signal);
    const answer=hostHoldResponse(response,request);
    // The verified custody is bound to this exact run and must still be live on this clock.
    if(!fresh(answer,now(),maxFreshMs))fail();
    const custody=assertBrowserCustody(answer.custody,{binding:b});
    // The verified custody must describe THIS authenticated host allocation, not any matching run.
    if(custody.hostId!==a.hostId||custody.generation!==a.generation)fail();
    if(custody.expiresAtMs<=now())fail();
    return answer;
   }catch{fail();}
  },
  /** The ONE named approval exchange. The caller passes only the ORIGINAL request/3 it captured; this
   * client pins its own allocation, host identity, nonce and an ABSOLUTE deadline derived from the original
   * window, the lease and the local certificate. Only a canonical approved receipt maps to a permit. */
  async decideBrowserApproval(originalRequest,{signal}={}){
   try{
    nativeSignal(signal);
    if(closed||signal?.aborted)fail();
    const local=localCertificate();
    const request=hostDecideRequest({schema:'meri-host-decide-request/1',allocation:a,binding:b,hostIdentity:i,
     nonce:nonce(),request:originalRequest,
     deadlineMs:Math.min(originalRequest.expiresAtMs,a.leaseDeadlineMs,local.notAfterMs)});
    if(closed||signal?.aborted)fail();
    // Encoded request and answer have SEPARATE bounds: the decide payload+envelope must fit the server's
    // request bound, while the answer keeps its own larger wire ceiling.
    // The ORIGINAL payload must fit its own ceiling; the whole envelope must fit the wire bound. Neither is
    // truncated, and the answer keeps its separate ceiling.
    if(Buffer.byteLength(JSON.stringify(request.request),'utf8')>HOST_DECIDE_MAX_BYTES)fail();
    const response=await perform(HOST_DECIDE_PATH,request,HOST_DECIDE_WIRE_MAX_BYTES,HOST_DECIDE_WIRE_MAX_BYTES,
     signal,request.deadlineMs-now());
    // The third argument is the ACTUAL observation clock: the receipt is judged at this instant.
    const answer=hostDecideResponse(response,request,now());
    // The authenticated ENVELOPE must still be fresh on this clock: a reply that expired in transit or is
    // future-dated never grants, even when the underlying approval itself is unexpired.
    if(!fresh(answer,now(),maxFreshMs))fail();
    if(answer.outcome==='approved')return Object.freeze({permitted:true,receipt:answer.receipt,
     checkedAtMs:answer.checkedAtMs,currentUntilMs:answer.currentUntilMs});
    return Object.freeze({permitted:false,outcome:answer.outcome,checkedAtMs:answer.checkedAtMs,
     currentUntilMs:answer.currentUntilMs});
   }catch{fail();}
  },
  /** The ONE named action receipt. The caller hands the observed receipt; this client pins its own
   * allocation/identity/nonce. Only the producer's actual durable acknowledgement is returned. */
  async recordBrowserReceipt(receipt,{signal}={}){
   try{
    nativeSignal(signal);
    if(closed||signal?.aborted)fail();
    localCertificate();
    const request=hostReceiptRequest({schema:'meri-host-receipt-request/1',allocation:a,binding:b,
     // The receipt travels UNCHANGED: its own binding is what the envelope must match, so a foreign claim
     // is refused instead of being rewritten into a valid one here.
     hostIdentity:i,nonce:nonce(),receipt});
    const response=await perform(HOST_RECEIPT_PATH,request,HOST_RECEIPT_WIRE_MAX_BYTES,
     HOST_RECEIPT_WIRE_MAX_BYTES,signal);
    const answer=hostReceiptResponse(response,request);
    if(!fresh(answer,now(),maxFreshMs))fail();
    return Object.freeze({eventId:answer.eventId,event:answer.event,checkedAtMs:answer.checkedAtMs});
   }catch{fail();}
  },
  close(){if(!closed){closed=true;lifetime.abort();}return Object.freeze({closed:true});},
 });
}
