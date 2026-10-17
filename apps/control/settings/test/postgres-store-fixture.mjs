/** SYNTHETIC ordered database responses with transaction staging only. No revision/CAS decision is implemented here. */
import assert from 'node:assert/strict';
const clone=structuredClone,auditSql=/^INSERT INTO meri_settings\.settings_audit\(/u;
/** Each borrowed connection consumes one script: {steps:[{match,rows?,inspect?,run?,error?}],connect?,commit?,loseCommitAck?}.
 * `inspect(params,sql)` asserts the actual SQL inputs; async hooks may coordinate races or cancellation. Scripts may be appended.
 * `committed` records only acknowledged-or-possibly-committed document/audit statements; rollback discards staged statements.
 * This fixture supplies SQL results; it does not prove PostgreSQL concurrency, durability or deployed schema. */
export function createSettingsPoolFixture(scripts=[]){
 const calls=[],released=[],committed=[];let connections=0;
 const pool={async connect(){
  const id=connections++,script=scripts[id];assert.ok(script,`unexpected client ${id}`);await script.connect?.();
  const steps=[...script.steps];let pending=[],begun=false;
  return {async query(sql,params=[]){
   calls.push({id,sql,params:clone(params)});
   if(sql==='BEGIN'||sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'){assert.equal(begun,false);begun=true;return {rows:[]};}
   if(sql==="SET LOCAL statement_timeout = '5s'"||sql==="SET LOCAL lock_timeout = '2s'"){assert.equal(begun,true);return {rows:[]};}
   if(sql==='ROLLBACK'){pending=[];return {rows:[]};}
   if(sql==='COMMIT'){
    assert.equal(steps.length,0,'all scripted operation statements were consumed');committed.push(...pending);pending=[];
    await script.commit?.();if(script.loseCommitAck)throw Error('synthetic private COMMIT acknowledgement loss');return {rows:[]};
   }
   const step=steps.shift();assert.ok(step,`unexpected SQL: ${sql}`);assert.match(sql,step.match);
   step.inspect?.(params,sql);await step.run?.();if(step.error)throw Error('synthetic private statement failure');
   const rows=clone(step.rows??[]);
   if(auditSql.test(sql))pending.push({id,kind:'audit',params:clone(params)});
   else if(/^(?:INSERT INTO|UPDATE) meri_settings\./u.test(sql)&&rows.length)pending.push({id,kind:'document',row:clone(rows[0])});
   return {rows,rowCount:rows.length};
  },release(error){released.push({id,error});}};
 },end(){assert.fail('the store must never close a borrowed pool');}};
 return {pool,scripts,calls,released,committed,connections:()=>connections};
}
