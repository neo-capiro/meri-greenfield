import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hotPathBudgets} from '../../../packages/runtime/hot-path-budgets.mjs';

test('the Python-only image fixture contains the canonical table without requiring Node in the proxy image',()=>{
 const actual=JSON.parse(readFileSync(new URL('./test/budget-fixture.json',import.meta.url),'utf8'));
 const {roots}=actual;
 const expected=hotPathBudgets({limits:{startupMs:roots.startup.ms,shutdownMs:roots.shutdown.ms,requestMs:roots.request.ms},
  runWindowMs:roots.turn.ms,originalExpiresAtMs:roots.original.expiresAtMs});
 assert.deepEqual(actual,expected);
});
