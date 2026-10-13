import {types} from 'node:util';
import {assertTaskLookupStoredBinding} from '../../../apps/control/task-lookup/index.mjs';
import {snapshot,hash,publicShape,action,exact,text,digest,instant,enumeration,array,unique,same,freeze,error} from '../contracts.mjs';
export {snapshot,hash,exact,same,freeze,error};
export const operation=Object.freeze({id:'actions.query',version:'0.2.0'});
export const stable=b=>({tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId});
export function options(value,required,optional=[]){
 if(!value||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)error('EXEC_OPTIONS');const out={};
 for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!d.enumerable||!Object.hasOwn(d,'value'))error('EXEC_OPTIONS');out[key]=d.value;}exact(out,[...required,...optional.filter(k=>Object.hasOwn(out,k))]);return out;
}
export function method(value,name){if(!value||types.isProxy(value))error('EXEC_PORT');let p=value;while(p){const d=Object.getOwnPropertyDescriptor(p,name);if(d){if(!Object.hasOwn(d,'value')||typeof d.value!=='function')error('EXEC_PORT');return d.value.bind(value);}p=Object.getPrototypeOf(p);if(p&&types.isProxy(p))error('EXEC_PORT');}error('EXEC_PORT');}
export function safeCode(value){if(!value||typeof value!=='object'||types.isProxy(value))return 'EXEC_PORT_FAILURE';const d=Object.getOwnPropertyDescriptor(value,'code');return d&&Object.hasOwn(d,'value')&&typeof d.value==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(d.value)?d.value:'EXEC_PORT_FAILURE';}
export function admit(value){
 const {runners,runnerSha256,runBindings,runId,deadlineMs,signal}=options(value,['runners','runnerSha256','runBindings','runId','deadlineMs'],['signal']);
 if(signal!==undefined&&(types.isProxy(signal)||!(signal instanceof AbortSignal)))error('EXEC_SIGNAL');
 const data=snapshot({runners,runnerSha256,runBindings,runId,deadlineMs});text(data.runId);if(!Number.isSafeInteger(data.deadlineMs))error('EXEC_DEADLINE');
 array(data.runners,3);array(data.runnerSha256,3);if(data.runners.length!==3||data.runnerSha256.length!==3)error('EXEC_ALL_SPLITS');
 const splits=['development','calibration','held-out'],cases=[],groups=new Map();let corpusSha256,configSha256,sourceSetSha256;
 for(const [index,r] of data.runners.entries()){
  exact(r,['schema','corpusSha256','configSha256','split','config','sources','cases']);if(r.schema!=='meri-task-lookup-runner/1')error('EXEC_RUNNER');digest(data.runnerSha256[index]);if(hash(r)!==data.runnerSha256[index])error('EXEC_RUNNER_PIN');
  digest(r.corpusSha256);digest(r.configSha256);enumeration(r.split,splits);
  exact(r.config,['sourceCommit','catalogSha256','contractsSha256','imageDigest','sdkVersion','modelId','proxyConfigSha256','skillManifestSha256','executionKind']);if(hash(r.config)!==r.configSha256)error('EXEC_CONFIG_PIN');
  array(r.sources);unique(r.sources.map(s=>s.sourceId));for(const s of r.sources){exact(s,['sourceId','snapshotSha256','asOf','receiptSha256']);text(s.sourceId,128);digest(s.snapshotSha256);digest(s.receiptSha256);instant(s.asOf);}
  const sourcePin=hash(r.sources);if(index&&(corpusSha256!==r.corpusSha256||configSha256!==r.configSha256||sourceSetSha256!==sourcePin))error('EXEC_COHORT_IDENTITY');corpusSha256=r.corpusSha256;configSha256=r.configSha256;sourceSetSha256=sourcePin;
  array(r.cases);for(const c of r.cases){
   exact(c,['caseId','groupId','mode','prompt','request','context','scopes','sourceIds','caseSha256','sourceSetSha256']);text(c.caseId);text(c.groupId);text(c.prompt,10000);enumeration(c.mode,['original','correct-tool','correct-evidence']);digest(c.caseSha256);digest(c.sourceSetSha256);
   if(groups.has(c.groupId)&&groups.get(c.groupId)!==r.split)error('EXEC_GROUP_SPLIT');groups.set(c.groupId,r.split);
   const normalized=action.normalizeInput(c.request,c.context);if(normalized.input.mode!=='client_scoped'||c.request.clientId!==c.context.clientResolution?.clientId||c.context.clientResolution.reference!==c.context.clientResolution.clientId)error('EXEC_CLIENT');
   array(c.scopes,100);unique(c.scopes.map(hash));for(const scope of c.scopes){publicShape('Scope',scope);if(scope.tenantId!==c.context.binding.tenantId)error('EXEC_SCOPE');}
   array(c.sourceIds,100);unique(c.sourceIds);if(!c.sourceIds.length||c.sourceIds.some(id=>!r.sources.some(s=>s.sourceId===id))||c.sourceSetSha256!==hash(c.sourceIds.map(id=>r.sources.find(s=>s.sourceId===id))))error('EXEC_SOURCE_PIN');
   cases.push({...c,split:r.split,runnerSha256:data.runnerSha256[index]});
  }
 }
 unique(data.runners.map(r=>r.split));array(cases);unique(cases.map(c=>c.caseId));array(data.runBindings);unique(data.runBindings.map(b=>b.caseId));
 if(!same(data.runBindings.map(b=>b.caseId).sort(),cases.map(c=>c.caseId).sort()))error('EXEC_BINDINGS');
 for(const row of data.runBindings){exact(row,['caseId','binding']);publicShape('RunBinding',row.binding);if(!same(stable(row.binding),stable(cases.find(c=>c.caseId===row.caseId).context.binding)))error('EXEC_STABLE_BINDING');}
 return {data:freeze({cases,runBindings:data.runBindings,runId:data.runId,deadlineMs:data.deadlineMs,corpusSha256,configSha256,sourceSetSha256}),signal};
}
export function prepared(value,c,binding,now,deadlineMs){
 const p=snapshot(value);exact(p,['context','readContext','credential']);if(typeof p.credential!=='string'||Buffer.byteLength(p.credential)>65536)error('EXEC_CREDENTIAL');const context=p.context;
 if(!same(context.binding,binding)||!same(context.scopes,c.scopes)||context.selectedClientId!==c.request.clientId||!Number.isSafeInteger(context.deadlineMs)||context.deadlineMs<=now||context.deadlineMs>deadlineMs||context.deadlineMs-now>60000)error('EXEC_PREPARED_CONTEXT');
 const request={operation,arguments:c.request},normalized=action.normalizeInput(c.request,{...c.context,binding});
 assertTaskLookupStoredBinding({context,request,argumentsSha256:normalized.argumentsSha256,bindingSha256:hash({context,request})});
 exact(p.readContext,['currentBinding','scopes','deadlineMs']);publicShape('RunBinding',p.readContext.currentBinding);
 if(!same(stable(p.readContext.currentBinding),stable(binding))||!same(p.readContext.scopes,c.scopes)||!Number.isSafeInteger(p.readContext.deadlineMs)||p.readContext.deadlineMs<=now||p.readContext.deadlineMs>deadlineMs||p.readContext.deadlineMs-now>60000)error('EXEC_PREPARED_READ');
 return freeze(p);
}
