/** Current native-qualified installation over measured Meri code; no self-qualification. */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertSubject} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertSkillInstallation} from '../../../packages/contracts/selected-skills/validate.mjs';
import {selectSkill} from '../../../packages/skills/index.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {executionCatalogSha256} from './installed-catalog.mjs';
const key=op=>`${op.id}@${op.version}`,same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const fault=()=>Object.assign(Error('SKILL_INSTALLATION_REFUSED'),{code:'SKILL_INSTALLATION_REFUSED'}),fail=()=>{throw fault();};
export function createSelectedSkillInstallationOwner(configuration){
 const c=own(configuration,['binding','request','selection','scopes','selectedClientId','handlers','readCurrentContext','readCurrentInstallation','now'],['sourceRoot','maxRequestMs']);
 const binding=data(c.binding),request=data(c.request),selection=data(own(c.selection,['subject','window','mondayBoardIds'])),scopes=data(c.scopes),selected=selectSkill(request.skill.skillId,request.skill.skillVersion);
 validateShape('RunBinding',binding);assertSubject(selection.subject,binding);
 const input=data({binding,skill:selected.pin,requestSha256:canonicalSha256(request),selectionSha256:canonicalSha256(selection)}),sourceRoot=resolve(c.sourceRoot??fileURLToPath(new URL('../../../',import.meta.url))),maxRequestMs=c.maxRequestMs??3000;
 if(!same(request.skill,selected.pin)||!same(selection.subject.scopes,scopes)||!same(selection.window,request.window)||selection.subject.kind!=='client'||selection.subject.entityIds.length!==1||selection.subject.entityIds[0]!==c.selectedClientId||types.isProxy(c.handlers)||!(c.handlers instanceof Map)||Object.getPrototypeOf(c.handlers)!==Map.prototype||['readCurrentContext','readCurrentInstallation','now'].some(k=>typeof c[k]!=='function')||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail();
 const handlers=new Map(),files=new Map();
 for(const [id,handler]of Map.prototype.entries.call(c.handlers)){const h=own(handler,['execute','sourceSha256','sourceFiles']);if(typeof h.execute!=='function')fail();const records=data(h.sourceFiles);
  if(!Array.isArray(records)||records.length<1||records.length>128)fail();const labels=new Set();for(const row of records){own(row,['label','sha256']);if(typeof row.label!=='string'||!/^[-A-Za-z0-9_./]+$/u.test(row.label)||row.label.split('/').some(p=>p==='.'||p==='..'||p==='')||labels.has(row.label)||!(/^[a-f0-9]{64}$/u.test(row.sha256)))fail();labels.add(row.label);}
  if(h.sourceSha256!==canonicalSha256(records))fail();files.set(id,records);handlers.set(id,Object.freeze({sourceSha256:h.sourceSha256,execute:call=>h.execute.call(handler,call)}));
 }
 async function context(life){const started=c.now(),r=data(own(await life.run(signal=>c.readCurrentContext({binding,signal})),['binding','scopes','selectedClientId','checkedAtMs','expiresAtMs']));
  if(!same(r.binding,binding)||!same(r.scopes,scopes)||r.selectedClientId!==c.selectedClientId||r.checkedAtMs<started||r.checkedAtMs>c.now()||!Number.isSafeInteger(r.checkedAtMs)||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=c.now())fail();life.limitDeadline(r.expiresAtMs);return r;}
 async function measure(operation,life){const records=files.get(key(operation));if(!records)fail();let total=0;for(const r of records){const path=resolve(sourceRoot,r.label);if(!path.startsWith(sourceRoot+sep))fail();let handle;
   try{handle=await life.run(()=>open(path,constants.O_RDONLY|constants.O_NOFOLLOW).then(async acquired=>{try{life.check();return acquired;}catch(error){await acquired.close();throw error;}}));const stat=await life.run(()=>handle.stat());if(!stat.isFile()||stat.size>8*1024*1024||(total+=stat.size)>16*1024*1024)fail();const bytes=await life.run(signal=>handle.readFile({signal}));if(bytes.length!==stat.size||createHash('sha256').update(bytes).digest('hex')!==r.sha256)fail();}finally{await handle?.close();}}
 }
 async function readForSkill(value){const {signal,...raw}=own(value,['binding','skill','requestSha256','selectionSha256'],['signal']);nativeSignal(signal);if(!same(data(raw),input))fail();const life=createOperationLifetime({deadlineMs:c.now()+maxRequestMs,now:c.now,signal,errorFactory:fault});
  try{const before=await context(life),started=c.now();
   // This configured port is the trusted native qualification owner. It must
   // verify current retained qualification/code/source authorization itself.
   // A caller/model receipt, UUID, Boolean or source-implemented flag is not it.
   const native=data(own(await life.run(signal=>c.readCurrentInstallation({...input,scopes,selectedClientId:c.selectedClientId,policyRevision:scopes[0].policyRevision,signal})),[...Object.keys(input),'baseCatalogSha256','installationId','executionCatalogSha256','operations','checkedAtMs','expiresAtMs','scopes','selectedClientId','policyRevision']));
   const {scopes:observedScopes,selectedClientId,policyRevision,...receipt}=native;
   if(!same(observedScopes,scopes)||selectedClientId!==c.selectedClientId||policyRevision!==scopes[0].policyRevision||native.executionCatalogSha256!==executionCatalogSha256(native))fail();
   assertSkillInstallation(receipt,{input,selected,started,now:c.now,life});
   for(const op of receipt.operations){if(handlers.get(key(op.operation))?.sourceSha256!==op.handlerSourceSha256)fail();await measure(op.operation,life);}
   const after=await context(life);if(!same({...before,checkedAtMs:0,expiresAtMs:0},{...after,checkedAtMs:0,expiresAtMs:0}))fail();life.check();return data({...receipt,checkedAtMs:c.now(),expiresAtMs:Math.min(receipt.expiresAtMs,before.expiresAtMs,after.expiresAtMs)});
  }catch{throw fault();}finally{life.close();}}
 return Object.freeze({readForSkill,handlers});
}
