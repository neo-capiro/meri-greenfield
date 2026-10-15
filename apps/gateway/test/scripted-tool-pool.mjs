/** Scripted existing qualification-namespace tool-budget SQL protocol over a mutable synthetic `state`; never native
 * PostgreSQL acceptance. `clock()` refreshes `state.now` before each statement. Shared by the selected-skill and
 * general-read gateway fixtures. */
export function scriptedToolPool(state,clock){
  const liabilities=()=>[...state.reservations.values()].map(r=>({...r,consumed_micro_usd:r.charged_micro_usd??0}));
  let locked=Promise.resolve();
  return {async connect(){state.connections++;let releaseLock,backup,phase='read';return {
    async query(sql,p=[]){
      clock();state.commands.push({sql,p});let rows=[];
      if(sql.includes('budget WHERE id=1 FOR UPDATE')){
        const previous=locked;locked=new Promise(r=>releaseLock=r);await previous;
        backup=structuredClone({budget:state.budget,allocations:state.allocations,bindings:state.bindings,reservations:state.reservations,produced:state.produced});rows=[state.budget];
      }else if(sql==='SELECT clock_timestamp() AS now')rows=[{now:new Date(state.now)}];
      else if(sql==='COMMIT'){
        if(state.parkPhase===phase){state.entered?.();await state.gate;}
        state.afterCommit?.(phase);releaseLock?.();releaseLock=null;
        if(state.loseAck===phase){state.loseAck=null;throw Error('synthetic lost acknowledgement');}
      }else if(sql==='ROLLBACK'){if(backup)Object.assign(state,backup);releaseLock?.();releaseLock=null;}
      else if(sql.startsWith('SELECT * FROM meri_qualification.runs'))rows=[state.run];
      else if(sql.startsWith('SELECT * FROM meri_qualification.grants'))rows=[state.grant];
      else if(sql.startsWith('SELECT * FROM meri_qualification.tool_run_allocations'))rows=state.allocations.has(p[0])?[state.allocations.get(p[0])]:[];
      else if(sql.startsWith('INSERT INTO meri_qualification.tool_run_allocations'))state.allocations.set(p[0],{run_id:p[0],allocation_sha256:p[1],allocation:structuredClone(p[2]),max_tool_calls:p[3],max_cost_micro_usd:p[4],started_at:new Date(state.now)});
      else if(sql.startsWith('SELECT * FROM meri_qualification.tool_grant_bindings'))rows=state.bindings.has(p[0])?[state.bindings.get(p[0])]:[];
      else if(sql.startsWith('INSERT INTO meri_qualification.tool_grant_bindings'))state.bindings.set(p[0],{grant_id:p[0],run_id:p[1],facts:structuredClone(p[2])});
      else if(sql.startsWith('SELECT * FROM meri_qualification.tool_invocations'))rows=[...state.produced.values()].filter(r=>r.run_id===p[0]&&r.producer_key_sha256===p[1]);
      else if(sql.startsWith('INSERT INTO meri_qualification.tool_invocations')){phase='prepare';state.produced.set(p[0],{invocation_id:p[0],run_id:p[1],producer_key_sha256:p[2],delivery:structuredClone(p[3]),facts:structuredClone(p[4]),raw_request_sha256:p[5],operation:structuredClone(p[6]),deadline_ms:p[7],created_at:new Date(state.now),reservation_id:null,arguments_sha256:null,completion:null});}
      else if(sql.startsWith('UPDATE meri_qualification.tool_invocations SET reservation_id')){phase='claim';Object.assign(state.produced.get(p[0]),{reservation_id:p[1],arguments_sha256:p[2]});}
      else if(sql.startsWith('UPDATE meri_qualification.tool_invocations SET completion')){phase='marker';state.produced.get(p[0]).completion=structuredClone(p[1]);}
      else if(sql.startsWith('SELECT * FROM meri_qualification.tool_reservations'))rows=state.reservations.has(p[0])?[state.reservations.get(p[0])]:[];
      else if(sql.startsWith('INSERT INTO meri_qualification.tool_reservations'))state.reservations.set(p[0],{invocation_id:p[0],reservation_id:p[1],grant_id:p[2],run_id:p[3],facts:structuredClone(p[4]),operation:structuredClone(p[5]),arguments_sha256:p[6],hold_micro_usd:p[7],max_output_bytes:p[8],state:'UNKNOWN',created_at:new Date(state.now),charged_micro_usd:null,output_bytes:null,settled_at:null});
      else if(sql.startsWith('UPDATE meri_qualification.budget SET consumed_micro_usd')){phase='settle';state.budget.consumed_micro_usd+=Number(p[0]);}
      else if(sql.startsWith('UPDATE meri_qualification.tool_reservations SET'))Object.assign(state.reservations.get(p[0]),{state:'SETTLED',charged_micro_usd:state.reservations.get(p[0]).hold_micro_usd,output_bytes:p[1],settled_at:new Date(state.now)});
      else if(sql.startsWith('SELECT 1 FROM meri_qualification.budget_liabilities'))rows=liabilities().filter(r=>r.grant_id===p[0]&&r.state==='UNKNOWN');
      else if(sql.includes('AS run_total FROM meri_qualification.budget_liabilities'))rows=[{held:liabilities().filter(r=>r.state==='UNKNOWN').reduce((n,r)=>n+r.hold_micro_usd,0),run_total:liabilities().reduce((n,r)=>n+(r.state==='UNKNOWN'?r.hold_micro_usd:r.consumed_micro_usd),0)}];
      else if(sql.startsWith('SELECT count(*) AS calls'))rows=[{calls:state.reservations.size}];
      else if(sql!=='BEGIN'&&!sql.startsWith('SET LOCAL'))throw Error('unmodelled SQL');
      if(state.afterQuery)await state.afterQuery(sql);
      return {rows};
    },release(error){releaseLock?.();releaseLock=null;state.releases.push(error);}
  };}};
}
