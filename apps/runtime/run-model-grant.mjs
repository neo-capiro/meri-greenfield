/** Admit the trusted canonical durable model-grant issuer, distinct from task/control credentials. No issuance implementation here.
 * The issuer must recover the same protected material for an identical intent, and refuse changed/uncertain issuance. */
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {data,own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
const fail=()=>{throw Object.assign(Error('MODEL_GRANT_REFUSED'),{code:'MODEL_GRANT_REFUSED'});};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const digest=value=>createHash('sha256').update(value).digest('hex');
export async function issueRunModelGrant({owner,intent,taskGrant,controlSha256,now,signal}){
 nativeSignal(signal);if(signal?.aborted||typeof owner?.issue!=='function'||typeof now!=='function')fail();
 const request=data(own(intent,['issuanceKey','binding','requestSha256','expiresAtMs']));
 const raw=own(await owner.issue({intent:request,signal}),['issuanceKey','binding','requestSha256','expiresAtMs','grantId','capabilitySha256','proxyCredential']);
 const {proxyCredential,...metadata}=raw,r=data(metadata);
 const at=now();if(!Number.isSafeInteger(at)||at<0)fail();
 if(signal?.aborted||!isDeepStrictEqual(Object.fromEntries(Object.keys(request).map(k=>[k,r[k]])),request)||!uuid.test(r.grantId)||
  r.grantId===taskGrant.grantId||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=at||typeof proxyCredential!=='string'||
  !/^[!-~]{32,256}$/u.test(proxyCredential)||digest(proxyCredential)!==r.capabilitySha256||r.capabilitySha256===taskGrant.capabilitySha256||r.capabilitySha256===controlSha256)fail();
 return Object.freeze({grantIntent:Object.freeze({grantId:r.grantId,capabilitySha256:r.capabilitySha256,expiresAtMs:r.expiresAtMs}),proxyCredential});
}
