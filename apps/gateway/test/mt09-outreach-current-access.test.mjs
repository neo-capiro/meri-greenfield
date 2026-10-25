/** MT-09: current-client visibility around the canonical Outreach source.
 *
 * This drives the real composition read-only -- reads composer, read-families, the canonical
 * tool dispatch effect/release owner, the Outreach handler/contract and the bounded synthetic
 * native transport -- so the refusal comes from the canonical current-access boundary, not from
 * a copied dispatcher or a family-side check. The existing fixture supplies the bounded source
 * counter; no product file is changed by this file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from '../../runtime/test/reads-native-fixture.mjs';

const FAMILY='outreach-query',OPERATION='query_outreach';
const SOURCE_PATH=`/api/clio/tools/${OPERATION}`,CURRENT_PATH='/api/clio/application-authority/current';
const foreignClient='b1234567-b123-4c12-8d12-e123456789ab';
const sourceCalls=f=>f.calls.filter(path=>path===SOURCE_PATH).length;
const currentCalls=f=>f.calls.filter(path=>path===CURRENT_PATH).length;

test('unchanged current client still releases the Outreach campaign page',async()=>{
 const f=await fixture(FAMILY,OPERATION),response=await f.execute(),body=await response.json();
 assert.equal(response.status,200,JSON.stringify(body));
 assert.equal(typeof body.resultJson,'string');
 assert.equal(sourceCalls(f),1);assert.equal(currentCalls(f),1);
});

test('a selected client outside current Core visibility refuses before the Outreach source',async()=>{
 const f=await fixture(FAMILY,OPERATION);f.setClients([]);
 const response=await f.execute(),body=await response.json();
 assert.equal(response.status,403);assert.equal(body.error?.code,'ACCESS_DENIED');assert.equal(body.resultJson,undefined);
 assert.equal(sourceCalls(f),0);assert.equal(currentCalls(f),1);
});

test('a current client scope change while the Outreach source is awaited releases nothing',async()=>{
 const changes=[
  scopes=>{scopes.length=0;},
  scopes=>{scopes[0].resourceId=foreignClient;},
  scopes=>{scopes[0].kind='tenant';},
 ];
 for(const change of changes){
  const f=await fixture(FAMILY,OPERATION);f.scene.state.afterSource=()=>change(f.scopes);
  const response=await f.execute(),body=await response.json();
  assert.equal(response.status,403);assert.equal(body.error?.code,'ACCESS_DENIED');assert.equal(body.resultJson,undefined);
  assert.equal(sourceCalls(f),1);assert.equal(f.calls.at(-1),SOURCE_PATH);
  // The refusal is the release fence comparing the read context taken before entry.execute with
  // the one re-read after it; it is not a second Core current-authority round trip.
  assert.equal(currentCalls(f),1);
 }
});
