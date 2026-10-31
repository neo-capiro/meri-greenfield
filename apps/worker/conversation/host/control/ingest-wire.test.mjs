/** The named download-ingest wire: closed envelope, byte/base64 agreement and the publication ACK shape. Pure
 * protocol checks over the canonical validators; no socket, TLS, database or artifact write. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assertHostAllocation} from '../binding.mjs';
import {binding as fixtureBinding} from '../../browser/test/fixtures.mjs';
import {hostIngestRequest,hostIngestResponse,HOST_INGEST_REQUEST_SCHEMA,HOST_INGEST_RESPONSE_SCHEMA,
 HOST_INGEST_MAX_BYTES,HOST_INGEST_WIRE_MAX_BYTES} from './protocol.mjs';
import {INTENT_OPERATIONS} from '../../../../runtime/artifacts/core-authority-wire.mjs';

const NOW=1700000000000,binding={...fixtureBinding};
const allocation=assertHostAllocation({schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,
 conversationId:binding.conversationId,generation:3,hostId:'11111111-1111-4111-8111-111111111111',
 imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:NOW+600000});
const hostIdentity={schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef',
 bootId:'77777777-7777-4777-8777-777777777777',conversationId:binding.conversationId,hostId:allocation.hostId};
const nonce='b'.repeat(64),body=Buffer.from('hello download\n');
const sha256=b=>createHash('sha256').update(b).digest('hex');
const request=over=>({schema:HOST_INGEST_REQUEST_SCHEMA,allocation,binding,hostIdentity,nonce,
 ingest:{filename:'notes.txt',format:'txt',mimeType:'text/plain; charset=utf-8',sha256:sha256(body),
  origin:'https://records.example',bytesBase64:body.toString('base64'),...over}});
const answer=over=>({schema:HOST_INGEST_RESPONSE_SCHEMA,nonce,versionId:'00000000-0000-4000-8000-000000000001',
 sha256:sha256(body),bytes:body.length,idempotencyKey:'c'.repeat(64),checkedAtMs:NOW,currentUntilMs:NOW+5000,...over});

test('a bounded request round-trips the exact bytes and derives no authority from the caller',()=>{
 const q=hostIngestRequest(request());
 assert.equal(q.ingest.bytesBase64,body.toString('base64'));
 assert.equal(q.ingest.bytes,undefined,'the internal form carries no Buffer');
 assert.equal(q.ingest.sha256,sha256(body));
 assert.ok(HOST_INGEST_WIRE_MAX_BYTES>HOST_INGEST_MAX_BYTES,'base64 and envelope are additive');
 // The request carries no scopes, policy digest, acquisition time or idempotency key at all.
 for(const forbidden of ['scopes','policySha256','acquiredAtMs','idempotencyKey','deadlineMs'])
  assert.equal(Object.hasOwn(q.ingest,forbidden),false,forbidden);
});

test('the ingest request refuses tampered bytes, types and envelope identity',()=>{
 const cases=[
  request({sha256:'0'.repeat(64)}),
  request({mimeType:'application/zip'}),
  request({format:'exe'}),
  request({filename:'../etc/passwd'}),
  request({origin:'https://records.example/path'}),
  request({bytesBase64:Buffer.from('other').toString('base64'),sha256:sha256(body)}),
  {...request(),nonce:'not-a-nonce'},
  {...request(),schema:'meri-host-ingest-request/2'},
 ];
 cases.forEach((value,n)=>assert.throws(()=>hostIngestRequest(value),`case ${n}`));

});

test('the answer is only the publication ACK for THIS request',()=>{
 const q=hostIngestRequest(request());
 assert.equal(hostIngestResponse(answer(),q).versionId,'00000000-0000-4000-8000-000000000001');
 for(const bad of [answer({sha256:'0'.repeat(64)}),answer({bytes:body.length+1}),
  answer({nonce:'d'.repeat(64)}),answer({currentUntilMs:NOW}),answer({idempotencyKey:'short'})])
  assert.throws(()=>hostIngestResponse(bad,q));
});

test('a reviewed browser download is admitted as an artifact generation intent',()=>{
 assert.deepEqual(INTENT_OPERATIONS['browser-import'],['artifact.generate']);
});
