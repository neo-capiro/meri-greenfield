/** SYNTHETIC-LOCAL: document preparer over the real artifact write owner (`createPostgresArtifactService`) with the
 * document application's synthetic-local fixture (scripted ledger, local store, real txt executor), plus stub write
 * ports for refusal paths. Not native Office, storage, KMS or database evidence. */
import test from 'node:test';import assert from 'node:assert/strict';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {artifactValidators} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createLocalDocumentFixture} from '../../document-application/local/fixture.mjs';
import {createPostgresArtifactService} from '../../../artifacts/postgres-service.mjs';
import {createDocumentIntentPreparer} from '../document-preparer.mjs';
import {mount,delivery,id,NOW} from './fixture.mjs';
const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
// The artifact entry (`apps/artifacts/python/entry.py`) sets POSIX rlimits through `resource`, which Windows Python lacks, so the
// real-generation case needs Linux (the image gate) or an explicitly configured interpreter. It is skipped visibly, never passed.
const posixGeneration=process.platform!=='win32'||process.env.MERI_DOCUMENT_PYTHON!==undefined?{}:{skip:'artifact generation needs POSIX rlimits (Linux); set MERI_DOCUMENT_PYTHON to run it here'};
const WORD={id:'create_word',version:'0.2.0'},spec={operation:'create_word',format:'txt',title:'Draft',content:{text:'Hello\n'}};
const code=c=>e=>e.code===c;
const descriptor=op=>{const e=catalog.operations.find(o=>o.operation.id===op);return {operation:e.operation,requiredGrants:e.requiredGrants,sourceRequirements:e.sourceRequirements};};
const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
async function real(t){
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python});t.after(()=>f.close());
 const writes={execute:(call,signal)=>createPostgresArtifactService(f.artifactOptions).execute(call,f.credential,signal)};
 const b=f.artifactOptions.context.binding;return {f,...mount({binding:b,preparers:[createDocumentIntentPreparer({descriptor:f.artifactOptions.descriptor,writes,binding:b})],now:f.now,scopes:f.artifactOptions.context.scopes})};
}
test('create_word prepares an immutable draft version once; the same delivery is the owner\'s own replay',posixGeneration,async t=>{
 const s=await real(t),out=await s.mount.prepare({operation:WORD,arguments:spec,deliveryId:delivery(1)});
 assert.equal(out.status,'draft');assert.equal(out.version.generationStatus,'draft');assert.equal(out.version.parentVersionId,null);assert.equal(s.f.stats().generations,1);
 assert.deepEqual(await s.mount.prepare({operation:WORD,arguments:spec,deliveryId:delivery(1)}),out);assert.equal(s.f.stats().generations,1);
 await assert.rejects(s.mount.prepare({operation:WORD,arguments:{...spec,title:'Other'},deliveryId:delivery(1)}),code('CONFLICT'));assert.equal(s.f.stats().generations,1);
});
test('unadmitted formats, other operations and argument authority are refused before generation',async t=>{
 const s=await real(t);
 for(const [n,args] of [{...spec,format:'pdf'},{...spec,operation:'create_excel'},{...spec,context:{binding}},{...spec,deliveryId:'x'}].entries())
  await assert.rejects(s.mount.prepare({operation:WORD,arguments:args,deliveryId:delivery(10+n)}),code('INVALID_ARGUMENTS'));
 assert.equal(s.f.stats().generations,0);
});
test('only admitted document operations construct; general analysis keeps its separate owner',()=>{
 assert.throws(()=>createDocumentIntentPreparer({descriptor:descriptor('run_analysis'),writes:{execute(){}},binding}),code('INTENT_CONFIGURATION'));
 assert.equal(createDocumentIntentPreparer({descriptor:descriptor('create_powerpoint'),writes:{execute(){}},binding}).operation.id,'create_powerpoint');
 assert.equal(createDocumentIntentPreparer({descriptor:descriptor('create_excel'),writes:{execute(){}},binding}).operation.id,'create_excel');
});
// The advertised `request_document` tool carries the selected capability in its own `operation` field beside
// `arguments` ("the canonical request object for the selected operation") and tells the model that identity and
// authority come from the trusted run, never from arguments. The canonical artifact request repeats `operation`,
// so the owner must not require the model to repeat a trusted selection it cannot discover from what is advertised.
// The observed live class at this boundary is a delivery settled FAILED/INVALID_ARGUMENTS with no owner call and no
// run binding; these cases pin the accepted and refused shapes without a generator, database or provider.
const BODY={format:'txt',title:'Draft',content:{text:'Hello\n'}};
function stub(operation='create_word'){
 const calls=[],writes={async execute(call){calls.push(call);throw Object.assign(Error('OWNER_STOP'),{code:'OWNER_STOP'});}};
 const prepared=createDocumentIntentPreparer({descriptor:descriptor(operation),writes,binding});
 const journaled=mount({binding,preparers:[prepared],now:()=>NOW});
 const row=()=>[...journaled.store.rows.values()].at(-1);
 return {calls,preparer:prepared,mount:journaled.mount,row};
}
test('the trusted operation is bound for the selected capability: a canonical body without the duplicate operation reaches the owner',async()=>{
 const s=stub(),out=s.mount.prepare({operation:WORD,arguments:BODY,deliveryId:delivery(20)});
 await assert.rejects(out,code('UNKNOWN'));
 assert.equal(s.calls.length,1,'the canonical owner is reached with the bound request');
 assert.deepEqual(s.calls[0].request,artifactValidators.request({...BODY,operation:'create_word'}));
 assert.equal(s.calls[0].request.operation,'create_word');
 assert.equal(s.calls[0].deliveryId,delivery(20));
 assert.deepEqual(s.row().outcome,null,'a started owner is never settled as a no-effect refusal');
 assert.equal(s.row().state,'UNKNOWN');
});
test('a model-supplied operation that conflicts with the selected capability is still refused with no owner call',async()=>{
 const s=stub();
 await assert.rejects(s.mount.prepare({operation:WORD,arguments:{...BODY,operation:'create_excel'},deliveryId:delivery(21)}),code('INVALID_ARGUMENTS'));
 assert.equal(s.calls.length,0);
 assert.deepEqual(s.row().outcome,{code:'INVALID_ARGUMENTS'});
 assert.equal(s.row().state,'FAILED');
});
test('the canonical request that repeats the selected operation is unchanged, and unadmitted or foreign shapes still refuse before the owner',async()=>{
 const repeated=stub();await assert.rejects(repeated.mount.prepare({operation:WORD,arguments:{...BODY,operation:'create_word'},deliveryId:delivery(22)}),code('UNKNOWN'));
 assert.equal(repeated.calls.length,1);assert.deepEqual(repeated.calls[0].request,artifactValidators.request({...BODY,operation:'create_word'}));
 const blocks={blocks:[{kind:'paragraph',runs:[{text:'Hello'}]}]},docx={format:'docx',title:'Draft',content:blocks};
 const admitted=stub();await assert.rejects(admitted.mount.prepare({operation:WORD,arguments:docx,deliveryId:delivery(23)}),code('UNKNOWN'));
 assert.equal(admitted.calls.length,1);assert.equal(admitted.calls[0].request.format,'docx');
 const refused=stub();
 // `pdf` is a valid canonical WordRequest but is not an admitted document format: the retained refusal must survive.
 for(const [n,args] of [{...docx,format:'pdf'},{...BODY,context:{binding}},{...BODY,title:''},{}].entries())
  await assert.rejects(refused.mount.prepare({operation:WORD,arguments:args,deliveryId:delivery(30+n)}),code('INVALID_ARGUMENTS'));
 assert.equal(refused.calls.length,0);
});
test('a write-owner failure after the call is UNKNOWN and never re-prepared; a non-draft result is withheld as UNKNOWN',async()=>{
 let calls=0;const failing=createDocumentIntentPreparer({descriptor:descriptor('create_word'),binding,writes:{async execute(){calls++;throw Error('ARTIFACT_EFFECT_UNKNOWN');}}});
 const a=mount({binding,preparers:[failing],now:()=>NOW}).mount;
 await assert.rejects(a.prepare({operation:WORD,arguments:spec,deliveryId:delivery(3)}),code('UNKNOWN'));await assert.rejects(a.prepare({operation:WORD,arguments:spec,deliveryId:delivery(3)}),code('UNKNOWN'));assert.equal(calls,1);
 const garbage=createDocumentIntentPreparer({descriptor:descriptor('create_word'),binding,writes:{async execute(){return {version:{generationStatus:'final'}};}}});
 await assert.rejects(mount({binding,preparers:[garbage],now:()=>NOW}).mount.prepare({operation:WORD,arguments:spec,deliveryId:delivery(4)}),code('UNKNOWN'));
});
