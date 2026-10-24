/** Actual adapter and SDK command classes; only S3 storage is synthetic. No credentials or network. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {createS3RetentionLedgerSink} from '../s3-ledger.mjs';
import {createRetentionLedger} from '../ledger.mjs';
import {captureRuntimePorts} from '../../../runtime/product-applications.mjs';

const kmsKeyId='arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001';
const subject={tenantId:'synthetic-tenant',kind:'conversation',subjectId:'00000000-0000-4000-8000-000000000002',ownerActorId:'synthetic-actor'};
const request=(state='SUPPRESSED')=>({subject,state,facts:{reason:'synthetic'}});
const fault=(name,status)=>Object.assign(new Error(name),{name,$metadata:{httpStatusCode:status}});
function fixture(options={}){
 const versions=new Map(),calls=[],streams=[];let current=null,count=0;
 const mode={versioning:'Enabled',loseWrite:false,writeError:null,stall:false,deleteMarker:false};
 const client={async send(command,{abortSignal}={}){
  const i=command.input,name=command.constructor.name;calls.push({name,input:i});
  assert.equal(i.Bucket,'synthetic-retention-bucket');assert.equal(i.ExpectedBucketOwner,'111122223333');assert.ok(abortSignal instanceof AbortSignal);
  if(name==='GetBucketVersioningCommand')return {Status:mode.versioning};
  assert.equal(i.Key,'synthetic-prefix/retention/ledger.json');
  if(name==='GetObjectCommand'){
   const value=versions.get(i.VersionId??current);
   if(!value){const error=fault('NoSuchKey',404);if(mode.deleteMarker)error.DeleteMarker=true;throw error;}
   const Body=mode.stall?new Readable({read(){}}):Readable.from([Buffer.from(value.body)]);streams.push(Body);
   return {...value.response,Metadata:{...value.metadata},ContentLength:value.body.length,Body};
  }
  assert.equal(name,'PutObjectCommand');
  if(mode.writeError)throw mode.writeError;
  if(current===null?i.IfNoneMatch!=='*':i.IfMatch!==versions.get(current).response.ETag)throw fault('PreconditionFailed',412);
  assert.equal(i.ServerSideEncryption,'aws:kms');assert.equal(i.SSEKMSKeyId,kmsKeyId);assert.equal(i.ChecksumType,'FULL_OBJECT');
  assert.equal(i.ChecksumSHA256,createHash('sha256').update(i.Body).digest('base64'));
  current=`native-version-${++count}`;
  const response={VersionId:current,ETag:`\"etag-${count}\"`,ChecksumSHA256:i.ChecksumSHA256,ChecksumType:'FULL_OBJECT',ServerSideEncryption:i.ServerSideEncryption,SSEKMSKeyId:i.SSEKMSKeyId};
  versions.set(current,{body:Buffer.from(i.Body),metadata:{...i.Metadata},response});
  if(mode.loseWrite){mode.loseWrite=false;throw fault('ConnectionClosed',500);}
  return {...response};
 }};
 const sink=createS3RetentionLedgerSink({client,bucket:'synthetic-retention-bucket',prefix:'synthetic-prefix',expectedBucketOwner:'111122223333',kmsKeyId,now:Date.now,...options});
 return {sink,ledger:createRetentionLedger({sink,now:Date.now}),mode,versions,calls,streams};
}

test('empty current head and ordered immutable-version replay survive a new ledger owner',async()=>{
 const f=fixture();assert.deepEqual(await f.ledger.head(),{sequence:0,entrySha256:null});assert.deepEqual(await f.ledger.replay(),[]);
 const first=await f.ledger.append(request()),second=await f.ledger.append(request('RELEASED'));
 assert.equal(first.sequence,1);assert.equal(second.sequence,2);
 const fresh=createRetentionLedger({sink:f.sink,now:Date.now});assert.deepEqual(await fresh.replay(),[first,second]);
 assert.deepEqual(await fresh.head(),{sequence:2,entrySha256:second.entrySha256});
 assert.equal(JSON.parse(f.versions.get('native-version-2').body).previousVersionId,'native-version-1');
 assert.ok(f.streams.every(stream=>stream.destroyed),'every native response stream is retired');
});

test('two concurrent appends use CAS and retain both transitions in a contiguous sequence',async()=>{
 const f=fixture();const rows=await Promise.all([f.ledger.append(request()),f.ledger.append(request('RELEASED'))]);
 assert.deepEqual(rows.map(row=>row.sequence).sort(),[1,2]);assert.equal((await f.ledger.replay()).length,2);
 assert.equal(f.calls.filter(c=>c.name==='PutObjectCommand').length,3,'only the definite conflict retries');
});

test('a lost committed write acknowledgement refuses the caller, then ordinary recovery sees it once',async()=>{
 const f=fixture();f.mode.loseWrite=true;await assert.rejects(f.ledger.append(request()),/RETENTION_LEDGER_UNACKNOWLEDGED/);
 assert.equal(f.calls.filter(c=>c.name==='PutObjectCommand').length,1);
 const fresh=createRetentionLedger({sink:f.sink,now:Date.now});assert.equal((await fresh.replay()).length,1);assert.equal((await fresh.head()).sequence,1);
 await fresh.append(request('RELEASED'));assert.deepEqual((await fresh.replay()).map(row=>row.sequence),[1,2]);
});

test('a write failure other than a proven conflict never retries',async()=>{
 const f=fixture();f.mode.writeError=fault('ServiceUnavailable',503);
 await assert.rejects(f.ledger.append(request()),/RETENTION_LEDGER_UNACKNOWLEDGED/);
 assert.equal(f.calls.filter(c=>c.name==='PutObjectCommand').length,1);assert.equal(f.versions.size,0);
});

test('disabled bucket versioning refuses before a write',async()=>{
 const f=fixture();f.mode.versioning='Suspended';await assert.rejects(f.ledger.append(request()),/RETENTION_LEDGER_UNACKNOWLEDGED/);
 assert.equal(f.calls.filter(c=>c.name==='PutObjectCommand').length,0);
});

test('current serving head and captured optional port need one GET regardless of retained history',async()=>{
 const f=fixture();for(let i=0;i<8;i++)await f.ledger.append(request(i%2?'RELEASED':'SUPPRESSED'));
 f.calls.length=0;const captured=captureRuntimePorts({retentionLedgerSink:f.sink});
 const ledger=createRetentionLedger({sink:captured.retentionLedgerSink,now:Date.now});assert.equal((await ledger.head()).sequence,8);
 assert.deepEqual(f.calls.map(c=>c.name),['GetObjectCommand']);assert.equal(f.calls[0].input.VersionId,undefined);
});

test('missing historical version, corrupt bytes and delete markers cannot become an empty ledger',async()=>{
 const missing=fixture();await missing.ledger.append(request());await missing.ledger.append(request('RELEASED'));
 missing.versions.delete('native-version-1');await assert.rejects(missing.ledger.replay(),/NoSuchKey/);
 const corrupt=fixture();await corrupt.ledger.append(request());corrupt.versions.get('native-version-1').body[0]=0;
 await assert.rejects(corrupt.ledger.head(),/RETENTION_LEDGER_CORRUPT/);
 assert.ok(corrupt.streams.every(stream=>stream.destroyed));
 const deleted=fixture();deleted.mode.deleteMarker=true;await assert.rejects(deleted.ledger.head(),/NoSuchKey/);
});

test('replay byte limit and blocked response stream fail boundedly and retire the stream',async()=>{
 const limited=fixture({maxReplayBytes:1});await limited.ledger.append(request());await assert.rejects(limited.ledger.replay(),/RETENTION_LEDGER_LIMIT/);
 const blocked=fixture({maxRequestMs:100});await blocked.ledger.append(request());blocked.mode.stall=true;
 // Keep the test alive while the production deadline timer intentionally does not hold the process open.
 const keepAlive=setInterval(()=>{},20);try{await assert.rejects(blocked.ledger.head(),/ARTIFACT_STORAGE_/);}finally{clearInterval(keepAlive);}
 assert.ok(blocked.streams.every(stream=>stream.destroyed));
});

test('optional head rejects malformed positions and older sinks retain replay behavior',async()=>{
 for(const head of [{sequence:0,entrySha256:'a'.repeat(64)},{sequence:1,entrySha256:null},{sequence:-1,entrySha256:null},{sequence:1,entrySha256:'x'}]){
  const ledger=createRetentionLedger({sink:{append:async()=>{},read:async()=>assert.fail('no full replay'),head:async()=>head},now:Date.now});
  await assert.rejects(ledger.head(),/RETENTION_LEDGER_CORRUPT/);
 }
 let reads=0;const old=createRetentionLedger({sink:{append:async()=>{},read:async()=>{reads++;return [];}},now:Date.now});
 assert.deepEqual(await old.head(),{sequence:0,entrySha256:null});assert.equal(reads,1);
});
