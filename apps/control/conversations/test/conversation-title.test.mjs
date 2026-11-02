import test from 'node:test';import assert from 'node:assert/strict';
import {derivedConversationTitle,UNNAMED_CONVERSATION_TITLE} from '../history/conversation-title.mjs';
test('the derived title keeps the first six words, trimmed, without edge punctuation',()=>{
 assert.equal(derivedConversationTitle('  What changed in the FY27 defense budget this week?  '),'What changed in the FY27 defense');
 assert.equal(derivedConversationTitle('Summarize HR 1234.'),'Summarize HR 1234');
 assert.equal(derivedConversationTitle('"Anduril meeting brief"'),'Anduril meeting brief');
 assert.equal(derivedConversationTitle('one\n\ttwo   three'),'one two three');
});
test('a prompt with no words yields no title, and a long word is bounded',()=>{
 for(const prompt of ['',' \n ','...','?!',null,undefined,42])assert.equal(derivedConversationTitle(prompt),null);
 const title=derivedConversationTitle('x'.repeat(200));assert.equal(title.length,80);
 assert.equal(derivedConversationTitle('a '.repeat(10)+'b'),'a a a a a a');
 assert.equal(UNNAMED_CONVERSATION_TITLE,'New conversation');
});
