/** Test-only harness: the canonical ArtifactService over the real local immutable store and the real fixed generators
 * (Python DOCX/XLSX/TXT, PptxGenJS PPTX), with scripted authority, budget and retention ports the test controls. PDF
 * generation uses the given converter. Nothing here is a qualification. */
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import canonicalize from 'canonicalize';
import {createArtifactValidators} from '../../../packages/contracts/artifacts-0.2/artifact-validation.mjs';
import {createArtifactService} from '../service.mjs';
import {createLocalArtifactStore} from '../local-store.mjs';
import {createLocalArtifactExecutor} from '../local-executor.mjs';

export const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
export const pptxModulePath=process.env.MERI_PPTXGENJS??fileURLToPath(new URL('../../worker/qualification/node_modules/pptxgenjs',import.meta.url));
export const hash=x=>createHash('sha256').update(canonicalize(x)).digest('hex');
const publicSchema=JSON.parse(await readFile(new URL('../../../packages/contracts/meri.schema.json',import.meta.url)));
const privateSchema=JSON.parse(await readFile(new URL('../../../packages/contracts/artifacts-0.2/artifact.schema.json',import.meta.url)));
const ajv=addFormats(new Ajv({strict:true,allErrors:true}));ajv.addSchema(publicSchema);ajv.addSchema(privateSchema);
const shape=(schema,name,value)=>{const check=ajv.getSchema(schema+'#/$defs/'+name);if(!check(value))throw new Error(ajv.errorsText(check.errors));};
export const validators=createArtifactValidators({validateShape:(name,value)=>shape(privateSchema.$id,name,value),validatePublicShape:(name,value)=>shape(publicSchema.$id,name,value),canonicalSha256:hash});

export const specs=Object.freeze({
 docx:{operation:'create_word',format:'docx',title:'Brief',content:{blocks:[{kind:'paragraph',style:'Title',runs:[{text:'Policy brief',bold:true}]},{kind:'table',rows:[['Name','Value'],['A','2']]}]}},
 xlsx:{operation:'create_excel',format:'xlsx',title:'Model',content:{sheets:[{name:'Data',rows:[[{value:'Item'},{value:'Amount'}],[{value:'A'},{value:2}],[{value:'B'},{value:3}],[{value:'Total'},{formula:'=SUM(B2:B3)'}]]}]}},
 pptx:{operation:'create_powerpoint',format:'pptx',title:'Deck',content:{slides:[{title:'Summary',bullets:['First','Second']},{title:'Table',table:[['A','B'],['1','2']]}]}},
 pdf:{operation:'create_word',format:'pdf',title:'Printable',content:{blocks:[{kind:'paragraph',runs:[{text:'Printable brief'}]}]}},
 txt:{operation:'create_word',format:'txt',title:'Notes',content:{text:'plain notes\n'}},
});
export const context=()=>({binding:{tenantId:'tenant',actorId:'actor',conversationId:'10000000-0000-4000-8000-000000000001',runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1},
 scopes:[{tenantId:'tenant',kind:'tenant',resourceId:'tenant',policyRevision:'1'}],evidence:[],assets:[],deadlineMs:Date.now()+90000,maxBytes:8388608});

/** `state.deny` refuses authority; `state.suppressed` (a Set of subject ids) and `state.barrier` drive the retention gate. */
export async function artifactHarness(t,{converter=null}={}){
 const root=await mkdtemp(join(tmpdir(),'meri-artifact-harness-')),store=await createLocalArtifactStore({root:join(root,'store'),canonicalSha256:hash});
 t.after(async()=>{await store.dispose();await rm(root,{recursive:true,force:true});});
 const state={deny:false,suppressed:new Set(),barrier:false,authorizations:[],puts:0,gets:0};
 const executor=createLocalArtifactExecutor({pythonExecutable:python,nodeExecutable:process.execPath,pptxModulePath,tempRoot:root,timeoutMs:60000,officeTransformer:converter});
 const objects={async put(...args){state.puts++;return store.objects.put(...args);},async get(...args){state.gets++;return store.objects.get(...args);}};
 const retention={async assertServable(subject){if(state.barrier)throw Object.assign(Error('RETENTION_RECOVERY_BARRIER'),{code:'RETENTION_RECOVERY_BARRIER'});
  if(state.suppressed.has(subject.subjectId))throw Object.assign(Error('RETENTION_SUPPRESSED'),{code:'RETENTION_SUPPRESSED'});}};
 const service=createArtifactService({validators,executor,now:Date.now,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()}),versions:store.versions,objects,retention,
  authorize:async i=>{state.authorizations.push(i.action);return {receiptId:'authority',decision:state.deny?'deny':'allow',action:i.action,binding:i.binding,scopesSha256:hash(i.scopes),resourceSha256:hash(i.resource),requestSha256:i.requestSha256,expiresAtMs:i.deadlineMs};},
  budget:{reserve:async i=>({ticketId:'ticket',binding:i.binding,requestSha256:i.requestSha256,maxBytes:i.maxBytes,deadlineMs:i.deadlineMs}),settle:async({ticketId,requestSha256,bytes,outcome})=>({ticketId,requestSha256,bytes,outcome,status:'settled'})}});
 return {root,store,objects,service,state,retention};
}
