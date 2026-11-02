/** Everything the model reads as instruction in a reads+intents run is written in the user's terms: the whole system
 * prompt append, the `meri_reads` and `meri_intents` server instructions and every tool description, as a real MCP
 * client lists them. Internal vocabulary (harness, gateway, code names, data-model words) must not be there, because the
 * model repeats what it reads to the user, and so are the `description` annotations of every advertised argument schema
 * (the pinned schema bytes themselves are untouched), the selected-skill `meri_original_reads` server and the permission
 * denial messages. No SDK query, provider or network call. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {buildConversationOptions,RESPONSE_STYLE,RESPONSE_VOICE} from '../options.mjs';
import {BEDROCK_MODEL} from '../provider.mjs';
import {binding,scopes,versions} from '../../../control/conversations/test/application-fixture.mjs';
import {familyReads,resolveAvailableReads} from '../reads/availability.mjs';
import {READ_FAMILIES} from '../reads/families.mjs';
import {createGeneralReadServer} from '../reads/server.mjs';
import {readToolName} from '../reads/tools.mjs';
import {failureResult,readNotices,READ_FAILURE_CODES} from '../reads/results.mjs';
import {SQL_REFUSAL_GUIDANCE} from '../reads/guidance.mjs';
import {readPromptSentence} from '../reads/options.mjs';
import {capiroDataPage,privateCapiroDataPage,sqlRefusal} from '../../../gateway/sources/capiro-data/test/fixture.mjs';
import {GENERAL_READ_CEILINGS} from '../reads/budget.mjs';
import {createIntentServer} from '../intents/server.mjs';
import {INTENT_ROWS} from '../intents/catalog.mjs';
import {intentFailureResult,INTENT_FAILURE_CODES as INTENT_CODES} from '../intents/results.mjs';
import {userVocabulary} from '../user-vocabulary.mjs';
import {createOriginalSkillServer} from '../skills/mcp.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';

/** Words the user must never hear back. Codes are matched exactly (UNAVAILABLE, ACCESS_DENIED); words case-insensitively.
 * `relations:` is the pinned argument name of describe_capiro_data and is allowed; "table" is the SQL-writing term. */
const BANNED=[/\bgoverned\b/iu,/\bgateway\b/iu,/\brelations?\b(?!:)/iu,/\btool names?\b/iu,/\bUNAVAILABLE\b/u,/\bACCESS_DENIED\b/u,/\bRESOURCE_LIMIT\b/u,/\bscheduler interface\b/iu,/\bbounded session\b/iu,/\bacceptance\b/iu];
/** Every violation of every text, reported together. */
const violations=[];
const check=(text,where)=>{for(const pattern of BANNED){const m=pattern.exec(text);if(m)violations.push(`${where} says "${m[0]}": ...${text.slice(Math.max(0,m.index-80),m.index+60).replaceAll('\n',' ')}...`);}};
/** Every `description` annotation of an advertised argument schema, with its JSON path. @param {any} node @param {string} path @returns {[string,string][]} */
const descriptions=(node,path='arguments')=>Array.isArray(node)?node.flatMap((v,i)=>descriptions(v,`${path}[${i}]`)):node!==null&&typeof node==='object'?Object.entries(node).flatMap(([k,v])=>k==='description'&&typeof v==='string'?[[path,v]]:descriptions(v,`${path}.${k}`)):[];

async function listed(server){
 const client=new Client({name:'user-vocabulary',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();
 await server.instance.connect(a);await client.connect(b);
 try{const {tools}=await client.listTools();return {instructions:client.getInstructions()??'',tools};}
 finally{await client.close();}
}
const now=Date.now;
function mountEverything(){
 const all=familyReads().map(row=>row.operation);
 const {available}=resolveAvailableReads({policy:{generalReads:true,readFamilies:Object.keys(READ_FAMILIES)},installation:{operations:all},discovery:{operations:all},scopes:[{kind:'client'}]});
 const reads=createGeneralReadServer({available,unavailable:[],binding,budgets:GENERAL_READ_CEILINGS,timeoutMs:60000,deadlineMs:now()+60000,now,executionCatalogSha256:null,execute:async()=>'{}'});
 const intents=createIntentServer({available:INTENT_ROWS,binding,scopes,timeoutMs:60000,deadlineMs:now()+60000,now,stillAvailable:async()=>true,prepare:async()=>{throw Error('UNAVAILABLE');}});
 // The selected-skill server (only document-compiler skills are admitted to it) at its offered version.
 const skill=createOriginalSkillServer({selected:selectSkill('quick_skill.commitments_audit','1.0.1'),read:async()=>'{}',timeoutMs:60000,binding});
 return {reads,intents,skill,available,
  readOptions:{mcpServers:{meri_reads:reads.server},allowedTools:[...reads.allowedTools],canUseTool:reads.canUseTool,hooks:reads.hooks},
  intentOptions:{mcpServers:{meri_intents:intents.server},allowedTools:[...intents.allowedTools],canUseTool:intents.canUseTool,hooks:intents.hooks}};
}
const runtime=()=>({binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,model:BEDROCK_MODEL,region:'us-east-1',maxOutputTokens:4096,providerEnvironment:{},sessionStore:{async load(){return null;},async append(){}},deadlineMs:now()+1000,maxTurns:20,maxCostMicroUSD:2000000,maxOutputBytes:1024});

test('the full system prompt of a reads+intents run, both server instructions and every tool description are in the user\'s terms',async()=>{
 const m=mountEverything();
 try{
  const o=buildConversationOptions(runtime(),new AbortController(),undefined,undefined,undefined,m.readOptions,m.intentOptions);
  assert.deepEqual(Object.keys(o.mcpServers),['meri_reads','meri_intents']);
  check(o.systemPrompt.append,'the system prompt');
  assert.ok(RESPONSE_STYLE.includes('Describe capabilities by what they do for the user, never by their internal name, and never mention a tool you lack (a shell, command line or file tool); when something is unavailable say what the user can do next.'));
  assert.ok(o.systemPrompt.append.includes(RESPONSE_VOICE));
  const reads=await listed(m.reads.server),intents=await listed(m.intents.server),skill=await listed(m.skill.server);
  assert.ok(reads.tools.length>=100&&intents.tools.length>=20&&skill.tools.length>=1,`${reads.tools.length} reads, ${intents.tools.length} intents, ${skill.tools.length} skill reads`);
  check(reads.instructions,'the reads instructions');check(intents.instructions,'the intents instructions');check(skill.instructions,'the selected-skill instructions');
  for(const t of [...reads.tools,...intents.tools,...skill.tools]){check(t.description,t.name);for(const [path,text] of descriptions(t.inputSchema))check(text,`${t.name} ${path}`);}
  for(const [server,canUseTool] of [['meri_reads',m.readOptions.canUseTool],['meri_intents',m.intentOptions.canUseTool],['meri_original_reads',m.skill.canUseTool]])check((await canUseTool('mcp__other__tool',{},{})).message,`${server} denial`);
  check((await o.canUseTool('mcp__other__tool',{},{})).message,'the default denial');
  // The correlation hook's own denials (the run's read limit, a lost correlation) are read by the model too.
  const limited=createGeneralReadServer({available:m.available,unavailable:[],binding,budgets:{...GENERAL_READ_CEILINGS,maxToolCalls:1},timeoutMs:60000,deadlineMs:now()+60000,now,executionCatalogSha256:null,execute:async()=>'{}'});
  try{const hook=limited.hooks.PreToolUse[0].hooks[0],input=i=>({hook_event_name:'PreToolUse',session_id:'71000000-0000-4000-8000-000000000091',tool_name:limited.allowedTools[0],tool_use_id:`toolu_vocabulary_${i}`,tool_input:{arguments:{}}});
   assert.equal((await hook(input(0),undefined,{})).hookSpecificOutput.permissionDecision,undefined);
   const limit=(await hook(input(1),undefined,{})).hookSpecificOutput;assert.equal(limit.permissionDecision,'deny');check(limit.permissionDecisionReason,'the read limit denial');
   assert.match(limit.permissionDecisionReason,/^The Capiro data read limit for this run is reached; no further source can be read in this message\./u);
   const lost=(await hook({...input(2),tool_use_id:'not a tool use!'},undefined,{})).hookSpecificOutput;assert.equal(lost.permissionDecision,'deny');check(lost.permissionDecisionReason,'the correlation denial');
  }finally{await limited.close();}
  assert.ok(violations.length===0,violations.join('\n'));
  // The argument descriptions the model reads are projected too; the catalog bytes behind them are the pinned ones.
  const awards=reads.tools.find(t=>t.name==='search_federal_contract_awards');
  assert.ok(descriptions(awards.inputSchema).some(([,text])=>text.includes('must not infer ISO-8601 support from this contract')),'federal-market date bound');
  // The SQL-writing text keeps its technical term and the pinned argument name.
  const query=reads.tools.find(t=>t.name==='query_capiro_data'),describe=reads.tools.find(t=>t.name==='describe_capiro_data');
  assert.match(query.description,/SELECT or WITH \.\.\. SELECT over the tables describe_capiro_data lists/u);
  assert.match(describe.description,/with relations:\[\.\.\.\] to re-read specific tables/u);
  // Unavailability is a sentence about what the user can do, not a code.
  assert.match(o.systemPrompt.append,/say plainly that those records could not be read and what they can do next/u);
  assert.match(intents.instructions,/^Requests prepared for the user's approval in this conversation\./u);
 }finally{await m.reads.close();await m.intents.close();await m.skill.close();}
});

test('every closed read failure text, with each read\'s own next step, is in the user\'s terms and names neither a code nor the tool',()=>{
 // The model relays these texts (the 1 November "UNAVAILABLE" and tool-name leaks): the code stays in `failureCode`, never in the words.
 const before=violations.length,names=familyReads().map(row=>readToolName(row));
 for(const name of names)for(const code of READ_FAILURE_CODES){
  const text=failureResult(code,name).content[0].text;check(text,`${name} ${code}`);
  assert.doesNotMatch(text,/mcp__/u,`${name} ${code} names the tool`);
  for(const word of READ_FAILURE_CODES)assert.doesNotMatch(text,new RegExp(`\\b${word}\\b`,'u'),`${name} ${code} says ${word}`);
 }
 assert.equal(violations.length,before,violations.slice(before).join('\n'));
 assert.match(failureResult('UNAVAILABLE','mcp__meri_reads__read_bill_text').content[0].text,/could not be read right now and suggest trying again in a minute/u);
 assert.match(failureResult('SOURCE_UNAVAILABLE','mcp__meri_reads__read_bill_text').content[0].text,/not reachable right now and to try again in a minute/u);
});

test('every intent tool-result text, with the details the owners attach, is plain words after its closed code: no constant, key or code name',()=>{
 // The leading `CODE: tool` is the fixed closed answer the model reads; everything after it reaches the user as words. The owners'
 // own constants (SESSION_UNAVAILABLE, PREVIEW_ROUTE_NOT_FOUND, ROUTINES_STALE) travel as the fault's `reason` for the log only.
 const details={INVALID_ARGUMENTS:["data must have required property 'title'",'not a canonical request for this conversation: derived keys (the idempotency and operation keys) and identity fields are never supplied','the schedule request is not a canonical request'],
  REFUSED:['the proposal request was answered before any proposal was created (HTTP 404)','the proposal request was answered HTTP 4xx','the schedule service refused the request as it stands','the proposal request was answered with something other than a pending proposal'],
  UNAVAILABLE:['could not check whether this request can be prepared right now: preparing a request for the user\'s approval did not get an answer in time, so nothing was prepared. This is temporary, not a disabled capability; ask the user to try again in a new message']};
 const before=violations.length,tool='mcp__meri_intents__propose_research_portfolio_management';
 for(const code of INTENT_CODES)for(const detail of [undefined,...(details[code]??[])]){
  const text=intentFailureResult(code,tool,detail).content[0].text,words=text.replace(new RegExp('^'+code+': (whether )?'+tool+' ','u'),'');
  assert.notEqual(words,text,code+' starts with its code and the tool');
  check(words.replace(/\bACCESS_DENIED\b/u,'access denied'),code+(detail===undefined?'':' with detail'));
  assert.doesNotMatch(words,/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/u,code+' carries a constant: '+words);
  assert.doesNotMatch(words,/\b[a-z]+(?:[A-Z][a-z0-9]+)+\b/u,code+' carries a key name: '+words);
  assert.doesNotMatch(words,/mcp__/u,code+' names the tool again');
 }
 assert.equal(violations.length,before,violations.slice(before).join('\n'));
});

test('an access refusal tells the model to report it plainly, never to guess a cause or send the user to another conversation',()=>{
 // 2 Nov: a PDF request in a client conversation was refused and the model, reading "not permitted for this user, client or
 // conversation", told the user PDFs need a General conversation. No such rule exists; the owner's reason stays in control's log.
 const text=intentFailureResult('ACCESS_DENIED','mcp__meri_intents__request_document').content[0].text;
 assert.equal(text,'ACCESS_DENIED: mcp__meri_intents__request_document was refused by the current permission check, so nothing was prepared. Nothing has been changed. Tell the user it could not be prepared; do not guess a cause or send them to another conversation.');
 assert.doesNotMatch(text,/client or conversation/u);
});

test('the vocabulary projection is a closed map: catalog bytes are untouched and argument or field names never change',()=>{
 assert.equal(userVocabulary('the relations describe_capiro_data lists; relations:[...]; relationsUsed; UNKNOWN_RELATION; join relationships'),'the tables describe_capiro_data lists; relations:[...]; relationsUsed; UNKNOWN_RELATION; join relationships');
 assert.equal(userVocabulary('Propose governed memory. Mailbox provider acceptance is not proof of delivery; never claim delivery from acceptance. Explicit acceptance in Core.'),
  'Propose saved memory. Mailbox provider acknowledgement is not proof of delivery; never claim delivery from the provider\'s acknowledgement. Explicit approval in Core.');
 assert.equal(userVocabulary('established by a trusted gateway; authority remains with the gateway'),'established by a trusted run; authority remains with the trusted run');
 const descriptors=familyReads().map(row=>row.descriptor);
 assert.ok(descriptors.some(d=>/\brelations?\b/u.test(d.whenToUse)),'the frozen catalog still carries its own words');
});

/** The 2 November acceptance (Meri cut 5): "no grants relation in the text-to-SQL layer", "the SQL layer does not include a
 * SAM opportunities table", a data set name and a statement printed in a refusal, and "89 bills" with no bound. Every fixed
 * model-facing text of the two SQL reads that a refusal, an argument failure or a page notice can put in front of the model
 * is free of the data-model words, and the routing guidance states how a count names its bound. */
const SQL_BANNED=[...BANNED,/\btext-to-SQL\b/iu,/\bSQL layer\b/iu,/\btables?\b/iu];
const sqlCheck=(text,where)=>{for(const pattern of SQL_BANNED){const m=pattern.exec(text);if(m)violations.push(`${where} says "${m[0]}": ...${text.slice(Math.max(0,m.index-80),m.index+60)}...`);}};
test('the SQL reads\' refusal, failure and page-notice texts never say text-to-SQL, SQL layer, relation or table, and a refusal tells the model what the user hears instead',()=>{
 const before=violations.length,tools=['describe_capiro_data','query_capiro_data'];
 for(const [code,text] of Object.entries(SQL_REFUSAL_GUIDANCE))sqlCheck(text,`refusal guidance ${code}`);
 assert.match(SQL_REFUSAL_GUIDANCE.UNKNOWN_RELATION,/tell the user in plain words that this data is not available for structured queries yet and offer what is \(for example a search by topic\), without naming data sets, statements or methods/u);
 const envelope=(id,result)=>({binding:{},subject:{},operation:{id},argumentsSha256:'0'.repeat(64),result});
 const notices=(id,result)=>readNotices({id},JSON.stringify(envelope(id,result)),envelope(id,result)).map(n=>n.text);
 for(const id of tools){
  for(const code of READ_FAILURE_CODES)sqlCheck(failureResult(code,`mcp__meri_reads__${id}`).content[0].text,`${id} ${code}`);
  // The fixed parts of every refusal notice; PostgreSQL's own diagnostic line (its message, position, hint and nearest names) is quoted verbatim for the correction and is the one part this test does not own.
  for(const code of [...Object.keys(SQL_REFUSAL_GUIDANCE),'OTHER']){
   const [text,...rest]=notices(id,{version:'0.1.0',generatedAt:'2026-10-26T12:00:00.000Z',ok:false,error:{code,message:'x'}});
   assert.equal(rest.length,0);sqlCheck(text,`${id} refusal ${code}`);
   assert.match(text,/This notice is for correcting the request, never for the user: show them neither the statement nor this message, codes or data set and column names; if the request cannot be corrected, say in plain words which data could not be queried\. No evidence, absence or completeness is established\.$/u,`${id} ${code}`);
  }
  const diagnosed=notices(id,sqlRefusal())[0];assert.match(diagnosed,/PostgreSQL 42703: column b\.titel does not exist at character 8\. .* This notice is for correcting the request, never for the user/u);
 }
 for(const [where,page] of [['public describe',capiroDataPage('describe_capiro_data')],['client describe',privateCapiroDataPage('describe_capiro_data')],['query',capiroDataPage()],['empty query',{...capiroDataPage(),rows:[],rowCount:0}],['cut query',{...capiroDataPage(),rowLimitReached:true,byteTruncated:true}]]){
  const texts=notices(page.tool??(where.includes('describe')?'describe_capiro_data':'query_capiro_data'),page);assert.equal(texts.length,1,where);sqlCheck(texts[0],`${where} notice`);
 }
 for(const where of ['public describe','client describe'])assert.match(notices('describe_capiro_data',where==='public describe'?capiroDataPage('describe_capiro_data'):privateCapiroDataPage('describe_capiro_data'))[0],/These names are for writing queries, never for the user: when no described data set holds the subject asked about, tell the user in plain words that this data is not available for structured queries yet and offer what is \(for example a search by topic\)\.$/u);
 assert.equal(violations.length,before,violations.slice(before).join('\n'));
 // The count-bound rule and the user-terms ban sit in the SQL routing guidance of the system prompt, with the typed-reader sentence no longer inviting "which path" talk.
 const prompt=readPromptSentence(true,['mcp__meri_reads__describe_capiro_data','mcp__meri_reads__query_capiro_data']);
 assert.match(prompt,/A count states in one clause the bound it counted under \(Congress, date range, status or tracked set\)\./u);
 assert.match(prompt,/Never repeat internal status codes, capability, data set, table, column or layer names, SQL or words such as bounded, read-disabled or activity to the user/u);
 assert.doesNotMatch(prompt,/say which path you used/u);
});
