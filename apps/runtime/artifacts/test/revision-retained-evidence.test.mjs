/** Source-backed (evidence-bearing) conversational revision through the real runtime application, the canonical
 * document application and the canonical artifact owner: scripted identity, SQL and bytes only.
 * The private current-authorized source read is the only origin of the retained provenance; no HTTP field and no
 * model argument can carry it. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeDocumentFixture,sha} from '../../../artifacts/test/native-document-fixture.mjs';
import {createRuntimeDocumentIntentPreparers} from '../intent-preparers.mjs';
import {createRuntimeArtifactApplication} from '../application.mjs';

const clientId='33333333-3333-4333-8333-000000000090',credential='action_session_'+'a'.repeat(43);
const token='Bearer '+'b'.repeat(43);
const limits={maxRequestMs:5000,maxRequestBytes:2097152,maxResponseBytes:16777216};
const deliveryId=seed=>'sdk:'+seed.repeat(64);
const code=(wanted,effect)=>error=>error?.code===wanted&&(effect===undefined||error.effect===effect);

/** A source-backed parent created by an ordinary revision of this conversation, then revised by a later run. */
async function fixture(){
 const f=nativeDocumentFixture({scopes:[{tenantId:'synthetic-tenant',kind:'client',resourceId:clientId,policyRevision:'r1'}],}),now=f.options.now,expiry=now()+30000;
 const parentBinding=structuredClone(f.context.binding);
 const evidence=[{sourceId:'program_elements',recordId:'record-synthetic',sourceVersionId:'version-synthetic',
  observedAt:new Date(now()).toISOString(),sourceUpdatedAt:null,citationId:randomUUID(),scopes:structuredClone(f.context.scopes),
  contentSha256:'a'.repeat(64),binding:structuredClone(parentBinding)}];
 const parent=await f.owner({context:{...f.context,evidence}}).execute(f.call);
 // The revision is a later run of the same conversation, so the parent's evidence binds another run than the write.
 const revisionBinding=Object.freeze({...parentBinding,runId:randomUUID(),attemptId:randomUUID()});
 const revisionContext=structuredClone({...f.context,binding:revisionBinding,deadlineMs:now()+30000});
 const selection={artifactId:parent.version.artifactId,versionId:parent.version.versionId,objectSha256:parent.version.object.sha256};
 const replacement={...f.call.request,content:{text:'Replacement that keeps its citations\n'}};
 const state={denied:false,resolved:[],phases:[],release:null};
 const sessions={async authenticateSession(){
   if(state.denied)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});
   return {principal:{sessionId:'synthetic-session',tenantId:parentBinding.tenantId,actorId:parentBinding.actorId,conversationId:parentBinding.conversationId,runId:revisionBinding.runId},sessionRevision:'synthetic-current',checkedAtMs:now(),expiresAtMs:expiry};},
  async readCurrentState({authentication}){return {authenticationSha256:hash(authentication),binding:revisionBinding,scopes:structuredClone(f.context.scopes),selectedClientId:clientId,checkedAtMs:now(),expiresAtMs:expiry};}};
 const optionsOwner={async resolve(call){
   state.resolved.push({intent:call.intent,body:call.body});
   return {documentOptions:{sessions,selectedClientId:clientId,now,limits,enabled:true,
     artifactOptions:{...f.options,context:structuredClone(revisionContext),ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})}},
    async recheck({phase}){state.phases.push(phase);if(phase==='release')await state.release?.();if(state.denied)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}};
 }};
 const config={sessions,optionsOwner,now,limits};
 const receipt={credential,expiresAtMs:expiry,context:{tenantId:revisionBinding.tenantId,actorId:revisionBinding.actorId,conversationId:revisionBinding.conversationId,runId:revisionBinding.runId,selectedClientId:clientId}};
 const runtimeFor=selection=>createRuntimeDocumentIntentPreparers({...config,binding:revisionBinding,selectedClientId:clientId,revision:selection,
  nativeCredentials:{nativeCredentialFor(){return {credential:'synthetic-native',expiresAtMs:expiry};}},
  async borrowSession(){return receipt;}});
 const runtime=()=>runtimeFor(selection);
 const prepare=(id=deliveryId('d'))=>runtime().find(p=>p.operation.id==='create_word').prepare({deliveryId:id,arguments:replacement});
 const app=()=>createRuntimeArtifactApplication({sessions,optionsOwner,now,limits});
 return {f,parent,evidence,revisionBinding,revisionContext,selection,replacement,state,config,runtime,runtimeFor,prepare,app};
}

test('a later conversational run keeps the parent citations through the existing artifact owner',async()=>{
 const h=await fixture(),result=await h.prepare();
 assert.equal(result.status,'draft');const version=result.version;
 assert.equal(version.parentVersionId,h.selection.versionId);assert.equal(version.artifactId,h.selection.artifactId);
 assert.deepEqual(version.binding,h.revisionBinding);
 // The retained provenance is the parent's stored evidence, unchanged, on a full replacement.
 assert.deepEqual(version.evidence,h.parent.version.evidence);
 assert.deepEqual(version.evidence,h.evidence);
 assert.notEqual(version.versionId,h.parent.version.versionId);assert.notEqual(version.object.sha256,h.parent.version.object.sha256);
 // One Core inspect read then one revise write through the existing application, and the exact original bytes.
 assert.deepEqual(h.state.resolved.map(x=>x.intent),['inspect','revise']);
 assert.equal(h.state.resolved[1].body.baseVersionId,h.selection.versionId);
 assert.deepEqual(h.state.phases,['admission','release','admission','release']);
 assert.equal(h.f.state.executions.length,2);assert.equal(h.f.state.executions[1].base.bytes.toString(),h.f.call.request.content.text);
 // The immutable parent version, spec and bytes are untouched.
 const stored=await h.f.options.versions.read(h.selection.versionId,undefined);
 assert.deepEqual(stored.version,h.parent.version);assert.deepEqual(stored.spec,h.f.call.request);assert.equal(stored.specSha256,v.hash(h.f.call.request));
});

test('an HTTP caller without the trusted capability can never reach a retained write',async()=>{
 const h=await fixture();
 const send=(retained,extra={})=>h.app().handle(new Request('https://meri-control.internal/api/documents/revise',{method:'POST',
  headers:{authorization:token,'content-type':'application/json'},body:JSON.stringify({deliveryId:deliveryId('a'),baseVersionId:h.selection.versionId,request:extra.request??h.replacement})}),retained===undefined?{}:{retained});
 // A body alone reaches the control admission, which refuses a source-backed parent with no trusted owner.
 const refused=await send();assert.equal(refused.status,503);assert.equal((await refused.json()).error.outcome,'NOT_DISPATCHED');
 // The capability is bound to the exact base version, the exact evidence hash and the exact retained assets.
 const asset=(await h.f.options.objects.put({objectId:randomUUID(),bytes:Buffer.from('synthetic-image'),scopes:structuredClone(h.f.context.scopes),requestSha256:'c'.repeat(64)}));
 const foreign={...h.evidence[0],binding:{...h.evidence[0].binding,conversationId:randomUUID()}};
 for(const [name,retained,status] of [
  ['another base version',{baseVersionId:randomUUID(),evidence:h.evidence,assets:[],evidenceSha256:hash(h.evidence)},403],
  ['a substituted evidence hash',{baseVersionId:h.selection.versionId,evidence:h.evidence,assets:[],evidenceSha256:'f'.repeat(64)},403],
  ['another conversation',{baseVersionId:h.selection.versionId,evidence:[foreign],assets:[],evidenceSha256:hash([foreign])},null],
 ]){
  const response=await send(retained);assert.notEqual(response.status,200,name);assert.equal((await response.json()).error.outcome,'NOT_DISPATCHED',name);
  if(status!==null)assert.equal(response.status,status,name);
 }
 // A replacement may only reference assets the retained capability carries.
 const image={kind:'image',assetId:'invented-image',widthInches:1,heightInches:1};
 const withImage=v.request({...h.replacement,format:'docx',content:{blocks:[image]}});
 const invented=await send({baseVersionId:h.selection.versionId,evidence:h.evidence,assets:[asset],evidenceSha256:hash(h.evidence)},{request:withImage});
 assert.equal(invented.status,403);assert.equal((await invented.json()).error.outcome,'NOT_DISPATCHED');
 // No refusal dispatched a write: the parent stays the only version and the only execution.
 assert.ok(h.state.resolved.every(call=>call.intent==='revise'));assert.equal(h.state.resolved.length,5);
 assert.equal(h.f.state.executions.length,1);
});

test('current-source revocation and a moved head stop the retained revision before any write',async()=>{
 const denied=await fixture();denied.state.release=()=>{denied.state.denied=true;};
 await assert.rejects(denied.prepare(),code('ACCESS_DENIED','none'));
 assert.deepEqual(denied.state.resolved.map(x=>x.intent),['inspect']);assert.equal(denied.f.state.executions.length,1);
 const moved=await fixture();
 await moved.f.owner().execute({deliveryId:'sdk:'+'e'.repeat(64),baseVersionId:moved.selection.versionId,request:moved.replacement});
 await assert.rejects(moved.prepare(),code('CONFLICT','none'));
 assert.deepEqual(moved.state.resolved.map(x=>x.intent),['inspect']);assert.equal(moved.f.state.executions.length,2);
});

test('an asset-bearing parent is refused rather than re-rendered without its retained object',async()=>{
 const h=await fixture();
 const object=await h.f.options.objects.put({objectId:randomUUID(),bytes:Buffer.from('synthetic-image'),scopes:structuredClone(h.f.context.scopes),requestSha256:'c'.repeat(64)});
 const spec=v.request({operation:'create_word',format:'docx',title:'Synthetic',content:{blocks:[{kind:'paragraph',runs:[{text:'With an image'}]},{kind:'image',assetId:'retained-image',widthInches:1,heightInches:1}]}});
 const docxExecutor={async execute({request}){const bytes=Buffer.from(JSON.stringify(request.content.blocks).slice(0,64));return {bytes,inspection:{sha256:sha(bytes),bytes:bytes.length,format:'docx',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{paragraphs:2,tables:0,pictures:1}}};}};
 // The parent is created with the asset object its own context carried; the revision path has no durable source for it.
 const parent=await h.f.owner({executor:docxExecutor,context:{...h.f.context,assets:[{id:'retained-image',object}]}}).execute({deliveryId:'sdk:'+'f'.repeat(64),baseVersionId:null,request:spec});
 assert.deepEqual(parent.version.evidence,[]);
 const selection={artifactId:parent.version.artifactId,versionId:parent.version.versionId,objectSha256:parent.version.object.sha256};
 const before=h.f.state.executions.length;
 await assert.rejects(h.runtimeFor(selection).find(p=>p.operation.id==='create_word').prepare({deliveryId:deliveryId('9'),arguments:spec}),code('UNAVAILABLE','none'));
 assert.deepEqual(h.state.resolved.map(x=>x.intent),['inspect']);assert.equal(h.f.state.executions.length,before);
 assert.deepEqual(h.f.state.executions.at(-1).request.operation,'create_word');
});

test('an uncertain write acknowledgement stays UNKNOWN and the journal never re-prepares it',async()=>{
 const h=await fixture();let revised=0;
 h.f.state.authorizeHook=call=>{if(call.action==='artifact.revise'){revised++;throw Object.assign(Error('CURRENT_ACCESS_DENIED'),{code:'CURRENT_ACCESS_DENIED'});}};
 const prepare=()=>h.prepare(deliveryId('7'));
 for(let attempt=0;attempt<2;attempt++)await assert.rejects(prepare,code('UNKNOWN','unknown'));
 // The uncertain delivery is re-checked against current access (one authority observation per attempt) and
 // never redispatched to the executor: the executor ran once, for the parent version only.
 assert.equal(revised,2);assert.equal(h.f.state.executions.length,1);
 assert.deepEqual(h.state.resolved.map(x=>x.intent),['inspect','revise','inspect','revise']);
});
