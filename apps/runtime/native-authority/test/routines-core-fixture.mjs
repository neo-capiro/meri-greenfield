/** SYNTHETIC Core for the routines wires: a test Ed25519 signer that follows capiro-backend `issueRoutineCancellationProof`
 * (@32cf3ca7) byte for byte, and fake `/api/clio/routines/{policy/check,cancellation-proof}` routes that follow
 * `decideRoutinePolicy` / `checkApprovedCancellation`. No network, key material outside this process, or live Core. */
import {generateKeyPairSync,sign as signBytes,randomUUID} from 'node:crypto';
import canonicalize from 'canonicalize';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';

export const ISSUER='https://core.synthetic.invalid/meri-routines',KID='routine-cancel-1',CORE_ORIGIN='https://core.synthetic.invalid';
export const ROUTINE_LIMITS=Object.freeze({maxCostMicrousd:2000000,maxRuntimeSeconds:900,retryLimit:0});
const b64=value=>Buffer.from(value).toString('base64url');

export function coreSigner({issuer=ISSUER,kid=KID}={}){
 const {publicKey,privateKey}=generateKeyPairSync('ed25519'),jwk=publicKey.export({format:'jwk'});
 const pin={issuer,kid,publicKey:{kty:'OKP',crv:'Ed25519',x:jwk.x}};
 /** Core's issuance: header JSON.stringify({alg,typ,kid}), RFC 8785 payload {iss,aud,iat,nbf,exp,jti,cancel}, pure Ed25519. */
 function sign(cancel,{nowMs,ttl=30,jti=randomUUID(),header,payload,key=privateKey,headerKid=kid,iss=issuer,aud='meri-schedule-run-control',nbfOffset=0}={}){
  const iat=Math.floor(nowMs/1000),body=payload??{iss,aud,iat,nbf:iat+nbfOffset,exp:iat+ttl,jti,cancel};
  const input=`${b64(header??JSON.stringify({alg:'EdDSA',typ:'capiro-meri-routine-cancel+jwt',kid:headerKid}))}.${b64(typeof body==='string'?body:canonicalize(body))}`;
  return {proof:`${input}.${signBytes(null,Buffer.from(input,'ascii'),key).toString('base64url')}`,jti,iat,exp:iat+ttl};
 }
 return {pin,sign,privateKey};
}

/** Core's selection-policy decision for one principal/membership (decideRoutinePolicy). Returns [status, body]. */
export function decidePolicy(body,{principal,membership,nowMs}){
 const {selection,selectionSha256}=body;if(hash(selection)!==selectionSha256)return [400,{message:'selectionSha256 mismatch'}];
 const {binding,scopes,selectedClientId}=selection.current,clients=new Set(membership.clientIds);
 if(binding.tenantId!==principal.tenantId||binding.actorId!==principal.actorId||scopes.some(s=>s.tenantId!==principal.tenantId)||new Set(scopes.map(s=>s.policyRevision)).size!==1||
  scopes.some(s=>s.kind==='client'&&!clients.has(s.resourceId))||selectedClientId!==null&&!clients.has(selectedClientId))return [403,{message:'refused'}];
 const mutation=['schedule_task','update_scheduled_task'].includes(selection.operation);
 if(mutation&&selection.request.destinationReference!=='meri-inbox')return [403,{message:'destination'}];
 return [200,{authorized:true,selectionSha256,binding,scopes,selectedClientId,destinationResolution:mutation?{reference:selection.request.destinationReference,destinationId:'meri-inbox'}:null,
  limits:mutation?{...ROUTINE_LIMITS}:null,checkedAtMs:nowMs,expiresAtMs:Math.min(membership.expiresAtMs,nowMs+30000)}];
}

/** Core's approved-cancellation check plus issuance (checkApprovedCancellation + issueRoutineCancellationProof). */
export function issueCancellation(body,{principal,nowMs,signer,ttl=30}){
 const {intent,intentSha256,decision,targets}=body;if(hash(intent)!==intentSha256)return [400,{message:'intentSha256 mismatch'}];
 const owner=intent.projection.owner,decidedAt=Date.parse(decision.decidedAt),expiresAt=Date.parse(decision.expiresAt);
 if(hash(owner)!==hash(principal)||decision.decision!=='approved'||decision.proposalId!==intent.intentId||decision.commandSha256!==intentSha256||hash(decision.approver)!==hash(principal)||
  decision.policyRevision!==intent.projection.scopes[0].policyRevision||decidedAt>nowMs||expiresAt<=nowMs||intent.cancel.running!=='request_cancel'||
  targets.some(t=>t.tenantId!==principal.tenantId||t.actorId!==principal.actorId))return [403,{message:'refused'}];
 const cancel={tenantId:principal.tenantId,ownerActorId:principal.actorId,scheduleId:intent.projection.scheduleId,intentId:intent.intentId,intentSha256,decisionSha256:hash(decision),runs:intent.cancel.runs,targets};
 const ttlSeconds=Math.min(ttl,Math.floor(expiresAt/1000)-Math.floor(nowMs/1000)),issued=signer.sign(cancel,{nowMs,ttl:ttlSeconds});
 return [200,{proof:issued.proof,jti:issued.jti,expiresAtMs:issued.exp*1000}];
}

/** Fake Core fetch for both routes. `state` scripts identity, membership, clock and response overrides; every request is recorded. */
export function coreRoutes(state){
 return async function fetchImpl(url,init){
  const record={url,headers:{...init.headers},body:JSON.parse(init.body)};state.requests.push(record);
  if(init.method!=='POST'||init.redirect!=='error'||init.credentials!=='omit')return new Response('',{status:400});
  if(init.headers['x-internal-service-secret']!==state.serviceSecret||init.headers.authorization!=='Bearer '+state.bearer)return new Response('',{status:403});
  const nowMs=state.coreNow(),principal=state.principal;let status,body;
  if(url===CORE_ORIGIN+'/api/clio/routines/policy/check')[status,body]=decidePolicy(record.body,{principal,membership:state.membership(),nowMs});
  else if(url===CORE_ORIGIN+'/api/clio/routines/cancellation-proof')[status,body]=issueCancellation(record.body,{principal,nowMs,signer:state.signer,ttl:state.ttl??30});
  else return new Response('',{status:404});
  if(state.rewrite)[status,body]=await state.rewrite(status,body,record);
  return status===200?new Response(JSON.stringify(body),{status,headers:{'content-type':state.contentType??'application/json'}}):new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
 };
}

/** Minimal pg-compatible pool for meri_schedules.run_cancel_proofs (BEGIN/SET LOCAL/INSERT … ON CONFLICT DO NOTHING/COMMIT). */
export function proofLedgerPool({loseCommit=false}={}){
 const rows=new Map(),state={rows,statements:[],loseCommit};
 return {state,pool:{async connect(){let pending=null;return {async query(text,values=[]){
  state.statements.push(text);
  if(text==='BEGIN'||text.startsWith('SET LOCAL'))return {rows:[],rowCount:0};
  if(text==='ROLLBACK'){pending=null;return {rows:[],rowCount:0};}
  if(text==='COMMIT'){if(state.loseCommit){state.loseCommit=false;if(pending)rows.set(...pending);pending=null;throw Error('synthetic COMMIT acknowledgement lost');}if(pending)rows.set(...pending);pending=null;return {rows:[],rowCount:0};}
  if(text.startsWith('INSERT INTO meri_schedules.run_cancel_proofs(')){
   const key=values[0]+'|'+values[2];if(rows.has(key)||pending?.[0]===key)return {rows:[],rowCount:0};
   const names=['issuer','key_id','token_id','tenant_id','owner_actor_id','schedule_id','intent_id','intent_sha256','decision_sha256','claims_sha256','proof_sha256','binding','binding_sha256','issued_at_s','expires_at_s'];
   pending=[key,Object.fromEntries(names.map((name,i)=>[name,structuredClone(values[i])]))];return {rows:[],rowCount:1};
  }
  throw Error('unexpected SQL: '+text);
 },release(){}};}}};
}
