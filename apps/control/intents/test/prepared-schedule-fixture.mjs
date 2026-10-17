/** Scripted SQL boundary for the ACTUAL intent journal adapter and its prepared-schedule reader. No DB, driver or DDL.
 * This fixture implements the statements the adapter sends; canonical validation/custody behavior remains in production. */
import assert from 'node:assert/strict';

export function createPreparedSchedulePoolFixture(){
 const state={rows:new Map(),queries:[],releases:[],connects:0,ends:0,beforeConnect:null,onQuery:null,onRelease:null,selectRows:null,commitError:null,releaseError:null};
 const result=rows=>({rows,rowCount:rows.length}),rowKey=values=>JSON.stringify(values.slice(0,4));
 const pool={
  async connect(){
   state.connects++;await state.beforeConnect?.();let local,readOnly=false;
   return {
    async query(sql,params=[]){
     state.queries.push({sql,params:structuredClone(params)});await state.onQuery?.(sql,params);
     if(sql==='BEGIN'||sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'){local=structuredClone(state.rows);readOnly=sql!=='BEGIN';return result([]);}
     if(sql.startsWith('SET LOCAL'))return result([]);
     if(sql==='ROLLBACK')return result([]);
     if(sql==='COMMIT'){
      if(!readOnly)state.rows=local;
      if(state.commitError){const error=state.commitError;state.commitError=null;throw error;}return result([]);
     }
     assert.ok(local,'statement must run in a transaction');assert.ok(sql.includes('meri_intents.preparations'));assert.equal(sql.includes('public.'),false);
     if(sql.startsWith('INSERT INTO meri_intents.preparations')){
      assert.equal(readOnly,false);const key=rowKey(params);if(local.has(key))return result([]);
      const row={tenant_id:params[0],actor_id:params[1],conversation_id:params[2],delivery_id:params[3],record:JSON.parse(params[4]),record_sha256:params[5],state:'PENDING',outcome:null};
      local.set(key,row);return result([structuredClone(row)]);
     }
     if(sql.startsWith('UPDATE meri_intents.preparations')){
      assert.equal(readOnly,false);const row=local.get(rowKey(params));if(!row||row.record_sha256!==params[4]||row.state!=='PENDING')return result([]);
      row.state=params[5];row.outcome=params[6]===null?null:JSON.parse(params[6]);return result([structuredClone(row)]);
     }
     if(sql.startsWith('SELECT')&&sql.includes("outcome->'result'->'proposal'->>'proposalId'")){
      assert.equal(readOnly,true);assert.equal(params.length,2);
      if(state.selectRows!==null)return result(typeof state.selectRows==='function'?state.selectRows(sql,params):state.selectRows);
      return result(structuredClone([...local.values()].filter(row=>row.tenant_id===params[0]&&row.outcome?.result?.proposal?.proposalId===params[1]).slice(0,2)));
     }
     if(sql.startsWith('SELECT'))return result(structuredClone(local.has(rowKey(params))?[local.get(rowKey(params))]:[]));
     assert.fail('Unexpected intent journal SQL statement');
    },
    release(error){state.releases.push(error);state.onRelease?.();if(state.releaseError)throw state.releaseError;},
   };
  },
  async end(){state.ends++;},
 };
 return {pool,state};
}
