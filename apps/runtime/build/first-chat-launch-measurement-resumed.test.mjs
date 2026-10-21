/** The resumed probe's gate fails at build for a release whose next turn would be refused at prepare: here the worker's temporary root
 * (run-temporary-root.mjs) is withheld, as on 96b6da6d, so the SDK materializes the resumed session under os.tmpdir() and the task
 * receiver's descriptor policy refuses its CLAUDE_CONFIG_DIR (live 2026-10-21, candidate 9, conversation 307e2e94: REMOTE_TASK_REFUSED).
 * Linux only, like the in-image measurement. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const inputs={proxyUrl:'https://proxy.meri.internal:8443',model:'us.anthropic.claude-sonnet-4-6',maxTurns:3,maxCostMicroUSD:2000000,maxOutputBytes:262144,
 configParentDirectory:'/run/meri',secureStorageDirectory:'/run/meri/sdk-secure',policyRevision:'e'.repeat(64)};

test('without the worker\'s temporary root the resumed descriptor is refused and the measurement says so',{skip:process.platform!=='linux'&&'the in-image measurement is Linux'},async()=>{
 mock.module(new URL('../native-authority/run-temporary-root.mjs',import.meta.url).href,{namedExports:{holdRunTemporaryRoot:()=>()=>{}}});
 const {measureFirstChatLaunch}=await import('./first-chat-launch-measurement.mjs');
 const r=await measureFirstChatLaunch(inputs,{root});
 assert.match(r.gates.resumedDescriptor,/^FAIL: the task receiver's descriptor policy refuses CLAUDE_CONFIG_DIR under \//u);
 assert.notEqual(r.resumedProbe.configDirectoryParent,'/run/meri');
 // Every other gate is unaffected: only the next turn would have failed.
 for(const [k,v] of Object.entries(r.gates))if(k!=='resumedDescriptor')assert.equal(v,'PASS',k);
});
