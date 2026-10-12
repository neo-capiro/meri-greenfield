// Full declared transport, not current source authorization or complete evidence.
import {snapshotOperationData} from './operation-contracts.mjs';
const fail=message=>{throw new Error(message);};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
function instant(value) {
  const time=Date.parse(value);
  if(!Number.isFinite(time)||new Date(time).toISOString()!==value)fail('Action instant is not canonical finite UTC');
  return time;
}
const deadlineCompare=(a,b)=>a===b?0:a===null?1:b===null?-1:Date.parse(a)-Date.parse(b);
function compare(a,b,sort) {
  const deadline=deadlineCompare(a.deadline,b.deadline),priority=b.priority-a.priority;
  return sort==='priority'?(priority||deadline):(deadline||priority);
}
export function createActionItemsCompleteValidators({validateShape,validatePublicShape,canonicalSha256,assertActionItemReadInput,assertActionItemClientScopedPage}) {
  function contextData(options) {
    const context=snapshotOperationData(options);validateShape('ActionItemsCompleteContext',context);
    validatePublicShape('RunBinding',context.binding);
    const resolution=context.clientResolution;
    if(resolution&&(resolution.reference.trim()!==resolution.reference||resolution.reference.length>80))fail('Action client reference is not canonical');
    if(resolution&&UUID.test(resolution.reference)&&resolution.reference.toLowerCase()!==resolution.clientId.toLowerCase())fail('Action client UUID resolution mismatch');
    return context;
  }
  function prepare(value,options) {
    const raw=snapshotOperationData(value),context=contextData(options);
    validateShape('ActionItemsCompleteInput',raw);
    const actor={actorId:context.binding.actorId};
    const first=assertActionItemReadInput(raw,actor);
    let request=raw,parsed=first;
    if(first.mode==='client_scoped') {
      const resolution=context.clientResolution;
      if(!resolution||resolution.reference!==first.selection.clientId)fail('Action client resolution differs from raw selector');
      request={...raw,clientId:resolution.clientId.toLowerCase()};
      parsed=assertActionItemReadInput(request,actor);
    } else if(context.clientResolution!==null)fail('Unexpected scoped action resolution');
    const normalized={...parsed,mode:parsed.mode==='client_scoped'?'client_scoped':'unscoped_list'};
    validateShape('ActionItemsCompleteNormalized',normalized);
    return {context,request,normalized};
  }
  function normalizeActionItemsCompleteInput(raw,context) {return prepare(raw,context).normalized;}
  function assertActionItemsCompleteResult(value,raw,options) {
    const {context,request,normalized}=prepare(raw,options),page=snapshotOperationData(value);
    if(normalized.mode==='client_scoped') {
      assertActionItemClientScopedPage(page,request,{actorId:context.binding.actorId});
      if(canonicalSha256(page.binding)!==canonicalSha256(context.binding))fail('Action scoped original binding mismatch');
      return page;
    }
    validateShape('ActionItemsUnscopedPage',page);instant(page.generatedAt);
    const {selection}=normalized;
    if(page.actions.length>selection.limit)fail('Action list exceeds selected limit');
    if(new Set(page.actions.map(row=>row.id.toLowerCase())).size!==page.actions.length)fail('Duplicate action identity');
    for(const [index,row] of page.actions.entries()) {
      instant(row.createdAt);instant(row.updatedAt);
      if(row.deadline!==null&&instant(row.deadline)%86400000!==0)fail('Action deadline is a stored date');
      if(selection.status!==null&&row.status!==selection.status)fail('Action status filter mismatch');
      if(index>0&&compare(page.actions[index-1],row,selection.sort)>0)fail('Action list order mismatch');
    }
    // Parallel row/count reads do not establish total>=returned or completeness.
    return page;
  }
  return Object.freeze({normalizeActionItemsCompleteInput,assertActionItemsCompleteResult});
}
