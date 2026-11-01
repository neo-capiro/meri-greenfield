import test from 'node:test';
import assert from 'node:assert/strict';
import {wopiFixture} from './wopi-fixture.mjs';
import {createOfficeDraftPublisher} from '../publish-draft.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {id} from '../../storage/test/sql-fixture.mjs';
import {ooxml} from '../../structure/test/fixtures.mjs';
import {zip} from '../../structure/test/fixtures.mjs';
import {chart} from './embedded-chart-fixture.mjs';
async function fixture(t,format='docx',withEvidence=false,baseBytes){
 const f=await wopiFixture(t,{format,withEvidence,...(baseBytes?{baseBytes}:{})}),bytes=baseBytes??ooxml(format);
 assert.equal((await f.send('lock',{lock:'CODE'})).status,200);
 assert.equal((await f.send('save',{lock:'CODE',body:bytes})).status,200);
 const options={...f.options,validators:v,publisherFor:(context,retained)=>f.owner({officeEditWrites:true,context,...retained})};
 const publisher=createOfficeDraftPublisher(options),selection={context:f.context,selectedClientId:f.context.scopes[0].resourceId};
 const input={draftId:f.draft.draftId,sequence:f.draft.sequence,sha256:f.draft.sha256};
 return {...f,bytes,publisher,publishOptions:options,selection,input,publish:(value=input,chosen=selection)=>publisher.publish(value,chosen)};
}
for(const format of ['docx','xlsx','pptx'])test(`${format}: separate Publish creates one immutable native revision from retained source`,async t=>{
 const f=await fixture(t,format),before=f.state.puts,result=await f.publish();
 assert.equal(f.draft.state,'published');assert.equal(result.draft.publishedVersionId,result.publication.version.versionId);
 assert.equal(result.publication.version.parentVersionId,f.first.version.versionId);assert.equal(result.publication.version.object.sha256,f.draft.sha256);
 assert.deepEqual(f.state.objects.get(v.hash(result.publication.version.object)),f.bytes);assert.equal(f.state.puts,before+1);
 assert.equal(f.state.executions.length,1);assert.equal(f.sql.state.versions.size,2);
 if(format==='xlsx')assert.equal(result.publication.inspection.details.formulaCache,'editor-provided/unverified; recalculation required');
 const replay=await f.publish();assert.equal(replay.publication.version.versionId,result.publication.version.versionId);assert.equal(f.state.puts,before+1);
 assert.equal(f.state.executions.length,1);assert.equal((await f.send('save',{lock:'CODE',body:f.bytes})).status,409);
});
test('Core begin acknowledgement loss never claims a new artifact intent on recovery, even after a new run',async t=>{
 const f=await fixture(t),claimsBefore=f.state.commands.filter(c=>c.sql.startsWith('INSERT')).length;f.state.loseBegin=true;
 await assert.rejects(f.publish(),e=>e.outcome==='UNKNOWN');assert.equal(f.draft.state,'publish-pending');assert.equal(f.state.puts,1);
 f.state.loseBegin=false;await assert.rejects(f.publish(),{code:'EDITOR_PUBLISH_UNRESOLVED'});assert.equal(f.draft.state,'publish-unknown');
 f.context.binding.runId=id(940);await f.sessions.issue({identityCredential:'synthetic-new-run'});
 await assert.rejects(f.publish(),{code:'EDITOR_PUBLISH_UNRESOLVED'});
 assert.equal(f.state.commands.filter(c=>c.sql.startsWith('INSERT')).length,claimsBefore);assert.equal(f.state.puts,1);assert.equal(f.draft.bytesBase64,f.bytes.toString('base64'));
});
test('later-run native editing preserves only the immutable parent evidence through exact retained-context admission',async t=>{
 const f=await fixture(t,'docx',true),original=structuredClone(f.first.version.evidence);f.context.evidence=[];f.context.binding.runId=id(942);
 await f.sessions.issue({identityCredential:'synthetic-editing-run'});let checked=false;
 const bridge=createOfficeDraftPublisher({...f.publishOptions,publisherFor:(context,retained)=>{
  assert.deepEqual(context.evidence,original);assert.equal(retained.admitRetainedEvidence(context),undefined);
  assert.equal(retained.admitRetainedEvidence({...context,evidence:[]}),1);assert.equal(retained.admitRetainedEvidence({...context,binding:{...context.binding,actorId:'another'}}),1);checked=true;
  return f.owner({officeEditWrites:true,context,...retained});
 }});
 const result=await bridge.publish(f.input,f.selection);assert.equal(checked,true);assert.deepEqual(result.publication.version.evidence,original);
 f.context.binding.runId=id(943);await f.sessions.issue({identityCredential:'synthetic-second-editing-run'});
 const replay=await f.publish();assert.deepEqual(replay.publication.version.evidence,original);assert.equal(replay.publication.version.versionId,result.publication.version.versionId);assert.equal(f.state.puts,2);
});
test('recovery during an in-flight initial caller never becomes a second dispatcher',async t=>{
 const f=await fixture(t);let release,reached;const arrived=new Promise(r=>reached=r),wait=new Promise(r=>release=r);
 const first=createOfficeDraftPublisher({...f.publishOptions,publisherFor:(context,retained)=>{const owner=f.owner({officeEditWrites:true,context,...retained});return {...owner,executeOfficeEdit:async(...args)=>{reached();await wait;return owner.executeOfficeEdit(...args);}};}});
 const pending=first.publish(f.input,f.selection);await arrived;
 await assert.rejects(f.publish(),{code:'EDITOR_PUBLISH_UNRESOLVED'});assert.equal(f.draft.state,'publish-unknown');assert.equal(f.state.puts,1);
 release();const result=await pending;assert.equal(result.draft.state,'published');assert.equal(f.state.puts,2);assert.equal(f.sql.state.versions.size,2);
});
for(const lost of ['artifact-settle','core-settle'])test(`${lost} ACK loss recovers the same publication across a new native run`,async t=>{
 const f=await fixture(t);if(lost==='artifact-settle')f.state.loseCommit='settle';else f.state.loseSettle=true;
 await assert.rejects(f.publish());assert.equal(f.sql.state.versions.size,2);assert.equal(f.state.puts,2);
 assert.equal(f.draft.state,lost==='artifact-settle'?'publish-unknown':'published');
 f.state.loseSettle=false;f.context.binding.runId=id(941);await f.sessions.issue({identityCredential:'synthetic-reconnected-native'});
 const result=await f.publish();assert.equal(result.draft.state,'published');assert.equal(f.state.puts,2);assert.equal(f.state.executions.length,1);
 assert.equal(result.publication.version.object.sha256,f.draft.sha256);
});
for(const bad of ['sequence','hash','base','limit','readonly','session','assets'])test(`${bad} preflight refuses before either Publish owner claims`,async t=>{
 const f=await fixture(t),input={...f.input};let chosen=f.selection;
 if(bad==='sequence')input.sequence++;if(bad==='hash')input.sha256='e'.repeat(64);if(bad==='base')f.draft.baseSha256='e'.repeat(64);
 if(bad==='limit')chosen={...chosen,context:{...f.context,maxBytes:f.bytes.length-1}};
 if(bad==='readonly')f.state.readonly=true;if(bad==='session')f.sessions.revoke(f.session.credential);
 if(bad==='assets')chosen={...chosen,context:{...f.context,assets:[{id:'not-editor-input',object:f.first.version.object}]}};
 const before=f.state.commands.filter(c=>c.sql.startsWith('INSERT')).length;await assert.rejects(f.publish(input,chosen));
 assert.ok(!f.state.calls.some(c=>c.route==='publish/begin'));assert.equal(f.state.commands.filter(c=>c.sql.startsWith('INSERT')).length,before);
 assert.equal(f.draft.state,'draft');assert.equal(f.state.puts,1);
});
test('bytes the WOPI save gate never admitted are refused by the artifact owner before it claims, and settle as a definite refusal',async t=>{
 // Core only ever stores what the WOPI save owner admitted; this models a draft that bypassed it. The artifact
 // owner inspects the bytes before claiming its journal, so the refusal is definite: no object, no version, no unknown.
 const f=await fixture(t);const bytes=Buffer.from('bad');Object.assign(f.draft,{bytesBase64:bytes.toString('base64'),sha256:f.sha(bytes),byteLength:3});
 const before=f.state.commands.filter(c=>c.sql.startsWith('INSERT')).length;
 await assert.rejects(f.publish({...f.input,sha256:f.draft.sha256}),{code:'EDITOR_STRUCTURE_REFUSED'});
 assert.equal(f.state.commands.filter(c=>c.sql.startsWith('INSERT')).length,before);assert.equal(f.state.puts,1);assert.equal(f.sql.state.versions.size,1);
 assert.equal(f.draft.state,'publish-refused');
});
test('a concurrent Save invalidates the explicit selected draft before Core can begin publication',async t=>{
 const f=await fixture(t);f.state.hook=route=>{if(route==='publish/begin'){f.draft.sequence++;}};
 await assert.rejects(f.publish(),{code:'OFFICE_DRAFT_CONFLICT'});assert.equal(f.state.puts,1);assert.equal(f.draft.state,'draft');
});

test('canonical stale head becomes conflict and preserves private bytes without overwriting the new head',async t=>{
 const f=await fixture(t),next=await f.run({...f.call,deliveryId:'another-publication',baseVersionId:f.first.version.versionId,
  request:{operation:'create_word',format:'docx',title:'Synthetic',content:{blocks:[{kind:'paragraph',runs:[{text:'Another published revision'}]}]}}});
 await assert.rejects(f.publish(),{code:'ARTIFACT_STALE_PARENT'});assert.equal(f.draft.state,'conflict');assert.equal(f.draft.bytesBase64,f.bytes.toString('base64'));
 assert.equal(f.sql.state.heads.get(f.first.version.artifactId).version_id,next.version.versionId);assert.equal(f.sql.state.versions.size,2);
 await assert.rejects(f.publish());assert.equal(f.draft.state,'conflict');assert.equal(f.sql.state.versions.size,2);
});
test('late authority refusal stays unknown; its code cannot falsely reopen a claimed publication',async t=>{
 const f=await fixture(t);f.state.hook=route=>{if(route==='publish/begin')f.state.authorizeHook=()=>{throw Object.assign(Error('ARTIFACT_AUTHORITY'),{code:'ARTIFACT_AUTHORITY'});};};
 await assert.rejects(f.publish(),{code:'ARTIFACT_AUTHORITY'});assert.equal(f.draft.state,'publish-unknown');assert.equal(f.state.puts,1);
 assert.equal([...f.state.rows.values()].filter(r=>r.state==='UNKNOWN').length,1);
 assert.ok(!f.state.calls.some(c=>c.route==='publish/settle'&&c.request.outcome==='refused'));
});
for(const loss of ['authority','suppression','generation'])test(`publication retained but result withheld after ${loss} during Core settlement`,async t=>{
 const f=await fixture(t);f.state.hook=route=>{if(route==='publish/settle'){
  if(loss==='authority')f.state.denied=true;
  if(loss==='suppression')f.sql.suppressed.add(`${f.context.binding.tenantId}:artifact:${f.first.version.artifactId}`);
  if(loss==='generation')f.state.generation++;
 }};
 await assert.rejects(f.publish());assert.equal(f.draft.state,'published');assert.equal(f.state.puts,2);assert.equal(f.sql.state.versions.size,2);
});
test('caller data never supplies title, actor, source bytes or a broadened scope; getters do not run',async t=>{
 const f=await fixture(t);let touched=false;const getter={...f.input};Object.defineProperty(getter,'draftId',{enumerable:true,get(){touched=true;return f.input.draftId;}});
 for(const value of [getter,{...f.input,title:'overwrite'},{...f.input,bytesBase64:'bad'},{...f.input,actorId:'someone'}])await assert.rejects(f.publish(value));
 await assert.rejects(f.publish(f.input,{...f.selection,selectedClientId:id(999)}));assert.equal(touched,false);assert.equal(f.draft.state,'draft');assert.equal(f.state.puts,1);
});
