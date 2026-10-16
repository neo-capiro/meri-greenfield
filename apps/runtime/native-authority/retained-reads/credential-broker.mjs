/** CONTROL-only genuine issuer binding and local pinned Ed25519 verification. Default unavailable. */
import {createPublicKey,verify as verifySignature} from 'node:crypto';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertRetainedPrincipalEnvelope,retainedPrincipalPayload,encodeRetainedPrincipal,retainedOrigin,retainedRoutes,retainedOperation} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {storageMethod} from '../../../artifacts/storage/boundary.mjs';
const same=(a,b)=>hash(a)===hash(b),deny=()=>{throw nativeReadFault('ACCESS_DENIED');};
export function createRetainedCredentialBroker(configuration={}){
 const c=own(configuration,[],['issuer','issuerId','keyId','publicKeyJwk','recipients','enabled','now']),now=c.now??Date.now,enabled=c.enabled??false;
 if(typeof now!=='function'||typeof enabled!=='boolean')throw nativeReadFault('CONFIGURATION');const issuer=c.issuer===undefined?undefined:own(c.issuer,['available'],['issue','readIdentity','readResource']),jwk=c.publicKeyJwk===undefined?undefined:data(own(c.publicKeyJwk,['kty','crv','x']));
 if(jwk&&(jwk.kty!=='OKP'||jwk.crv!=='Ed25519'||typeof jwk.x!=='string'||!/^[A-Za-z0-9_-]{43}$/u.test(jwk.x)||Buffer.from(jwk.x,'base64url').length!==32||Buffer.from(jwk.x,'base64url').toString('base64url')!==jwk.x))throw nativeReadFault('CONFIGURATION');
 const ready=Boolean(enabled&&issuer?.available===true&&c.issuerId&&c.keyId&&jwk&&c.recipients);let issue,key,recipients;
 if(ready){if([c.issuerId,c.keyId].some(v=>typeof v!=='string'||v.length<1||v.length>256))throw nativeReadFault('CONFIGURATION');issue=storageMethod(c.issuer,'issue');key=createPublicKey({key:jwk,format:'jwk'});
  recipients=data(own(c.recipients,[],Object.keys(retainedRoutes)));for(const [op,origin] of Object.entries(recipients))retainedOrigin(origin);}
 async function getCredentials(raw){
  if(!ready)throw nativeReadFault('UNAVAILABLE');const {signal,...fields}=own(raw,['operation','request','context','input','identity','resource','originalExpiresAtMs','deadlineMs'],['signal']),{operation,request,context,input,identity,resource,originalExpiresAtMs,deadlineMs}=data(fields);
  nativeSignal(signal);const op=retainedOperation(operation);if(!recipients[op.id])throw nativeReadFault('UNAVAILABLE');const normalized=resolveOperationContract(op).normalizeInput(request,context);if(!same(normalized.input,input))deny();const started=now(),expiry=Math.min(originalExpiresAtMs,deadlineMs,identity.expiresAtMs,resource.expiresAtMs,started+30000);if(!Number.isSafeInteger(expiry)||expiry<=started)deny();
  const envelope=assertRetainedPrincipalEnvelope(await issue({operation:op,request,context,originalExpiresAtMs:expiry,signal,deadlineMs}));
  if(envelope.issuer!==c.issuerId||envelope.keyId!==c.keyId||envelope.audienceOrigin!==recipients[op.id]||envelope.recipientPath!==retainedRoutes[op.id].data||envelope.operation!==op.id||!same({tenantId:envelope.principal.tenantId,actorId:envelope.principal.actorId},identity.principal)||envelope.identityRevision!==identity.identityRevision||envelope.resourceRevision!==resource.resourceRevision||envelope.rawRequestSha256!==hash(request)||envelope.normalizedArgsSha256!==hash(input)||envelope.normalizationContextSha256!==hash(context)||envelope.issuedAtMs<started||envelope.issuedAtMs>now()||envelope.originalExpiresAtMs>expiry||envelope.originalExpiresAtMs<=now()||!verifySignature(null,retainedPrincipalPayload(envelope),key,Buffer.from(envelope.signature,'base64url')))deny();
  return data({assertionJson:encodeRetainedPrincipal(envelope),expiresAtMs:envelope.originalExpiresAtMs});
 }
 return Object.freeze({available:ready,getCredentials});
}
