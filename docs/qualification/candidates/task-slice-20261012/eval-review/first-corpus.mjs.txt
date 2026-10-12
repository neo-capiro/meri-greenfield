import {snapshot,hash,publicShape,action,exact,text,digest,instant,enumeration,array,unique,same,freeze,qualification,error} from './contracts.mjs';
const splits=['development','calibration','held-out'];
export function freezeCorpus(value,options){
 const input=snapshot(value),pin=snapshot(options);exact(pin,['approvalSha256']);digest(pin.approvalSha256);
 exact(input,['schema','cases','sources','config','approval']);if(input.schema!=='meri-task-lookup-input/1')error('EVAL_SCHEMA');
 const {cases,sources,config,approval}=input;array(cases);array(sources);unique(sources.map(s=>s.sourceId));
 for(const source of sources){exact(source,['sourceId','snapshotSha256','asOf','receiptSha256']);text(source.sourceId,128);digest(source.snapshotSha256);digest(source.receiptSha256);instant(source.asOf);}
 exact(config,['sourceCommit','catalogSha256','contractsSha256','imageDigest','sdkVersion','modelId','proxyConfigSha256','skillManifestSha256','executionKind']);
 if(typeof config.sourceCommit!=='string'||!/^[a-f0-9]{40}$/.test(config.sourceCommit))error('EVAL_SOURCE_COMMIT');
 for(const key of ['catalogSha256','contractsSha256','proxyConfigSha256','skillManifestSha256'])digest(config[key]);
 if(config.imageDigest!==null&&(typeof config.imageDigest!=='string'||!/^sha256:[a-f0-9]{64}$/.test(config.imageDigest)))error('EVAL_IMAGE');
 for(const key of ['sdkVersion','modelId'])if(config[key]!==null)text(config[key]);enumeration(config.executionKind,['source-test','native-observed']);
 const groups=new Map(),origins=new Map(),casePins=[];unique(cases.map(c=>c.caseId));
 for(const c of cases){
  exact(c,['caseId','groupId','split','kind','originSha256','mode','prompt','request','context','scopes','sourceIds','expected']);text(c.caseId);text(c.groupId);enumeration(c.split,splits);enumeration(c.kind,['real','synthetic']);digest(c.originSha256);enumeration(c.mode,['original','correct-tool','correct-evidence']);text(c.prompt,10000);
  if(groups.has(c.groupId)&&groups.get(c.groupId)!==c.split)error('EVAL_GROUP_LEAKAGE');groups.set(c.groupId,c.split);
  if(origins.has(c.originSha256)&&origins.get(c.originSha256)!==c.groupId)error('EVAL_ORIGIN_GROUP');origins.set(c.originSha256,c.groupId);
  const normalized=action.normalizeInput(c.request,c.context);if(normalized.input.mode!=='client_scoped')error('EVAL_SELECTED_CLIENT_REQUIRED');
  if(!c.context.clientResolution||c.context.clientResolution.reference!==c.context.clientResolution.clientId||c.request.clientId!==c.context.clientResolution.clientId)error('EVAL_EXACT_CLIENT_REQUIRED');
  array(c.scopes,100);if(!c.scopes.length)error('EVAL_SCOPES');unique(c.scopes.map(hash));for(const scope of c.scopes){publicShape('Scope',scope);if(scope.tenantId!==c.context.binding.tenantId)error('EVAL_SCOPE_BINDING');}
  array(c.sourceIds,100);unique(c.sourceIds);if(!c.sourceIds.length||c.sourceIds.some(id=>!sources.some(s=>s.sourceId===id)))error('EVAL_SOURCE_REFERENCE');
  exact(c.expected,['outcome','semanticSha256','replaySha256','recordIds','absence','exhaustive']);enumeration(c.expected.outcome,['returned','denied','clarify']);array(c.expected.recordIds,50);unique(c.expected.recordIds);for(const id of c.expected.recordIds)text(id);
  if(c.expected.outcome==='returned')digest(c.expected.semanticSha256);else if(c.expected.semanticSha256!==null||c.expected.recordIds.length)error('EVAL_NONRETURN_GOLD');
  if(c.expected.replaySha256!==null)digest(c.expected.replaySha256);
  if(c.expected.absence!==false||c.expected.exhaustive!==false)error('EVAL_UNQUALIFIED_CLAIM');
  casePins.push({caseId:c.caseId,caseSha256:hash(c),sourceSetSha256:hash(c.sourceIds.map(id=>sources.find(s=>s.sourceId===id)))});
 }
 exact(approval,['receiptId','ownerRef','issuedAt','inputSha256']);text(approval.receiptId);text(approval.ownerRef);instant(approval.issuedAt);digest(approval.inputSha256);
 if(approval.inputSha256!==hash({cases,sources,config})||hash(approval)!==pin.approvalSha256)error('EVAL_APPROVAL_PIN');
 return freeze({schema:'meri-task-lookup-freeze/1',input,corpusSha256:hash(input),approvalSha256:pin.approvalSha256,configSha256:hash(config),sourceSetSha256:hash(sources),casePins,
  counts:{cases:cases.length,declaredRealCases:cases.filter(c=>c.kind==='real').length,declaredRealSeeds:new Set(cases.filter(c=>c.kind==='real').map(c=>c.originSha256)).size,syntheticCases:cases.filter(c=>c.kind==='synthetic').length,qualifiedRealRequests:0},qualification:qualification()});
}
export function verifyCorpus(value){const frozen=snapshot(value);const recomputed=freezeCorpus(frozen.input,{approvalSha256:frozen.approvalSha256});if(!same(frozen,recomputed))error('EVAL_FREEZE_MISMATCH');return recomputed;}
export function runnerCases(value,options){const frozen=verifyCorpus(value),o=snapshot(options);exact(o,['split']);enumeration(o.split,splits);
 return freeze({schema:'meri-task-lookup-runner/1',corpusSha256:frozen.corpusSha256,configSha256:frozen.configSha256,split:o.split,config:snapshot(frozen.input.config),sources:snapshot(frozen.input.sources),cases:frozen.input.cases.filter(c=>c.split===o.split).map(c=>{
  const {expected,kind,originSha256,split,...runner}=c;return {...snapshot(runner),...frozen.casePins.find(p=>p.caseId===c.caseId)};
 })});
}
