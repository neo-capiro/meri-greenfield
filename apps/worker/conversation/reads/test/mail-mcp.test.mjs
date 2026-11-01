/** Mail as the model experiences it: the real MCP server, worker HTTP, control composer and gateway mail adapter over
 * scripted Core pages. Connected, empty, denied, no-mailbox and stale-mailbox paths each read as what they are. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {generalReadFixture,mountReads} from './fixture.mjs';
const text=r=>r.content[0].text;
const corePaths=f=>f.calls.filter(p=>p.startsWith('/api/clio/tools/'));

test('every mail tool states its stored-mail source, subject rule and arguments in its description',async()=>{
 const f=await generalReadFixture(),m=await mountReads(f);
 try{const {tools}=await m.client.listTools();
  for(const t of tools)assert.match(t.description,/Stored mail of the user's connected mailbox \(Microsoft 365 or Google Workspace\) as last synchronized into Capiro: never the live inbox and never a send\./,t.name);
  const search=tools.find(t=>t.name==='mail_search_messages'),thread=tools.find(t=>t.name==='mail_read_thread');
  assert.match(search.description,/At least one of query, from, participant, withinDays or a folder other than all is required/);
  assert.match(thread.description,/bodyCompleteness \(full, preview, truncated, missing or unknown\)/);
  for(const t of tools)assert.doesNotMatch(t.description,/Pending contract only|Pending\/null handler|versions are unproven/,t.name);
 }finally{await m.close();}
});

test('a connected search returns the page plus one notice with counts, continuation and the mailbox state',async()=>{
 const f=await generalReadFixture(),m=await mountReads(f);
 try{const r=await m.call('mail_search_messages',f.search);assert.equal(r.isError,undefined,JSON.stringify(r));
  const page=JSON.parse(text(r));assert.equal(page.kind,'mail-candidate-source-page');assert.equal(page.messages.length,1);
  assert.equal(r.content[1].text,'Notice: 1 stored message candidate(s) of 2 matching; more exist, continue with offset 1. Previews are incomplete excerpts: read a thread with mail_read_thread before quoting or summarizing its content. Mailbox connection status disabled: stored mail up to the last synchronization, possibly stale; the user can reconnect the mailbox in Capiro\'s mail integration settings.');
 }finally{await m.close();}
});

test('an empty page is absence within its filter only',async()=>{
 const f=await generalReadFixture();f.source.state.total=0;const m=await mountReads(f);
 try{const r=await m.call('mail_search_messages',f.search);assert.equal(r.isError,undefined,JSON.stringify(r));
  assert.deepEqual(JSON.parse(text(r)).messages,[]);
  assert.equal(r.content[1].text,'Notice: 0 stored message candidate(s) of 0 matching. An empty page is absence within this subject, folder, window and filter only, not proof that no email exists; widen withinDays or the folder, or search by from or participant.');
  assert.equal(corePaths(f).length,1);
 }finally{await m.close();}
});

test('no connected mailbox reads as UNAVAILABLE with the connect hint, before any Core mail request',async()=>{
 const f=await generalReadFixture();f.rows(rows=>rows.filter(row=>row.provider==='zoom'));const m=await mountReads(f);
 try{const r=await m.call('mail_search_messages',f.search);assert.equal(r.isError,true);
  assert.match(text(r),/^UNAVAILABLE: mcp__meri_reads__mail_search_messages is not enabled, installed or served/);
  assert.match(text(r),/No connected Microsoft 365 or Google Workspace mailbox is available for this user, or stored mail is not served in this conversation\. Tell the user to connect their mailbox in Capiro's mail integration settings; do not say that no email exists\. No evidence, absence or completeness is established\.$/);
  assert.deepEqual(corePaths(f),[]);assert.deepEqual(m.runtime.receipts(),[]);
 }finally{await m.close();}
});

test('another client\'s subject is a denied scope with the subject rule, never an empty page',async()=>{
 const f=await generalReadFixture(),m=await mountReads(f);
 try{const r=await m.call('mail_search_messages',{...f.search,subject:{kind:'client',entityId:'71000000-0000-4000-8000-000000000999'}});
  assert.equal(r.isError,true);assert.match(text(r),/^ACCESS_DENIED: mcp__meri_reads__mail_search_messages is not permitted/);
  assert.match(text(r),/use \{kind:"personal"\} in General and \{kind:"client", entityId\} only for the selected client\. Do not retry with another client\./);
  assert.deepEqual(corePaths(f),[]);
 }finally{await m.close();}
});

test('an unrestricted search is refused with the filter rule',async()=>{
 const f=await generalReadFixture(),m=await mountReads(f);
 try{const r=await m.call('mail_search_messages',{subject:{kind:'personal'}});
  assert.equal(r.isError,true);assert.match(text(r),/^INVALID_ARGUMENTS: mcp__meri_reads__mail_search_messages /);
  assert.match(text(r),/at least one filter among query \(1-200 characters\), from, participant, withinDays \(1-3650\) or folder \(inbox or sent\)/);
  assert.deepEqual(corePaths(f),[]);
 }finally{await m.close();}
});

test('a thread read reports its message count, incomplete body sections and the mailbox state',async()=>{
 const f=await generalReadFixture({id:'mail.read_thread'}),m=await mountReads(f);
 try{const r=await m.call('mail_read_thread',f.source.args);assert.equal(r.isError,undefined,JSON.stringify(r));
  const page=JSON.parse(text(r));assert.equal(page.kind,'mail-thread-source-page');assert.equal(page.messages[0].section.hasMore,true);
  assert.equal(r.content[1].text,'Notice: 1 message(s) of 1 in this thread. 1 body section(s) are incomplete: continue with the listed nextBodyOffsets before quoting, and say what was not read. Mailbox connection status disabled: stored mail up to the last synchronization, possibly stale; the user can reconnect the mailbox in Capiro\'s mail integration settings.');
 }finally{await m.close();}
});
