/** D1 envelope: one value set across Node owner, Python proxy and the SDK request ceiling; exact boundary admits, +1 refuses. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PRODUCT_MAX_INPUT_TOKENS,PRODUCT_MAX_OUTPUT_TOKENS} from './product-envelope.mjs';
import {decodeReservationFrame,decodeSettlementFrame} from './product-boundary-codec.mjs';
import {buildConversationOptions} from '../../worker/conversation/options.mjs';
import {binding as runBinding,versions} from '../../control/conversations/test/application-fixture.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const raw=Buffer.from('{"prompt":"synthetic"}'),native=Buffer.from('{"anthropic_version":"bedrock-2023-05-31"}');
const binding=['tenant','actor','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444',1];
const wire=frame=>Buffer.from(JSON.stringify(frame));
const reservation=count=>['meri.proxy.reservation/1',['request_A',binding,9000000000000],
 ['request_A',[[...binding],'arn:aws:ecs:synthetic','grant_A',1],'synthetic-product-bearer-000000001',raw.toString('base64'),
  ['POST','https://example.test/invoke','example.test','application/json',native.toString('base64'),[['host','example.test'],['content-type','application/json']]],
  [count,sha(native),'anthropic.claude-sonnet-4-6','aws-counttokens']]];
const settlement=(counted,maxOutput,output)=>['meri.proxy.settlement/1','request_A',
 ['COMPLETE',['request_A',sha(native),sha(raw),'b'.repeat(64),counted,maxOutput,['local_echo']],'e'.repeat(64),counted,output,'COMPLETE_NATIVE_MESSAGE','native-usage-data']];

test('D1 values are 64k input / 8k output and match the Python proxy envelope exactly',()=>{
 assert.deepEqual([PRODUCT_MAX_INPUT_TOKENS,PRODUCT_MAX_OUTPUT_TOKENS],[65536,8192]);
 const py=readFileSync(new URL('../../proxy/qualification/runtime/bedrock_body.py',import.meta.url),'utf8');
 assert.equal(Number(/^ENVELOPE_MAX_INPUT_TOKENS = (\d+)$/m.exec(py)?.[1]),PRODUCT_MAX_INPUT_TOKENS);
 assert.equal(Number(/^ENVELOPE_MAX_OUTPUT_TOKENS = (\d+)$/m.exec(py)?.[1]),PRODUCT_MAX_OUTPUT_TOKENS);
});

test('the boundary codec admits the exact envelope and refuses one token past it',()=>{
 assert.equal(decodeReservationFrame(wire(reservation(PRODUCT_MAX_INPUT_TOKENS))).observation.count.inputTokens,PRODUCT_MAX_INPUT_TOKENS);
 assert.throws(()=>decodeReservationFrame(wire(reservation(PRODUCT_MAX_INPUT_TOKENS+1))));
 assert.doesNotThrow(()=>decodeSettlementFrame(wire(settlement(PRODUCT_MAX_INPUT_TOKENS,PRODUCT_MAX_OUTPUT_TOKENS,PRODUCT_MAX_OUTPUT_TOKENS))));
 assert.throws(()=>decodeSettlementFrame(wire(settlement(PRODUCT_MAX_INPUT_TOKENS+1,16,1))));
 assert.throws(()=>decodeSettlementFrame(wire(settlement(12,PRODUCT_MAX_OUTPUT_TOKENS+1,1))));
 assert.throws(()=>decodeSettlementFrame(wire(settlement(12,16,17))),'output above the bound max_tokens refuses');
});

test('the SDK subprocess is pinned to the envelope output ceiling with thinking off',()=>{
 const runtime={binding:runBinding,versions,cwd:`/meri/workspaces/${runBinding.conversationId}`,proxyUrl:'https://trusted-proxy.invalid',proxyCredential:'synthetic-task-capability',
  model:'qualified-model-pin',sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+1000,maxTurns:2,maxCostMicroUSD:2_000_000,maxOutputBytes:1024};
 const o=buildConversationOptions(runtime,new AbortController());
 assert.equal(o.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS,String(PRODUCT_MAX_OUTPUT_TOKENS));assert.equal(o.env.MAX_THINKING_TOKENS,'0');
 assert.equal(o.maxBudgetUsd,2,'the D1 per-run $2 allocation reaches the SDK budget unchanged');
});
