/** Retention transitions in one existing versioned S3 object. A conditional write appends one version;
 * native VersionIds link the immutable history. Serving reads only the current version, recovery replays
 * its ancestors. The borrowed client uses maxAttempts:1; uncertainty is recovered, never blindly retried. */
import {GetBucketVersioningCommand,PutObjectCommand} from '../../artifacts/storage/s3-sdk.mjs';
import {readS3ConditionalDocument} from '../../artifacts/storage/s3-conditional-document.mjs';
import {createS3ArtifactObjects} from '../../artifacts/storage/s3-objects.mjs';
import {storageMethod,storageLifetime,sha} from '../../artifacts/storage/boundary.mjs';
import {own,data,hash,subject,fail} from './boundary.mjs';
import {transitions} from './ledger.mjs';

const errorPrefix='RETENTION_LEDGER',namespace='meri-retention-ledger-v1';
const corrupt=()=>fail(errorPrefix+'_CORRUPT');
function nativeVersion(value){
 if(typeof value!=='string'||!value||value==='null'||!value.isWellFormed()||Buffer.byteLength(value)>1024)corrupt();
 return value;
}
function transition(value){
 const r=own(data(value),['subject','state','facts','atMs','entrySha256'],['reason']);
 subject(r.subject);
 const {entrySha256,...record}=r;
 if(!transitions.includes(r.state)||!Number.isSafeInteger(r.atMs)||r.atMs<0||hash(record)!==entrySha256||
  r.reason!==undefined&&(typeof r.reason!=='string'||!r.reason||r.reason.length>1024))corrupt();
 return r;
}
function parse(value){
 const document=own(data(value),['format','previousVersionId','row']);
 if(document.format!==1)corrupt();
 if(document.row===null){if(document.previousVersionId!==null)corrupt();return document;}
 const row=own(document.row,['subject','state','facts','atMs','entrySha256','sequence','receiptSha256'],['reason']);
 const {sequence,receiptSha256,...entry}=row;transition(entry);
 if(!Number.isSafeInteger(sequence)||sequence<1||receiptSha256!==hash({sequence,entrySha256:entry.entrySha256}))corrupt();
 if(sequence===1){if(document.previousVersionId!==null)corrupt();}else nativeVersion(document.previousVersionId);
 return document;
}

export function createS3RetentionLedgerSink(options){
 const {client,bucket,prefix,expectedBucketOwner,kmsKeyId,now,maxRequestMs=15000,maxReplayBytes=67108864}=own(options,
  ['client','bucket','prefix','expectedBucketOwner','kmsKeyId','now'],['maxRequestMs','maxReplayBytes']);
 // Reuse the storage identity/configuration validation; construction does no IO and owns no client.
 createS3ArtifactObjects({client,bucket,prefix,expectedBucketOwner,kmsKeyId,now,maxRequestMs});
 if(!Number.isSafeInteger(maxReplayBytes)||maxReplayBytes<1||maxReplayBytes>67108864)fail('RETENTION_CONFIGURATION');
 const send=storageMethod(client,'send'),target={Bucket:bucket,Key:`${prefix}/retention/ledger.json`,ExpectedBucketOwner:expectedBucketOwner};
 // The shared JSON transport names this metadata field tenantsha256. Here it identifies the deployment ledger,
 // whose actual tenant/subject facts remain in each canonical transition, not in deployment configuration.
 const tenantSha256=hash({bucket,prefix,namespace});
 const read=(life,versionId)=>readS3ConditionalDocument({send,target,tenantSha256,namespace,kmsKeyId,maxIndexBytes:8388608,
  parse,errorPrefix,empty:()=>({format:1,previousVersionId:null,row:null})},life,versionId);
 async function operation(fn,signal){const life=storageLifetime({now,maxRequestMs},signal);try{return await fn(life);}finally{life.close();}}
 const head=signal=>operation(async life=>{const row=(await read(life)).value.row;return {sequence:row?.sequence??0,entrySha256:row?.entrySha256??null};},signal);
 async function append(value){const entry=transition(value);
  return operation(async life=>{
   const versioning=await life.run(signal=>send(new GetBucketVersioningCommand({Bucket:bucket,ExpectedBucketOwner:expectedBucketOwner}),{abortSignal:signal}));
   if(versioning.Status!=='Enabled')fail('RETENTION_LEDGER_VERSIONING_REQUIRED');
   for(let attempt=0;attempt<4;attempt++){
    const current=await read(life),sequence=(current.value.row?.sequence??0)+1;
    const receiptSha256=hash({sequence,entrySha256:entry.entrySha256});
    const document=parse({format:1,previousVersionId:current.versionId,row:{...entry,sequence,receiptSha256}});
    const bytes=Buffer.from(JSON.stringify(document));if(bytes.length>8388608)fail('RETENTION_LEDGER_LIMIT');
    const digest=sha(bytes),checksum=Buffer.from(digest,'hex').toString('base64');let response;
    try{response=await life.run(signal=>send(new PutObjectCommand({...target,Body:bytes,ContentLength:bytes.length,ContentType:'application/json',
     ...(current.etag===null?{IfNoneMatch:'*'}:{IfMatch:current.etag}),ChecksumAlgorithm:'SHA256',ChecksumSHA256:checksum,
     ChecksumType:'FULL_OBJECT',ServerSideEncryption:'aws:kms',SSEKMSKeyId:kmsKeyId,BucketKeyEnabled:false,
     Metadata:{namespace,tenantsha256:tenantSha256,contentsha256:digest}}),{abortSignal:signal}));}
    catch(error){if(error?.$metadata?.httpStatusCode===412)continue;fail('RETENTION_LEDGER_UNACKNOWLEDGED');}
    const id=nativeVersion(response.VersionId);
    if(response.ChecksumSHA256!==checksum||response.ChecksumType!=='FULL_OBJECT'||response.ServerSideEncryption!=='aws:kms'||response.SSEKMSKeyId!==kmsKeyId)corrupt();
    const back=await read(life,id);if(hash(back.value)!==hash(document))corrupt();
    return {sequence,receiptSha256};
   }
   fail('RETENTION_LEDGER_CONTENTION');
  });
 }
 async function replay(){return operation(async life=>{
  let current=await read(life),expected=current.value.row?.sequence??0,bytes=0;const rows=[];
  while(expected>0){
   const {row,previousVersionId}=current.value;if(row?.sequence!==expected)corrupt();
   bytes+=Buffer.byteLength(JSON.stringify(row));if(bytes>maxReplayBytes)fail('RETENTION_LEDGER_LIMIT');rows.push(row);
   expected--;if(expected>0)current=await read(life,previousVersionId);
  }
  return rows.reverse();
 });}
 return Object.freeze({append,read:replay,head});
}
