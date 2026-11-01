/** Orientation notices on canonical pages that the scripted MCP fixtures cannot produce: thread bodies that are missing or
 * unknown (nothing continues them) versus cut bodies (nextBodyOffsets continue them), and the mailbox state per message. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readNotices} from '../results.mjs';
import {createMailFixture} from '../../../../gateway/sources/mail/test/fixtures.mjs';
const thread={id:'mail.read_thread'};
const notice=page=>readNotices(thread,JSON.stringify(page),page)[0]?.text;
const base=createMailFixture('mail.read_thread').page();
const message=changes=>({...base.messages[0],...changes});

test('a cut body continues; a missing or unknown body is reported as not available and never continued',()=>{
 const cut=notice({...base,messages:[message({bodyCompleteness:'truncated'})]});
 assert.match(cut,/1 body section\(s\) are incomplete: continue with the listed nextBodyOffsets/);assert.doesNotMatch(cut,/not available/);
 for(const completeness of ['missing','unknown']){
  const text=notice({...base,messages:[message({bodyCompleteness:completeness,section:{...base.messages[0].section,hasMore:false}})],nextBodyOffsets:[]});
  assert.match(text,/^Notice: 1 message\(s\) of 1 in this thread\. 1 message body\(ies\) are not available in stored mail \(missing or unknown\): report that the body could not be read; nothing continues them\. Mailbox connection status disabled/,completeness);
  assert.doesNotMatch(text,/nextBodyOffsets/,completeness);
 }
 const mixed=notice({...base,messages:[message({bodyCompleteness:'full',section:{...base.messages[0].section,hasMore:true}}),message({bodyCompleteness:'missing',connectionStatus:'connected'})],totalMessages:2});
 assert.match(mixed,/2 message\(s\) of 2 in this thread\. 1 body section\(s\) are incomplete: continue with the listed nextBodyOffsets before quoting, and say what was not read\. 1 message body\(ies\) are not available/);
});

test('a connected mailbox adds no stale hint; the mailbox state is read only from returned messages',()=>{
 const connected=notice({...base,messages:[message({connectionStatus:'connected',bodyCompleteness:'full',section:{...base.messages[0].section,hasMore:false}})]});
 assert.equal(connected,'Notice: 1 message(s) of 1 in this thread.');
 assert.match(notice({...base,messages:[message({connectionStatus:'needs_configuration'})]}),/Mailbox connection status needs_configuration: stored mail up to the last synchronization, possibly stale; the user can reconnect the mailbox/);
});

test('an empty candidate page says stale only when the source state says so, with its synchronization time',()=>{
 const search={id:'mail.search_messages'},candidates=createMailFixture('mail.search_messages'),page=candidates.page();
 const empty={...page,messages:[],totalMatches:0,hasMore:false,nextOffset:null,continuation:{...page.continuation,requiredReads:[]}};
 const text=p=>readNotices(search,JSON.stringify(p),p)[0].text;
 assert.equal(text(empty),'Notice: 0 stored message candidate(s) of 0 matching. An empty page is absence within this subject, folder, window and filter only, not proof that no email exists; widen withinDays or the folder, or search by from or participant.');
 const stale={...empty,sources:[{...empty.sources[0],freshness:'stale',synchronizedAt:'2026-10-01T00:00:00.000Z'}]};
 assert.match(text(stale),/\. The mail source reports its stored mail as stale \(last synchronized 2026-10-01T00:00:00\.000Z\); the user can reconnect the mailbox in Capiro's mail integration settings\.$/);
 const unknownWhen={...empty,sources:[{...empty.sources[0],freshness:'stale'}]};
 assert.match(text(unknownWhen),/stale \(last synchronized at an unknown time\)/);
 assert.doesNotMatch(text({...empty,sources:[{...empty.sources[0],freshness:'fresh',synchronizedAt:'2026-11-01T00:00:00.000Z'}]}),/stale/);
});
