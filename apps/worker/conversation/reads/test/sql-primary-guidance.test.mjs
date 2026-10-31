import test from 'node:test';
import assert from 'node:assert/strict';
import {readPromptSentence} from '../options.mjs';

const prefix='mcp__meri_reads__';
const describe=prefix+'describe_capiro_data',query=prefix+'query_capiro_data';

test('SQL-primary policy is admitted only with both actual query tools',()=>{
 for(const tools of [[],[describe],[query]]){
  assert.doesNotMatch(readPromptSentence(true,tools),/primary retrieval path|Before querying/);
 }
 assert.equal(readPromptSentence(false,[describe,query]),'No institutional source tool is enabled for this activity.');
 const prompt=readPromptSentence(true,[describe,query]);
 assert.match(prompt,/primary retrieval path.*covered by the published relations/);
 assert.match(prompt,/describe_capiro_data first.*author SELECT SQL.*bound parameters/);
});

test('SQL-primary guidance retains semantic scope, failure and provenance boundaries',()=>{
 const prompt=readPromptSentence(true,[describe,query]);
 for(const requirement of [
  /clarify any ambiguity.*client, jurisdiction, measure, fiscal versus calendar period, currency or units/,
  /aggregate parent amounts before joining child rows/,
  /denied, unavailable, timed-out or invalid SQL query is not an empty result/,
  /must not trigger broader or unscoped retrieval/,
  /another enabled authorized reader only when.*do not cover.*original document\/web evidence/,
  /generatedAt is query time, not source freshness/,
  /missing sourceAsOf\/sourceVersion stays unknown/,
  /clientId only narrows access and never grants it/,
  /rowLimitReached, byteTruncated and authored LIMIT separately/,
  /derived SQL rows and aggregates are not immutable source passages/,
 ])assert.match(prompt,requirement);
 assert.doesNotMatch(prompt,/Use read_saved_record/);
});
