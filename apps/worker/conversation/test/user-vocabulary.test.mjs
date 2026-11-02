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
import {GENERAL_READ_CEILINGS} from '../reads/budget.mjs';
import {createIntentServer} from '../intents/server.mjs';
import {INTENT_ROWS} from '../intents/catalog.mjs';
import {userVocabulary} from '../user-vocabulary.mjs';
import {createOriginalSkillServer} from '../skills/mcp.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';

/** Words the user must never hear back. Codes are matched exactly (UNAVAILABLE, ACCESS_DENIED); words case-insensitively.
 * `relations:` is the pinned argument name of describe_capiro_data and is allowed; "table" is the SQL-writing term. */
const BANNED=[/\bgoverned\b/iu,/\bgateway\b/iu,/\brelations?\b(?!:)/iu,/\btool names?\b/iu,/\bUNAVAILABLE\b/u,/\bACCESS_DENIED\b/u,/\bscheduler interface\b/iu,/\bbounded session\b/iu,/\bacceptance\b/iu];
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
 return {reads,intents,skill,
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
  assert.ok(RESPONSE_STYLE.includes('Describe capabilities by what they do for the user, never by their internal name; when something is unavailable say what the user can do next.'));
  assert.ok(o.systemPrompt.append.includes(RESPONSE_VOICE));
  const reads=await listed(m.reads.server),intents=await listed(m.intents.server),skill=await listed(m.skill.server);
  assert.ok(reads.tools.length>=100&&intents.tools.length>=20&&skill.tools.length>=1,`${reads.tools.length} reads, ${intents.tools.length} intents, ${skill.tools.length} skill reads`);
  check(reads.instructions,'the reads instructions');check(intents.instructions,'the intents instructions');check(skill.instructions,'the selected-skill instructions');
  for(const t of [...reads.tools,...intents.tools,...skill.tools]){check(t.description,t.name);for(const [path,text] of descriptions(t.inputSchema))check(text,`${t.name} ${path}`);}
  for(const [server,canUseTool] of [['meri_reads',m.readOptions.canUseTool],['meri_intents',m.intentOptions.canUseTool],['meri_original_reads',m.skill.canUseTool]])check((await canUseTool('mcp__other__tool',{},{})).message,`${server} denial`);
  check((await o.canUseTool('mcp__other__tool',{},{})).message,'the default denial');
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

test('the vocabulary projection is a closed map: catalog bytes are untouched and argument or field names never change',()=>{
 assert.equal(userVocabulary('the relations describe_capiro_data lists; relations:[...]; relationsUsed; UNKNOWN_RELATION; join relationships'),'the tables describe_capiro_data lists; relations:[...]; relationsUsed; UNKNOWN_RELATION; join relationships');
 assert.equal(userVocabulary('Propose governed memory. Mailbox provider acceptance is not proof of delivery; never claim delivery from acceptance. Explicit acceptance in Core.'),
  'Propose saved memory. Mailbox provider acknowledgement is not proof of delivery; never claim delivery from the provider\'s acknowledgement. Explicit approval in Core.');
 assert.equal(userVocabulary('established by a trusted gateway; authority remains with the gateway'),'established by a trusted run; authority remains with the trusted run');
 const descriptors=familyReads().map(row=>row.descriptor);
 assert.ok(descriptors.some(d=>/\brelations?\b/u.test(d.whenToUse)),'the frozen catalog still carries its own words');
});
