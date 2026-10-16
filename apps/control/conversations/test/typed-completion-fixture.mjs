// Scripted transactional SQL, not PostgreSQL/isolation qualification. Real completion-journal executes every transition.
import {createCompletionJournal} from '../completion-journal.mjs';
import {hash} from '../../../../packages/runtime/objective-generation-custody.mjs';
import {encodedFixture,proofFixture,clone} from '../../../worker/conversation/objective-generation/test/fixtures.mjs';
export function typedCompletionFixture(){
 const f=encodedFixture();let state={run:{projection:{binding:f.binding,scopes:f.scopes,versions:f.versions,state:'running',policyRevision:f.scopes[0].policyRevision},request:f.acceptedRequest,request_sha256:hash(f.acceptedRequest),last_sequence:3,hold_control_id:null,sequence_end:null},completion:null,events:[],queries:[]},tail=Promise.resolve(),commitUnknown=false;
 const rows=rows=>({rows});
 const client={async query(sql,p){state.queries.push(sql);
  if(sql.startsWith('SELECT * FROM meri_conversations.runs'))return rows([clone(state.run)]);
  if(sql.startsWith('SELECT * FROM meri_conversations.completion_checkpoints'))return rows(state.completion?[clone(state.completion)]:[]);
  if(sql.startsWith('INSERT INTO meri_conversations.completion_checkpoints')){state.completion={tenant_id:p[0],conversation_id:p[1],run_id:p[2],completion_id:p[3],checkpoint_id:p[4],identity:clone(p[5]),identity_sha256:p[6],state:p[7],proof:null,proof_sha256:null};return rows([]);}
  if(sql.startsWith('UPDATE meri_conversations.runs SET hold_completion_id')){state.run.hold_completion_id=p[3];return rows([]);}
  if(sql.startsWith('UPDATE meri_conversations.runs SET projection')){state.run.projection=clone(p[3]);state.run.projection_sha256=p[4];state.run.last_sequence=p[5];return rows([]);}
  if(sql.startsWith('INSERT INTO meri_conversations.events')){state.events.push(clone(p[5]));return rows([]);}
  if(sql.includes("SET state='PUBLISHED'")){Object.assign(state.completion,{state:'PUBLISHED',proof:clone(p[3]),proof_sha256:p[4]});return rows([]);}
  if(sql.includes("SET state='UNKNOWN'")){state.completion.state='UNKNOWN';return rows([]);}
  throw Error('UNRECOGNIZED_SCRIPTED_SQL');
 }};
 async function tx(_binding,check,fn){const before=tail;let release;tail=new Promise(r=>release=r);await before;const snapshot=clone(state);let committed=false;try{check();const result=await fn(client);check();committed=true;if(commitUnknown)throw Error('SYNTHETIC_COMMIT_UNKNOWN');return result;}catch(error){if(!committed)state=snapshot;throw error;}finally{release();}}
 const journal=createCompletionJournal({tx,rowRun:r=>r}),selection=f.codec.selection(f.selection),key={binding:f.binding,scopes:f.scopes,selectedClientId:f.scopes[0].resourceId},identity={...key,completionId:f.ref,checkpointId:proofFixture(f).checkpoint.checkpointId,typedResult:f.descriptor,typedSelection:selection},check=()=>{};
 const events=p=>[{contractVersion:'0.1.0',eventId:p.verifiedEventId,createdAt:new Date().toISOString(),type:'checkpoint.verified',data:{checkpointId:p.checkpointId}},{contractVersion:'0.1.0',eventId:p.completedEventId,createdAt:new Date().toISOString(),type:'run.status',data:{state:'completed',reasonCode:null}}];
 const read=async()=>({run:clone(state.run.projection),request:clone(state.run.request)});
 return {...f,key,identity,journal,check,events,read,proof:()=>proofFixture(f),get state(){return state;},commitUnknown:v=>{commitUnknown=v;}};
}
