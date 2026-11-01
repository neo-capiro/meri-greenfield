/** What the model actually receives for the SQL, memory and mail reads, asserted on the production composition
 * (`model-view-fixture.mjs`): the registration-era catalog prose never reaches it, every argument, result field and
 * refusal it needs is stated once, and the routing sentence sends each kind of question to the right path. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderModelView,renderMarkdown} from './model-view-fixture.mjs';
import {MAX_DESCRIPTION} from '../tools.mjs';

const view=await renderModelView();
const tool=name=>{const found=view.tools.find(t=>t.name===name);assert.ok(found,name);return found;};
const STALE=/null handler|Pending (?:private )?contract only|no enabled source|adapter assertion|Local validation does not qualify|versions are unproven|optional versioned contract|older Core omits contract|contract grammar/iu;

test('the view lists exactly the six reads at their mounted versions and every description fits the SDK budget',()=>{
 assert.deepEqual(view.tools.map(t=>t.name).sort(),['describe_capiro_data','mail_list_messages','mail_read_thread','mail_search_messages','query_capiro_data','search_memory']);
 for(const t of view.tools){assert.ok(t.description.length<=MAX_DESCRIPTION,`${t.name} ${t.description.length}`);assert.doesNotMatch(t.description,STALE,t.name);assert.doesNotMatch(JSON.stringify(t.arguments),STALE,t.name);}
 assert.doesNotMatch(view.systemPrompt,STALE);assert.doesNotMatch(view.instructions,STALE);
 assert.match(view.instructions,/Available: .*Search memory.*Describe Capiro data.*Query Capiro data/);
 assert.ok(renderMarkdown(view).includes('## Tool `query_capiro_data`'));
});

test('text-to-SQL: the statement rules, parameters, result shape, refusal codes and routing are stated once each',()=>{
 const query=tool('query_capiro_data'),describe=tool('describe_capiro_data');
 for(const rule of [/one read-only PostgreSQL 16 SELECT or WITH \.\.\. SELECT/,/one query reads one source/,/INVALID_QUERY, UNSUPPORTED_SQL, UNKNOWN_RELATION, UNKNOWN_FIELD or PARAMETER_MISMATCH/,/Bind text, date, UUID and decimal values as \$1\.\.\$n/,
  /rowLimit default 200, max 1000, applied as an outer LIMIT/,/byteTruncated \(256 KiB cap\)/,/Page by keyset: ORDER BY the full key and WHERE key > \$n/,/Filter value_kind, position_cycle and asserted_fy before summing budget positions/])assert.match(query.description,rule);
 // The sql argument states the gate's rules in the schema the model fills in.
 const sql=JSON.stringify(query.arguments);
 assert.match(sql,/exactly one SELECT or WITH \.\.\. SELECT, run verbatim under a read-only role inside an outer LIMIT wrapper/);
 assert.match(sql,/Not allowed: a second statement, SET, SHOW, EXPLAIN, COPY, transaction control, INSERT, UPDATE, DELETE, MERGE, SELECT INTO, data-modifying CTEs, and administrative, sleep, lock, file or dblink functions/);
 assert.match(sql,/PostgreSQL reports its own errors with message, character position, hint, SQLSTATE and nearest published names/);
 assert.match(sql,/cast it \(\$1::date\) when the context does not fix the type/);
 assert.match(describe.description,/columns \(name, type, PostgreSQL pgType, nullable, unit, enum values, meaning\), primary key, declared join relationships, grain, coverage limitations and freshness field/);
 assert.match(describe.description,/Call it once before the first query of a conversation/);
 // The SQL tools are the destination of the SQL-first routing sentence, so neither tells the model to call itself.
 for(const t of [query,describe])assert.doesNotMatch(t.description,/Structured questions:/);
 assert.match(view.systemPrompt,/Structured questions about Capiro data .* go to describe_capiro_data once per conversation and then query_capiro_data/);
});

test('memory: scope per conversation kind, the page size, the result fields, attribution and the no-save rule are stated',()=>{
 const memory=tool('search_memory');
 for(const rule of [/clientId \(in a selected-client conversation the selected client's UUID.*null in General/,/Core returns at most 3 items per page and nextCursor continues/,/memoryItemId with contentCursor/,
  /payload carries title, type, scope \(personal, client or firm\), governance \(status, approvedAt, approvedByUserId, stale, validUntil\) and content/,/Attribute each item as saved memory by title, scope and approvedAt/,
  /pending proposals, rejected, withdrawn, revoked and superseded items are excluded, so an empty result is not proof/,/never say a memory was saved or remembered/,/fails the whole call as ACCESS_DENIED/])assert.match(memory.description,rule);
 assert.deepEqual(Object.keys(memory.arguments.properties),['query','clientId','k','cursor','memoryItemId','contentCursor']);
 assert.match(view.systemPrompt,/Saved knowledge: .* call search_memory first/);
 const texts=Object.fromEntries(view.notices.map(n=>[n.scenario,n.texts]));
 assert.match(texts['search_memory: one approved item'][0],/^Notice: 1 approved memory item\(s\) returned \(at most 3 per page\); contentStatus available\. Attribute each item as saved memory/);
 assert.match(texts['search_memory: empty recall'][0],/0 approved memory item\(s\).*not proof that nothing was saved or proposed/);
 assert.match(texts['search_memory: Core argument error'][0],/refused the arguments: Provide a search query\. Pass the topic or client as query text/);
 assert.match(texts['search_memory: ACCESS_DENIED'][0],/clientId must be that client's UUID, in General it must be null/);
 assert.match(texts['search_memory: UNAVAILABLE'][0],/Governed memory recall is not served/);
});

test('mail: the subject, filters, paging, candidate and thread fields, stale mailbox and refusals are stated',()=>{
 const search=tool('mail_search_messages'),list=tool('mail_list_messages'),thread=tool('mail_read_thread');
 for(const t of [search,list,thread])assert.match(t.description,/Stored mail of the user's connected mailbox \(Microsoft 365 or Google Workspace\) as last synchronized into Capiro: never the live inbox and never a send\. subject is \{kind:"personal"\} in General .* or \{kind:"client", entityId:<the selected client's UUID>\}/);
 assert.match(search.description,/query \(words in subject or body, up to 200 characters\), from \(sender name or address\), participant \(any sender or recipient\)/);
 assert.match(search.description,/At least one of query, from, participant, withinDays or a folder other than all is required/);
 assert.match(search.description,/"what did X last email us about" search from X .* "the last N threads with client Y"/);
 assert.match(list.description,/limit \(1-50 candidates per page, default 15\), offset \(nextOffset of the previous page\)/);
 for(const t of [search,list])assert.match(t.description,/subjectText, from \{name, email\}, to and cc .* preview\.text \(an incomplete excerpt, never the full body\), threadId, messageId, clientId, connectionStatus and readHandle; totalMatches, hasMore and nextOffset/);
 assert.match(thread.description,/threadId \(UUID of a candidate from a list or search\), messageId \(optional: start at this message\), messageOffset .* limit \(1-10 messages per read, default 3\), bodyOffset and maxCharacters \(1-6000, default 2000/);
 assert.match(thread.description,/bodyCompleteness \(full, preview, truncated, missing or unknown\) and section \{start, endExclusive, totalCodeUnits, text, hasMore\}/);
 assert.match(view.systemPrompt,/Email: .* mail_search_messages \(from, participant or query words\) or mail_list_messages \(recent mail\), then mail_read_thread/);
 const texts=Object.fromEntries(view.notices.map(n=>[n.scenario,n.texts]));
 assert.match(texts['mail_search_messages: one candidate from a disconnected mailbox'][0],/^Notice: 1 stored message candidate\(s\) of 2 matching; more exist, continue with offset 1\. Previews are incomplete excerpts.*Mailbox connection status disconnected: stored mail up to the last synchronization, possibly stale; the user can reconnect/);
 assert.match(texts['mail_search_messages: empty page'][0],/0 stored message candidate\(s\) of 0 matching\. An empty page is absence within this subject, folder, window and filter only, not proof that no email exists/);
 assert.match(texts['mail_search_messages: UNAVAILABLE (no mailbox)'][0],/No connected Microsoft 365 or Google Workspace mailbox is available for this user.*do not say that no email exists/);
 assert.match(texts['mail_search_messages: ACCESS_DENIED'][0],/use \{kind:"personal"\} in General and \{kind:"client", entityId\} only for the selected client/);
});

test('the describe orientation line names the relations and the retired contract envelope is never mentioned',()=>{
 const texts=Object.fromEntries(view.notices.map(n=>[n.scenario,n.texts]));
 assert.match(texts['describe_capiro_data: Core 362 describe envelope'][0],/^Notice: 1 public relation\(s\) described: program_elements\./);
 assert.match(texts['query_capiro_data: gate refusal UNSUPPORTED_SQL'][0],/Send exactly one statement that starts with SELECT or WITH \.\.\. SELECT/);
 for(const {texts} of view.notices)for(const text of texts)assert.doesNotMatch(text,/contract/);
});
