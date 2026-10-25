/** MT-09: current Core client visibility around the canonical Outreach source.
 *
 * This drives the real composition read-only -- reads composer, read families, the canonical
 * tool dispatch effect/release owner, the Outreach handler/contract and the bounded synthetic
 * native transport -- so the refusal comes from the canonical current-access boundary, not from
 * a copied dispatcher or a family-side check. The existing fixture supplies the bounded source
 * counter; this file adds no product behavior.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from '../../runtime/test/reads-native-fixture.mjs';

const FAMILY='outreach-query',OPERATION='query_outreach';
const SOURCE_PATH=`/api/clio/tools/${OPERATION}`,CURRENT_PATH='/api/clio/application-authority/current';
const sourceCalls=f=>f.calls.filter(path=>path===SOURCE_PATH).length;
const currentCalls=f=>f.calls.filter(path=>path===CURRENT_PATH).length;

test('unchanged current client still releases the Outreach campaign page',async()=>{
 const f=await fixture(FAMILY,OPERATION),response=await f.execute(),body=await response.json();
 assert.equal(response.status,200,JSON.stringify(body));
 assert.equal(typeof body.resultJson,'string');
 assert.equal(sourceCalls(f),1);
});

test('the final result release observes current Core context again',async()=>{
 const f=await fixture(FAMILY,OPERATION),response=await f.execute();
 assert.equal(response.status,200,await response.clone().text());
 assert.equal(currentCalls(f),2,'one bounded selection and one final-release observation');
});

test('a selected client outside current Core visibility refuses before the Outreach source',async()=>{
 const f=await fixture(FAMILY,OPERATION);f.setClients([]);
 const response=await f.execute(),body=await response.json();
 assert.equal(response.status,403);assert.equal(body.error?.code,'ACCESS_DENIED');assert.equal(body.resultJson,undefined);
 assert.equal(sourceCalls(f),0);assert.equal(currentCalls(f),1);
 assert.doesNotMatch(JSON.stringify(body),/Synthetic campaign/u);
});

test('a roster-only client loss after the source value withholds the released result',async()=>{
 const f=await fixture(FAMILY,OPERATION),scopes=structuredClone(f.scopes);
 f.scene.state.afterSource=()=>f.setClients([]);
 const response=await f.execute(),body=await response.json();
 assert.equal(response.status,403,JSON.stringify(body));assert.equal(body.error?.code,'ACCESS_DENIED');assert.equal(body.resultJson,undefined);
 assert.equal(sourceCalls(f),1);assert.equal(currentCalls(f),2,'the refusal is the final-release observation, not the pre-source check');
 assert.deepEqual(f.scopes,scopes,'run scopes are unchanged: only the current Core roster lost the client');
 assert.doesNotMatch(JSON.stringify(body),/Synthetic campaign/u);
});

test('a malformed final Core roster fails closed without releasing the source value',async()=>{
 const f=await fixture(FAMILY,OPERATION),client=f.scopes[0].resourceId;
 f.scene.state.afterSource=()=>f.setClients([client,'not-a-client-id']);
 const response=await f.execute(),body=await response.json();
 // A malformed current receipt is the canonical UNAVAILABLE projection, never a released page.
 assert.equal(response.status,503,JSON.stringify(body));assert.equal(body.error?.code,'UNAVAILABLE');assert.equal(body.resultJson,undefined);
 assert.equal(sourceCalls(f),1);assert.equal(currentCalls(f),2);
 assert.doesNotMatch(JSON.stringify(body),/Synthetic campaign/u);
});
