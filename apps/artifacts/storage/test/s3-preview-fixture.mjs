/** Actual SDK command types with one in-memory atomic conditional object. No S3 process/network/credential. */
import {Readable} from 'node:stream';import {GetBucketVersioningCommand,GetObjectCommand,PutObjectCommand} from '../s3-sdk.mjs';
import {createS3PreviewEvidence} from '../s3-preview-evidence.mjs';import {custodyFixture} from '../../test/preview-custody-fixture.mjs';
export const kmsKeyId='arn:aws:kms:us-east-1:111122223333:key/22222222-2222-4222-8222-222222222222';
export function s3PreviewFixture(){const f=custodyFixture(),state={current:null,versions:new Map(),calls:[],lostAck:false,deny:false,versioning:'Enabled',preconditions:0,mutate:null,park:false};
 const client={async send(command,options){state.calls.push({command,options});if(command instanceof GetBucketVersioningCommand)return {Status:state.versioning};
  if(state.deny)throw Object.assign(Error('synthetic denied'),{$metadata:{httpStatusCode:403}});
  if(command instanceof PutObjectCommand){const a=command.input;if(state.preconditions>0){state.preconditions--;throw {$metadata:{httpStatusCode:412}};}
   if(a.IfNoneMatch==='*'&&state.current||a.IfMatch!==undefined&&a.IfMatch!==state.current?.ETag)throw {$metadata:{httpStatusCode:412}};
   const VersionId='synthetic-index-native-'+(state.versions.size+1),ETag='"synthetic-etag-'+VersionId+'"';
   const value={VersionId,ETag,ContentLength:a.Body.length,ChecksumSHA256:a.ChecksumSHA256,ChecksumType:'FULL_OBJECT',ServerSideEncryption:a.ServerSideEncryption,SSEKMSKeyId:a.SSEKMSKeyId,Metadata:structuredClone(a.Metadata),bytes:Buffer.from(a.Body)};
   state.versions.set(VersionId,value);state.current=value;if(state.lostAck){state.lostAck=false;throw Error('synthetic applied index PUT ACK lost');}return {...value};}
  if(!(command instanceof GetObjectCommand))throw Error('Unexpected synthetic command');if(state.park)return new Promise(()=>{});
  const value=command.input.VersionId?state.versions.get(command.input.VersionId):state.current;if(!value)throw Object.assign(Error('synthetic absent'),{name:'NoSuchKey',$metadata:{httpStatusCode:404}});
  const out={...value,Metadata:structuredClone(value.Metadata),Body:Readable.from([value.bytes])};state.mutate?.(out);return out;
 }};
 const config={client,bucket:'synthetic-evidence-bucket',prefix:'shipping-evidence',expectedBucketOwner:'111122223333',kmsKeyId,tenantId:f.version.binding.tenantId,now:Date.now,maxRequestMs:200};
 const create=changes=>createS3PreviewEvidence({...config,enabled:true,...changes});
 const install=owner=>{f.evidence.claim=owner.claim;f.evidence.append=owner.append;f.evidence.read=owner.read;};
 return {...f,s3:state,config,createEvidence:create,install};
}
