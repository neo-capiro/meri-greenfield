// Scripted PostgreSQL protocol fixture: synthetic rows only, no native/server claim.
export function storeFixture(){const state={conversations:new Map(),runs:new Map(),events:new Map(),calls:[],commitUnknown:false,controls:new Map(),checkpoints:new Map(),controlSequence:0};let tail=Promise.resolve();const key=p=>p.slice(0,3).join(':');
 const pool={async connect(){let releaseLock;const previous=tail;tail=new Promise(r=>releaseLock=r);await previous;let snapshot;return {async query(sql,p=[]){state.calls.push(sql);if(sql==='BEGIN'){snapshot=structuredClone({conversations:state.conversations,runs:state.runs,events:state.events,controls:state.controls,checkpoints:state.checkpoints,controlSequence:state.controlSequence});return {rows:[]};}if(sql==='ROLLBACK'){Object.assign(state,snapshot);return {rows:[]};}if(sql==='COMMIT'){if(state.commitUnknown)throw Error('ack lost');return {rows:[]};}if(sql.startsWith('SET ')||sql.startsWith('SELECT pg_advisory'))return {rows:[]};let rows=[];
  if(sql.startsWith('SELECT * FROM meri_conversations.conversations')){const row=state.conversations.get(p.slice(0,2).join(':'));rows=row?[row]:[];}
  else if(sql.startsWith('INSERT INTO meri_conversations.conversations'))state.conversations.set(p.slice(0,2).join(':'),{tenant_id:p[0],conversation_id:p[1],owner_actor_id:p[2],projection:structuredClone(p[3]),projection_sha256:p[4]});
  else if(sql.startsWith('SELECT * FROM meri_conversations.runs'))rows=[...state.runs.values()].filter(r=>r.tenant_id===p[0]&&r.conversation_id===p[1]&&(sql.includes('request_id=$3')?(r.request_id===p[2]||r.run_id===p[3]):r.run_id===p[2]));
  else if(sql.startsWith('SELECT * FROM meri_conversations.controls'))rows=[...state.controls.values()].filter(r=>r.tenant_id===p[0]&&(sql.includes('control_id=$2')?r.control_id===p[1]:r.conversation_id===p[1]&&r.run_id===p[2]&&r.control_sequence>p[3])).slice(0,100);
  else if(sql.startsWith('INSERT INTO meri_conversations.controls')){const row={tenant_id:p[0],control_id:p[1],conversation_id:p[2],run_id:p[3],control_sequence:++state.controlSequence,projection:structuredClone(p[4]),projection_sha256:p[5]};state.controls.set(p.slice(0,2).join(':'),row);rows=[row];}
  else if(sql.startsWith('UPDATE meri_conversations.controls')){const row=state.controls.get(p.slice(0,2).join(':'));row.projection=structuredClone(p[2]);row.projection_sha256=p[3];}
  else if(sql.startsWith('INSERT INTO meri_conversations.checkpoints'))state.checkpoints.set(p.slice(0,2).join(':'),{tenant_id:p[0],checkpoint_id:p[1],conversation_id:p[2],run_id:p[3],control_id:p[4],proof:structuredClone(p[5]),proof_sha256:p[6]});
  else if(sql.startsWith('SELECT * FROM meri_conversations.checkpoints')){const row=state.checkpoints.get(p.slice(0,2).join(':'));rows=row?[row]:[];}
  else if(sql.startsWith('UPDATE meri_conversations.runs SET hold_control_id'))state.runs.get(key(p)).hold_control_id=p[3];
  else if(sql.startsWith('INSERT INTO meri_conversations.runs'))state.runs.set(key(p),{tenant_id:p[0],conversation_id:p[1],run_id:p[2],projection:structuredClone(p[3]),projection_sha256:p[4],request_id:p[5],request:structuredClone(p[6]),request_sha256:p[7],last_sequence:1,...(p.length>8?{continuation:structuredClone(p[8]),continuation_sha256:p[9]}:{})});
  else if(sql.startsWith('INSERT INTO meri_conversations.events')){const rows=state.events.get(key(p))??[];rows.push({sequence:p[3],event_id:p[4],event:structuredClone(p[5]),event_sha256:p[6]});state.events.set(key(p),rows);}
  else if(sql.startsWith('SELECT * FROM meri_conversations.events'))rows=(state.events.get(key(p))??[]).filter(e=>sql.includes('event_id=$4')?e.event_id===p[3]:e.sequence>p[3]).slice(0,sql.includes('event_id=$4')?1:p[4]);
  else if(sql.startsWith('UPDATE meri_conversations.runs')){const row=state.runs.get(key(p));row.projection=structuredClone(p[3]);row.projection_sha256=p[4];row.last_sequence=p[5];}
  else throw Error(`Unexpected SQL: ${sql}`);return {rows:structuredClone(rows),rowCount:rows.length};},release(){releaseLock();}};}};
 return {pool,state};
}
export const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`;
export const binding={tenantId:'tenant-a',actorId:'actor-a',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
export const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:id(5),policyRevision:'policy1'}];
export const versions={imageDigest:`sha256:${'a'.repeat(64)}`,sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
