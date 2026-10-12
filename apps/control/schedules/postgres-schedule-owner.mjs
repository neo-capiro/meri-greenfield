import {canonicalSha256, frozenScheduleData, denySchedule,scheduleErrorCode} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';

// Borrow a pg 8.23.1-compatible pool configured by its owner with finite
// connectionTimeoutMillis/query_timeout. Source cancellation is not wire cancellation.
export function createPostgresScheduleOwner({pool}) {
  if(!pool||typeof pool.connect!=='function')denySchedule('SCHEDULE_POOL');
  async function transaction(body,check) {
    let client,begun=false,committing=false,reusable=false,result,failure;
    try {
      check();client=await pool.connect();check();await client.query('BEGIN');begun=true;check();
      await client.query("SET LOCAL statement_timeout = '5s'");check();
      await client.query("SET LOCAL lock_timeout = '2s'");check();
      result=await body(client);check();committing=true;await client.query('COMMIT');reusable=true;check();
    } catch(error) {
      failure=Object.assign(new Error(committing?'SCHEDULE_COMMIT_UNKNOWN':'SCHEDULE_STORE_UNAVAILABLE'),{code:committing?'SCHEDULE_COMMIT_UNKNOWN':scheduleErrorCode(error)??'SCHEDULE_STORE_UNAVAILABLE'});
      if(begun&&!committing)try{await client.query('ROLLBACK');reusable=true;}catch{}
    } finally {
      if(client)try{client.release(reusable?undefined:failure);}catch{failure??=Object.assign(new Error('SCHEDULE_RELEASE_UNKNOWN'),{code:'SCHEDULE_RELEASE_UNKNOWN'});}
    }
    if(failure)throw failure;return result;
  }
  async function claim(binding,check) {
    const b=frozenScheduleData(binding),i=b.intent,p=i.projection,t=p.owner.tenantId;
    return transaction(async c=>{
      // Transaction advisory lock also serializes concurrent creation of a missing row.
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${t}:${p.scheduleId}`]);check();
      if((await c.query('SELECT intent_id FROM meri_schedules.intents WHERE tenant_id=$1 AND intent_id=$2',[t,i.intentId])).rows.length)denySchedule('SCHEDULE_REPLAY');check();
      const old=(await c.query('SELECT * FROM meri_schedules.projections WHERE tenant_id=$1 AND schedule_id=$2 FOR UPDATE',[t,p.scheduleId])).rows[0];check();
      if(i.operation==='schedule_task') {
        if(old)denySchedule('SCHEDULE_EXISTS');
        await c.query('INSERT INTO meri_schedules.projections(tenant_id,schedule_id,temporal_schedule_id,owner_actor_id,generation,projection,projection_sha256,active_intent) VALUES($1,$2,$3,$4,0,$5,$6,$7)',[t,p.scheduleId,p.temporalScheduleId,p.owner.actorId,p,canonicalSha256(p),i.intentId]);check();
      } else {
        if(!old||old.active_intent!==null||Number(old.generation)!==i.expectedGeneration||old.projection_sha256!==i.previousProjectionSha256||old.temporal_schedule_id!==p.temporalScheduleId||old.owner_actor_id!==p.owner.actorId||old.projection.createdAt!==p.createdAt)denySchedule('SCHEDULE_STALE');
        await c.query('UPDATE meri_schedules.projections SET active_intent=$3 WHERE tenant_id=$1 AND schedule_id=$2',[t,p.scheduleId,i.intentId]);check();
      }
      await c.query("INSERT INTO meri_schedules.intents(tenant_id,intent_id,schedule_id,intent_sha256,binding_sha256,intent,state) VALUES($1,$2,$3,$4,$5,$6,'CLAIMED')",[t,i.intentId,p.scheduleId,canonicalSha256(i),b.bindingSha256,i]);check();
      return {intentId:i.intentId,bindingSha256:b.bindingSha256,state:'CLAIMED'};
    },check);
  }
  async function transition(binding,state,check) {
    const b=frozenScheduleData(binding),i=b.intent,p=i.projection,t=p.owner.tenantId;
    return transaction(async c=>{
      const row=(await c.query('SELECT * FROM meri_schedules.intents WHERE tenant_id=$1 AND intent_id=$2 FOR UPDATE',[t,i.intentId])).rows[0];check();
      if(!row||row.binding_sha256!==b.bindingSha256||row.intent_sha256!==canonicalSha256(i)||!(state==='DISPATCHING'?['CLAIMED']:['DISPATCHING']).includes(row.state))denySchedule('SCHEDULE_TRANSITION');
      await c.query('UPDATE meri_schedules.intents SET state=$3,updated_at=clock_timestamp() WHERE tenant_id=$1 AND intent_id=$2',[t,i.intentId,state]);check();
      if(state==='ACKNOWLEDGED') {
        const changed=await c.query('UPDATE meri_schedules.projections SET generation=$4,projection=$5,projection_sha256=$6,active_intent=NULL WHERE tenant_id=$1 AND schedule_id=$2 AND active_intent=$3 AND generation=$7',[t,p.scheduleId,i.intentId,i.generation,p,canonicalSha256(p),i.expectedGeneration]);check();
        if(changed.rowCount!==1)denySchedule('SCHEDULE_STALE');
      }
      return {intentId:i.intentId,bindingSha256:b.bindingSha256,state};
    },check);
  }
  async function list(selection,check) {
    const s=frozenScheduleData(selection);
    return transaction(async c=>{
      const rows=(await c.query('SELECT projection,generation,active_intent FROM meri_schedules.projections WHERE tenant_id=$1 AND owner_actor_id=$2 AND ($3::uuid IS NULL OR schedule_id>$3::uuid) ORDER BY schedule_id LIMIT $4',[s.owner.tenantId,s.owner.actorId,s.afterScheduleId,s.limit+1])).rows;check();
      return frozenScheduleData({rows:rows.slice(0,s.limit).map(r=>({projection:r.projection,generation:Number(r.generation),unresolved:r.active_intent!==null})),hasMore:rows.length>s.limit});
    },check);
  }
  return Object.freeze({claim,markDispatching:(b,c)=>transition(b,'DISPATCHING',c),commitKnown:(b,c)=>transition(b,'ACKNOWLEDGED',c),markUnknown:(b,c)=>transition(b,'UNKNOWN',c),list});
}
