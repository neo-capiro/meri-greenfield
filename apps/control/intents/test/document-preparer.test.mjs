/** SYNTHETIC-LOCAL: document preparer over the real artifact write owner (`createPostgresArtifactService`) with the
 * document application's synthetic-local fixture (scripted ledger, local store, real txt executor), plus stub write
 * ports for refusal paths. Not native Office, storage, KMS or database evidence. */
import test from 'node:test';import assert from 'node:assert/strict';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {createLocalDocumentFixture} from '../../document-application/local/fixture.mjs';
import {createPostgresArtifactService} from '../../../artifacts/postgres-service.mjs';
import {createDocumentIntentPreparer} from '../document-preparer.mjs';
import {mount,delivery,id,NOW} from './fixture.mjs';
const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const WORD={id:'create_word',version:'0.2.0'},spec={operation:'create_word',format:'txt',title:'Draft',content:{text:'Hello\n'}};
const code=c=>e=>e.code===c;
const descriptor=op=>{const e=catalog.operations.find(o=>o.operation.id===op);return {operation:e.operation,requiredGrants:e.requiredGrants,sourceRequirements:e.sourceRequirements};};
const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
async function real(t){
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python});t.after(()=>f.close());
 const writes={execute:(call,signal)=>createPostgresArtifactService(f.artifactOptions).execute(call,f.credential,signal)};
 const b=f.artifactOptions.context.binding;return {f,...mount({binding:b,preparers:[createDocumentIntentPreparer({descriptor:f.artifactOptions.descriptor,writes,binding:b})],now:f.now,scopes:f.artifactOptions.context.scopes})};
}
test('create_word prepares an immutable draft version once; the same delivery is the owner\'s own replay',async t=>{
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
test('only admitted document operations construct; PowerPoint and analysis stay unavailable',()=>{
 for(const op of ['create_powerpoint','run_analysis'])assert.throws(()=>createDocumentIntentPreparer({descriptor:descriptor(op),writes:{execute(){}},binding}),code('INTENT_CONFIGURATION'));
 assert.equal(createDocumentIntentPreparer({descriptor:descriptor('create_excel'),writes:{execute(){}},binding}).operation.id,'create_excel');
});
test('a write-owner failure after the call is UNKNOWN and never re-prepared; a non-draft result is withheld as UNKNOWN',async()=>{
 let calls=0;const failing=createDocumentIntentPreparer({descriptor:descriptor('create_word'),binding,writes:{async execute(){calls++;throw Error('ARTIFACT_EFFECT_UNKNOWN');}}});
 const a=mount({binding,preparers:[failing],now:()=>NOW}).mount;
 await assert.rejects(a.prepare({operation:WORD,arguments:spec,deliveryId:delivery(3)}),code('UNKNOWN'));await assert.rejects(a.prepare({operation:WORD,arguments:spec,deliveryId:delivery(3)}),code('UNKNOWN'));assert.equal(calls,1);
 const garbage=createDocumentIntentPreparer({descriptor:descriptor('create_word'),binding,writes:{async execute(){return {version:{generationStatus:'final'}};}}});
 await assert.rejects(mount({binding,preparers:[garbage],now:()=>NOW}).mount.prepare({operation:WORD,arguments:spec,deliveryId:delivery(4)}),code('UNKNOWN'));
});
