import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=process.env.MERI_WORKFLOW_REVIEW_ROOT,cRoot=process.env.MERI_COMMITMENTS_REVIEW_ROOT??root,rRoot=process.env.MERI_RELATIONSHIP_REVIEW_ROOT??root;
assert(cRoot&&rRoot,'Explicit reviewed workflow roots required');
const load=(base,path)=>import(pathToFileURL(base+'/'+path));
const {createCommitmentsAuditCompiler}=await load(cRoot,'apps/control/document-application/commitments-audit/compose.mjs');
const cf=await load(cRoot,'apps/control/document-application/commitments-audit/test/fixtures.mjs');
const {createRelationshipBriefCompiler}=await load(rRoot,'apps/control/document-application/relationship-brief/compose.mjs');
const rf=await load(rRoot,'apps/control/document-application/relationship-brief/test/fixtures.mjs');
const {GatewayDenied}=await load(rRoot,'apps/gateway/dispatch/operation-result.mjs');
const plain=r=>r.request.content.blocks.map(b=>b.runs.map(x=>x.text).join('')).join('\n');
test('bounded Commitments accepts broader typed native inventory as partial without changing selected window',async()=>{
 const context=rf.unitContext(),selection=cf.selection(context);selection.window={basis:'explicit',startInclusive:'2026-10-13T10:00:00.000Z',endExclusive:'2026-10-13T15:00:00.000Z',timezone:'UTC',weekStartsOn:null};
 const compiler=createCommitmentsAuditCompiler({readSource:rf.sourcePage,now:()=>rf.NOW}),r=await compiler.prepare(cf.makeInput(),context,{selection});
 assert.deepEqual(r.provenance.selection.window,selection.window);assert(r.ledger.coverage.some(c=>c.windowMatch==='broad-native-read'));assert(r.ledger.coverage.every(c=>!c.complete));assert(r.ledger.commitments.every(c=>!c.completed));
});
test('Relationship canonical unavailable gateway code remains a visible source gap',async()=>{
 const context=rf.unitContext(),compiler=createRelationshipBriefCompiler({defaultCongress:119,now:()=>rf.NOW,readSource:call=>{if(call.operation.id==='find_contacts')throw new GatewayDenied('UNAVAILABLE');return rf.sourcePage(call);}});
 const r=await compiler.prepare(rf.makeInput(),context,{selection:rf.selected(context)});assert(r.coverage.some(c=>c.sourceId==='tenant_contacts'&&!c.complete));assert(plain(r).includes('UNAVAILABLE'));
});
test('Relationship has no unrelated Monday read when no authorized mapped boards are selected',async()=>{
 const context=rf.unitContext(),selection=rf.selected(context),calls=[];selection.mondayBoardIds=[];
 const compiler=createRelationshipBriefCompiler({defaultCongress:119,now:()=>rf.NOW,readSource:call=>{calls.push(call.operation.id);return rf.sourcePage(call);}}),r=await compiler.prepare(rf.makeInput(),context,{selection});
 assert(!calls.includes('read_monday_client_boards'));assert(r.coverage.some(c=>c.sourceId==='client_knowledge_monday'&&c.status==='not-mapped'));assert(plain(r).includes('NOT_MAPPED'));
});
test('candidate-only read cap never supplies decisive source evidence or verifies relationship claims',async()=>{
 const context=rf.unitContext(),compiler=createRelationshipBriefCompiler({defaultCongress:119,now:()=>rf.NOW,limits:{maxCalls:10},readSource:rf.sourcePage}),r=await compiler.prepare(rf.makeInput(),context,{selection:rf.selected(context)});
 assert(!r.context.evidence.some(e=>e.sourceId==='mail'));assert.equal(r.quotes[0].status,'missing-or-mismatched-excerpt');assert(r.issues.some(i=>i.reason==='CALL_CAP'));assert(plain(r).includes('[unverified interpretation]'));
});
for(const [name,create,input,selection] of [['Commitments',createCommitmentsAuditCompiler,cf.makeInput,cf.selection],['Relationship',createRelationshipBriefCompiler,rf.makeInput,rf.selected]])
test(name+' original recipe refuses actual successor operation and derived-source substitutions',async()=>{
 for(const mode of ['successor-operation','derived-source']){
  const context=rf.unitContext(),compiler=create({defaultCongress:119,now:()=>rf.NOW,readSource:call=>{
   const page=rf.sourcePage(call);if(call.operation.id==='query_action_items'){
    if(mode==='successor-operation'){page.operation={id:'actions.query',version:'0.2.0'};page.result.operation={id:'actions.query',version:'0.2.0'};}
    else {page.result.sources[0].sourceId='action_items_complete';page.result.sources[0].authority='derived';}
   }return page;
  }});
  await assert.rejects(compiler.prepare(input(),context,{selection:selection(context)}));
 }
});
for(const [name,create,context,selection,input,prefix]of [
 ['Commitments',createCommitmentsAuditCompiler,cf.unitContext,cf.selection,cf.makeInput,'COMMITMENTS'],
 ['Relationship',createRelationshipBriefCompiler,rf.unitContext,rf.selected,rf.makeInput,'RELATIONSHIP']
])test(name+' parked source deadline aborts the borrowed read with its own typed failure',async()=>{
 let signal;const now=Date.now(),c=context();c.deadlineMs=now+50;
 const compiler=create({defaultCongress:119,now:()=>Date.now(),readSource:call=>{signal=call.signal;return new Promise(()=>{});}}),keepAlive=setInterval(()=>{},1000);
 try{await assert.rejects(compiler.prepare(input(new Date(Math.min(cf.NOW,now)).toISOString()),c,{selection:selection(c)}),{code:prefix+'_DEADLINE'});assert(signal.aborted);}finally{clearInterval(keepAlive);}
});
