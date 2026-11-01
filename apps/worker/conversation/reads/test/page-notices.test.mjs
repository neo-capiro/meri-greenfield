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
