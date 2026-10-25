/** Actual Objective selection codec -> conversation inventory -> existing purge row owner.
 * Database triggers, role grants and transaction exclusion are qualified separately. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {runStartFixture,NOW} from '../../../runtime/objective-source/test/run-start-fixture.mjs';
import {objectiveRunStartColumns} from '../../../runtime/objective-source/run-starts.mjs';
import {createPostgresObjectiveRunStartStore} from '../../../runtime/objective-source/postgres-run-starts.mjs';
import {syntheticObjectivePool} from '../../../runtime/objective-source/test/run-start-fixture.mjs';
import {versions} from './store-fixture.mjs';
import {contentRows} from './retention-content-fixture.mjs';
import {hash} from '../boundary.mjs';
import {decodeConversationInventoryRows} from '../retention-inventory-decode.mjs';
import {enumerateReferences} from '../../retention/inventory.mjs';
import {conversationPurgeRow,tombstone} from '../../retention/conversation-purge-rows.mjs';

function fixture({accepted=false}={}){
 const f=runStartFixture(),b=f.binding,createdAt=new Date(NOW).toISOString(),policyRevision='policy1';
 const scopes=[{tenantId:b.tenantId,kind:'client',resourceId:f.clientId,policyRevision}];
 const conversation={conversationId:b.conversationId,owner:{tenantId:b.tenantId,actorId:b.actorId},scopes,policyRevision,createdAt};
 const tuple={tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId};
 const run={binding:b,state:'failed',scopes,policyRevision,versions,createdAt};
 const event={contractVersion:'0.1.0',eventId:f.eventId,binding:b,sequence:1,createdAt,scopes,type:'run.status',data:{state:'failed',reasonCode:'SYNTHETIC'}};
 const row={...objectiveRunStartColumns(f.record,{tenantId:f.tenantId}),created_at:new Date(NOW)};
 const raw={subject:{tenantId:b.tenantId,kind:'conversation',subjectId:b.conversationId,ownerActorId:b.actorId},
  conversation:{tenant_id:b.tenantId,conversation_id:b.conversationId,owner_actor_id:b.actorId,projection:conversation,projection_sha256:hash(conversation)},
  runs:accepted?[{...tuple,projection:run,projection_sha256:hash(run),request_id:f.acceptedRequest.requestId,request:f.acceptedRequest,request_sha256:hash(f.acceptedRequest),last_sequence:1,sequence_base:0,sequence_end:null}]:[],
  events:accepted?[{...tuple,sequence:1,event_id:event.eventId,event,event_sha256:hash(event)}]:[],
  controls:[],checkpoints:[],completionCheckpoints:[],nextRuns:[],memoryContinuations:[],memoryContextRows:[],memoryCandidates:[],contentRows:contentRows()};
 raw.contentRows['meri_objective_source.run_starts']=[row];
 return {...f,raw,row,decode:()=>decodeConversationInventoryRows(raw)};
}

for(const accepted of [false,true])test(`Objective ${accepted?'accepted run':'registered pre-admission'} prompt is inventoried without releasing content; erasure retains consumed identities`,()=>{
 const f=fixture({accepted}),decoded=f.decode(),inventory=enumerateReferences(decoded);
 assert.equal(decoded.runs.length,accepted?1:0);
 const target=inventory.rowTargets.find(t=>t.table==='meri_objective_source.run_starts');assert.ok(target);
 assert.equal(JSON.stringify(inventory).includes(f.selection.executionContext.prompt),false);
 const owner=conversationPurgeRow(f.raw.subject,{className:'conversation',target});owner.verify(f.row);
 assert.equal(owner.mode,'objective');assert.equal(owner.erased(f.row),false);
 assert.match(owner.sql,/UPDATE meri_objective_source\.run_starts r SET record=\$4::jsonb/);
 assert.doesNotMatch(owner.sql,/record_sha256=|binding=|generation_job_id=\$LAST|DELETE/);
 assert.deepEqual(owner.args(),[f.tenantId,f.binding.conversationId,f.generationJobId]);
 assert.equal(owner.erased({...f.row,record:tombstone(f.binding.conversationId)}),true);
 assert.equal(owner.erased({...f.row,record:tombstone(f.eventId)}),false);
 assert.throws(()=>owner.verify({...f.row,record:{...f.record,effectExpiresAtMs:1}}),/RETENTION_ROW_CHANGED/);
});

for(const change of ['digest','tenant','actor','binding','client','request','missing-parent'])test(`Objective inventory refuses ${change} mismatch`,()=>{
 const f=fixture({accepted:true}),row=f.row;
 if(change==='digest')row.record_sha256='0'.repeat(64);
 if(change==='tenant')row.tenant_id='foreign';
 if(change==='actor')f.raw.subject.ownerActorId='foreign';
 if(change==='binding')row.binding={...row.binding,attemptId:f.eventId};
 if(change==='client'){const p=f.raw.conversation.projection;p.scopes[0].resourceId=f.eventId;f.raw.conversation.projection_sha256=hash(p);}
 if(change==='request'){const r=f.raw.runs[0];r.request={...r.request,prompt:'Changed'};r.request_sha256=hash(r.request);}
 if(change==='missing-parent')f.raw.conversation=null;
 assert.throws(f.decode);
});

test('erased immutable run start is neither ordinary absence nor permission to recreate the job',async()=>{
 const f=fixture(),p=syntheticObjectivePool(),store=createPostgresObjectiveRunStartStore({enabled:true,pool:p.pool,now:()=>NOW});
 await store.putOnce({record:f.record});const row=p.state.runStarts.get(f.generationJobId),before=structuredClone(row);
 row.record=tombstone(f.binding.conversationId);
 for(const call of [()=>store.read({binding:f.binding}),()=>store.readByJob({generationJobId:f.generationJobId}),()=>store.putOnce({record:f.record})])await assert.rejects(call);
 assert.equal(p.state.runStarts.size,1);assert.deepEqual({...p.state.runStarts.get(f.generationJobId),record:before.record},before);
 assert.equal(p.state.trace.filter(q=>q.text.startsWith('INSERT INTO meri_objective_source.run_starts')).length,1);
});
