/** The Core PR87 token extension is limited to the eleven retained source reads.
 * These are pure contract checks: no token is issued and no source is called. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {SIGNED_RETAINED_SOURCE_OPERATIONS} from '../../../../gateway/sources/retained-reads/signed-source-operations.mjs';
import {READ_DELEGATION_ROUTES,tokenRequest,toolRoute} from '../contract.mjs';

const sourceVersions=Object.freeze({
 read_monday_client_boards:'0.2.0',get_client_context:'0.3.0',resolve_entity:'0.2.0',
 'mail.list_messages':'0.2.0','mail.search_messages':'0.2.0','mail.read_thread':'0.2.0',
 'meeting.list_upcoming_meetings':'0.2.0','meeting.query_debriefs':'0.2.0','meeting.read_client_meetings':'0.2.0',
 read_client_documents:'0.2.0',find_contacts:'0.2.0',
});
const SHA={body:'1'.repeat(64),arguments:'2'.repeat(64),correlation:'a'.repeat(64)};
const tool=(operation,extra={})=>tokenRequest({kind:'tool',callKey:'owned_retained_1',path:toolRoute(operation),
 bodySha256:SHA.body,operation,argumentsSha256:SHA.arguments,...extra});
const denied=error=>error?.message==='INVALID_ARGUMENTS'||error?.message==='ACCESS_DENIED';

test('only the eleven exact retained source versions carry a closed correlation claim',()=>{
 assert.deepEqual(SIGNED_RETAINED_SOURCE_OPERATIONS,sourceVersions);
 for(const [id,version] of Object.entries(sourceVersions)){
  const operation={id,version},request=tool(operation,{correlationSha256:SHA.correlation});
  assert.deepEqual(Object.keys(request).sort(),[
   'argumentsSha256','bodySha256','callKey','correlationSha256','kind','method','operation','path',
   'referenceSha256','retryOf','schemaVersion','toolRequestSha256'].sort(),id);
  assert.deepEqual(request.operation,operation,id);
  assert.equal(request.correlationSha256,SHA.correlation,id);
  assert.equal(request.path,`/api/clio/tools/${id}`,id);
  assert.throws(()=>tool(operation),denied,`${id} without correlation`);
  for(const invalid of [null,'',SHA.correlation.toUpperCase(),'x'.repeat(64)])
   assert.throws(()=>tool(operation,{correlationSha256:invalid}),denied,`${id} with malformed correlation`);
 }
 assert.throws(()=>tool({id:'get_client_context',version:'0.2.0'},{correlationSha256:SHA.correlation}),denied,
  'the original profile version cannot inherit the successor token claim');
});

test('legacy tools and non-tool token kinds omit correlation entirely',()=>{
 const legacy={id:'search_tracked_bills',version:'0.2.0'};
 const request=tool(legacy);
 assert.equal(Object.hasOwn(request,'correlationSha256'),false);
 assert.throws(()=>tool(legacy,{correlationSha256:SHA.correlation}),denied);
 const common={callKey:'owned_retained_1',bodySha256:SHA.body,correlationSha256:SHA.correlation};
 const nonTools=[
  {kind:'current',path:'/api/clio/application-authority/read-delegations/11111111-1111-4111-8111-111111111111/current'},
  {kind:'mode',path:READ_DELEGATION_ROUTES.mode,operation:{id:'search_federal_grants',version:'0.2.0'},toolRequestSha256:SHA.arguments},
  {kind:'reference',path:READ_DELEGATION_ROUTES.reference,referenceSha256:SHA.arguments},
 ];
 for(const kind of nonTools)assert.throws(()=>tokenRequest({...common,...kind}),denied,kind.kind);
});

test('lost-response retry identity includes the signed correlation digest',()=>{
 const operation={id:'read_client_documents',version:'0.2.0'};
 const first=tool(operation,{correlationSha256:SHA.correlation});
 const digest=canonicalSha256(first);
 const retry=tool(operation,{correlationSha256:SHA.correlation,retryOf:digest});
 assert.equal(first.retryOf,null);
 assert.equal(retry.retryOf,digest);
 assert.equal(canonicalSha256({...retry,retryOf:null}),digest);
 assert.notEqual(canonicalSha256({...first,correlationSha256:'4'.repeat(64)}),digest,
  'a changed correlation cannot reuse the original retry identity');
 assert.notEqual(canonicalSha256({...first,bodySha256:'5'.repeat(64)}),digest,
  'a changed exact body cannot reuse the original retry identity');
});
