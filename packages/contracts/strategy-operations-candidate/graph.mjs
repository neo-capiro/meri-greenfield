/** Whole-graph checks; no truncation, edge filtering or ID allocation. */
const fail=()=>{throw Error('STRATEGY_CANDIDATE_GRAPH');};
export function graph(nodes,idOf,edgesOf){
 const ids=new Set(nodes.map(idOf));if(ids.size!==nodes.length||nodes.length>60)fail();
 for(const n of nodes){if(n.startsOn!==null&&n.endsOn!==null&&n.endsOn<n.startsOn)fail();for(const dep of edgesOf(n))if(dep===idOf(n)||!ids.has(dep))fail();}
 const visiting=new Set(),done=new Set(),rows=new Map(nodes.map(n=>[idOf(n),n]));
 function visit(id){if(visiting.has(id))fail();if(done.has(id))return;visiting.add(id);for(const d of edgesOf(rows.get(id)))visit(d);visiting.delete(id);done.add(id);}
 for(const id of ids)visit(id);
}
export function validateDraftGraph(payload){graph(payload.nodes,n=>n.sourceNodeKey,n=>n.dependsOn);}
export function validateEditGraph(payload,basis,fields){
 const rows=new Map(basis.nodes.map(n=>['existing:'+n.nodeId,{...structuredClone(n),nodeId:'existing:'+n.nodeId,dependsOn:n.dependsOn.map(id=>'existing:'+id)}])),targets=new Set(),added=new Set();
 for(const e of payload.edits){
  const keys=Object.keys(e.changes),changes={...e.changes,...(e.changes.dependsOn?{dependsOn:e.changes.dependsOn.map(d=>d.kind==='existing'?'existing:'+d.nodeId:'new:'+d.sourceNodeKey)}:{})};
  if(e.op==='add'){
   if(e.nodeId!==null||e.sourceNodeKey===null||added.has(e.sourceNodeKey)||fields.some(k=>!keys.includes(k)))fail();
   added.add(e.sourceNodeKey);rows.set('new:'+e.sourceNodeKey,{nodeId:'new:'+e.sourceNodeKey,...changes});continue;
  }
  const target='existing:'+e.nodeId;
  if(e.nodeId===null||e.sourceNodeKey!==null||!rows.has(target)||targets.has(target))fail();targets.add(target);
  if(e.op==='remove'){if(keys.length)fail();rows.delete(target);continue;}
  if(!keys.length||e.op==='retime'&&keys.some(k=>!['startsOn','endsOn','openEnded'].includes(k)))fail();
  rows.set(target,{...rows.get(target),...changes});
 }
 graph([...rows.values()],n=>n.nodeId,n=>n.dependsOn);
}
export function draftDependencyIndices(payload){
 validateDraftGraph(payload);const indices=new Map(payload.nodes.map((n,i)=>[n.sourceNodeKey,i]));
 return payload.nodes.map(n=>n.dependsOn.map(k=>indices.get(k)));
}
