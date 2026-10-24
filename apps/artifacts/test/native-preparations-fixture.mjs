/** Scripted existing intent-preparation SQL only, for isolated source fixtures. */
import assert from 'node:assert/strict';
export function nativePreparationsFixture(){
 const state={rows:new Map(),commands:[],releases:[],loseCommit:null};let tail=Promise.resolve();
 const pool={async connect(){let local,unlock,mutation=null;return {async query(sql,p=[]){
  state.commands.push({sql,p:structuredClone(p)});const rows=x=>({rows:structuredClone(x),rowCount:x.length});
  if(sql==='BEGIN'||sql.startsWith('SET LOCAL'))return rows([]);
  if(sql==='COMMIT'){if(local)state.rows=local;if(state.loseCommit===mutation&&mutation!==null){state.loseCommit=null;throw Error('LOST_INTENT_COMMIT_ACK');}return rows([]);}
  if(sql==='ROLLBACK')return rows([]);
  assert.ok(sql.includes('meri_intents.preparations'),'only the existing intent table');
  if(!local){const prior=tail;tail=new Promise(r=>unlock=r);await prior;local=structuredClone(state.rows);}
  const key=JSON.stringify(p.slice(0,4));
  if(sql.startsWith('INSERT')){if(local.has(key))return rows([]);mutation='claim';const row={record:JSON.parse(p[4]),record_sha256:p[5],state:'PENDING',outcome:null};local.set(key,row);return rows([row]);}
  if(sql.startsWith('SELECT'))return rows(local.has(key)?[local.get(key)]:[]);
  if(sql.startsWith('UPDATE')){const row=local.get(key);if(!row||row.state!=='PENDING'||row.record_sha256!==p[4])return rows([]);mutation='settle';row.state=p[5];row.outcome=p[6]===null?null:JSON.parse(p[6]);return rows([row]);}
  assert.fail('Unexpected SQL');
 },release(error){state.releases.push(error);unlock?.();}};}};
 return {pool,state};
}
