import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=process.env.MERI_TYPED_REVIEW_ROOT;
const domain=process.env.MERI_COMMITMENTS_REVIEW_ROOT??root;
assert(root&&domain,'Explicit reviewed source paths required');
const load=(base,path)=>import(pathToFileURL(base+'/'+path));
const {bindWorkflowReads}=await load(root,'packages/skills/evidence/typed-reads.mjs');
const {createCollection}=await load(domain,'apps/control/document-application/commitments-audit/source.mjs');
const f=await load(domain,'apps/control/document-application/commitments-audit/test/fixtures.mjs');
const {createOperationLifetime}=await load(root,'packages/runtime/operation-lifetime.mjs');
const {canonicalSha256:hash}=await load(root,'packages/contracts/validate.mjs');
const {resolveOperationContract}=await load(root,'packages/contracts/retrieval-0.2/validate.mjs');
const {createClientKnowledgeFixture,memoryText}=await load(root,'apps/gateway/sources/client-knowledge/test/fixtures.mjs');
const {createHash}=await import('node:crypto');
const identity={skillId:'quick_skill.commitments_audit',skillVersion:'1.0.0'};
async function captured(){
 const context=f.unitContext(),selection=f.selection(context),life=createOperationLifetime({deadlineMs:f.NOW+60000,now:()=>f.NOW,errorFactory:code=>Object.assign(Error(code),{code})});
 const collection=createCollection({readSource:f.sourcePage,context,selected:selection,asOf:new Date(f.NOW).toISOString(),query:'briefing',deadlineMs:f.NOW+60000,life,now:()=>f.NOW,
  limits:{maxCalls:24,maxPages:3,maxRecords:3,sectionCodeUnits:2000,maxBodyCodeUnits:120000,maxSourceBytes:2097152}});
 try{await collection.collect();return {context:{binding:context.binding,subject:selection.subject,window:selection.window,asOf:new Date(f.NOW).toISOString(),mondayBoardIds:selection.mondayBoardIds},reads:collection.reads,gaps:collection.gaps};}finally{life.close();}
}
const change=(r,fn)=>{fn(r.result);r.resultSha256=hash(r.result);};
test('actual typed receipts bind full late mail and all six original source cells; unavailable sources are retained',async()=>{
 const f0=await captured(),b=bindWorkflowReads(f0.context,f0.reads,identity),entry=[...b.records.values()].find(e=>e.record.sourceId==='mail');
 assert(entry);assert.equal(entry.record.content.text,f.corpus);assert(entry.record.content.text.includes(f.lateQuote));assert.equal(entry.record.recordVersionId,f.sourceVersionId);
 assert.equal(b.coverage.length,6);assert(b.coverage.every(c=>c.complete===false));assert(f0.gaps.some(g=>g.operation==='query_tasks'));assert(f0.gaps.some(g=>g.operation==='query_action_items'));
 assert(entry.authorizationDecisionIds.length>0);assert(entry.receiptSha256s.length>=2);assert.equal(entry.verification,'bound-source-excerpt');
});
for(const [name,mutate]of [
 ['result checksum',r=>r.resultSha256='0'.repeat(64)],
 ['binding',r=>change(r,p=>p.binding.writerFence++)],
 ['scope',r=>change(r,p=>p.messages[0].scopes[0].resourceId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')],
 ['full body hash',r=>change(r,p=>p.messages[0].contentSha256='0'.repeat(64))],
 ['operation substitution',r=>{r.operation={id:'query_tasks',version:'0.2.0'};}]
])test('typed read refuses '+name,async()=>{const f0=await captured(),r=f0.reads.find(r=>r.operation.id==='mail.read_thread');mutate(r);assert.throws(()=>bindWorkflowReads(f0.context,f0.reads,identity));});
test('missing final body page is not evidence even if inventory and the first decisive page were read',async()=>{
 const f0=await captured(),reads=f0.reads.filter(r=>r.operation.id!=='mail.read_thread'||r.request.bodyOffset===0),b=bindWorkflowReads(f0.context,reads,identity);
 assert.equal([...b.records.values()].some(e=>e.record.sourceId==='mail'),false);assert(b.incomplete.some(e=>e.sourceId==='mail'));
 assert(b.coverage.find(c=>c.sourceId==='mail').limitations.some(x=>x.includes('incomplete')));
});
test('retained same source/record/version cannot bind a different full hash',async()=>{
 const f0=await captured(),r=structuredClone(f0.reads.find(r=>r.operation.id==='mail.read_thread'));change(r,p=>p.messages[0].contentSha256='f'.repeat(64));
 assert.throws(()=>bindWorkflowReads(f0.context,[...f0.reads,r],identity),{code:'WORKFLOW_IMMUTABLE_SOURCE_CONFLICT'});
});
test('approved-memory material support is explicit; original memory prose is not silently treated as inventory-only coverage',async()=>{
 const op={id:'search_memory',version:'0.2.0'},fixture=createClientKnowledgeFixture('search_memory',{client:true}),contract=resolveOperationContract(op);
 const context={binding:fixture.binding,subject:fixture.subject,window:{basis:'unbounded'},asOf:new Date(f.NOW).toISOString(),mondayBoardIds:[]};
 const nc={tenantId:context.binding.tenantId,userId:context.binding.actorId},request={clientId:fixture.clientId,query:'approved allocation',k:3},n=contract.normalizeInput(request,nc),first=fixture.page(n.input),next=first.records[0].payload.content.nextRead;
 const receipts=[];for(const req of [request,next]){const norm=contract.normalizeInput(req,nc),result={binding:context.binding,subject:context.subject,operation:op,argumentsSha256:norm.argumentsSha256,result:fixture.page(norm.input)};receipts.push({operation:op,request:req,normalizationContext:nc,result,resultSha256:hash(result)});}
 const bound=bindWorkflowReads(context,receipts,{skillId:'quick_skill.relationship_brief',skillVersion:'1.0.0'}),entry=[...bound.records.values()].find(e=>e.record.sourceId==='client_knowledge_memory');
 // An original required source must either supply decisive material or disclose the implementation limitation.
 assert(entry?.record.content.text===memoryText||bound.coverage.find(c=>c.sourceId==='client_knowledge_memory').limitations.some(x=>/material.*unsupported|material.*unavailable|projection-only/i.test(x)));
});
async function memoryReads(){
 const op={id:'search_memory',version:'0.2.0'},fixture=createClientKnowledgeFixture('search_memory',{client:true}),contract=resolveOperationContract(op);
 const context={binding:fixture.binding,subject:fixture.subject,window:{basis:'unbounded'},asOf:new Date(f.NOW).toISOString(),mondayBoardIds:[]},nc={tenantId:context.binding.tenantId,userId:context.binding.actorId};
 const firstRequest={clientId:fixture.clientId,query:'approved allocation',k:3},first=fixture.page(contract.normalizeInput(firstRequest,nc).input),receipts=[];
 for(const request of [firstRequest,first.records[0].payload.content.nextRead]){const n=contract.normalizeInput(request,nc),result={binding:context.binding,subject:context.subject,operation:op,argumentsSha256:n.argumentsSha256,result:fixture.page(n.input)};
  receipts.push({operation:op,request,normalizationContext:nc,result,resultSha256:hash(result),observedAt:context.asOf});}
 return {context,receipts};
}
test('complete approved memory retains native salted hash and derived-memory provenance independently of plain text correlation',async()=>{
 const f0=await memoryReads(),b=bindWorkflowReads(f0.context,f0.receipts,{skillId:'quick_skill.relationship_brief',skillVersion:'1.0.0'}),entry=[...b.records.values()][0];
 assert(entry);assert.equal(entry.record.content.text,memoryText);assert.equal(entry.verification,'bound-derived-memory');assert.equal(entry.record.metadata.upstreamExcerptVerified,false);
 const version=entry.record.recordVersionId,digest=s=>createHash('sha256').update(s,'utf8').digest('hex');
 assert.equal(entry.record.metadata.nativeContentHash,digest(memoryText+'\0'+version));assert.equal(entry.record.contentSha256,digest(memoryText));assert.notEqual(entry.record.contentSha256,entry.record.metadata.nativeContentHash);
 assert.equal(entry.record.metadata.governance.status,'active');assert.equal(entry.record.metadata.governance.authority,'firm_approved');assert.equal(entry.record.metadata.sourceExcerpt,null);
});
test('approved memory missing continuation stays unbound and visible',async()=>{
 const f0=await memoryReads(),b=bindWorkflowReads(f0.context,f0.receipts.slice(0,1),{skillId:'quick_skill.relationship_brief',skillVersion:'1.0.0'});
 assert.equal(b.records.size,0);assert(b.incomplete.some(x=>x.sourceId==='client_knowledge_memory'));assert(b.coverage.find(c=>c.sourceId==='client_knowledge_memory').complete===false);
});
test('approved memory altered material cannot bypass its native composite hash',async()=>{
 const f0=await memoryReads(),receipt=f0.receipts.at(-1);change(receipt,p=>p.result.records[0].payload.value=p.result.records[0].payload.value.replace('approved','refused!'));
 assert.throws(()=>bindWorkflowReads(f0.context,f0.receipts,{skillId:'quick_skill.relationship_brief',skillVersion:'1.0.0'}));
});
