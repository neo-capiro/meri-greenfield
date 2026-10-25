/** Actual runtime/document application, session and immutable publication owners. Core, captured-file lookup and SQL/object
 * transports are synthetic; these tests perform no HTTP, database, provider or secret-file calls. */
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createRuntimeFilingCustody} from '../filing-custody.mjs';
import {createCoreArtifactAuthorityClient} from '../core-authority-client.mjs';
import {createCoreArtifactAuthority} from '../core-authority.mjs';
import {createArtifactAuthorityCredentials} from '../authority-credentials.mjs';
import {createRuntimeDocumentOptionsComposer} from '../composition.mjs';
import {applicationFixture} from '../../../control/conversations/test/application-fixture.mjs';
import {nativeDocumentFixture,sha} from '../../../artifacts/test/native-document-fixture.mjs';
import {NOW,id} from '../../../artifacts/storage/test/sql-fixture.mjs';

export const binding={tenantId:id(100),actorId:id(101),conversationId:id(102),runId:id(103),attemptId:id(104),workerId:id(105),writerFence:1};
export const selectedClientId=id(106),scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:selectedClientId,policyRevision:'policy1'}];
export const limits={maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576},now=()=>Date.now();
export async function filingCustodyFixture(t,{native=false,sourceConversation=false}={}){
 t.mock.timers.enable({apis:['Date'],now:NOW});
 const f=await applicationFixture({binding,scopes,selectedClientId,initialInput:true});t.after(()=>f.close());
 await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});
 const documents=nativeDocumentFixture({binding,scopes}),state={coreStatus:200,coreCalls:[],intents:[],lookups:[],file:null,onResolve:null,onCore:null};
 const client=createCoreArtifactAuthorityClient({origin:'https://core.synthetic.invalid',now,fetchImpl:async(_url,init)=>{
  const q=JSON.parse(init.body);state.coreCalls.push(q);await state.onCore?.(q);
  if(state.coreStatus!==200)return Response.json({error:'denied'},{status:state.coreStatus});
  const r={...q,principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'a'.repeat(64),selectedClientId:q.clientId,
   contextRevision:'b'.repeat(64),operations:['artifact.download','artifact.generate','artifact.inspect','artifact.preview-publish','artifact.revise'],
   limits:{maxArtifactBytes:1048576},authorityRevision:'c'.repeat(64),checkedAtMs:NOW,expiresAtMs:NOW+60000};delete r.clientId;return Response.json(r);
 }});
 const credentials=await createArtifactAuthorityCredentials({serviceSecretFile:'/run/synthetic',readSecret:async()=>Buffer.from('synthetic-service')});
 const authority=createCoreArtifactAuthority({client,credentials,now,limits,maxOutputBytes:1048576});
 const store={...f.store,lifecycle:{...f.store.lifecycle,async readArtifactFile(value,check){check();return value.versionId===state.file?.entry.object.objectId?structuredClone(state.file):null;}}};
 const compose=createRuntimeDocumentOptionsComposer({storage:{versions:documents.options.versions,objects:documents.options.objects},executor:documents.options.executor,pool:documents.options.pool,sessions:f.sessions,store,now});
 const optionsOwner={async resolve(call){state.intents.push(call.intent);await state.onResolve?.(call);
  const {recheck,...options}=await authority.resolve({...call,sessions:f.sessions,store});return {documentOptions:compose(options),recheck};}};
 let object,versionId,expectedBytes;
 if(native){
  expectedBytes=Buffer.from('Native file contents');object={objectId:id(700),versionId:'native-exact-s3-version',sha256:sha(expectedBytes),bytes:expectedBytes.length,scopes};versionId=object.objectId;
  documents.state.objects.set(v.hash(object),expectedBytes);
  state.file={kind:'native-file',binding:sourceConversation?{...binding,conversationId:id(710),runId:id(711)}:binding,scopes,manifestId:id(701),
   createdAt:new Date(NOW).toISOString(),entry:{path:'output/café.txt',kind:'file',executable:false,object}};
 }else{const result=await documents.run();object=result.version.object;versionId=result.version.versionId;expectedBytes=Buffer.from(documents.call.request.content.text);}
 const resolveVersion=async call=>{state.lookups.push(call);if(state.lookup)return state.lookup(call);
  return native?object.objectId:documents.options.versions.findByObject({objectId:call.object.objectId,tenantId:call.binding.tenantId,conversationId:call.binding.conversationId},call.signal);
 };
 const config={sessions:f.sessions,optionsOwner,now,limits,retention:documents.sql.retention,resolveVersion},custody=createRuntimeFilingCustody(config);
 const call={object,credential:f.credential,binding,scopes,deadlineMs:NOW+5000};
 return {f,documents,state,object,versionId,expectedBytes,config,custody,call,authority};
}
