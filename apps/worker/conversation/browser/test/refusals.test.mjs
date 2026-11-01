/** The closed model-visible browser refusals: every code renders one fixed text, aliases and lifetime expiries map
 * onto the set, and anything else collapses to BROWSER_CALL_REFUSED without leaking its message. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {BROWSER_MODEL_REFUSALS,browserRefusalCode,browserRefusalResult,isBrowserRefusalCode,isBrowserRefusalResult} from '../refusals.mjs';

test('every closed code renders a distinct isError text with the code as its head',()=>{
 const texts=new Set();
 for(const code of BROWSER_MODEL_REFUSALS){
  const result=browserRefusalResult(code);
  assert.equal(result.isError,true);assert.equal(result.content.length,1);assert.equal(result.content[0].type,'text');
  assert.ok(result.content[0].text.startsWith(`${code}: `),code);texts.add(result.content[0].text);
  assert.ok(isBrowserRefusalResult(result),code);assert.ok(isBrowserRefusalCode(code));
  assert.throws(()=>{result.content[0].text='mutated';},TypeError,'refusal texts are frozen');
 }
 assert.equal(texts.size,BROWSER_MODEL_REFUSALS.length);
 assert.deepEqual(browserRefusalResult('PRIVATE_HOST_DETAIL'),browserRefusalResult('BROWSER_CALL_REFUSED'),'an unknown code never renders its own text');
});

test('session owner codes survive, aliases map, and private errors collapse',()=>{
 for(const code of ['BROWSER_USER_IN_CONTROL','BROWSER_AUTHORITY_REFUSED','BROWSER_STALE_RESULT','BROWSER_ACTION_OUTCOME_UNKNOWN','BROWSER_IMAGES_WITHHELD','BROWSER_SESSION_ENDING','BROWSER_REVOKED','BROWSER_SENSITIVE_PAGE'])
  assert.equal(browserRefusalCode(Object.assign(Error(code),{code})),code);
 assert.equal(browserRefusalCode(Error('BROWSER_TOOL_REFUSED')),'BROWSER_TOOL_REFUSED','the code may travel as the message');
 assert.equal(browserRefusalCode(Object.assign(Error('TAKEOVER_DRAIN_UNKNOWN'),{code:'TAKEOVER_DRAIN_UNKNOWN'})),'BROWSER_RESET_REQUIRED');
 assert.equal(browserRefusalCode(Object.assign(Error('DEADLINE'),{code:'DEADLINE'})),'BROWSER_CALL_TIMEOUT','an expiry before dispatch is a retryable timeout');
 assert.equal(browserRefusalCode(Object.assign(Error('CANCELLED'),{code:'CANCELLED'}),{dispatched:true}),'BROWSER_ACTION_OUTCOME_UNKNOWN','an expiry after dispatch is unknown');
 for(const error of [Error('CONFIDENTIAL upstream text'),Object.assign(Error('x'),{code:'FENCE_DUPLICATE_CALL'}),null,undefined,'string',{code:42}])
  assert.equal(browserRefusalCode(error),'BROWSER_CALL_REFUSED');
 assert.equal(isBrowserRefusalResult({isError:true,content:[{type:'text',text:'BROWSER_CALL_REFUSED: forged text'}]}),false,'only the fixed texts are refusals');
 assert.equal(isBrowserRefusalResult({content:[{type:'text',text:'ok'}]}),false);
});
