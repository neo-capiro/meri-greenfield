import {snapshotOperationData} from './operation-contracts.mjs';
const fail=()=>{throw Error('GRAPH_PATHS_INVALID');};
const unique=rows=>new Set(rows).size===rows.length;
export function createGraphPathsValidators({validateShape}){
 function normalizeInput(request,context={}){
  const input=snapshotOperationData(request),options=snapshotOperationData(context);
  if(!options||Object.keys(options).length)fail();validateShape('GraphPathsInput',input);
  if(input.to.trim()!==input.to)fail();
  return {input:{...input,depth:input.depth??3,...(input.clientId?{clientId:input.clientId.toLowerCase()}:{})}};
 }
 function assertOutput(value,request){
  const {input}=normalizeInput(request),out=snapshotOperationData(value);validateShape('GraphPathsOutput',out);
  if(out.target!==input.to||out.clientId!==(input.clientId??null)||out.coverage.maxDepth!==input.depth||
   out.coverage.state!==(out.coverage.reasons.length?'partial':'complete')||!unique(out.coverage.reasons)||
   out.paths.length>out.coverage.clientsSearched||input.clientId&&out.coverage.clientsSearched!==1)fail();
  if(out.coverage.reasons.includes('path_limit')&&(out.paths.length!==20||out.coverage.clientsSearched<21))fail();
  const roots=[];
  for(const path of out.paths){
   if(path.edges.length!==path.nodes.length-1||path.edges.length>input.depth||!unique(path.nodes.map(node=>node.id)))fail();
   const first=path.nodes[0];if(first.type!=='client'||!first.id.startsWith('client:')||path.nodes.at(-1).id!==input.to)fail();roots.push(first.id);
   for(const node of path.nodes){if(!node.id.startsWith(node.type+':')||input.clientId&&node.type==='client'&&node.id!=='client:'+input.clientId)fail();}
   for(let i=0;i<path.edges.length;i++){
    const edge=path.edges[i],a=path.nodes[i].id,b=path.nodes[i+1].id;
    if(!(edge.src===a&&edge.dst===b||edge.src===b&&edge.dst===a)||!unique(edge.sources.map(source=>JSON.stringify(source))))fail();
    const kind=edge.basis==='thematic'?'memory_item':edge.basis==='derived'?'kg_cache_projection':null;
    if(edge.origin!==(edge.basis==='thematic'?'mention':'fk')||kind&&edge.sources.some(source=>source.kind!==kind))fail();
    if(edge.basis==='direct')for(const source of edge.sources){
     if(source.kind==='client_person'){
      if(edge.relation!=='contact'||!edge.src.startsWith('client:')||edge.dst!=='person:'+source.id)fail();
     }else if(source.kind==='tracked_bill_relationship'){
      let ref;try{ref=JSON.parse(source.id);}catch{fail();}
      if(!Array.isArray(ref)||ref.length!==2||edge.relation!=='tracks'||edge.src!=='client:'+ref[0]||edge.dst!=='bill:'+ref[1])fail();
     }else fail();
    }
   }
   const basis=path.edges.some(edge=>edge.basis==='thematic')?'thematic':path.edges.some(edge=>edge.basis==='derived')?'derived':'direct';
   if(path.basis!==basis)fail();
  }
  if(!unique(roots))fail();
  const summary=out.paths.length?`${out.paths.length} source-linked route(s) within ${input.depth} hops in the authorized current graph projection.`:
   `No route was returned within ${input.depth} hops in the authorized current graph projection. This does not establish that a target is absent.`;
  if(out.summary!==summary)fail();return value;
 }
 return Object.freeze({normalizeInput,assertOutput});
}
