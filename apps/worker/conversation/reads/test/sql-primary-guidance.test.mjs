/** The system-prompt sentence routes questions to the mounted tools and says nothing a tool description already says. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readPromptSentence} from '../options.mjs';

const prefix='mcp__meri_reads__';
const describe=prefix+'describe_capiro_data',query=prefix+'query_capiro_data',memory=prefix+'search_memory';
const mail=['mail_list_messages','mail_search_messages','mail_read_thread'].map(name=>prefix+name);

test('SQL routing is admitted only with both actual query tools, and only as routing',()=>{
 for(const tools of [[],[describe],[query]])assert.doesNotMatch(readPromptSentence(true,tools),/Structured questions about Capiro data/);
 assert.equal(readPromptSentence(false,[describe,query]),`Capiro's data is not connected in this conversation: tell the user so in their own terms and answer from general knowledge with that caveat. Never quote internal words such as bounded, read-disabled, UNAVAILABLE, tool or activity to the user, and never recommend a third-party API or scraping as a workaround.`);
 const prompt=readPromptSentence(true,[describe,query]);
 assert.match(prompt,/Structured questions about Capiro data .* go to describe_capiro_data once per conversation and then query_capiro_data/);
 assert.match(prompt,/public is the default source and clientId only narrows access/);
 assert.match(prompt,/settle any ambiguity that changes the answer \(client, fiscal versus calendar period, units, budget cycle\)/);
 assert.match(prompt,/A refusal names its correction: fix the SQL and run it again, and never switch to another source/);
 assert.match(prompt,/Use a typed reader only when the described relations do not cover the question/);
 assert.match(prompt,/query-bounded rows, not source completeness; generatedAt is query time/);
 // The retired contract envelope and the per-tool argument and result detail stay out of the prompt.
 assert.doesNotMatch(prompt,/contract grammar|rowLimitReached|byteTruncated|keyset|legacy global query tools|Use read_saved_record/);
 assert.ok(prompt.length<1500,`${prompt.length} characters`);
});

test('memory and mail routing follow their mounted tools and never claim completeness',()=>{
 assert.doesNotMatch(readPromptSentence(true,[describe,query]),/Saved knowledge|Email:/);
 const recall=readPromptSentence(true,[memory]);
 assert.match(recall,/Saved knowledge: when the user asks what Meri, they or the firm have saved, noted or remembered .* call search_memory first/);
 assert.match(recall,/attribute each item as saved memory by title, scope and approval date/);
 assert.match(recall,/only prepares a proposal for the user's approval: never say a memory was saved or remembered/);
 for(const tool of mail){
  const prompt=readPromptSentence(true,[tool]);
  assert.match(prompt,/Email: .* come from the mail tools, never from memory or SQL/);
  assert.match(prompt,/mail_read_thread for a thread's body before quoting it/);
  assert.match(prompt,/stored mail of the connected mailbox up to its last synchronization, not the live inbox, and an empty page is not proof that no email exists/);
 }
 const all=readPromptSentence(true,[describe,query,memory,...mail]);
 assert.ok(all.indexOf('Structured questions')<all.indexOf('Saved knowledge')&&all.indexOf('Saved knowledge')<all.indexOf('Email:'),'SQL, then memory, then mail');
});

test('the user hears about disconnected or refused Capiro data in their own terms, never in harness vocabulary',()=>{
 const none=readPromptSentence(false,[describe,query]),mounted=readPromptSentence(true,[describe,query,memory,...mail]);
 assert.match(none,/^Capiro's data is not connected in this conversation: tell the user so in their own terms and answer from general knowledge with that caveat\./);
 assert.match(mounted,/When a call answers UNAVAILABLE or ACCESS_DENIED, tell the user in their own terms that this Capiro data is not connected or not permitted in this conversation and answer from general knowledge with that caveat\./);
 for(const prompt of [none,mounted])assert.match(prompt,/Never quote internal words such as bounded, read-disabled, UNAVAILABLE, tool or activity to the user, and never recommend a third-party API or scraping as a workaround\./);
 assert.doesNotMatch(none,/bounded session|read-disabled here|return UNAVAILABLE|ProPublica/);
 assert.equal(none.split(/\.\s/).length,2,'two sentences');
});
