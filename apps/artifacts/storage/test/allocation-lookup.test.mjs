/** Actual SDK command classes with synthetic responses only. No AWS/list/storage action. Exhaustion never proves final absence. */
import test from 'node:test';import assert from 'node:assert/strict';
import {GetBucketVersioningCommand,HeadObjectCommand,ListObjectVersionsCommand} from '../s3-sdk.mjs';
import {createS3ArtifactObjects} from '../s3-objects.mjs';import {v} from '../boundary.mjs';import {custodyFixture} from '../../test/preview-custody-fixture.mjs';
const kmsKeyId='arn:aws:kms:us-east-1:111122223333:key/22222222-2222-4222-8222-222222222222';
function fixture(){const f=custodyFixture(),calls=[],state={pages:null,heads:null,lists:0,mutate:null,park:false},prefix=`meri-artifacts/${v.hash(f.claim.scopes)}/${f.claim.objectId}/`,key=prefix+f.source.version.object.sha256;
 const version={Key:key,VersionId:'synthetic-native-1',Size:f.bytes.length,IsLatest:true,LastModified:new Date(f.state.now)};
 const client={async send(command,options){calls.push({command,options});if(command instanceof GetBucketVersioningCommand)return {Status:'Enabled'};
   if(command instanceof ListObjectVersionsCommand){if(state.park)return new Promise(()=>{});const page=state.pages?await state.pages(command.input,state.lists++):{Versions:[version],DeleteMarkers:[],IsTruncated:false};return page;}
   assert.ok(command instanceof HeadObjectCommand,'observation must remain read-only');const result={VersionId:command.input.VersionId,ContentLength:f.bytes.length,ChecksumSHA256:Buffer.from(f.source.version.object.sha256,'hex').toString('base64'),ChecksumType:'FULL_OBJECT',ServerSideEncryption:'aws:kms',SSEKMSKeyId:kmsKeyId,
    Metadata:{objectid:f.claim.objectId,contentsha256:f.source.version.object.sha256,scopessha256:v.hash(f.claim.scopes),requestsha256:v.hash({preview:f.claim.versionId,sourceSha256:f.claim.sourceSha256})}};state.mutate?.(result);return result;}};
 const create=options=>createS3ArtifactObjects({client,bucket:'synthetic-preview-bucket',prefix:'meri-artifacts',expectedBucketOwner:'111122223333',kmsKeyId,now:()=>f.state.now,maxRequestMs:200,...options});
 return {...f,calls,stateLookup:state,prefix,key,version,createObjects:create,observe:options=>create(options).observeAllocation({claim:f.claim,source:f.source})};
}

test('synthetic allocation lookup: exact retained allocation, native metadata, two stable passes and no absence/purge authority',async()=>{
 const f=fixture(),result=await f.observe();assert.equal(result.versions[0].versionId,'synthetic-native-1');assert.equal(result.complete,false);assert.equal(result.terminalAbsent,false);
 assert.equal(result.paginationExhausted,true);assert.equal(result.claimSha256,v.hash(f.claim));assert.equal(result.pages.length,1);
 const lists=f.calls.filter(c=>c.command instanceof ListObjectVersionsCommand);assert.equal(lists.length,2);assert.ok(lists.every(c=>c.command.input.Prefix===f.prefix&&c.command.input.ExpectedBucketOwner==='111122223333'));
 assert.ok(f.calls.every(c=>c.options.abortSignal instanceof AbortSignal));assert.ok(f.calls.filter(c=>c.command instanceof HeadObjectCommand).every(c=>c.command.input.VersionId==='synthetic-native-1'));
});

test('synthetic allocation lookup: complete empty observations remain nonterminal while UNKNOWN put can finish later',async()=>{
 const f=fixture();f.stateLookup.pages=()=>({IsTruncated:false,Versions:[],DeleteMarkers:[]});const result=await f.observe();assert.deepEqual(result.versions,[]);assert.equal(result.terminalAbsent,false);assert.equal(result.complete,false);
 assert.equal(result.reason,'NATIVE_LISTING_HAS_NO_SNAPSHOT_OR_WRITER_CLOSURE');f.stateLookup.pages=null;assert.equal((await f.observe()).versions.length,1);
});

test('synthetic allocation lookup: bounded stable multi-page versions and relevant native delete markers are retained',async()=>{
 const f=fixture(),marker={Key:f.key,VersionId:'synthetic-marker',IsLatest:false,LastModified:new Date(f.state.now-1)};
 f.stateLookup.pages=input=>input.KeyMarker?{IsTruncated:false,Versions:[],DeleteMarkers:[marker]}:{IsTruncated:true,NextKeyMarker:f.key,NextVersionIdMarker:'synthetic-native-1',Versions:[f.version]};
 const result=await f.observe();assert.equal(result.pages.length,2);assert.equal(result.deleteMarkers[0].versionId,marker.VersionId);assert.equal(result.complete,false);
});

test('synthetic allocation lookup: cursor loop, duplicate native identity, truncated and overflowing pages never release inventory',async()=>{
 for(const kind of ['loop','duplicate','truncated','overflow']){const f=fixture();f.stateLookup.pages=()=>kind==='loop'?{IsTruncated:true,NextKeyMarker:f.key,NextVersionIdMarker:'same',Versions:[]}:
   kind==='duplicate'?{IsTruncated:false,Versions:[f.version,f.version]}:kind==='truncated'?{IsTruncated:true,Versions:[f.version]}:
   {IsTruncated:false,Versions:Array.from({length:129},(_,i)=>({...f.version,VersionId:'native-'+i}))};await assert.rejects(f.observe(),/ALLOCATION_UNKNOWN|INVENTORY_UNAVAILABLE/);}
});

test('synthetic allocation lookup: out-of-prefix or malformed version identity and changed scope/request metadata refuse',async()=>{
 for(const kind of ['prefix','null-version','scope','request','marker']){const f=fixture();if(kind==='prefix')f.version.Key='foreign/'+f.key;if(kind==='null-version')f.version.VersionId='null';
  if(kind==='scope')f.stateLookup.mutate=r=>r.Metadata.scopessha256='0'.repeat(64);if(kind==='request')f.stateLookup.mutate=r=>r.Metadata.requestsha256='0'.repeat(64);if(kind==='marker')f.stateLookup.mutate=r=>r.DeleteMarker=true;
  await assert.rejects(f.observe());}
});

test('synthetic allocation lookup: unstable traversal and permission denial never become absence',async()=>{
 const f=fixture();f.stateLookup.pages=(input,n)=>({IsTruncated:false,Versions:n===0?[f.version]:[]});await assert.rejects(f.observe(),/ALLOCATION_UNSTABLE/);
 const denied=fixture();denied.stateLookup.pages=()=>{throw Object.assign(Error('synthetic denied'),{$metadata:{httpStatusCode:403}});};await assert.rejects(denied.observe(),/synthetic denied/);
});

test('synthetic allocation lookup: missing current version facts, parked send deadline and pre-cancellation are bounded',async()=>{
 const malformed=fixture();malformed.stateLookup.pages=()=>({Versions:[]});await assert.rejects(malformed.observe(),/ALLOCATION_UNKNOWN/);
 const parked=fixture();parked.stateLookup.park=true;await assert.rejects(parked.observe({maxRequestMs:20,now:Date.now}),/DEADLINE/);
 const cancelled=fixture(),controller=new AbortController();controller.abort();await assert.rejects(cancelled.createObjects().observeAllocation({claim:cancelled.claim,source:cancelled.source},controller.signal));assert.equal(cancelled.calls.length,0);
});
