/** SYNTHETIC pg-compatible pool answering exactly the statements `postgres-journal.mjs` issues against `meri_memory.candidates`
 * (witnessed by `migration-source.test.mjs`), over in-memory rows. Not PostgreSQL: no constraints beyond the journal's own keys. */
const COLUMNS=['candidate','candidate_sha256','request_sha256','submission_state','review_id'];
export function createMemoryPoolFixture(){
 const rows=[],statements=[];
 const project=row=>Object.fromEntries(COLUMNS.map(c=>[c,row[c]]));
 const byKey=(tenantId,proposer,key)=>rows.find(r=>r.tenant_id===tenantId&&r.proposer_actor_id===proposer&&r.idempotency_key===key);
 async function query(text,params=[]){
  const sql=text.replace(/\s+/gu,' ').trim();statements.push(sql);
  if(/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL)/u.test(sql))return {rows:[],rowCount:0};
  if(sql.startsWith('INSERT INTO meri_memory.candidates')){
   const [tenant_id,candidate_id,proposer_actor_id,idempotency_key,request_sha256,candidate,candidate_sha256,scope,client_id,created_at]=params;
   if(byKey(tenant_id,proposer_actor_id,idempotency_key)||rows.some(r=>r.tenant_id===tenant_id&&r.candidate_id===candidate_id))return {rows:[],rowCount:0};
   const row={tenant_id,candidate_id,proposer_actor_id,idempotency_key,request_sha256,candidate:JSON.parse(candidate),candidate_sha256,scope,client_id,created_at,submission_state:'PREPARED',review_id:null};
   rows.push(row);return {rows:[project(row)],rowCount:1};
  }
  if(sql.startsWith('UPDATE meri_memory.candidates SET submission_state=\'SUBMITTED\'')){
   const [tenant_id,candidate_id,candidate_sha256,review_id]=params;
   const row=rows.find(r=>r.tenant_id===tenant_id&&r.candidate_id===candidate_id&&r.candidate_sha256===candidate_sha256&&(['PREPARED','SUBMISSION_UNKNOWN'].includes(r.submission_state)||r.submission_state==='SUBMITTED'&&r.review_id===review_id));
   if(!row)return {rows:[],rowCount:0};row.submission_state='SUBMITTED';row.review_id=review_id;return {rows:[],rowCount:1};
  }
  if(sql.startsWith('UPDATE meri_memory.candidates SET submission_state=\'SUBMISSION_UNKNOWN\'')){
   const [tenant_id,candidate_id]=params,row=rows.find(r=>r.tenant_id===tenant_id&&r.candidate_id===candidate_id&&r.submission_state==='PREPARED');
   if(row)row.submission_state='SUBMISSION_UNKNOWN';return {rows:[],rowCount:row?1:0};
  }
  if(sql.includes('ORDER BY created_at DESC, candidate_id DESC LIMIT $7')){
   const [tenant_id,proposer,clientIds,clientId,cursorAt,cursorId,limit]=params;
   const out=rows.filter(r=>r.tenant_id===tenant_id&&r.proposer_actor_id===proposer&&(r.scope!=='client'||clientIds.includes(r.client_id))&&(clientId===null||r.client_id===clientId)&&
    (cursorAt===null||r.created_at<cursorAt||r.created_at===cursorAt&&r.candidate_id<cursorId))
    .sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.candidate_id.localeCompare(a.candidate_id)).slice(0,limit);
   return {rows:out.map(project),rowCount:out.length};
  }
  if(sql.includes('AND idempotency_key=$3')){const row=byKey(params[0],params[1],params[2]);return {rows:row?[project(row)]:[],rowCount:row?1:0};}
  if(sql.includes('AND candidate_id=$3')){const row=rows.find(r=>r.tenant_id===params[0]&&r.proposer_actor_id===params[1]&&r.candidate_id===params[2]);return {rows:row?[project(row)]:[],rowCount:row?1:0};}
  throw Error('unexpected statement: '+sql);
 }
 return {rows,statements,pool:{async connect(){return {query,release(){}};}}};
}
