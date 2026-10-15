// Scripted PostgreSQL protocol fixture for the schedule owner's fixed SQL: synthetic rows only. One transaction at a time with
// snapshot rollback; no claim about PostgreSQL concurrency, locking, permissions or crash durability.
export function scheduleOwnerFixture() {
 const state={projections:new Map(),intents:new Map(),occurrences:new Map(),failNext:null};let tail=Promise.resolve();
 const pk=(t,id)=>`${t}:${id}`;
 const pool={async connect(){
  let release;const previous=tail;tail=new Promise(r=>release=r);await previous;let snapshot;
  return {async query(sql,p=[]){
   if(state.failNext&&sql.startsWith(state.failNext)){state.failNext=null;throw Error('synthetic store failure');}
   if(sql==='BEGIN'){snapshot=structuredClone({projections:state.projections,intents:state.intents,occurrences:state.occurrences});return {rows:[]};}
   if(sql==='ROLLBACK'){Object.assign(state,snapshot);return {rows:[]};}
   if(sql==='COMMIT'||sql.startsWith('SET LOCAL')||sql.startsWith('SELECT pg_advisory'))return {rows:[]};
   if(sql.startsWith('SELECT intent_id FROM meri_schedules.intents'))return {rows:state.intents.has(pk(p[0],p[1]))?[{intent_id:p[1]}]:[]};
   if(sql.startsWith('SELECT * FROM meri_schedules.projections')){const r=state.projections.get(pk(p[0],p[1]));return {rows:r?[structuredClone(r)]:[]};}
   if(sql.startsWith('INSERT INTO meri_schedules.projections')){state.projections.set(pk(p[0],p[1]),{tenant_id:p[0],schedule_id:p[1],temporal_schedule_id:p[2],owner_actor_id:p[3],generation:'0',projection:structuredClone(p[4]),projection_sha256:p[5],active_intent:p[6]});return {rows:[],rowCount:1};}
   if(sql.startsWith('UPDATE meri_schedules.projections SET active_intent=$3')){state.projections.get(pk(p[0],p[1])).active_intent=p[2];return {rows:[],rowCount:1};}
   if(sql.startsWith('UPDATE meri_schedules.projections SET generation=$4')){const r=state.projections.get(pk(p[0],p[1]));if(!r||r.active_intent!==p[2]||Number(r.generation)!==p[6])return {rows:[],rowCount:0};Object.assign(r,{generation:String(p[3]),projection:structuredClone(p[4]),projection_sha256:p[5],active_intent:null});return {rows:[],rowCount:1};}
   if(sql.startsWith('INSERT INTO meri_schedules.intents')){state.intents.set(pk(p[0],p[1]),{tenant_id:p[0],intent_id:p[1],schedule_id:p[2],intent_sha256:p[3],binding_sha256:p[4],intent:structuredClone(p[5]),state:'CLAIMED'});return {rows:[],rowCount:1};}
   if(sql.startsWith('SELECT * FROM meri_schedules.intents')||sql.startsWith('SELECT intent_id,intent,intent_sha256,state FROM meri_schedules.intents')){const r=state.intents.get(pk(p[0],p[1]));return {rows:r?[structuredClone(r)]:[]};}
   if(sql.startsWith("UPDATE meri_schedules.intents SET state='ACKNOWLEDGED'")){state.intents.get(pk(p[0],p[1])).state='ACKNOWLEDGED';return {rows:[],rowCount:1};}
   if(sql.startsWith('UPDATE meri_schedules.intents SET state=$3')){state.intents.get(pk(p[0],p[1])).state=p[2];return {rows:[],rowCount:1};}
   if(sql.startsWith('SELECT occurrence_key,schedule_id,occurrence,effect,effect_sha256,state FROM meri_schedules.occurrences WHERE tenant_id=$1 AND occurrence_key=$2')){const r=state.occurrences.get(pk(p[0],p[1]));return {rows:r?[structuredClone(r)]:[]};}
   if(sql.startsWith("SELECT occurrence_key,schedule_id,occurrence,effect,effect_sha256,state FROM meri_schedules.occurrences WHERE tenant_id=$1 AND schedule_id=$2 AND state='OPEN'"))return {rows:[...state.occurrences.values()].filter(o=>o.tenant_id===p[0]&&o.schedule_id===p[1]&&o.state==='OPEN').slice(0,1).map(o=>structuredClone(o))};
   if(sql.startsWith('INSERT INTO meri_schedules.occurrences')){
    if(!state.projections.has(pk(p[0],p[2]))||state.occurrences.has(pk(p[0],p[1]))||[...state.occurrences.values()].some(o=>o.tenant_id===p[0]&&o.schedule_id===p[2]&&o.state==='OPEN'))throw Error('synthetic constraint violation');
    state.occurrences.set(pk(p[0],p[1]),{tenant_id:p[0],occurrence_key:p[1],schedule_id:p[2],generation:String(p[3]),occurrence:structuredClone(p[4]),effect:structuredClone(p[5]),effect_sha256:p[6],state:'OPEN'});return {rows:[],rowCount:1};}
   if(sql.startsWith('UPDATE meri_schedules.occurrences SET state=$3')){state.occurrences.get(pk(p[0],p[1])).state=p[2];return {rows:[],rowCount:1};}
   if(sql.startsWith('SELECT p.projection,p.projection_sha256,p.generation,p.active_intent')){
    const r=state.projections.get(pk(p[0],p[1]));if(!r)return {rows:[]};
    const acknowledged=[...state.intents.values()].filter(i=>i.tenant_id===p[0]&&i.schedule_id===p[1]&&i.state==='ACKNOWLEDGED'&&i.intent.generation===Number(r.generation));
    const base={projection:structuredClone(r.projection),projection_sha256:r.projection_sha256,generation:r.generation,active_intent:r.active_intent};
    return {rows:acknowledged.length?acknowledged.map(i=>({...base,intent_id:i.intent_id,intent:structuredClone(i.intent),intent_sha256:i.intent_sha256,state:i.state})):[{...base,intent_id:null,intent:null,intent_sha256:null,state:null}]};
   }
   throw Error(`unscripted SQL: ${sql.slice(0,80)}`);
  },release(){release();}};
 }};
 return {pool,state};
}
