/** Location-preserving edits on declared nested text scopes. Never guesses a new
 * descendant after its source range was consumed by an ancestor operation. */
const fault=(code,operationId)=>{throw Object.assign(Error(code),{code,operationId});};
export function scopedApplication(source){
 let text=source.text;
 let pieces=[{start:0,text}];
 const scopes=new Map(source.scopes.map(scope=>[scope.id,{...scope,valid:true,dependencies:new Set()}]));
 const closures=new Map();
 function split(input,at){
  const left=[],right=[];let offset=0;
  for(const piece of input){
   const end=offset+piece.text.length;
   if(end<=at)left.push(piece);
   else if(offset>=at)right.push(piece);
   else {
    const cut=at-offset;
    left.push({...piece,text:piece.text.slice(0,cut)});
    right.push({start:piece.start===null?null:piece.start+cut,text:piece.text.slice(cut)});
   }
   offset=end;
  }
  return [left,right];
 }
 function read(op){
  const scope=scopes.get(op.scopeId);
  if(!scope)fault('DRAFT_SCOPE_UNKNOWN',op.id);
  if(!scope.valid)fault('DRAFT_SCOPE_INVALIDATED',op.id);
  const closure=new Set(op.dependsOn.flatMap(id=>[id,...closures.get(id)]));
  if([...scope.dependencies].some(id=>!closure.has(id)))fault('DRAFT_DEPENDENCY_REQUIRED',op.id);
  return {text:text.slice(scope.start,scope.end),closure};
 }
 function apply(op,edit,closure){
  const target=scopes.get(op.scopeId),start=target.start+edit.start,end=target.start+edit.end;
  const delta=edit.replacement.length-(end-start),ancestors=new Set(target.ancestorPath);
  for(const scope of scopes.values()){
   if(!scope.valid)continue;
   if(scope.id===target.id||ancestors.has(scope.id)){
    scope.end+=delta;
    for(const id of closure)scope.dependencies.delete(id);
    scope.dependencies.add(op.id);
   }else if(scope.end<=start){
    // Insertion at the end of a non-target scope belongs outside that scope.
   }else if(scope.start>=end){
    scope.start+=delta;scope.end+=delta;
   }else if(scope.start<=start&&scope.end>=end&&start!==end){
    // A parent may edit text strictly inside a descendant, preserving its range.
    // Exact whole-descendant replacement/deletion destroys its old identity.
    if(scope.start===start&&scope.end===end)scope.valid=false;
    else {scope.end+=delta;for(const id of closure)scope.dependencies.delete(id);scope.dependencies.add(op.id);}
   }else if(start===end&&scope.start<start&&scope.end>start){
    scope.end+=delta;for(const id of closure)scope.dependencies.delete(id);scope.dependencies.add(op.id);
   }else scope.valid=false;
  }
  const [left,rest]=split(pieces,start),[,right]=split(rest,end-start);
  pieces=[...left,...(edit.replacement?[{start:null,text:edit.replacement}]:[]),...right];
  text=text.slice(0,start)+edit.replacement+text.slice(end);
  closures.set(op.id,closure);
 }
 function comparisons(){
  const spans=[];let cursor=0,pending='';
  for(const piece of pieces){
   if(piece.start===null){pending+=piece.text;continue;}
   if(cursor<piece.start||pending)spans.push({before:source.text.slice(cursor,piece.start),after:pending});
   spans.push({before:piece.text,after:piece.text});
   cursor=piece.start+piece.text.length;pending='';
  }
  if(cursor<source.text.length||pending)spans.push({before:source.text.slice(cursor),after:pending});
  return spans;
 }
 return {read,apply,comparisons,get text(){return text;}};
}
