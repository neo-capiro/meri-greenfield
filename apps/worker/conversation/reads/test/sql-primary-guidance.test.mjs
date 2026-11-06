/** The system-prompt sentence routes questions to the mounted tools and says nothing a tool description already says. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readPromptSentence} from '../options.mjs';

const prefix='mcp__meri_reads__';
const describe=prefix+'describe_capiro_data',query=prefix+'query_capiro_data',memory=prefix+'search_memory';
const mail=['mail_list_messages','mail_search_messages','mail_read_thread'].map(name=>prefix+name);

test('SQL routing is admitted only with both actual query tools, and only as routing',()=>{
 for(const tools of [[],[describe],[query]])assert.doesNotMatch(readPromptSentence(true,tools),/Structured questions about Capiro data/);
 assert.equal(readPromptSentence(false,[describe,query]),`Capiro's data is not connected in this conversation: tell the user so in their own terms, answer only what is not specific to Capiro's or the client's records, and say plainly that those records could not be read. Omit internal codes, schema names, SQL and harness jargon by default. If explicitly requested, show the actual SQL or predicate used, label unexecuted proposals and give only verified matching examples. Explain refusals plainly; never suggest a third-party API or scraping as a workaround.`);
 const prompt=readPromptSentence(true,[describe,query]);
 assert.match(prompt,/Structured questions about Capiro data .* go to describe_capiro_data once per source and then query_capiro_data/);
 assert.match(prompt,/public is the default source and clientId only narrows access/);
 assert.match(prompt,/Settle any ambiguity that changes the answer \(client, fiscal versus calendar period, units, budget cycle\) before querying\./);
 assert.match(prompt,/A refusal names its correction: fix the SQL and run it again, and never switch to another source/);
 assert.match(prompt,/Use a typed reader only when the described data sets do not cover the question/);
 assert.match(prompt,/query-bounded rows, not source completeness; generatedAt is query time/);
 // 2 November acceptance: "89 bills" named no Congress, window or tracked set, and the typed-reader sentence invited "which path" talk.
 assert.match(prompt,/A count states in one clause the bound it counted under \(Congress, date range, status or tracked set\)\./);
 assert.doesNotMatch(prompt,/say which path you used|not source freshness|to evade a refusal/);
 // The retired contract envelope and the per-tool argument and result detail stay out of the prompt.
 assert.doesNotMatch(prompt,/contract grammar|rowLimitReached|byteTruncated|keyset|legacy global query tools|Use read_saved_record/);
 // 3,300: the no-gap-filling and government-forecast sentences (2 November acceptance R06, R07) added about 520 characters.
 // 3,600: the list-answer, freshness and no-file-talk sentence (2 November forecasts acceptance) added about 370 characters.
 assert.ok(prompt.length<3600,`${prompt.length} characters`);
 assert.match(prompt,/A "which" or "list" question is answered with the records \(for forecasts: title, agency or RIN, window, stage\) and the total: all of them up to about 30, otherwise about 20 representative ones and an offer of the rest, with a count by month, agency or stage only when asked or as a short overview of a large set\. When currency matters, state when Capiro last checked a public source \(its freshness field\)\. Never mention result files, JSON or shell commands\./);
});

const DATE_BASIS='When a question asks for the most recent, latest, newest or oldest records without naming a date, rank by the latest action or activity date when the data has one and otherwise by the introduction or creation date, say in one clause which date the ranking used, and when two plausible dates would change the answer say so in one sentence.';
test('ranked "most recent" questions name the date they ranked by, with the SQL routing they govern',()=>{
 for(const tools of [[],[describe],[query],[memory],[...mail]])assert.ok(!readPromptSentence(true,tools).includes(DATE_BASIS),'only with both query tools');
 const prompt=readPromptSentence(true,[describe,query]);
 assert.equal(prompt.split(DATE_BASIS).length-1,1,'once');
 assert.ok(prompt.indexOf('Structured questions about Capiro data')<prompt.indexOf(DATE_BASIS),'after the SQL routing');
 assert.ok(prompt.indexOf(DATE_BASIS)<readPromptSentence(true,[describe,query,memory]).indexOf('Saved knowledge'),'before memory routing');
 assert.equal(DATE_BASIS.split(/\.\s/).length,1,'one sentence');
});

const REFUSED_OR_EMPTY='A refused or empty read is reported as exactly that: never answer about the user\'s records from your own knowledge in its place, and never say that data does not exist unless the query that would show it ran and returned nothing.';
const SHOWN_DATA='Numbers in prose must agree with the table or figures you show; summarise a trend from those numbers and state the actual high and low. When the data lacks a field the answer needs (for example names), say so before ranking or inferring, and keep facts about the world (for example two senators per state) consistent with the data shown.';
test('answers about records are bound to what the mounted reads returned, whichever reads are mounted',()=>{
 for(const tools of [[],[describe,query],[memory],[...mail]]){const prompt=readPromptSentence(true,tools);assert.ok(prompt.includes(REFUSED_OR_EMPTY),'refused or empty');assert.ok(prompt.includes(SHOWN_DATA),'shown data');
  assert.equal(prompt.split(REFUSED_OR_EMPTY).length-1,1);assert.equal(prompt.split(SHOWN_DATA).length-1,1);
  assert.ok(prompt.indexOf('UNAVAILABLE or ACCESS_DENIED')<prompt.indexOf(REFUSED_OR_EMPTY)&&prompt.indexOf(REFUSED_OR_EMPTY)<prompt.indexOf(SHOWN_DATA),'after the refusal terms, before routing');}
 // Without reads there is nothing returned to bind to: the disconnected sentence alone applies.
 const none=readPromptSentence(false,[describe,query]);assert.doesNotMatch(none,/refused or empty read|Numbers in prose/);
});

test('memory and mail routing follow their mounted tools and never claim completeness',()=>{
 assert.doesNotMatch(readPromptSentence(true,[describe,query]),/Saved knowledge|Email:/);
 const recall=readPromptSentence(true,[memory]);
 assert.match(recall,/Saved knowledge: when the user asks what Meri, they or the firm have saved, noted or remembered .* call search_memory first/);
 assert.match(recall,/attribute each item as saved memory by title, scope and approval date/);
 assert.match(recall,/happens only through a request the user approves in Meri; until then nothing is stored, so never say a memory was saved or remembered/);
 for(const tool of mail){
  const prompt=readPromptSentence(true,[tool]);
  assert.match(prompt,/Email: .* come from the stored-mail reads, never from memory or SQL/);
  assert.match(prompt,/mail_read_thread for a thread's body before quoting it/);
  assert.match(prompt,/stored mail of the connected mailbox up to its last synchronization, not the live inbox, and an empty page is not proof that no email exists/);
 }
 const all=readPromptSentence(true,[describe,query,memory,...mail]);
 assert.ok(all.indexOf('Structured questions')<all.indexOf('Saved knowledge')&&all.indexOf('Saved knowledge')<all.indexOf('Email:'),'SQL, then memory, then mail');
});

test('the user hears about disconnected or refused Capiro data in their own terms, never in harness vocabulary',()=>{
 const none=readPromptSentence(false,[describe,query]),mounted=readPromptSentence(true,[describe,query,memory,...mail]);
 assert.match(none,/^Capiro's data is not connected in this conversation: tell the user so in their own terms, answer only what is not specific to Capiro's or the client's records, and say plainly that those records could not be read\./);
 assert.match(mounted,/When a read answers that it is not connected or not permitted, tell the user in their own terms that this Capiro data is not connected or not permitted for this conversation, answer only what is not specific to Capiro's or the client's records, and say plainly that those records could not be read and what they can do next\./);
 assert.doesNotMatch(mounted,/general knowledge|prepares a proposal|Core /,'no invented client facts, no internals');
 for(const prompt of [none,mounted])assert.match(prompt,/Omit internal codes, schema names, SQL and harness jargon by default\. If explicitly requested, show the actual SQL or predicate used, label unexecuted proposals and give only verified matching examples\. Explain refusals plainly; never suggest a third-party API or scraping as a workaround\./);
 assert.doesNotMatch(none,/bounded session|read-disabled here|return UNAVAILABLE|ProPublica/);
 assert.equal(none.split(/\.\s/).length,4,'disconnected context plus technical-request exception');
});
