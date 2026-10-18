/** GOLDEN Core fake at the HTTP (Fetch) boundary, derived line by line from capiro-backend PR #84 head `0304b0ef`:
 *  apps/api/src/meri/memory-receiving/{meri-memory.contract,meri-memory-receiving.service,meri-memory-receiving.controller}.ts
 *  apps/api/src/memory/memory.controller.ts (candidates/:id/owner-decision), memory-candidate.service.ts
 *  (decideOwnPersonalCandidate, requireMeriPersonalOwner), memory-version.controller.ts and immutable-memory-version.service.ts
 *  (requireLifecycle, lockCandidate, approveCandidate, rejectCandidate).
 * SYNTHETIC: in-memory rows behind Core's exact statuses, bodies, scoped ids, hash domains and guards. Not Core, not PostgreSQL. */
import {randomUUID} from 'node:crypto';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,HEX64=/^[a-f0-9]{64}$/u,ISO_MS=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const UUID_TEXT='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const SYNTHETIC_KEY=new RegExp(`^meri:(${UUID_TEXT})$`,'u'),CLIO_ID=new RegExp(`^clio:(${UUID_TEXT})$`,'u'),ITEM_ID=new RegExp(`^item:(${UUID_TEXT})$`,'u');
const SOURCE_KINDS=['conversation_message','artifact_version','document','web_page','memory'],SCOPES=['personal','client','firm'],DAY_MS=86400000;
const CORE_SCOPE={personal:'user_private',client:'client',firm:'firm'},MERI_SCOPE={user_private:'personal',client:'client',firm:'firm'};
const VERSION_SOURCE_KINDS=new Set(['memory_correction','memory_restore','memory_contradiction']);
const ADMIN_ROLES=new Set(['user_admin','capiro_admin']);
export const clioMemorySlug=id=>`clio:${id}`;
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
const bad=m=>new HttpError(400,m),forbidden=()=>new HttpError(403,'Memory receiving refused'),conflict=m=>new HttpError(409,m),notFound=m=>new HttpError(404,m);
const stale=()=>conflict('The correction target is no longer the pinned active memory');
/** meri-memory.contract.ts, closed parsers. */
function closed(value,keys,field){
 if(!value||typeof value!=='object'||Array.isArray(value))throw bad(field);
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)))throw bad(field);return value;
}
const text=(v,field,min,max)=>{if(typeof v!=='string'||v.length<min||v.length>max)throw bad(field);return v;};
const nullableText=(v,field,min,max)=>v===null?null:text(v,field,min,max);
const trimmedText=(v,field,max)=>{if(typeof v!=='string'||!v||v.trim()!==v||v.length>max)throw bad(field);return v;};
const uuid=(v,field)=>{if(typeof v!=='string'||!UUID.test(v))throw bad(field);return v;};
function parseOrigin(value){
 if(value&&typeof value==='object'&&value.kind==='surface'){closed(value,['kind'],'origin');return {kind:'surface'};}
 const v=closed(value,['kind','conversationId','runId','commandId','commandSha256'],'origin');
 if(v.kind!=='conversation')throw bad('origin.kind');if(typeof v.commandSha256!=='string'||!HEX64.test(v.commandSha256))throw bad('origin.commandSha256');
 return {kind:'conversation',conversationId:uuid(v.conversationId,'origin.conversationId'),runId:uuid(v.runId,'origin.runId'),commandId:uuid(v.commandId,'origin.commandId'),commandSha256:v.commandSha256};
}
export function parseMeriMemoryCandidate(value){
 const v=closed(value,['schema','candidateId','tenantId','proposerActorId','kind','scope','clientId','content','key','ttlDays','corrects','reason','sources','origin','idempotencyKey','createdAt'],'candidate');
 if(v.schema!=='meri.memory-candidate.v1')throw bad('candidate.schema');if(v.kind!=='addition'&&v.kind!=='correction')throw bad('candidate.kind');
 if(!SCOPES.includes(v.scope))throw bad('candidate.scope');
 const clientId=v.scope==='client'?uuid(v.clientId,'candidate.clientId'):v.clientId===null?null:(()=>{throw bad('candidate.clientId');})();
 const content=text(v.content,'candidate.content',1,4000);if(content.trim()!==content)throw bad('candidate.content');
 if(v.ttlDays!==null&&(!Number.isSafeInteger(v.ttlDays)||v.ttlDays<1||v.ttlDays>365))throw bad('candidate.ttlDays');
 let corrects=null;
 if(v.kind==='correction'){const c=closed(v.corrects,['memoryId','memorySha256'],'candidate.corrects');if(typeof c.memorySha256!=='string'||!HEX64.test(c.memorySha256))throw bad('candidate.corrects.memorySha256');corrects={memoryId:text(c.memoryId,'candidate.corrects.memoryId',1,128),memorySha256:c.memorySha256};}
 else if(v.corrects!==null)throw bad('candidate.corrects');
 const reason=nullableText(v.reason,'candidate.reason',1,1000);if(v.kind==='addition'&&reason!==null)throw bad('candidate.reason');
 if(!Array.isArray(v.sources)||v.sources.length>16)throw bad('candidate.sources');
 const sources=v.sources.map((item,i)=>{const s=closed(item,['kind','reference','sha256','title'],`candidate.sources[${i}]`);
  if(!SOURCE_KINDS.includes(s.kind))throw bad(`candidate.sources[${i}].kind`);if(s.sha256!==null&&(typeof s.sha256!=='string'||!HEX64.test(s.sha256)))throw bad(`candidate.sources[${i}].sha256`);
  const reference=trimmedText(s.reference,`candidate.sources[${i}].reference`,512);
  if(s.kind==='web_page'){let url;try{url=new URL(reference);}catch{throw bad(`candidate.sources[${i}].reference`);}if(url.protocol!=='https:'||url.username||url.password)throw bad(`candidate.sources[${i}].reference`);}
  return {kind:s.kind,reference,sha256:s.sha256,title:s.title===null?null:trimmedText(s.title,`candidate.sources[${i}].title`,200)};});
 if(typeof v.createdAt!=='string'||!ISO_MS.test(v.createdAt)||new Date(v.createdAt).toISOString()!==v.createdAt)throw bad('candidate.createdAt');
 return {schema:'meri.memory-candidate.v1',candidateId:uuid(v.candidateId,'candidate.candidateId'),tenantId:text(v.tenantId,'candidate.tenantId',1,128),proposerActorId:text(v.proposerActorId,'candidate.proposerActorId',1,128),
  kind:v.kind,scope:v.scope,clientId,content,key:nullableText(v.key,'candidate.key',1,120),ttlDays:v.ttlDays,corrects,reason,sources,origin:parseOrigin(v.origin),idempotencyKey:text(v.idempotencyKey,'candidate.idempotencyKey',1,128),createdAt:v.createdAt};
}
function parseStatusRequest(value){
 const v=closed(value,['candidates'],'body');if(!Array.isArray(v.candidates)||v.candidates.length<1||v.candidates.length>50)throw bad('candidates');
 const pairs=v.candidates.map((item,i)=>{const p=closed(item,['candidateId','candidateSha256'],`candidates[${i}]`);if(typeof p.candidateSha256!=='string'||!HEX64.test(p.candidateSha256))throw bad(`candidates[${i}].candidateSha256`);return {candidateId:uuid(p.candidateId,`candidates[${i}].candidateId`),candidateSha256:p.candidateSha256};});
 if(new Set(pairs.map(p=>p.candidateId)).size!==pairs.length)throw bad('candidates');return pairs;
}
/** `createGoldenCore({now, lifecycle})`: `lifecycle` is Core's MEMORY_GOVERNANCE_LIFECYCLE=enforce (D016 #6: preview Core only). */
export function createGoldenCore({now=Date.now,lifecycle=true,serviceSecret='golden-service-secret'}={}){
 const state={lifecycle,serviceSecret,bearers:new Map(),memories:[],items:[],submissions:new Map(),candidates:new Map(),walledClients:new Set(),calls:[],offline:false};
 const iso=ms=>new Date(ms).toISOString();
 const ctxOf=headers=>{const auth=headers.get('authorization')??'';const member=auth.startsWith('Bearer ')?state.bearers.get(auth.slice(7)):undefined;if(!member)throw new HttpError(401,'Unauthorized');return member;};
 const verified=headers=>headers.get('x-internal-service-secret')===state.serviceSecret;
 async function clientMemoryAllowed(clientId){return !state.walledClients.has(clientId);}
 async function visible(ctx,coreScope,ownerUserId,clientId){
  if(!MERI_SCOPE[coreScope])return false;if(coreScope==='user_private')return ownerUserId===ctx.userId;
  if(coreScope==='client')return !!clientId&&(await clientMemoryAllowed(clientId));return true;
 }
 const loadItem=(tenantId,by)=>state.items.find(r=>r.tenantId===tenantId&&('id' in by?r.id===by.id:r.slug===by.slug))??null;
 function itemState(row){
  if(row.status==='superseded'||row.governedStatus==='superseded')return 'superseded';
  if(row.status==='revoked'||row.governedStatus==='revoked')return 'forgotten';
  if(row.governedStatus==='expired'||(row.expiresAt!==null&&row.expiresAt<=now()))return 'expired';
  if(row.status==='active'&&(row.governedStatus==='active'||row.governedStatus==='stale'))return 'active';return null;
 }
 const sectionsText=sections=>{if(!Array.isArray(sections))return null;const out=[];for(const s of sections){if(typeof s?.body!=='string')return null;if(s.body.trim())out.push(s.body.trim());}return out.join('\n\n');};
 /** 0304b0ef logicalKey: a synthetic key is logically null only with proven lineage from the committing submission. */
 function logicalKey(ctx,storageKey,subject){
  const synthetic=SYNTHETIC_KEY.exec(storageKey);if(!synthetic)return storageKey;
  const submission=state.submissions.get(synthetic[1]),candidate=state.candidates.get(synthetic[1]);
  if(!submission||!candidate||submission.tenantId!==ctx.tenantId||candidate.payload.logicalNull!==true||!candidate.committedMemoryId)return storageKey;
  if('clioId' in subject)return candidate.committedMemoryId===subject.clioId?null:storageKey;
  const target=clioMemorySlug(candidate.committedMemoryId);
  for(let cursor=loadItem(ctx.tenantId,{id:subject.itemId});cursor;cursor=cursor.supersedesId?loadItem(ctx.tenantId,{id:cursor.supersedesId}):null)if(cursor.slug===target)return null;
  return storageKey;
 }
 function clioTarget(ctx,row){
  const key=logicalKey(ctx,row.key,{clioId:row.id});if(key!==null&&key.length>120)return null;
  const scope=MERI_SCOPE[row.scope],clientId=scope==='client'?row.clientId:null,ownerActorId=scope==='personal'?row.ownerUserId:null,memoryId=`clio:${row.id}`;
  const projection=loadItem(ctx.tenantId,{slug:clioMemorySlug(row.id)}),lifecycle=projection?itemState(projection):'active';
  const st=lifecycle===null?null:lifecycle!=='active'?lifecycle:row.expiresAt!==null&&row.expiresAt<=now()?'expired':'active';
  if(st===null)return null;
  return {tenantId:row.tenantId,memoryId,memorySha256:canonicalSha256({schema:'capiro.clio-memory.v1',memoryId,scope,clientId,ownerActorId,key,storageKey:row.key,state:st,value:row.value,expiresAt:row.expiresAt===null?null:iso(row.expiresAt),updatedAt:row.updatedAt}),scope,clientId,ownerActorId,key,state:st};
 }
 async function itemTarget(ctx,row){
  const coreScope=row.memoryScope==='client'||row.clientId?'client':row.memoryScope==='user_private'||row.ownerUserId?'user_private':'firm';
  if(!(await visible(ctx,coreScope,row.ownerUserId,row.clientId)))return null;
  const st=itemState(row),value=sectionsText(row.sections);if(st===null||value===null)return null;
  const key=logicalKey(ctx,row.title,{itemId:row.id});if(key!==null&&key.length>120)return null;
  const scope=MERI_SCOPE[coreScope],clientId=scope==='client'?row.clientId:null,ownerActorId=scope==='personal'?row.ownerUserId:null,memoryId=`item:${row.id}`;
  return {tenantId:row.tenantId,memoryId,memorySha256:canonicalSha256({schema:'capiro.memory-item.v1',memoryId,scope,clientId,ownerActorId,key,storageKey:row.title,state:st,value,expiresAt:row.expiresAt===null?null:iso(row.expiresAt),updatedAt:row.updatedAt}),scope,clientId,ownerActorId,key,state:st};
 }
 async function readScoped(ctx,memoryId){
  const clio=CLIO_ID.exec(memoryId);
  if(clio){const row=state.memories.find(r=>r.id===clio[1]&&r.tenantId===ctx.tenantId);return row&&(await visible(ctx,row.scope,row.ownerUserId,row.clientId))?clioTarget(ctx,row):null;}
  const item=ITEM_ID.exec(memoryId);if(item){const row=loadItem(ctx.tenantId,{id:item[1]});return row?itemTarget(ctx,row):null;}
  return null;
 }
 function controllingVersion(tenantId,slug){
  const lineage=[];let frontier=state.items.filter(r=>r.tenantId===tenantId&&r.slug===slug);
  while(frontier.length){lineage.push(...frontier);frontier=state.items.filter(r=>r.tenantId===tenantId&&frontier.some(p=>r.supersedesId===p.id));}
  return lineage.filter(r=>r.status==='active'&&['active','stale'].includes(r.governedStatus)).sort((a,b)=>b.createdAt-a.createdAt||(b.id<a.id?-1:1))[0]??null;
 }
 const versionSourceFor=(ctx,memoryId)=>{const item=ITEM_ID.exec(memoryId);if(item)return item[1];const clio=CLIO_ID.exec(memoryId);if(!clio)return null;return loadItem(ctx.tenantId,{slug:clioMemorySlug(clio[1])})?.id??null;};
 const ack=row=>({candidateId:row.candidateId,candidateSha256:row.candidateSha256,reviewId:row.reviewId,accepted:true});
 const findSubmission=(tenantId,candidateId)=>{const s=state.submissions.get(candidateId);return s&&s.tenantId===tenantId?s:null;};
 async function submit(ctx,raw){
  const request=closed(raw,['candidate','candidateSha256'],'body');if(typeof request.candidateSha256!=='string'||!HEX64.test(request.candidateSha256))throw bad('candidateSha256');
  const candidate=parseMeriMemoryCandidate(request.candidate);
  if(canonicalSha256(request.candidate)!==request.candidateSha256)throw bad('candidateSha256 mismatch');
  if(candidate.tenantId!==ctx.tenantId||candidate.proposerActorId!==ctx.userId)throw forbidden();
  if(candidate.key!==null&&SYNTHETIC_KEY.test(candidate.key))throw bad('Reserved memory key');
  const existing=findSubmission(ctx.tenantId,candidate.candidateId);
  const replay=stored=>{if(stored.proposerUserId!==ctx.userId||stored.candidateSha256!==request.candidateSha256)throw conflict('Candidate id already submitted with different content');return ack(stored);};
  if(existing)return replay(existing);
  if(state.candidates.has(candidate.candidateId))throw conflict('Candidate id already in use');
  const record=()=>{const row={tenantId:ctx.tenantId,candidateId:candidate.candidateId,candidateSha256:request.candidateSha256,proposerUserId:ctx.userId,reviewId:randomUUID(),candidate:request.candidate};state.submissions.set(candidate.candidateId,row);return row;};
  if(candidate.kind==='correction'){
   if(candidate.ttlDays!==null)throw conflict('A correction with ttlDays is not supported yet');
   const pin=candidate.corrects,sourceItemId=versionSourceFor(ctx,pin.memoryId);if(!sourceItemId)throw stale();
   // ImmutableMemoryVersionService.proposeReviewOnlyCorrection: requireLifecycle, source lookup, verify hook under the row lock.
   if(!state.lifecycle)throw new HttpError(503,'Immutable governed memory versions are disabled (MEMORY_GOVERNANCE_LIFECYCLE is not "enforce").');
   const source=loadItem(ctx.tenantId,{id:sourceItemId});if(!source)throw notFound('Memory item not found.');
   const current=await readScoped(ctx,pin.memoryId);
   if(!current||current.state!=='active'||current.memorySha256!==pin.memorySha256||current.scope!==candidate.scope||current.clientId!==candidate.clientId)throw stale();
   if(itemState(source)!=='active')throw conflict('not controlling');
   state.candidates.set(candidate.candidateId,{id:candidate.candidateId,tenantId:ctx.tenantId,proposedBy:ctx.userId,sourceKind:'memory_correction',scope:candidate.scope,clientId:candidate.clientId,
    payload:{key:source.title,value:candidate.content,ownerUserId:source.ownerUserId,scope:CORE_SCOPE[candidate.scope],logicalNull:false,versionProposal:{kind:'correction',sourceItemId,targetItemId:null}},status:'pending',decidedAt:null,committedMemoryId:null,committedMemoryItemId:null,duplicateMemoryItemId:null});
   record();
  }else{
   if(candidate.clientId&&!(await clientMemoryAllowed(candidate.clientId)))throw forbidden();
   const owner=candidate.scope==='personal'?ctx.userId:null,client=candidate.scope==='client'?candidate.clientId:null;
   if(candidate.key!==null&&state.memories.some(r=>r.tenantId===ctx.tenantId&&r.scope===CORE_SCOPE[candidate.scope]&&r.key===candidate.key&&r.ownerUserId===owner&&r.clientId===client))throw conflict('A memory with this key already exists; submit a correction instead');
   state.candidates.set(candidate.candidateId,{id:candidate.candidateId,tenantId:ctx.tenantId,proposedBy:ctx.userId,sourceKind:'explicit_user',scope:candidate.scope,clientId:candidate.clientId,
    payload:{key:candidate.key??`meri:${candidate.candidateId}`,value:candidate.content,source:'meri',scope:CORE_SCOPE[candidate.scope],ownerUserId:owner,clientId:candidate.clientId,logicalNull:candidate.key===null,
     expiresAt:candidate.ttlDays?iso(Date.parse(candidate.createdAt)+candidate.ttlDays*DAY_MS):null},status:'pending',decidedAt:null,committedMemoryId:null,committedMemoryItemId:null,duplicateMemoryItemId:null});
   record();
  }
  return ack(findSubmission(ctx.tenantId,candidate.candidateId));
 }
 function status(ctx,raw){
  const pairs=parseStatusRequest(raw);
  const reviews=pairs.map(pair=>{
   const submission=findSubmission(ctx.tenantId,pair.candidateId),base={candidateId:pair.candidateId,candidateSha256:pair.candidateSha256};
   if(!submission||submission.proposerUserId!==ctx.userId||submission.candidateSha256!==pair.candidateSha256)return {...base,status:'not_found',reviewId:null,decidedAt:null,publishedMemoryId:null};
   const candidate=state.candidates.get(pair.candidateId);if(!candidate)return {...base,status:'not_found',reviewId:null,decidedAt:null,publishedMemoryId:null};
   const decidedAt=candidate.decidedAt===null?null:iso(candidate.decidedAt);
   const published=VERSION_SOURCE_KINDS.has(candidate.sourceKind)?(candidate.committedMemoryItemId??candidate.duplicateMemoryItemId)?`item:${candidate.committedMemoryItemId??candidate.duplicateMemoryItemId}`:null:candidate.committedMemoryId?`clio:${candidate.committedMemoryId}`:null;
   if((candidate.status==='approved'||candidate.status==='auto_committed')&&published&&decidedAt)return {...base,status:'approved',reviewId:submission.reviewId,decidedAt,publishedMemoryId:published};
   if((candidate.status==='rejected'||candidate.status==='withdrawn')&&decidedAt)return {...base,status:candidate.status,reviewId:submission.reviewId,decidedAt,publishedMemoryId:null};
   return {...base,status:'pending',reviewId:submission.reviewId,decidedAt:null,publishedMemoryId:null};
  });
  return {reviews,checkedAt:iso(now())};
 }
 async function findByKey(ctx,raw){
  const v=closed(raw,['scope','clientId','key'],'body');if(!SCOPES.includes(v.scope))throw bad('scope');
  const clientId=v.scope==='client'?uuid(v.clientId,'clientId'):v.clientId===null?null:(()=>{throw bad('clientId');})();const key=text(v.key,'key',1,120);
  if(clientId&&!(await clientMemoryAllowed(clientId)))return {memory:null};
  const row=state.memories.filter(r=>r.tenantId===ctx.tenantId&&r.scope===CORE_SCOPE[v.scope]&&r.key===key&&r.ownerUserId===(v.scope==='personal'?ctx.userId:null)&&r.clientId===(v.scope==='client'?clientId:null)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
  if(!row||!(await visible(ctx,row.scope,row.ownerUserId,row.clientId)))return {memory:null};
  const controlling=controllingVersion(ctx.tenantId,clioMemorySlug(row.id)),projection=loadItem(ctx.tenantId,{slug:clioMemorySlug(row.id)});
  const found=controlling&&projection&&controlling.id!==projection.id?await itemTarget(ctx,controlling):clioTarget(ctx,row);
  return {memory:found&&found.key===key?found:null};
 }
 /** memory-candidate.service.ts decideOwnPersonalCandidate / approve / reject (W8 owner rule always applied). */
 function ownerDecision(ctx,id,raw){
  const decision=raw?.decision;if(decision!=='approve'&&decision!=='reject')throw bad('decision must be "approve" or "reject".');
  const missing=()=>notFound('No personal memory candidate of yours with that id.');
  if(!UUID.test(id))throw missing();const row=state.candidates.get(id);
  if(!row||row.tenantId!==ctx.tenantId||row.scope!=='personal'||row.proposedBy!==ctx.userId||row.payload.ownerUserId!==ctx.userId)throw missing();
  if(VERSION_SOURCE_KINDS.has(row.sourceKind))throw conflict('Decide this version candidate at /memory/version-candidates/:id/approve or /reject.');
  if(row.status!=='pending')throw notFound('No pending memory candidate with that id.');
  if(row.proposedBy!==ctx.userId)throw forbidden();
  row.status=decision==='approve'?'approved':'rejected';row.decidedAt=now();
  if(decision==='reject')return {status:'rejected'};
  const memoryId=randomUUID();
  state.memories.push({id:memoryId,tenantId:ctx.tenantId,scope:row.payload.scope,ownerUserId:row.payload.ownerUserId,clientId:row.payload.clientId,key:row.payload.key,value:row.payload.value,expiresAt:row.payload.expiresAt===null?null:Date.parse(row.payload.expiresAt),updatedAt:iso(now())});
  row.committedMemoryId=memoryId;return {status:'approved',memoryId};
 }
 /** immutable-memory-version.service.ts approveCandidate / rejectCandidate. */
 function versionDecision(ctx,id,decision,raw){
  if(!state.lifecycle)throw new HttpError(503,'Immutable governed memory versions are disabled (MEMORY_GOVERNANCE_LIFECYCLE is not "enforce").');
  let cleanReason=null;
  if(decision==='reject'){cleanReason=String(raw?.reason??'').trim();if(!cleanReason)throw bad('A rejection reason is required.');}
  const row=state.candidates.get(id);
  if(!UUID.test(id)||!row||row.tenantId!==ctx.tenantId||row.status!=='pending'||!VERSION_SOURCE_KINDS.has(row.sourceKind))throw notFound('No pending memory version candidate with that id.');
  if(decision==='approve'&&row.payload.scope!=='user_private'&&row.proposedBy===ctx.userId&&!ADMIN_ROLES.has(ctx.role))throw forbidden();
  if(decision==='reject'){row.status='rejected';row.decidedAt=now();return {ok:true,candidateId:id,outcome:'rejected'};}
  const source=loadItem(ctx.tenantId,{id:row.payload.versionProposal.sourceItemId});if(!source||itemState(source)!=='active')throw conflict('Source version is no longer controlling.');
  source.status='superseded';source.governedStatus='superseded';
  const version={...source,id:randomUUID(),slug:`${source.slug}~v${randomUUID().replaceAll('-','')}`,supersedesId:source.id,status:'active',governedStatus:'active',sections:[{key:'memory',heading:'Memory',owner:'human',body:row.payload.value}],createdAt:now(),updatedAt:iso(now())};
  state.items.push(version);row.status='approved';row.decidedAt=now();row.committedMemoryItemId=version.id;
  return {ok:true,candidateId:id,outcome:'activated',memoryItemId:version.id};
 }
 async function route(request){
  const url=new URL(request.url),path=url.pathname,headers=request.headers;
  if(request.method!=='POST')throw new HttpError(404,'Not found');
  const ctx=ctxOf(headers);let body=null;try{body=JSON.parse(await request.text());}catch{throw bad('Unexpected token');}
  state.calls.push({path,service:headers.has('x-internal-service-secret'),bearer:headers.get('authorization').slice(7)});
  const receiving={'/api/clio/memory/review/submit':submit,'/api/clio/memory/review/status':status,'/api/clio/memory/read_target':async(c,raw)=>({memory:await readScoped(c,text(closed(raw,['memoryId'],'body').memoryId,'memoryId',1,128))}),'/api/clio/memory/find_by_key':findByKey}[path];
  if(receiving){if(!verified(headers))throw forbidden();return receiving(ctx,body);}
  let m;
  if((m=/^\/api\/memory\/candidates\/([^/]+)\/owner-decision$/u.exec(path)))return ownerDecision(ctx,m[1],body);
  if((m=/^\/api\/memory\/version-candidates\/([^/]+)\/(approve|reject)$/u.exec(path)))return versionDecision(ctx,m[1],m[2],body);
  throw new HttpError(404,`Cannot POST ${path}`);
 }
 async function fetch(url,init){
  if(state.offline)throw new TypeError('fetch failed');
  try{return Response.json(await route(new Request(url,init)),{status:200,headers:{'cache-control':'no-store'}});}
  catch(error){if(error instanceof HttpError)return Response.json({statusCode:error.status,message:error.message},{status:error.status});throw error;}
 }
 const member=({token,tenantId,userId,role='standard_user'})=>{state.bearers.set(token,{tenantId,userId,role});return state.bearers.get(token);};
 /** A committed clio memory (optionally with its canonical projection item, as Core's adapter keeps for governed tenants). */
 const addMemory=({id=randomUUID(),tenantId,scope='personal',ownerUserId=null,clientId=null,key,value='Mornings',expiresAt=null,updatedAt=iso(now()),projection=true})=>{
  const row={id,tenantId,scope:CORE_SCOPE[scope],ownerUserId:scope==='personal'?ownerUserId:null,clientId:scope==='client'?clientId:null,key,value,expiresAt,updatedAt};state.memories.push(row);
  if(projection)state.items.push({id:randomUUID(),tenantId,slug:clioMemorySlug(id),supersedesId:null,status:'active',governedStatus:'active',title:key,sections:[{key:'memory',heading:'Memory',owner:'human',body:value}],ownerUserId:row.ownerUserId,clientId:row.clientId,memoryScope:row.scope,expiresAt,updatedAt,createdAt:now()-1000});
  return row;
 };
 return Object.freeze({state,fetch,member,addMemory,readScoped,calls:state.calls,candidates:state.candidates,submissions:state.submissions,items:state.items,memories:state.memories});
}
