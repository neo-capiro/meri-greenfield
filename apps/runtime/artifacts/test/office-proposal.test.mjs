/** The same-document bridge through the actual runtime office owners: the governed read and prepare over the exact
 * selected version, Apply through the artifact publisher with CAS on the parent head, replay without a second write,
 * durable Reject, stale-head and mismatch refusals, the composed owner's attended-session and authority gates, and
 * the typed-revision refusal that names the bridge. Synthetic options authority, Core HTTP and SQL/object ports as in
 * office-application.test.mjs; no engine or rendering claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {wopiFixture} from '../../../artifacts/edit-sessions/test/wopi-fixture.mjs';
import {createCollaboraCodeLaunch} from '../../../artifacts/edit-sessions/collabora-code.mjs';
import {createRuntimeOfficeApplication} from '../office-application.mjs';
import {createOfficeIntentOwner} from '../office-intents.mjs';
import {registerDocumentIntentOwner} from '../intent-binding.mjs';
import {createOfficeEditPreparer} from '../../../control/intents/office-edit-preparer.mjs';
import {createIntentApprovalOwner} from '../../../control/intents/approval.mjs';
import {mount,delivery} from '../../../control/intents/test/fixture.mjs';
import {id} from '../../../artifacts/storage/test/sql-fixture.mjs';
import {retained} from '../../../artifacts/office-units/test/fixtures.mjs';
import {officeOutline,officePartsDigest} from '../../../artifacts/office-units/index.mjs';
import {readZip} from '../../../artifacts/structure/zip.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {OFFICE_PROPOSAL_KIND} from '../../../../packages/contracts/office-edit.mjs';
const OP={id:'propose_office_edit',version:'0.2.0'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const edits={docx:{unit:'p:1',before:'Quarterly report — Ω',after:'Quarterly report — Ω (final)'},xlsx:{unit:'Data!B2',before:'7',after:'9'},pptx:{unit:'slide:1/shape:2',before:'Agenda',after:'Agenda (revised)'}};
async function fixture(t,format='docx'){
 const baseBytes=retained[format](),f=await wopiFixture(t,{format,baseBytes}),now=f.options.now;
 const state=Object.assign(f.state,{observations:[],modeDenied:null,selection:null});
 const limits={maxRequestMs:5000,maxRequestBytes:2097152,maxResponseBytes:16777216};
 const optionsOwner={async resolve(call){
  const required={'office-edit':'artifact.revise',inspect:'artifact.inspect',download:'artifact.download'}[call.intent];
  const authorize=async x=>{if(x.action!==required||state.modeDenied===call.intent)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});return f.artifactOptions.authorize(x);};
  return {documentOptions:{sessions:f.sessions,selectedClientId:f.claims.selectedClientId,artifactOptions:{...f.artifactOptions,now,authorize,ids:()=>({artifactId:id(960),versionId:id(961),objectId:id(962)})},now,limits,enabled:true},
   async recheck({phase}){state.observations.push({intent:call.intent,phase});if(state.modeDenied===call.intent)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}};
 }};
 const discoveryBytes=Buffer.from(`<wopi-discovery><net-zone name="external-https"><app><action ext="${format}" name="edit" urlsrc="https://office.example.test/browser/synthetic/cool.html?"/></app></net-zone></wopi-discovery>`);
 const launch=createCollaboraCodeLaunch({editorOrigin:'https://office.example.test',wopiOrigin:'https://wopi.example.test',discoveryBytes,codec:f.codec,now});
 const app=createRuntimeOfficeApplication({optionsOwner,sessions:f.sessions,now,limits,drafts:f.options.drafts,codec:f.codec,launch,generation:f.options.generation,browserOrigin:'https://app.example.test'});
 const binding=f.context.binding,scopes=f.context.scopes,selectedClientId=f.claims.selectedClientId;
 const selectionFor=version=>({artifactId:version.artifactId,versionId:version.versionId,objectSha256:version.object.sha256});
 const credential=()=>({credential:f.session.credential,deadlineMs:now()+5000});
 const document=selection=>({read:({signal,write})=>app.readSelected({...credential(),selection,intent:write?'revise':'download',signal})});
 const rights={currentRights:async()=>({scopes,expiresAtMs:now()+60000}),policyRevision:scopes[0].policyRevision};
 const preparerFor=selection=>createOfficeEditPreparer({binding,scopes,selectedClientId,document:document(selection),now,deadlineMs:now()+60000,...rights});
 const office=Object.fromEntries(['apply','reject','read'].map(m=>[m,({proposal,signal,deadlineMs})=>app[m+'Proposal']({...credential(),proposal,signal,deadlineMs})]));
 // The composed owner: the run's immutable selection, the live transcript and the borrowed attended session.
 const context={};registerDocumentIntentOwner(context,()=>[],undefined,undefined,{read:async()=>{throw Error('unused');},selectionFor:async()=>state.selection});
 const store={history:{async transcript(){return {latestRun:{binding,scopes,state:'completed'},pendingTurn:null};}}};
 const composed=createOfficeIntentOwner({context,application:app,sessions:f.sessions,store,retention:f.artifactOptions.retention,now,limits:{maxRequestMs:5000}});
 return {...f,app,state,baseBytes,format,binding,scopes,selectedClientId,selectionFor,preparerFor,rights,office,composed,now,edit:edits[format]};
}
const principalOf=f=>({tenantId:f.binding.tenantId,actorId:f.binding.actorId,role:'member',permissions:[],clientIds:[f.selectedClientId],membershipRevision:'m1'});
const propose=(f,n,after='New')=>({action:'propose',summary:'Tighten the heading',operations:[{unit:f.edit.unit,kind:'replace_text',before:f.edit.before,after}]});
const decision=(f,n,p,choice)=>({conversationId:f.binding.conversationId,deliveryId:delivery(n),proposalId:p.proposalId,commandSha256:p.commandSha256,decision:choice});
for(const format of ['docx','xlsx','pptx'])test(`${format}: read the exact selected version, prepare one proposal, apply it as a new version with the manual content preserved, replay adds nothing`,async t=>{
 const f=await fixture(t,format),selection=f.selectionFor(f.first.version),preparer=f.preparerFor(selection),{store,mount:m}=mount({binding:f.binding,preparers:[preparer],now:f.now,scopes:f.scopes});
 const read=await m.prepare({operation:OP,arguments:{action:'read'},deliveryId:delivery(1)});
 assert.equal(read.status,'read');assert.equal(read.document.versionId,f.first.version.versionId);assert.equal(read.document.objectSha256,sha(f.baseBytes));assert.equal(read.document.format,format);
 assert.deepEqual(read.outline,officeOutline(f.baseBytes,format));assert.equal(store.rows.size,0,'a read never journals');
 const request=propose(f,2,f.edit.after);
 const prepared=await m.prepare({operation:OP,arguments:request,deliveryId:delivery(2)}),p=prepared.proposal;
 assert.equal(prepared.status,'approval_required');assert.equal(p.kind,'office_edit');assert.equal(p.document.versionId,f.first.version.versionId);assert.equal(f.state.puts,1,'preparing writes nothing');
 assert.deepEqual(await m.prepare({operation:OP,arguments:request,deliveryId:delivery(2)}),prepared,'the same delivery replays the same proposal');
 const owner=createIntentApprovalOwner({journal:store.port,office:f.office,now:f.now,limits:{maxRequestMs:5000},enabled:true}),principal=principalOf(f);
 const listed=await owner.list({principal,request:{conversationId:f.binding.conversationId}});
 assert.equal(listed.intents[0].kind,'office_edit');assert.equal(listed.intents[0].result.proposalStatus,'proposed');
 const applied=await owner.decide({principal,request:decision(f,2,p,'approved')});
 assert.equal(applied.status,'office_edit_decided');assert.equal(applied.result.proposalStatus,'applied');
 const version=applied.result.version;assert.equal(version.parentVersionId,f.first.version.versionId);assert.equal(f.state.puts,2);assert.equal(f.sql.state.versions.size,2);
 // The published parts are exactly the pinned parts: every untouched part is byte-identical to the manual document.
 const source=await f.options.artifacts.editorSource(version.versionId,f.context,{write:true});
 assert.equal(sha(source.bytes),version.sha256);assert.deepEqual(officePartsDigest(source.bytes,format),p.result);
 const before=readZip(f.baseBytes),after=readZip(source.bytes),changed=format==='docx'?['word/document.xml']:format==='xlsx'?['xl/worksheets/sheet1.xml','xl/workbook.xml']:['ppt/slides/slide1.xml'];
 for(const [name,bytes] of before)if(!changed.includes(name))assert.ok(bytes.equals(after.get(name)),name);
 const record=await f.artifactOptions.versions.read(version.versionId);assert.equal(record.spec.sourceKind,OFFICE_PROPOSAL_KIND);assert.equal(record.spec.proposal.proposalId,p.proposalId);
 const again=await owner.decide({principal,request:decision(f,2,p,'approved')});assert.deepEqual(again.result,applied.result);assert.equal(f.state.puts,2,'Apply replays; no second publication');
 const after2=await owner.list({principal,request:{conversationId:f.binding.conversationId}});assert.equal(after2.intents[0].result.proposalStatus,'applied');assert.equal(after2.intents[0].result.version.versionId,version.versionId);
 // Rejecting an applied proposal is refused, never answered as if the version had not been published.
 await assert.rejects(owner.decide({principal,request:decision(f,2,p,'rejected')}),e=>e.message==='APPROVAL_DECISION_REFUSED');
 // A new proposal against the applied version continues the same artifact: the old version is no longer the head.
 const stale=await m.prepare({operation:OP,arguments:{action:'read'},deliveryId:delivery(3)});assert.equal(stale.document.versionId,f.first.version.versionId);
 await assert.rejects(m.prepare({operation:OP,arguments:request,deliveryId:delivery(4)}),e=>e.code==='CONFLICT');
 // The typed replacement model still refuses the retained Office version Meri just published, and says what to use instead.
 await assert.rejects(f.run({deliveryId:'typed-revision',baseVersionId:version.versionId,request:{operation:{docx:'create_word',xlsx:'create_excel',pptx:'create_powerpoint'}[format],format,title:'Synthetic',content:{docx:{blocks:[{kind:'paragraph',runs:[{text:'typed'}]}]},xlsx:{sheets:[{name:'Data',rows:[[{value:2}]]}]},pptx:{slides:[{title:'Typed',bullets:['x']}]}}[format]}}),
  e=>e.code==='EDITOR_TYPED_REVISION_UNAVAILABLE'&&e.message.includes('propose_office_edit'));
});
test('a proposal whose parent was superseded by a manual Publish refuses with the stale-head code and never writes',async t=>{
 const f=await fixture(t),selection=f.selectionFor(f.first.version),{store,mount:m}=mount({binding:f.binding,preparers:[f.preparerFor(selection)],now:f.now,scopes:f.scopes});
 const prepared=await m.prepare({operation:OP,arguments:propose(f,5),deliveryId:delivery(5)}),p=prepared.proposal;
 // The user edits manually in the meantime: open, save and publish the private draft on the same parent.
 const key={draftId:f.draft.draftId,versionId:f.first.version.versionId},auth=()=>({credential:f.session.credential,deadlineMs:f.now()+5000});
 await f.app.execute('open',key,auth());const started=await f.app.execute('launch',{...key,operation:'acquire',editorId:f.claims.editorId,expectedEpoch:0,mode:'edit'},auth());
 const wopi=(operation,extra={})=>{const original=f.request(operation,{...extra,token:started.launch.fields.access_token}),url=new URL(original.url);url.pathname=url.pathname.replace('synthetic-file',f.draft.draftId);return f.app.handleWopi(new Request(url,original));};
 assert.equal((await wopi('lock',{lock:'CODE'})).status,200);
 assert.equal((await wopi('save',{lock:'CODE',body:retained.docx()})).status,200);
 const saved=await f.app.execute('read',key,auth());
 await f.app.execute('release',{...key,editorId:started.editor.editorId,expectedEpoch:started.editor.epoch},auth());
 const published=await f.app.execute('publish',{...key,sequence:saved.draft.sequence,sha256:saved.draft.sha256},auth());
 assert.equal(published.publication.version.parentVersionId,f.first.version.versionId);const puts=f.state.puts;
 const owner=createIntentApprovalOwner({journal:store.port,office:f.office,now:f.now,limits:{maxRequestMs:5000},enabled:true}),principal=principalOf(f);
 const out=await owner.decide({principal,request:decision(f,5,p,'approved')});
 assert.equal(out.result.proposalStatus,'conflict');assert.equal(out.result.code,'OFFICE_EDIT_STALE_HEAD');assert.equal(out.result.version,null);assert.equal(f.state.puts,puts,'nothing was written');
 const listed=await owner.list({principal,request:{conversationId:f.binding.conversationId}});assert.equal(listed.intents[0].result.proposalStatus,'conflict');
});
test('reject settles the proposal durably: a reload and another tab read it as rejected, Apply can no longer publish it, and a tampered or foreign request is refused',async t=>{
 const f=await fixture(t),selection=f.selectionFor(f.first.version),{store,mount:m}=mount({binding:f.binding,preparers:[f.preparerFor(selection)],now:f.now,scopes:f.scopes});
 const p=(await m.prepare({operation:OP,arguments:propose(f,6),deliveryId:delivery(6)})).proposal;
 const tab=()=>createIntentApprovalOwner({journal:store.port,office:f.office,now:f.now,limits:{maxRequestMs:5000},enabled:true}),principal=principalOf(f);
 const rejected=await tab().decide({principal,request:decision(f,6,p,'rejected')});
 assert.equal(rejected.status,'office_edit_decided');assert.equal(rejected.result.proposalStatus,'rejected');assert.equal(rejected.result.version,null);assert.equal(f.state.puts,1);
 // Another tab (a fresh owner over the same journal) lists the decision and cannot apply the proposal any more.
 const other=tab();
 assert.equal((await other.list({principal,request:{conversationId:f.binding.conversationId}})).intents[0].result.proposalStatus,'rejected');
 const applied=await other.decide({principal,request:decision(f,6,p,'approved')});
 assert.equal(applied.result.proposalStatus,'rejected');assert.equal(applied.result.version,null);assert.equal(f.state.puts,1,'nothing was published');assert.equal(f.sql.state.versions.size,1);
 assert.equal((await other.decide({principal,request:decision(f,6,p,'rejected')})).result.proposalStatus,'rejected','reject replays');
 // The same parent still takes a different proposal: the rejected one did not touch the head.
 const q=(await m.prepare({operation:OP,arguments:propose(f,7,'Other wording'),deliveryId:delivery(7)})).proposal;
 await assert.rejects(other.decide({principal,request:{...decision(f,7,q,'approved'),commandSha256:'0'.repeat(64)}}),e=>e.message==='INTENT_MISMATCH');
 const foreign={...principal,actorId:'someone-else'};
 await assert.rejects(other.decide({principal:foreign,request:decision(f,7,q,'approved')}),e=>e.message==='INTENT_NOT_FOUND');
 // Unknown unit, changed text and an unsupported kind refuse at prepare, each with its exact code, and journal FAILED.
 for(const [n,operation,code] of [[8,{unit:'p:9',kind:'replace_text',before:'x',after:'y'},'REFUSED'],[9,{unit:'p:1',kind:'replace_text',before:'Other',after:'y'},'REFUSED'],[10,{unit:'p:3',kind:'replace_text',before:'See the site',after:'y'},'REFUSED'],[11,{unit:'p:1',kind:'replace_text',before:'x'},'INVALID_ARGUMENTS']])
  await assert.rejects(m.prepare({operation:OP,arguments:{action:'propose',summary:'s',operations:[operation]},deliveryId:delivery(n)}),e=>e.code===code);
 assert.equal((await other.decide({principal,request:decision(f,7,q,'approved')})).result.proposalStatus,'applied');assert.equal(f.state.puts,2);
 assert.equal((await tab().decide({principal,request:decision(f,6,p,'approved')})).result.proposalStatus,'rejected','the rejected row outlives the head change');
});
test('the composed owner: a preparer only for a selected document, propose under revise authority, a named principal bound to the attended session, cross-conversation and revoked-authority refusals, expiry',async t=>{
 const f=await fixture(t),principal=principalOf(f),runArguments={binding:f.binding,scopes:f.scopes,selectedClientId:f.selectedClientId,deadlineMs:f.now()+30000,...f.rights};
 assert.deepEqual(await f.composed.prepareForRun(runArguments),[],'no selected document, no office tool');
 f.state.selection=f.selectionFor(f.first.version);
 const preparers=await f.composed.prepareForRun(runArguments);assert.equal(preparers.length,1);assert.equal(preparers[0].owner,'office');
 const {store,mount:m}=mount({binding:f.binding,preparers,now:f.now,scopes:f.scopes});
 // Revoked revise authority: the outline still reads (download), but no proposal is prepared for an Apply that could only fail.
 f.state.modeDenied='office-edit';
 assert.equal((await m.prepare({operation:OP,arguments:{action:'read'},deliveryId:delivery(12)})).status,'read');
 await assert.rejects(m.prepare({operation:OP,arguments:propose(f,13),deliveryId:delivery(13)}),e=>e.code==='ACCESS_DENIED');
 f.state.modeDenied=null;
 const p=(await m.prepare({operation:OP,arguments:propose(f,14),deliveryId:delivery(14)})).proposal;
 // Every port names the principal, who must be the proposal's own actor in its own conversation.
 await assert.rejects(f.composed.apply({proposal:p}),e=>e.message==='INVALID_COMMAND');
 await assert.rejects(f.composed.apply({proposal:p,principal:{...principal,actorId:'someone-else'}}),{code:'ACCESS_DENIED'});
 const {commandSha256,...bound}=p,elsewhere={...bound,binding:{...bound.binding,conversationId:id(777)},context:{...bound.context,conversationId:id(777)}};
 await assert.rejects(f.composed.read({proposal:{...elsewhere,commandSha256:hash(elsewhere)},principal}),{code:'ACCESS_DENIED'});
 const journalOwner=createIntentApprovalOwner({journal:store.port,office:{apply:f.composed.apply,reject:f.composed.reject,read:f.composed.read},now:f.now,limits:{maxRequestMs:5000},enabled:true});
 await assert.rejects(journalOwner.decide({principal,request:{...decision(f,14,p,'approved'),conversationId:id(777)}}),e=>e.message==='INTENT_NOT_FOUND');
 assert.equal((await journalOwner.list({principal,request:{conversationId:f.binding.conversationId}})).intents.find(i=>i.deliveryId===delivery(14)).result.proposalStatus,'proposed');
 // Revise authority revoked between propose and Apply: refused before any write.
 f.state.modeDenied='office-edit';
 await assert.rejects(journalOwner.decide({principal,request:decision(f,14,p,'approved')}),e=>e.message==='EXECUTION_AUTHORITY_REFUSED');
 assert.equal(f.state.puts,1);assert.equal(f.sql.state.versions.size,1);
 f.state.modeDenied=null;
 // Expiry: the proposal outlives its own deadline; neither decision reaches the owner and the owner itself refuses it too.
 f.state.clock+=31000;
 for(const choice of ['approved','rejected'])await assert.rejects(journalOwner.decide({principal,request:decision(f,14,p,choice)}),e=>e.message==='INTENT_EXPIRED');
 const later=await f.sessions.issue({identityCredential:'synthetic-later-session'});
 await assert.rejects(f.app.applyProposal({credential:later.credential,proposal:p,deadlineMs:f.now()+5000}),{code:'INTENT_EXPIRED'});
 assert.equal(f.state.puts,1);
});
