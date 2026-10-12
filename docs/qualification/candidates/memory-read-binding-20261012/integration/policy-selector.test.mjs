import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const source = process.env.POLICY_SOURCE_UNDER_REVIEW
  ? pathToFileURL(process.env.POLICY_SOURCE_UNDER_REVIEW)
  : new URL('../../../../../packages/contracts/retrieval-0.2/memory-review-policy.mjs', import.meta.url);
const {memoryReviewPolicyText} = await import(source);

test('wording selection refuses getters without evaluating them', () => {
  let effects = 0;
  const selection = {action: 'approve'};
  Object.defineProperty(selection, 'scope', {enumerable: true, get() {effects++; return 'firm';}});
  let refused = false;
  try { memoryReviewPolicyText(selection); } catch { refused = true; }
  assert.equal(effects, 0, 'caller getter ran');
  assert.equal(refused, true);
});

test('wording selection refuses proxies before caller traps execute', () => {
  let effects = 0;
  const selection = new Proxy({scope: 'client', action: 'approve'}, {
    ownKeys(target) { effects++; return Reflect.ownKeys(target); },
    get(target, key) { effects++; return Reflect.get(target, key); },
  });
  let refused = false;
  try { memoryReviewPolicyText(selection); } catch { refused = true; }
  assert.equal(effects, 0, 'caller proxy trap ran');
  assert.equal(refused, true);
});
