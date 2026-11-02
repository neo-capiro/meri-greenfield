/** The model-facing `arguments` contract of the intent tools: the canonical owner schema, the declared
 * narrowings (memory and the document rows), and the rows that still advertise none (SYNTHETIC source evidence;
 * no model, SDK query, provider, database or network call). The registered document tool's contract over the real
 * MCP transport is asserted in `native-document.test.mjs`. */
import test from 'node:test';import assert from 'node:assert/strict';
import {z} from 'zod';
import {INTENT_ROWS,intentDescriptor} from '../catalog.mjs';
import {canonicalIntentInputSchema,intentRowArguments,intentToolArguments} from '../schema.mjs';
import {watchValidators,validateShape} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {WATCH_SUPPORTED,WATCH_TARGET_KINDS} from '../../../../../packages/contracts/retrieval-0.2/watch-action-validation.mjs';
const CONFIGURATION=error=>error?.code==='INTENT_SCHEMA_CONFIGURATION';
const row=id=>INTENT_ROWS.find(r=>r.operation.id===id);
/** The advertised `arguments` schema of one row, as the model sees it. @param {string} id */
const advertised=id=>z.toJSONSchema(intentRowArguments(row(id)).arguments,{io:'input'});
const parses=(schema,value)=>schema.safeParse(value).success;

test('every intent row advertises its canonical schema, a declared narrowing, or none at all',()=>{
 assert.deepEqual(Object.fromEntries(INTENT_ROWS.map(r=>[r.operation.id,intentRowArguments(r).mode])),{
  save_note:'record',watch_action:'declared',create_client:'canonical',update_client_profile:'record',save_legiwatch_relevance:'canonical',mail_send:'canonical',
  apply_legiwatch_suggestion:'record',save_business_development_brief:'record',prepare_legiwatch_briefing:'record',save_legislative_research:'record',
  publish_research_portfolio_share_link:'canonical',revoke_research_portfolio_share_link:'canonical',
  manage_research_portfolio:'canonical',create_research_portfolio_snapshot:'canonical',request_research_portfolio_output:'canonical',save_research_portfolio_output_to_client:'canonical',
  watch_research_portfolio:'canonical',update_research_portfolio_change_state:'canonical',create_research_portfolio_bookmark:'canonical',add_research_portfolio_review_note:'canonical',
  prepare_research_portfolio_brief:'canonical',prepare_research_portfolio_meeting:'canonical',
  create_word:'declared',create_excel:'declared',create_powerpoint:'declared',run_analysis:'record',
  schedule_task:'record',update_scheduled_task:'record',cancel_scheduled_task:'canonical',
  create_task:'canonical',update_task:'canonical',save_memory:'declared',save_chat_attachments:'canonical',propose_office_edit:'canonical'});
 // A tool is only as precise as its least precise row: one record row keeps the tool's open record.
 assert.equal(intentToolArguments([row('create_excel')]).mode,'declared');
 assert.equal(intentToolArguments([row('save_memory')]).mode,'declared');
 assert.equal(intentToolArguments([row('run_analysis')]).mode,'record');
 assert.equal(intentToolArguments([row('create_word'),row('create_excel'),row('create_powerpoint')]).mode,'declared');
 assert.equal(intentToolArguments([row('update_scheduled_task'),row('cancel_scheduled_task')]).mode,'record');
 for(const rows of [[],undefined])assert.throws(()=>intentToolArguments(rows));
});

test('the open record is what a row advertises only while its canonical schema cannot be proved',()=>{
 // The canonical request of a proved row is advertised verbatim, and its own conversion is the proof.
 const schema=advertised('create_task'),converted=z.fromJSONSchema(schema);
 assert.deepEqual(Object.keys(schema.properties),['title','clientId','dueDate']);
 assert.equal(parses(converted,{title:'Task'}),true);
 assert.equal(parses(converted,{title:'Task',unexpected:true}),false);
 // The document rows are declared, not left opaque: one branch per admitted format, each carrying the canonical
 // fields and not demanding the trusted operation selection from the model.
 const word=advertised('create_word'),branches=(word.anyOf??[word]).flatMap(branch=>branch.anyOf??[branch]);
 assert.deepEqual(branches.map(branch=>branch.properties.format.const),['docx','txt']);
 for(const branch of branches){
  assert.deepEqual([...branch.required].sort(),['content','format','title']);
  assert.equal(branch.properties.operation.const,'create_word');
 }
 // A row with no proved canonical contract keeps the record, and it advertises no field contract.
 assert.equal(advertised('run_analysis').properties,undefined);
 assert.equal(parses(z.fromJSONSchema(advertised('run_analysis')),{anything:'at all'}),true);
 assert.equal(advertised('schedule_task').properties,undefined);
});

test('management advertises closed disjoint reads and confirmed writes from its canonical input',()=>{
 const resolved=intentRowArguments(row('manage_research_portfolio'));
 assert.equal(resolved.mode,'canonical');
 assert.equal(intentToolArguments([row('manage_research_portfolio')]).mode,'canonical');
 const schema=advertised('manage_research_portfolio');
 assert.equal(schema.oneOf.length,2);
 for(const branch of schema.oneOf){assert.equal(branch.additionalProperties,false);assert.ok(branch.required.includes('action'));}
 const input={conversationId:'71000000-0000-4000-8000-000000000001',parameters:{}};
 for(const action of schema.oneOf[0].properties.action.enum)assert.equal(parses(resolved.arguments,{...input,action}),true,action);
 for(const action of schema.oneOf[1].properties.action.enum){
  assert.equal(parses(resolved.arguments,{...input,action,confirmed:true}),true,action);
  assert.equal(parses(resolved.arguments,{...input,action}),false,action);
 }
 for(const value of [{...input,action:'not_an_action'},{...input,action:'grants_list',extra:true},{...input,action:'grants_list',confirmed:false},
  {...input,action:'rule_preview'}, {...input,confirmed:true}, {action:'grants_list',parameters:{}}, {...input,action:'grants_list',parameters:[]}])
  assert.equal(parses(resolved.arguments,value),false,JSON.stringify(value));
});

test('the watch tool advertises the canonical request resolved per family and operation, exactly as its owner validates',()=>{
 const resolved=intentRowArguments(row('watch_action'));
 assert.equal(resolved.mode,'declared');assert.equal(intentToolArguments([row('watch_action')]).mode,'declared');
 const schema=advertised('watch_action'),branches=schema.anyOf;
 // One branch per family and operation group of the owner's tables; `set_delivery` stands alone because it couples the flag.
 assert.equal(branches.length,Object.values(WATCH_SUPPORTED).reduce((n,ops)=>n+(ops.includes('set_delivery')?2:1),0));
 for(const branch of branches){
  assert.equal(branch.additionalProperties,false);assert.equal(branch.allOf,undefined);
  assert.deepEqual([...branch.required].sort(),['clientId','enabled','expectedVersion','family','operation','reason','sourceRevision','targetKey','targetKind']);
  const family=branch.properties.family.const,operations=branch.properties.operation.enum??[branch.properties.operation.const];
  assert.ok(operations.every(op=>WATCH_SUPPORTED[family].includes(op)),family);
  assert.deepEqual(branch.properties.targetKind.enum??[branch.properties.targetKind.const],WATCH_TARGET_KINDS[family]);
  assert.equal(branch.properties.enabled.type,operations.includes('set_delivery')?'boolean':'null');
 }
 const base={family:'legiwatch_keyword',clientId:'71000000-0000-4000-8000-000000000001',targetKind:'keyword_rule',targetKey:'rule-1',operation:'pause',expectedVersion:4,sourceRevision:null,reason:null,enabled:null};
 // What the owner validates is accepted, and the canonical validator (the oracle for the conditionals) agrees.
 for(const value of [base,{...base,operation:'set_delivery',enabled:true},{...base,family:'client_watchlist',targetKind:'client_tracker_watchlist',operation:'subscribe'},
  {...base,family:'defense_budget_target',targetKind:'pe',operation:'unsubscribe',reason:'Programme ended',sourceRevision:'rev-2'},{...base,clientId:null}]){
  assert.equal(parses(resolved.arguments,value),true,JSON.stringify(value));watchValidators.normalizeInput(value);validateShape('WatchInput',value);
 }
 // What the owner refuses is refused before the owner, by field: the coupled flag, a target kind or operation outside the
 // family, a caller request key, an out-of-range version, a bad token and a missing field. Base advertised an open record
 // here, so every one of these reached the owner as an opaque INVALID_ARGUMENTS.
 const {reason:_omitted,...missing}=base;
 for(const value of [{...base,operation:'set_delivery'},{...base,enabled:true},{...base,targetKind:'prospect'},{...base,family:'client_watchlist',targetKind:'client_tracker_watchlist',operation:'unsubscribe'},
  {...base,family:'defense_budget_target',targetKind:'pe',operation:'pause'},{...base,requestKey:'caller'},{...base,expectedVersion:0},{...base,targetKey:'bad key'},{...base,reason:''},missing]){
  assert.equal(parses(resolved.arguments,value),false,JSON.stringify(value));assert.throws(()=>watchValidators.normalizeInput(value),JSON.stringify(value));
 }
});

test('the memory tool advertises exactly the fields its owner admits',()=>{
 const schema=advertised('save_memory');
 assert.equal(schema.type,'object');assert.equal(schema.additionalProperties,false);assert.deepEqual(schema.required,['content']);
 assert.deepEqual(Object.keys(schema.properties),['content','key','scope','ttlDays']);
 assert.deepEqual(schema.properties.content,{type:'string',minLength:1,maxLength:4000});
 assert.equal(schema.properties.scope.anyOf[0].pattern,'^(personal|client|firm)$');
 const converted=z.fromJSONSchema(schema);
 // What the owner admits.
 for(const value of [{content:'Preference'},{content:'Preference',key:'brief-length',scope:'personal',ttlDays:14},{content:'Preference',ttlDays:null}])
  assert.equal(parses(converted,value),true,JSON.stringify(value));
 // What it refuses: any model-supplied clientId (even null), unknown fields, other scopes, and text the owner's
 // own bounds refuse. Base advertised an untyped object here, so every one of these reached the owner instead.
 for(const value of [{content:'Preference',clientId:null},{content:'Preference',clientId:'00000000-0000-4000-8000-000000000901'},
  {content:'Preference',unexpected:true},{content:'Preference',scope:'private-user'},{content:'',key:'k'},{content:'x'.repeat(4001)},
  {content:'Preference',key:'k'.repeat(121)},{content:'Preference',ttlDays:'14'},{key:'k'}])
  assert.equal(parses(converted,value),false,JSON.stringify(value));
});

test('the memory advertisement is the canonical request narrowed, never widened',()=>{
 const canonical=canonicalIntentInputSchema(intentDescriptor(row('save_memory').operation).inputSchema);
 const canonicalParses=z.fromJSONSchema(canonical),advertisedParses=z.fromJSONSchema(advertised('save_memory'));
 // The canonical request admits a model-supplied clientId and wider text; the owner does not, so the tool must not.
 for(const value of [{content:'Preference',clientId:null},{content:'x'.repeat(4001)},{content:'Preference',key:'k'.repeat(121)},{content:'Preference',scope:'global'}]){
  assert.equal(parses(canonicalParses,value),true,JSON.stringify(value));
  assert.equal(parses(advertisedParses,value),false,JSON.stringify(value));
 }
 // Nothing the advertisement accepts is outside the canonical request.
 for(const value of [{content:'Preference'},{content:'Preference',key:'k',scope:'firm',ttlDays:2},{},{content:'x',clientId:null}])
  if(parses(advertisedParses,value))assert.equal(parses(canonicalParses,value),true,JSON.stringify(value));
});

test('a schema document that does not match the descriptor byte pin fails closed',()=>{
 const inputSchema=intentDescriptor(row('save_memory').operation).inputSchema;
 assert.doesNotThrow(()=>canonicalIntentInputSchema(inputSchema));
 for(const tampered of [{...inputSchema,sha256:'f'.repeat(64)},{...inputSchema,id:'urn:meri:commands:tool-interface:0.2.0#/$defs/NoSuchRequest'},
  {id:'urn:meri:commands:unknown:0.2.0#/$defs/Anything',sha256:inputSchema.sha256},{id:inputSchema.id},{}])
  assert.throws(()=>canonicalIntentInputSchema(tampered),CONFIGURATION,JSON.stringify(tampered));
 assert.throws(()=>intentRowArguments({operation:{id:'save_memory'}}),CONFIGURATION);
});
