/** The registered `request_document` contract over the actual MCP in-memory transport and the real document intent
 * preparer; the artifact write owner is a counting scripted port, so no generator, POSIX runtime, database, provider
 * or model call happens here (SYNTHETIC source evidence, not document generation or live acceptance).
 *
 * The trusted consumer binds the operation it was composed for (PR265 `2fb9195`) and the base preparer still demands
 * it; the case that depends on that binding is reported as skipped where the composing consumer is absent, never
 * passed silently. */
import test from 'node:test';import assert from 'node:assert/strict';
import catalog from '../../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {DOCUMENT_INTENT_OPERATIONS,createDocumentIntentPreparer} from '../../../../control/intents/document-preparer.mjs';
import {mount,delivery,id,NOW} from '../../../../control/intents/test/fixture.mjs';
import {mountIntents} from './fixture.mjs';
const WORD={id:'create_word',version:'0.2.0'};
const TXT={format:'txt',title:'Draft',content:{text:'Hello\n'}};
const DOCX={format:'docx',title:'Draft',content:{blocks:[{kind:'paragraph',runs:[{text:'Hello'}]}]}};
const EXCEL={format:'xlsx',title:'Book',content:{sheets:[{name:'Sheet1',rows:[[{value:'a'}]]}]}};
const POWERPOINT={format:'pptx',title:'Deck',content:{slides:[{title:'One'}]}};
/** Unadmitted, conflicting, foreign and malformed bodies: refused before the owner in every composition. */
const REFUSED=Object.freeze([{...TXT,format:'pdf'},{...TXT,operation:'create_excel'},{...TXT,context:{binding:{}}},
 {...TXT,title:''},{...TXT,clientId:null},{anything:'at all'},{}]);
const VALID=Object.freeze([[WORD.id,TXT],[WORD.id,DOCX],['create_excel',EXCEL],['create_powerpoint',POWERPOINT]]);
const descriptor=operation=>{const entry=catalog.operations.find(row=>row.operation.id===operation);return {operation:entry.operation,requiredGrants:entry.requiredGrants,sourceRequirements:entry.sourceRequirements};};
/** The document composition: the real preparers of every admitted operation over one counting scripted write port. */
function composition(){
 const binding={tenantId:'tenant-document',actorId:'actor-document',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:id(901),policyRevision:'policy-document'}],calls=[];
 const writes={async execute(call){calls.push(call);throw Object.assign(Error('OWNER_STOP'),{code:'OWNER_STOP'});}};
 const preparers=DOCUMENT_INTENT_OPERATIONS.map(operation=>createDocumentIntentPreparer({descriptor:descriptor(operation),writes,binding}));
 const journaled=mount({binding,preparers,now:()=>NOW,scopes});
 const f={binding,scopes,now:()=>NOW,deadlineMs:NOW+60000,port:journaled.mount};
 return {binding,scopes,calls,f,prepare:call=>journaled.mount.prepare(call),rows:()=>[...journaled.store.rows.values()],mount:()=>mountIntents(f)};
}
/** The advertised branches of the registered tool, flattened over its per-operation unions. */
const branchesOf=tool=>(tool.inputSchema.properties.arguments.anyOf??[tool.inputSchema.properties.arguments]).flatMap(branch=>branch.anyOf??[branch]);
const text=result=>result.content[0].text;
const OPERATIONS=Object.freeze({docx:WORD.id,txt:WORD.id,xlsx:'create_excel',pptx:'create_powerpoint'});

test('the registered request_document tool advertises the admitted Word branches beside Excel and PowerPoint',async()=>{
 const c=composition(),m=await c.mount();assert(m);
 try{
  const tool=(await m.client.listTools()).tools.find(entry=>entry.name==='request_document');assert.ok(tool,'request_document is registered');
  assert.deepEqual(tool.inputSchema.properties.operation.enum,['create_word','create_excel','create_powerpoint']);
  const branches=branchesOf(tool);
  // One branch per admitted format of each document operation; PDF is not admitted by default.
  assert.deepEqual(branches.map(branch=>branch.properties.format.const),['docx','txt','xlsx','pptx']);
  for(const branch of branches){
   const operation=OPERATIONS[branch.properties.format.const];
   assert.equal(branch.type,'object');assert.equal(branch.additionalProperties,false);
   assert.deepEqual([...branch.required].sort(),['content','format','title'],branch.properties.format.const);
   assert.equal(branch.properties.operation.const,operation,'the trusted selection is constrained, never demanded');
   assert.equal(branch.properties.title.minLength,1);assert.equal(branch.properties.title.maxLength,200);
  }
  const [docx,txt]=branches;
  assert.equal(docx.properties.content.properties.blocks.type,'array','the canonical WordContent blocks');
  assert.equal(txt.properties.content.properties.text.type,'string');
  assert.equal(docx.properties.content.additionalProperties,false);
 }finally{await m.close();}
});

test('admitted bodies reach the document owner exactly once; unadmitted, conflicting and foreign shapes never reach it',async()=>{
 const c=composition(),m=await c.mount();assert(m);
 try{
  // One run admits eight write requests (`MAX_INTENT_CALLS`), so refusals and accepted bodies use their own run.
  for(const [index,body] of REFUSED.entries()){
   const out=await m.call('request_document',{operation:WORD.id,arguments:body},{toolUseId:`toolu_refused_${index}`});
   assert.equal(out.isError,true,JSON.stringify(body));
   assert.equal(c.calls.length,0,`no owner call for ${JSON.stringify(body)}`);
   assert.equal(c.rows().length,0,'a body the contract refuses is not a governed delivery');
  }
 }finally{await m.close();}
 const accepted=await c.mount();assert(accepted);
 try{
  for(const [index,[operation,args]] of VALID.entries()){
   const body={...args,operation};
   const out=await accepted.call('request_document',{operation,arguments:body},{toolUseId:`toolu_valid_${index}`});
   // The scripted owner stops after being called, so the delivery is UNKNOWN: never a draft, never a retry.
   assert.equal(out.isError,true,args.format);assert.match(text(out),/^UNKNOWN: /u,args.format);
   assert.equal(c.calls.length,index+1,`exactly one owner call for ${args.format}`);
   assert.deepEqual(c.calls[index].request,body);
   assert.equal(Object.hasOwn(c.calls[index],'credential'),false);
  }
  assert.deepEqual(c.rows().map(row=>row.state),['UNKNOWN','UNKNOWN','UNKNOWN','UNKNOWN']);
  // A delivery replayed by a later runtime answers UNKNOWN from the journal and never calls the owner again.
  const again=await c.mount();assert(again);
  try{
   const replay=await again.call('request_document',{operation:WORD.id,arguments:{...TXT,operation:WORD.id}},{toolUseId:'toolu_valid_0'});
   assert.equal(replay.isError,true);assert.match(text(replay),/^UNKNOWN: /u);
   assert.equal(c.calls.length,4,'a replayed delivery never calls the owner again');
  }finally{await again.close();}
 }finally{await accepted.close();}
});

test('the consumer itself refuses those shapes before the write owner, whatever the tool advertised',async()=>{
 const c=composition();
 for(const [index,body] of REFUSED.entries())
  await assert.rejects(c.prepare({operation:WORD,arguments:body,deliveryId:delivery(100+index)}),error=>error?.code==='INVALID_ARGUMENTS',JSON.stringify(body));
 assert.equal(c.calls.length,0);
 for(const [index,[operation,args]] of VALID.entries())
  await assert.rejects(c.prepare({operation:{id:operation,version:'0.2.0'},arguments:{...args,operation},deliveryId:delivery(200+index)}),error=>error?.code==='UNKNOWN',args.format);
 assert.equal(c.calls.length,4);
});

test('a canonical body may omit the repeated operation where the composed consumer binds it',async t=>{
 // PR265 binds the trusted operation; the base document preparer still demands the repeated one.
 const probe=composition();let bound=false;
 try{await probe.prepare({operation:WORD,arguments:TXT,deliveryId:delivery(300)});}catch(error){bound=error?.code!=='INVALID_ARGUMENTS';}
 if(!bound){t.skip('the composed document preparer demands the repeated operation; PR265 2fb9195 supplies the trusted binding');return;}
 const c=composition(),m=await c.mount();assert(m);
 try{
  const out=await m.call('request_document',{operation:WORD.id,arguments:TXT},{toolUseId:'toolu_omitted_operation'});
  assert.equal(out.isError,true);assert.match(text(out),/^UNKNOWN: /u);
  assert.equal(c.calls.length,1);assert.deepEqual(c.calls[0].request,{...TXT,operation:WORD.id},'the trusted selection is bound into the canonical request');
 }finally{await m.close();}
});
