// Governed recall wire projection, not approval/eligibility enforcement or retrieval.
import {createHash} from 'node:crypto';
import {snapshotOperationData} from './operation-contracts.mjs';
const fail=message=>{throw new Error(message);};
const operation='search_memory',uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const optional=(v,n)=>typeof v==='string'?v.trim().slice(0,n)||null:null;
const hash=s=>createHash('sha256').update(s).digest('hex');
export function createClientKnowledgeMemoryValidators({validateShape,schema}) {
  if(typeof validateShape!=='function'||!schema?.$defs)fail('Memory contract configuration');
  const check=id=>{if(id!==operation)fail('Unknown memory operation');};
  const inputDefinition=id=>{check(id);return 'ClientKnowledgeMemoryInput';};
  const outputDefinition=id=>{check(id);return 'ClientKnowledgeMemoryOutput';};
  function decode(value){
    if(typeof value!=='string'||value.length>1024||!/^[A-Za-z0-9_-]+$/.test(value))fail('Invalid memory content cursor');
    const bytes=Buffer.from(value,'base64url');
    if(bytes.toString('base64url')!==value)fail('Noncanonical memory cursor encoding');
    let data;try{data=snapshotOperationData(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}catch{fail('Invalid memory cursor JSON');}
    validateShape('MemoryContentCursor',data);return data;
  }
  function normalizeInput(id,request,context){
    check(id);const raw=snapshotOperationData(request),ctx=snapshotOperationData(context);
    validateShape('ClientKnowledgeMemoryRequest',raw);validateShape('ClientKnowledgeMemoryContext',ctx);
    const parsed=typeof raw.k==='number'?raw.k:Number.parseInt(raw.k??'',10);
    const input={query:optional(raw.query,400),clientId:optional(raw.clientId,80),k:Number.isFinite(parsed)?Math.min(15,Math.max(1,Math.floor(parsed))):8,cursor:optional(raw.cursor,8192),memoryItemId:optional(raw.memoryItemId,80),contentCursor:optional(raw.contentCursor,1024)};
    if(input.query&&(!input.clientId||uuid.test(input.clientId))){
      if(input.memoryItemId&&!uuid.test(input.memoryItemId))fail('Memory item selector must be UUID');
      if(input.contentCursor&&!input.memoryItemId||input.memoryItemId&&input.cursor)fail('Memory continuation selector conflict');
      if(input.contentCursor){const c=decode(input.contentCursor);if(c.itemId!==input.memoryItemId||c.scope!==hash(JSON.stringify([ctx.tenantId,ctx.userId,input.clientId])))fail('Memory cursor scope/item substitution');}
    }
    validateShape(inputDefinition(id),input);
    return Object.freeze({input:Object.freeze(input),metadata:Object.freeze({sourceConnected:false,authoritative:false,currentPolicyQualified:false,cursorAuthenticated:false,absenceEvidence:false})});
  }
  function assertResult(id,value,request,context){
    const ctx=snapshotOperationData(context),{input}=normalizeInput(id,request,ctx),page=snapshotOperationData(value);
    validateShape(outputDefinition(id),page);
    const expectedError=!input.query?'Provide a search query.':input.clientId&&!uuid.test(input.clientId)?'clientId must be a client UUID — pass the exact id, or omit it.':null;
    if(expectedError){if(page.error!==expectedError)fail('Memory refusal substitution');return page;}
    if('error'in page)fail('Unexpected memory refusal');
    const source=page.coverage.sources.find(s=>s.domain==='institutional_knowledge');
    const initial=input.memoryItemId?1:Math.min(input.k,3);
    if(page.requestedPageSize!==input.k||![initial,1].includes(page.effectivePageSize)||page.records.length>page.effectivePageSize||page.nextCursor!==(source?.nextCursor??null))fail('Memory pagination projection mismatch');
    if(page.coverage.requestedDomains.length!==1||page.coverage.requestedDomains[0]!=='institutional_knowledge')fail('Memory requested domain substitution');
    const expectedStatus=page.records.length?(page.records.every(r=>r.payload.contentStatus==='metadata_only')?'metadata_only':'available'):input.memoryItemId?'unavailable_or_ineligible':source?.sourceStatus==='healthy'?'empty':'unavailable';
    if(page.contentStatus!==expectedStatus||page.factContentUnavailableCount!==page.records.filter(r=>r.payload.contentStatus!=='available').length||page.contentTruncated!==page.records.some(r=>r.payload.content.truncated))fail('Memory content status substitution');
    const summary=page.records.length?`${page.records.length} governed memory item(s) returned. Follow content.nextRead for complete approved content; coverage describes the search.`:'No eligible memory was returned. Coverage distinguishes an empty result from unavailable recall.';
    if(page.summary!==summary||page.results.length!==page.records.length)fail('Memory wrapper result mismatch');
    const scope=hash(JSON.stringify([ctx.tenantId,ctx.userId,input.clientId])),seen=new Set();
    for(let index=0;index<page.records.length;index++){
      const row=page.records[index],p=row.payload,c=p.content,proof=row.provenance,result=page.results[index];
      validateShape({available:'MemoryContentAvailableLimitation',metadata_only:'MemoryMetadataOnlyLimitation',empty:'MemoryEmptyLimitation'}[p.contentStatus],p.contentLimitation);
      if(seen.has(row.recordId)||p.memoryItemId!==row.recordId||proof.recordId!==row.recordId||input.memoryItemId&&row.recordId!==input.memoryItemId)fail('Memory record identity substitution');seen.add(row.recordId);
      if(input.clientId&&p.clientId!==null&&p.clientId!==input.clientId)fail('Memory client substitution');
      if(p.clientId?(row.entityRef?.type!=='client'||row.entityRef.id!==p.clientId):row.entityRef!==undefined)fail('Memory entity reference mismatch');
      if(result.id!==row.recordId||result.memoryItemId!==row.recordId||result.title!==p.title||result.type!==p.type||result.clientId!==p.clientId||result.relevance!==(row.retrievalSignals.semanticSimilarity??null))fail('Memory convenience result substitution');
      if(c.offset>c.endOffset||c.endOffset>c.totalCharacters||p.value.length!==c.endOffset-c.offset||proof.startOffset!==c.offset||proof.endOffset!==c.endOffset||c.truncated!==(c.endOffset<c.totalCharacters))fail('Memory content range mismatch');
      if(!input.memoryItemId&&p.value.length>500||p.title!==null&&p.title.length>160)fail('Memory excerpt bound');
      if(c.totalCharacters>c.offset&&!p.value.length)fail('Memory content page cannot make zero progress');
      if(/[\uD800-\uDBFF]$/.test(p.value))fail('Memory content ends inside surrogate pair');
      const previous=input.contentCursor?decode(input.contentCursor):null;
      if(c.offset!==(previous?.offset??0)||previous&&previous.hash!==c.hash)fail('Memory continuation content changed');
      if(c.truncated){
        const next=c.nextRead;if(!next||next.memoryItemId!==row.recordId||next.clientId!==(input.clientId??undefined))fail('Memory next-read selector mismatch');
        const cursor=decode(next.contentCursor);if(cursor.itemId!==row.recordId||cursor.scope!==scope||cursor.hash!==c.hash||cursor.offset!==c.endOffset)fail('Memory next cursor mismatch');
      }else if(c.nextRead!==null)fail('Terminal memory content has next read');
      if(c.offset===0&&c.endOffset===c.totalCharacters&&!proof.metadataTruncated&&c.hash!==hash(p.value+'\0'+(proof.sourceVersion??'')))fail('Memory complete content hash mismatch');
      for(const [key,cap]of [['sourceId',200],['sourceRef',600],['sourceExcerpt',400],['sourceVersion',200]])if(proof[key]!==null&&proof[key].length>cap)fail('Memory metadata bound');
      const budget=input.memoryItemId?6000:Math.min(6000,Math.max(1800,Math.floor(7200/Math.max(1,page.records.length))));
      if(JSON.stringify(row,null,2).length>budget)fail('Memory content page JSON budget exceeded');
    }
    return page;
  }
  return Object.freeze({schemaId:schema.$id,operationIds:Object.freeze([operation]),inputDefinition,outputDefinition,normalizeInput,assertResult});
}
