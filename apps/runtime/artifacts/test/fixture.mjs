/** Source-only current/accounting/S3 replies; real canonical owners and real Python generation. */
import {fileURLToPath} from 'node:url';import {Readable} from 'node:stream';
import {createRequire} from 'node:module';
import {createLocalDocumentFixture} from '../../../control/document-application/local/fixture.mjs';
import {createActionSessionApplication} from '../../../control/action-host/session/http.mjs';
import {listenActionApplication} from '../../../control/action-application/node-http.mjs';
import {bindPreparedBriefArtifactOptions} from '../../../control/document-application/research-brief/binding.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {sqlFixture} from '../../../artifacts/storage/test/sql-fixture.mjs';
import {createRuntimeArtifactApplication,createRuntimeArtifactStorage,createRuntimeDocumentOptionsComposer} from '../index.mjs';
const {GetBucketVersioningCommand,PutObjectCommand,GetObjectCommand}=createRequire(new URL('../../../artifacts/storage/package.json',import.meta.url))('@aws-sdk/client-s3');
export const python='/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3',soffice='/opt/codex/runtimes/codex-primary-runtime/dependencies/bin/override/soffice';
export async function fixture(operation='create_word'){
 process.env.MERI_REVIEW_SOURCE_ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python,operation}),db=sqlFixture(),stored=new Map(),state={prepared:null,checks:[],resolved:[],deny:false,denyAfterGeneration:false,boolean:false,swapped:false},kms='arn:aws:kms:us-east-1:111122223333:key/22222222-2222-4222-8222-222222222222';let native=0;
 const client={async send(command){const a=command.input;if(command instanceof GetBucketVersioningCommand)return {Status:'Enabled'};
  if(command instanceof PutObjectCommand){if(stored.has(a.Key))throw {$metadata:{httpStatusCode:412}};stored.set(a.Key,{bytes:Buffer.from(a.Body),VersionId:'SYNTHETIC_MOUNT_NATIVE_'+(++native),Metadata:structuredClone(a.Metadata),ChecksumSHA256:a.ChecksumSHA256});}
  const o=stored.get(a.Key);if(!o||a.VersionId!==undefined&&a.VersionId!==o.VersionId)throw Error('SYNTHETIC_VERSION_MISSING');const response={VersionId:o.VersionId,Metadata:o.Metadata,ChecksumSHA256:o.ChecksumSHA256,ChecksumType:'FULL_OBJECT',ServerSideEncryption:'aws:kms',SSEKMSKeyId:kms,ContentLength:o.bytes.length};if(command instanceof GetObjectCommand)response.Body=Readable.from([o.bytes]);return response;}};
 const storage=createRuntimeArtifactStorage({s3:{client,bucket:'synthetic-mount-bucket',prefix:'runtime-artifacts',expectedBucketOwner:'111122223333',kmsKeyId:kms},versionsPool:db.pool,now:f.now,maxRequestMs:1000});
 const compose=createRuntimeDocumentOptionsComposer({storage,executor:f.artifactOptions.executor,budgetPool:f.ledger.pool,sessions:f.sessions,now:f.now});
 const current=async(credential,signal)=>{const authentication=await f.sessions.authenticateSession({credential,signal}),now=await f.sessions.readCurrentState({authentication,signal});if(v.hash(now.binding)!==v.hash(f.artifactOptions.context.binding)||v.hash(now.scopes)!==v.hash(f.artifactOptions.context.scopes))throw Error('ACCESS_DENIED');};
 const owner={async resolve(call){state.resolved.push({intent:call.intent,requestSha256:call.requestSha256});await current(call.credential,call.signal);
  const artifactOptions=state.prepared?bindPreparedBriefArtifactOptions(state.prepared,{...f.artifactOptions,context:state.prepared.context}):f.artifactOptions;
  const documentOptions=compose({artifactOptions,selectedClientId:f.selectedClientId,credential:f.credential,limits:f.limits,enabled:true});if(state.swapped)documentOptions.sessions={};
  return {documentOptions,async recheck(check){state.checks.push(check.phase);if(check.requestSha256!==v.hash({intent:call.intent,body:call.body})||state.deny||state.denyAfterGeneration&&f.stats().generations>0)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});await current(call.credential,check.signal);if(state.boolean)return true;}};
 }};
 let app=createRuntimeArtifactApplication({sessions:f.sessions,optionsOwner:owner,now:f.now,limits:f.limits});const issuance=createActionSessionApplication({owner:f.sessions,now:f.now,maxRequestMs:3000});
 const server=await listenActionApplication({app:{handle:r=>new URL(r.url).pathname==='/api/action-followthrough/session'?issuance.handle(r):app.handle(r)},host:'127.0.0.1',port:0,lifetimeMs:25000});
 const send=(route,body,credential)=>fetch(server.origin+route,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)});
 const issued=await send('/api/action-followthrough/session',{},f.nativeCredential),session=await issued.json();if(issued.status!==200)throw Error('SYNTHETIC_SESSION');
 return {f,db,stored,state,storage,compose,owner,session,send:(route,body)=>send('/api/documents/'+route,body,session.credential),reconstruct(){app=createRuntimeArtifactApplication({sessions:f.sessions,optionsOwner:owner,now:f.now,limits:f.limits});},async close(){await server.close();await f.close();return {http:server.status(),fixture:f.stats()};}};
}
