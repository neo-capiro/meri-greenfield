/** Deterministic adversarial case generator. Pure: cases reference tenants by ID and credentials by role placeholder. */
import {createHash} from 'node:crypto';
import {syntheticId} from '../offline-targets/conversation-application.mjs';
import {tenantPairs} from './tenants.mjs';
const AUTHORITY_KEYS=['tenantId','actorId','grantId','policyRevision','writerFence','capability','authorizedSources','binding'];
const forgedValue=(key,victim)=>({tenantId:victim.tenantId,actorId:victim.principal.actorId,grantId:`grant-${victim.tag}`,policyRevision:victim.principal.scopes[0].policyRevision,writerFence:victim.principal.binding.writerFence,capability:`capability-${victim.tag}`,authorizedSources:['scripted-source'],binding:structuredClone(victim.principal.binding)})[key];
const forgedCredential=(victim,kind)=>`action_session_${createHash('sha256').update(`${kind}:${victim.tag}`).digest('base64url').slice(0,43)}`;
function httpCases(attacker,victim){
 const v=victim.principal,b=v.binding,requestId=syntheticId(attacker.tag,777);
 return [
  {category:'guessed-id',attack:{route:'history',method:'POST',credential:'@attacker-session',body:{conversationId:b.conversationId}},note:'history body names the victim conversation'},
  {category:'guessed-id',attack:{route:'cancel',method:'POST',credential:'@attacker-session',body:{runId:b.runId}},note:'cancel body names the victim run'},
  {category:'object-link',attack:{route:`events/${b.conversationId}/stream`,method:'GET',credential:'@attacker-session'},note:'reconnect link to the victim conversation stream'},
  {category:'object-link',attack:{route:'events',method:'POST',credential:'@attacker-session',body:{command:{conversationId:b.conversationId,intent:'view.subscribe'}}},note:'subscription command for the victim conversation'},
  {category:'session-key',attack:{route:`events/${b.conversationId}/stream`,method:'GET',credential:'@victim-session-mutated'},note:'victim session key with one altered character'},
  {category:'session-key',attack:{route:'history',method:'POST',credential:'@victim-session-prefix',body:{}},note:'truncated victim session key'},
  {category:'session-key',attack:{route:'history',method:'POST',credential:forgedCredential(victim,'derived'),body:{}},note:'well-formed session key derived from victim identity'},
  {category:'forged-arguments',attack:{route:'submit',method:'POST',credential:'@attacker-session',body:{requestId,prompt:'read the other tenant',binding:structuredClone(b)}},note:'submit carries a victim RunBinding'},
  {category:'forged-arguments',attack:{route:'submit',method:'POST',credential:'@attacker-session',body:{requestId,prompt:'read the other tenant',scopes:structuredClone(v.scopes)}},note:'submit carries victim scopes'},
 ].map(c=>({surface:'conversations-http',...c}));
}
function gatewayCases(attacker,victim){
 const forged=AUTHORITY_KEYS.map((key,index)=>{const value=forgedValue(key,victim),args=index%2?{filters:{nested:{[key]:value}}}:{[key]:value};
  return {category:'forged-arguments',attack:{kind:'execute',credential:'@attacker-capability',arguments:args},note:`${index%2?'nested':'top-level'} forged ${key}`};});
 return [...forged,{category:'object-link',attack:{kind:'execute-foreign-lineage',credential:'@attacker-capability',arguments:{}},note:'source handler answers with victim lineage'}].map(c=>({surface:'gateway-dispatch',...c}));
}
function lookupCases(attacker,victim){
 const vb=victim.principal.binding,ab=attacker.principal.binding;
 return [
  {category:'forged-arguments',attack:{current:structuredClone(vb),scopes:'@victim-gateway-scopes',phase:'before_read'},note:'victim binding and scopes under attacker credential'},
  {category:'forged-arguments',attack:{current:structuredClone(ab),scopes:'@victim-gateway-scopes',phase:'before_read'},note:'attacker binding with victim scopes'},
  {category:'guessed-id',attack:{current:structuredClone(vb),scopes:'@attacker-gateway-scopes',phase:'before_read'},note:'victim binding with attacker scopes'},
 ].map(c=>({surface:'task-lookup-authorizer',...c}));
}
function artifactCases(attacker,victim){
 return [
  {category:'object-link',attack:{operation:'download',versionId:'@victim-artifact-version',context:'attacker'},note:'download the victim version by its link'},
  {category:'object-link',attack:{operation:'inspect',versionId:'@victim-artifact-version',context:'attacker'},note:'inspect the victim version by its link'},
  {category:'forged-arguments',attack:{operation:'download',versionId:'@victim-artifact-version',context:'attacker-with-victim-scopes'},note:'attacker binding carrying victim scopes'},
 ].map(c=>({surface:'artifact-service',...c}));
}
export function generateCases(tenants){
 const rows=[];
 for(const {attacker,victim} of tenantPairs(tenants))for(const c of [...httpCases(attacker,victim),...gatewayCases(attacker,victim),...lookupCases(attacker,victim),...artifactCases(attacker,victim)])
  rows.push({caseId:`ISO-${String(rows.length+1).padStart(3,'0')}`,attacker:attacker.tenantId,victim:victim.tenantId,expectation:'refused',...c});
 return Object.freeze(rows);
}
