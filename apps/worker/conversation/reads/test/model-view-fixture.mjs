/** Exactly what the model receives for a set of reads, produced by the production composition: the `meri_reads`
 * server instructions and each tool's name, description and input schema as a real MCP client lists them, the
 * system-prompt sentence `options.mjs` appends for those tools, and the result notices `results.mjs` adds to sample
 * Core envelopes. `model-view.test.mjs` asserts on it; `node model-view-fixture.mjs > view.md` snapshots it
 * (docs/handover/20261101/READ-MODEL-VIEW-*.md). */
import {pathToFileURL} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {familyReads} from '../availability.mjs';
import {createGeneralReadServer} from '../server.mjs';
import {readPromptSentence} from '../options.mjs';
import {GENERAL_READ_CEILINGS} from '../budget.mjs';
import {failureResult,readNotices} from '../results.mjs';
import {capiroDataPage,sqlRefusal} from '../../../../gateway/sources/capiro-data/test/fixture.mjs';
import {createMailFixture} from '../../../../gateway/sources/mail/test/fixtures.mjs';
import {createClientKnowledgeFixture} from '../../../../gateway/sources/client-knowledge/test/fixtures.mjs';

export const DEFAULT_OPERATIONS=Object.freeze(['describe_capiro_data','query_capiro_data','search_memory','mail.list_messages','mail.search_messages','mail.read_thread']);
/** The catalog version the product mounts for each read (`preferredVersions`: the originals' replacement). */
export const MOUNTED_VERSIONS=Object.freeze({describe_capiro_data:'0.5.0',query_capiro_data:'0.5.0'});
const BINDING=Object.freeze({tenantId:'00000000-0000-4000-8000-000000000001',actorId:'00000000-0000-4000-8000-000000000002',conversationId:'00000000-0000-4000-8000-000000000003',runId:'00000000-0000-4000-8000-000000000004',attemptId:'00000000-0000-4000-8000-000000000005',workerId:'00000000-0000-4000-8000-000000000006',writerFence:1});

/** @param {readonly string[]} operations catalog operation ids */
export function mountedRows(operations=DEFAULT_OPERATIONS){
 const rows=familyReads().filter(row=>operations.includes(row.operation.id)&&row.operation.version===(MOUNTED_VERSIONS[row.operation.id]??'0.2.0'));
 if(rows.length!==operations.length)throw Error(`MODEL_VIEW_ROWS: ${rows.length} of ${operations.length} reads found`);
 return rows;
}
/** @param {{operations?:readonly string[]}} [options] */
export async function renderModelView({operations=DEFAULT_OPERATIONS}={}){
 const rows=mountedRows(operations),now=Date.now;
 const server=createGeneralReadServer({available:rows,unavailable:[],binding:BINDING,budgets:GENERAL_READ_CEILINGS,timeoutMs:60000,deadlineMs:now()+60000,now,executionCatalogSha256:null,execute:async()=>'{}'});
 const client=new Client({name:'model-view',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();
 try{
  await server.server.instance.connect(a);await client.connect(b);
  const {tools}=await client.listTools();
  return {instructions:client.getInstructions()??'',systemPrompt:readPromptSentence(true,server.allowedTools),
   tools:tools.map(t=>({name:t.name,description:t.description,arguments:t.inputSchema.properties.arguments})),notices:sampleNotices()};
 }finally{await client.close();await server.close();}
}
/** Result texts for representative Core envelopes and gateway failures, per read. */
export function sampleNotices(){
 const query={id:'query_capiro_data'},describe={id:'describe_capiro_data'},memory={id:'search_memory'};
 const wrap=(operation,result)=>({binding:BINDING,subject:{},operation,argumentsSha256:'0'.repeat(64),result});
 const notices=(operation,result)=>readNotices(operation,JSON.stringify(wrap(operation,result)),wrap(operation,result)).map(n=>n.text);
 // The mail handler returns the canonical page itself, not a {result} envelope.
 const mailNotices=page=>readNotices({id:'mail.search_messages'},JSON.stringify(page),page).map(n=>n.text);
 const emptyQuery={...capiroDataPage(),rows:[],rowCount:0};
 const mailFixture=createMailFixture('mail.search_messages'),mailPage=mailFixture.page();
 const emptyMail={...mailPage,messages:[],totalMatches:0,hasMore:false,nextOffset:null,continuation:{...mailPage.continuation,requiredReads:[]}};
 const memoryFixture=createClientKnowledgeFixture('search_memory'),memoryPage=memoryFixture.page();
 const emptyMemory={...memoryPage,results:[],records:[],contentStatus:'empty',summary:'0 governed memory item(s) returned.'};
 const samples=[
  ['describe_capiro_data: Core 362 describe envelope',notices(describe,capiroDataPage('describe_capiro_data'))],
  ['describe_capiro_data: unknown relation refusal',notices(describe,sqlRefusal({code:'UNKNOWN_RELATION',message:'congress_bill is not a published relation.',candidates:['congress_bills'],position:undefined,hint:undefined,sqlstate:undefined}))],
  ['query_capiro_data: two rows',notices(query,capiroDataPage())],
  ['query_capiro_data: zero rows',notices(query,emptyQuery)],
  ['query_capiro_data: PostgreSQL unknown column (42703)',notices(query,sqlRefusal())],
  ['query_capiro_data: gate refusal UNSUPPORTED_SQL',notices(query,sqlRefusal({code:'UNSUPPORTED_SQL',message:'Exactly one SELECT statement is required.',position:undefined,hint:undefined,sqlstate:undefined,candidates:undefined}))],
  ['query_capiro_data: PARAMETER_MISMATCH',notices(query,sqlRefusal({code:'PARAMETER_MISMATCH',message:'Every supplied parameter must be referenced, consecutively from $1.',position:undefined,hint:undefined,sqlstate:undefined,candidates:undefined}))],
  ['query_capiro_data: QUERY_TIMEOUT',notices(query,sqlRefusal({code:'QUERY_TIMEOUT',message:'The query exceeded its execution time limit. Narrow the query.',sqlstate:'57014',position:undefined,hint:undefined,candidates:undefined}))],
  ['search_memory: one approved item',notices(memory,memoryPage)],
  ['search_memory: empty recall',notices(memory,emptyMemory)],
  ['search_memory: Core argument error',notices(memory,{error:'Provide a search query.'})],
  ['mail_search_messages: one candidate from a disabled mailbox',mailNotices(mailPage)],
  ['mail_search_messages: empty page',mailNotices(emptyMail)],
  ['mail_search_messages: UNAVAILABLE (no mailbox)',[failureResult('UNAVAILABLE','mcp__meri_reads__mail_search_messages').content[0].text]],
  ['mail_search_messages: ACCESS_DENIED',[failureResult('ACCESS_DENIED','mcp__meri_reads__mail_search_messages').content[0].text]],
  ['search_memory: ACCESS_DENIED',[failureResult('ACCESS_DENIED','mcp__meri_reads__search_memory').content[0].text]],
  ['search_memory: UNAVAILABLE',[failureResult('UNAVAILABLE','mcp__meri_reads__search_memory').content[0].text]],
  ['query_capiro_data: INVALID_ARGUMENTS',[failureResult('INVALID_ARGUMENTS','mcp__meri_reads__query_capiro_data').content[0].text]],
 ];
 return samples.map(([scenario,texts])=>({scenario,texts}));
}
/** @param {Awaited<ReturnType<typeof renderModelView>>} view */
export function renderMarkdown(view){
 const lines=['# What the model receives for the data, memory and mail reads','','Rendered from the production composition (`reads/server.mjs`, `reads/tools.mjs`, `reads/options.mjs`, `reads/results.mjs`) by `reads/test/model-view-fixture.mjs`. Reads: '+view.tools.map(t=>`\`${t.name}\``).join(', ')+'.','',
  '## System prompt sentence (`readPromptSentence`)','',view.systemPrompt,'','## `meri_reads` server instructions','',view.instructions,''];
 for(const t of view.tools)lines.push(`## Tool \`${t.name}\``,'','### Description','',t.description,'','### Input schema (`arguments`)','','```json',JSON.stringify(t.arguments,null,1),'```','');
 lines.push('## Result notices and failure texts','');
 for(const {scenario,texts} of view.notices){lines.push(`### ${scenario}`,'');lines.push(texts.length?texts.map(t=>`> ${t}`).join('\n\n'):'_(no notice)_');lines.push('');}
 return lines.join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 process.stdout.write(renderMarkdown(await renderModelView()));
}
