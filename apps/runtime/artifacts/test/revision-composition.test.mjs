/** Production run owner over real action-session/artifact owners; scripted persistence and bytes only. */
import {randomUUID} from 'node:crypto';
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {nativeDocumentFixture,sha} from '../../../artifacts/test/native-document-fixture.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {createDocumentRevisionRunOwner} from '../revision-composition.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
const clientId='33333333-3333-4333-8333-000000000090';
const ASSET=Buffer.from('synthetic retained image bytes\n');
/** A declared image asset, its exact bytes and a deterministic docx executor, for the asset-bearing parent. */
const assetDocument={operation:'create_word',format:'docx',title:'Retained',content:{blocks:[{kind:'paragraph',runs:[{text:'With an image'}]},{kind:'image',assetId:'retained-image',widthInches:1,heightInches:1}]}};
const assetExecutor=f=>({async execute(input){f.state.executions.push(input);const bytes=Buffer.from(JSON.stringify(input.request.content.blocks).slice(0,64));
 return {bytes,inspection:{sha256:sha(bytes),bytes:bytes.length,format:'docx',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{paragraphs:1,tables:0,pictures:input.assets.length}}};}});
async function fixture(t,{sourceBacked=false,assets=null}={}){
 const f=nativeDocumentFixture({scopes:[{tenantId:'synthetic-tenant',kind:'client',resourceId:clientId,policyRevision:'r1'}]});
 if(sourceBacked)f.context.evidence.push({sourceId:'program_elements',recordId:'synthetic-record',sourceVersionId:'synthetic-version',observedAt:new Date(f.options.now()).toISOString(),sourceUpdatedAt:null,citationId:randomUUID(),scopes:structuredClone(f.context.scopes),contentSha256:'a'.repeat(64),binding:structuredClone(f.context.binding)});
 const object={objectId:randomUUID(),versionId:'',sha256:sha(ASSET),bytes:ASSET.length,scopes:structuredClone(f.context.scopes)};object.versionId=`SYNTHETIC_${object.objectId}`;
 if(assets==='retained'){f.context.assets=[{id:'retained-image',object}];f.state.objects.set(hash(object),Buffer.from(ASSET));}
 else if(assets==='bare')f.context.assets=[];
 const first=assets===null?await f.run():await f.owner({executor:assetExecutor(f),context:f.context,...(assets==='retained'?{retainedAssetMapWrites:true}:{})}).execute({deliveryId:'native-asset-delivery',baseVersionId:null,request:assetDocument});
 const binding=f.context.binding,now=f.options.now;
 const state={denied:false,reads:0,phases:[],release:null},expiry=now()+30000;
 const sessions=createActionSessionOwner({mode:'process-local',now,refusals:()=>{},limits:{maxSessions:8,maxRequestMs:5000,maxTtlMs:30000,maxFactBytes:131072},
  async verifyIdentity(){if(state.denied)throw Error('DENIED');return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'current',checkedAtMs:now(),expiresAtMs:expiry};},
  async resolveContext({identity}){return {identitySha256:hash(identity),binding,scopes:f.context.scopes,selectedClientId:clientId,contextRevision:'current',checkedAtMs:now(),expiresAtMs:expiry};}});t.after(()=>sessions.close());
 const session=await sessions.issue({identityCredential:'synthetic-native',hints:{conversationId:binding.conversationId,runId:binding.runId,clientId}});
 const selection={artifactId:first.version.artifactId,versionId:first.version.versionId,objectSha256:first.version.object.sha256};
 state.saved={run:{binding,scopes:f.context.scopes},request:{requestId:'33333333-3333-4333-8333-000000000800',prompt:'Revise',skill:null,window:null,windowRequest:null,documentRevision:selection}};
 const store={async read(_binding,_query,check){state.reads++;check();return structuredClone(state.saved);}},limits={maxRequestMs:5000,maxRequestBytes:2097152,maxResponseBytes:16777216};
 const optionsOwner={async resolve(call){assert.equal(call.credential,session.credential);assert.equal(call.intent,'inspect');return {documentOptions:{sessions,selectedClientId:clientId,artifactOptions:{...f.options,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})},now,limits,enabled:true},async recheck({phase}){state.phases.push(phase);if(phase==='release')await state.release?.();}};}};
 const owner=createDocumentRevisionRunOwner({bound:()=>({sessions,store}),optionsOwner,now,limits}),call={binding,selection,deadlineMs:expiry};
 return {f,first,object,request:assetDocument,state,sessions,session,selection,owner,call};
}
test('stored selection reads the original spec through the existing session and current document owner without another session or write',async t=>{
 const h=await fixture(t);assert.deepEqual(await h.owner.selectionFor(h.call),h.selection);const before=h.sessions.status().sessions,executions=h.f.state.executions.length;
 const result=await h.owner.read(h.call);assert.deepEqual(result,{selection:h.selection,request:h.f.call.request,specSha256:hash(h.f.call.request)});assert.deepEqual(h.state.phases,['admission','release']);assert.equal(h.sessions.status().sessions,before);assert.equal(h.f.state.executions.length,executions);
});
test('ordinary stored input is selector-free; changed binding/selection/skill and mixed source scopes refuse before artifact resolution',async t=>{
 const h=await fixture(t);delete h.state.saved.request.documentRevision;assert.equal(await h.owner.selectionFor(h.call),null);await assert.rejects(h.owner.read(h.call),{code:'ACCESS_DENIED'});
 h.state.saved.request.documentRevision=h.selection;
 for(const mutate of [()=>h.state.saved.run.binding={...h.call.binding,writerFence:2},()=>h.state.saved.request.documentRevision={...h.selection,objectSha256:'f'.repeat(64)},()=>h.state.saved.request.skill={skillId:'quick_skill.commitments_audit'},()=>h.state.saved.run.scopes.push({...h.state.saved.run.scopes[0],kind:'private-user',resourceId:h.call.binding.actorId}),()=>h.state.saved.run.scopes.push({...h.state.saved.run.scopes[0],resourceId:randomUUID()}),()=>h.state.saved.run.scopes.push({...h.state.saved.run.scopes[0],kind:'mailbox',resourceId:'mailbox',tenantId:'other-tenant'}),()=>h.state.saved.run.scopes.push({...h.state.saved.run.scopes[0],kind:'mailbox',resourceId:'mailbox',policyRevision:'changed'})]){
  const saved=structuredClone(h.state.saved);mutate();await assert.rejects(h.owner.read(h.call),{code:'ACCESS_DENIED'});h.state.saved=saved;
 }assert.deepEqual(h.state.phases,[]);
});
test('missing original action session and release-time revocation withhold source',async t=>{
 const absent=await fixture(t);absent.sessions.revoke(absent.session.credential);await assert.rejects(absent.owner.read(absent.call),{code:'SESSION_UNAVAILABLE'});assert.deepEqual(absent.state.phases,[]);
 const denied=await fixture(t);denied.state.release=()=>{denied.state.denied=true;};await assert.rejects(denied.owner.read(denied.call));assert.deepEqual(denied.state.phases,['admission','release']);assert.equal(denied.f.state.executions.length,1);
});

test('selected report private read preserves the immutable source and verified bytes without granting the generic selection path',async t=>{
 const h=await fixture(t,{sourceBacked:true});h.state.saved.request.skill=selectSkill('quick_skill.bill_watch','2.0.0').pin;
 await assert.rejects(h.owner.selectionFor(h.call),{code:'ACCESS_DENIED'});
 const sessions=h.sessions.status().sessions,executions=h.f.state.executions.length;
 const source=await h.owner.readForSelected(h.call);
 assert.deepEqual(Object.keys(source).sort(),['headVersionId','inspection','request','specSha256','version']);
 assert.deepEqual(source.version,h.first.version);assert.deepEqual(source.request,h.f.call.request);
 assert.deepEqual(source.version.evidence,h.f.context.evidence);assert.equal(source.specSha256,hash(h.f.call.request));
 assert.equal(source.inspection.currentBytesVerified,true);assert.equal(source.inspection.sha256,h.selection.objectSha256);
 assert.equal(h.sessions.status().sessions,sessions);assert.equal(h.f.state.executions.length,executions);
 assert.deepEqual(h.state.phases,['admission','release']);
});

test('private selected source rejects an ineligible recipe or changed selector and preserves release-time revocation',async t=>{
 const h=await fixture(t);h.state.saved.request.skill=selectSkill('quick_skill.bill_watch','1.1.0').pin;
 await assert.rejects(h.owner.readForSelected(h.call),{code:'ACCESS_DENIED'});assert.deepEqual(h.state.phases,[]);
 h.state.saved.request.skill=selectSkill('quick_skill.bill_watch','2.0.0').pin;
 await assert.rejects(h.owner.readForSelected({...h.call,selection:{...h.selection,objectSha256:'f'.repeat(64)}}),{code:'ACCESS_DENIED'});
 h.state.release=()=>{h.state.denied=true;};await assert.rejects(h.owner.readForSelected(h.call));
 assert.deepEqual(h.state.phases,['admission','release']);assert.equal(h.f.state.executions.length,1);
});

test('an asset-bearing parent is read and preserved with its exact retained map, and one whose map was never retained stays unavailable',async t=>{
 const h=await fixture(t,{assets:'retained'}),sessions=h.sessions.status().sessions,executions=h.f.state.executions.length;
 // The private selected read carries the durable record's own map next to the immutable spec it belongs to.
 const source=await h.owner.readForSelected(h.call);
 assert.deepEqual(Object.keys(source).sort(),['assets','headVersionId','inspection','request','specSha256','version']);
 assert.deepEqual(source.assets,[{id:'retained-image',object:h.object}]);
 assert.deepEqual(source.request,h.request);assert.equal(source.specSha256,hash(h.request));
 assert.equal(source.inspection.currentBytesVerified,true);assert.equal(source.inspection.sha256,h.selection.objectSha256);
 assert.equal(h.sessions.status().sessions,sessions);assert.equal(h.f.state.executions.length,executions);
 assert.deepEqual(h.state.phases,['admission','release']);
 // The generic private read of the same parent keeps its exact legacy shape and no asset field of its own.
 assert.deepEqual(await h.owner.read(h.call),{selection:h.selection,request:h.request,specSha256:hash(h.request)});

 // The same declared asset on a parent whose durable record retained no map: the declared reference is not
 // invented here, so both private reads stay explicitly unavailable and nothing executes.
 const bare=await fixture(t,{assets:'bare'}),before=bare.f.state.executions.length;
 assert.equal(Object.hasOwn([...bare.f.sql.state.versions.values()][0].record,'assets'),false);
 await assert.rejects(bare.owner.readForSelected(bare.call),{code:'UNAVAILABLE'});
 await assert.rejects(bare.owner.read(bare.call),{code:'UNAVAILABLE'});
 assert.equal(bare.f.state.executions.length,before);
});
