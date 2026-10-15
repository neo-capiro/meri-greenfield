/** Executes one generated case against the seeded targets and returns what the attacker could observe. */
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {operation} from '../offline-targets/gateway-dispatch.mjs';
import {syntheticId} from '../offline-targets/conversation-application.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const GATEWAY_REFUSALS=['INVALID_ARGUMENTS','ACCESS_DENIED','UNAVAILABLE','INVALID_RESULT','DEADLINE','CANCELLED'],LOOKUP_REFUSALS=['ACCESS_DENIED','LOOKUP_UNAVAILABLE','DEADLINE','CANCELLED'];
const artifactRefusal=error=>typeof error?.code==='string'&&error.code.startsWith('ARTIFACT_')||['Cross-tenant artifact scope','Duplicate scope'].includes(error?.message);
/** Serialize a thrown failure the way a caller would see it: message, code and own enumerable data, including causes. */
export function observableFailure(error){
 const seen=new Set();const render=e=>{if(!e||typeof e!=='object'||seen.has(e))return String(e);seen.add(e);const own={};for(const key of Object.getOwnPropertyNames(e))if(key!=='stack')own[key]=e[key];return JSON.stringify(own,(k,v)=>v instanceof Error?JSON.parse(render(v)):v);};
 return render(error);
}
async function readBounded(response,maxMs){
 if(response.body===null)return '';const reader=response.body.getReader();const chunks=[];const timer=new Promise(resolve=>setTimeout(resolve,maxMs,'timeout'));
 try{while(true){const next=await Promise.race([reader.read(),timer]);if(next==='timeout'||next.done)break;chunks.push(Buffer.from(next.value));if(Buffer.concat(chunks).length>65536)break;}}
 finally{try{await reader.cancel();}catch{}}
 return Buffer.concat(chunks).toString('utf8');
}
function resolveCredential(placeholder,targets,attacker,victim){
 const a=targets.seeded.get(attacker.tenantId),v=targets.seeded.get(victim.tenantId);
 if(placeholder==='@attacker-session')return a.sessionCredential;
 if(placeholder==='@victim-session-mutated'){const c=v.sessionCredential;return c.slice(0,-1)+(c.endsWith('A')?'B':'A');}
 if(placeholder==='@victim-session-prefix')return v.sessionCredential.slice(0,30);
 if(placeholder==='@attacker-capability')return a.gatewayCredential;
 if(typeof placeholder==='string'&&!placeholder.startsWith('@'))return placeholder;
 fail('ISOLATION_CREDENTIAL_PLACEHOLDER');
}
async function http(targets,c,attacker,victim){
 const {route,method,body}=c.attack,credential=resolveCredential(c.attack.credential,targets,attacker,victim);
 const response=await targets.conversations.app.handle(targets.conversations.request({route,method,credential,body}));
 const text=await readBounded(response,250);
 return {accepted:response.status>=200&&response.status<300,refusal:response.status>=400&&response.status<500,text:`${response.status} ${text}`,status:response.status};
}
async function gateway(targets,c,attacker,victim){
 const credential=resolveCredential(c.attack.credential,targets,attacker,victim),requestJson=JSON.stringify({operation,arguments:c.attack.arguments});
 const foreign=c.attack.kind==='execute-foreign-lineage',g=targets.gateway;
 try{const output=foreign?await g.executeWith(async()=>JSON.stringify({binding:structuredClone(victim.principal.binding),subject:foreignSubject(victim,targets),data:g.page()}),requestJson,credential):await g.execute(requestJson,credential);
  return {accepted:true,refusal:false,text:output,status:'returned'};}
 catch(error){return {accepted:false,refusal:error?.name==='GatewayDenied'&&GATEWAY_REFUSALS.includes(error.message),text:observableFailure(error),status:error.message};}
}
function foreignSubject(victim,targets){const scope=targets.seeded.get(victim.tenantId).gatewayScope,p=victim.principal;
 return {kind:'personal',entityType:'user',entityIds:[p.actorId],tenantId:p.binding.tenantId,actorId:p.actorId,authorizationDecisionId:syntheticId('0bad',902),policyRevision:scope.policyRevision,scopes:[scope],rosterVersionId:null};}
async function lookup(targets,c,attacker,victim){
 const scopes=c.attack.scopes==='@victim-gateway-scopes'?[targets.seeded.get(victim.tenantId).gatewayScope]:c.attack.scopes==='@attacker-gateway-scopes'?[targets.seeded.get(attacker.tenantId).gatewayScope]:fail('ISOLATION_SCOPE_PLACEHOLDER');
 const unsigned={original:null,current:c.attack.current,scopes:structuredClone(scopes),resultReference:syntheticId(attacker.tag,600),resultSha256:null};
 try{const receipt=await targets.lookupAuthorizer(attacker)({phase:c.attack.phase,binding:{...unsigned,bindingSha256:canonicalSha256(unsigned)},limitDeadline(){}});return {accepted:true,refusal:false,text:JSON.stringify(receipt),status:'authorized'};}
 catch(error){return {accepted:false,refusal:LOOKUP_REFUSALS.includes(error?.code),text:observableFailure(error),status:error.code??error.message};}
}
async function artifact(targets,c,attacker,victim){
 const versionId=c.attack.versionId==='@victim-artifact-version'?targets.seeded.get(victim.tenantId).artifactVersionId:fail('ISOLATION_VERSION_PLACEHOLDER');
 const context=c.attack.context==='attacker'?targets.artifacts.context(attacker.principal):c.attack.context==='attacker-with-victim-scopes'?targets.artifacts.context({binding:attacker.principal.binding,scopes:victim.principal.scopes}):fail('ISOLATION_CONTEXT_PLACEHOLDER');
 try{const result=await targets.artifacts.service[c.attack.operation](versionId,context);return {accepted:true,refusal:false,text:JSON.stringify({...result,bytes:result.bytes?.toString('utf8')}),status:'released'};}
 catch(error){return {accepted:false,refusal:artifactRefusal(error),text:observableFailure(error),status:error.code??error.message};}
}
const surfaces={'conversations-http':http,'gateway-dispatch':gateway,'task-lookup-authorizer':lookup,'artifact-service':artifact};
export async function executeCase(targets,tenants,c){
 const attacker=tenants.find(t=>t.tenantId===c.attacker),victim=tenants.find(t=>t.tenantId===c.victim),run=surfaces[c.surface];
 if(!attacker||!victim||attacker===victim||!run)fail('ISOLATION_CASE');
 return run(targets,c,attacker,victim);
}
/** Positive controls prove the oracle sees a tenant's own data when it is legitimately served. */
export async function executeControls(targets,tenants){
 const rows=[];
 for(const tenant of tenants){const s=targets.seeded.get(tenant.tenantId);
  const history=await targets.conversations.app.handle(targets.conversations.request({route:'history',credential:s.sessionCredential,body:{}}));
  rows.push({controlId:`own-history:${tenant.tenantId}`,ok:history.status===200&&(await history.text()).includes(tenant.promptSentinel)});
  const download=await targets.artifacts.service.download(s.artifactVersionId,targets.artifacts.context(tenant.principal));
  rows.push({controlId:`own-artifact:${tenant.tenantId}`,ok:download.bytes.toString('utf8').includes(tenant.artifactSentinel)});
  const unsigned={original:null,current:structuredClone(tenant.principal.binding),scopes:[s.gatewayScope],resultReference:syntheticId(tenant.tag,601),resultSha256:null};
  const receipt=await targets.lookupAuthorizer(tenant)({phase:'before_read',binding:{...unsigned,bindingSha256:canonicalSha256(unsigned)},limitDeadline(){}});
  rows.push({controlId:`own-lookup:${tenant.tenantId}`,ok:receipt.authorized===true});
  const page=JSON.parse(await targets.gateway.execute(JSON.stringify({operation,arguments:{}}),s.gatewayCredential));
  rows.push({controlId:`own-gateway:${tenant.tenantId}`,ok:page.binding.tenantId===tenant.tenantId});
 }
 return rows;
}
