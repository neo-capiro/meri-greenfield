/** The same-document bridge through the actual runtime office owners: the governed read and prepare over the exact
 * selected version, Apply through the artifact publisher with CAS on the parent head, replay without a second write,
 * stale-head and mismatch refusals, and the typed-revision refusal that names the bridge. Synthetic options
 * authority, Core HTTP and SQL/object ports as in office-application.test.mjs; no engine or rendering claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {wopiFixture} from '../../../artifacts/edit-sessions/test/wopi-fixture.mjs';
import {createCollaboraCodeLaunch} from '../../../artifacts/edit-sessions/collabora-code.mjs';
import {createRuntimeOfficeApplication} from '../office-application.mjs';
import {createOfficeEditPreparer} from '../../../control/intents/office-edit-preparer.mjs';
import {createIntentApprovalOwner} from '../../../control/intents/approval.mjs';
import {mount,delivery} from '../../../control/intents/test/fixture.mjs';
import {id} from '../../../artifacts/storage/test/sql-fixture.mjs';
import {retained} from '../../../artifacts/office-units/test/fixtures.mjs';
import {officeOutline} from '../../../artifacts/office-units/index.mjs';
import {readZip} from '../../../artifacts/structure/zip.mjs';
import {OFFICE_PROPOSAL_KIND} from '../../../../packages/contracts/office-edit.mjs';
const OP={id:'propose_office_edit',version:'0.2.0'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const edits={docx:{unit:'p:1',before:'Quarterly report — Ω',after:'Quarterly report — Ω (final)'},xlsx:{unit:'Data!B2',before:'7',after:'9'},pptx:{unit:'slide:1/shape:2',before:'Agenda',after:'Agenda (revised)'}};
async function fixture(t,format='docx'){
 const baseBytes=retained[format](),f=await wopiFixture(t,{format,baseBytes}),now=f.options.now;
 const state=Object.assign(f.state,{observations:[],modeDenied:null});
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
 const document=selection=>({read:({signal})=>app.readSelected({...credential(),selection,signal})});
 const preparerFor=selection=>createOfficeEditPreparer({binding,scopes,selectedClientId,document:document(selection),now,deadlineMs:now()+60000,currentRights:async()=>({scopes,expiresAtMs:now()+60000}),policyRevision:scopes[0].policyRevision});
 const office={apply:({proposal,signal,deadlineMs})=>app.applyProposal({...credential(),proposal,signal,deadlineMs}),read:({proposal,signal,deadlineMs})=>app.readProposal({...credential(),proposal,signal,deadlineMs})};
 return {...f,app,state,baseBytes,format,binding,scopes,selectedClientId,selectionFor,preparerFor,office,now,edit:edits[format]};
}
const principalOf=f=>({tenantId:f.binding.tenantId,actorId:f.binding.actorId,role:'member',permissions:[],clientIds:[f.selectedClientId],membershipRevision:'m1'});
for(const format of ['docx','xlsx','pptx'])test(`${format}: read the exact selected version, prepare one proposal, apply it as a new version with the manual content preserved, replay adds nothing`,async t=>{
 const f=await fixture(t,format),selection=f.selectionFor(f.first.version),preparer=f.preparerFor(selection),{store,mount:m}=mount({binding:f.binding,preparers:[preparer],now:f.now,scopes:f.scopes});
 const read=await m.prepare({operation:OP,arguments:{action:'read'},deliveryId:delivery(1)});
 assert.equal(read.status,'read');assert.equal(read.document.versionId,f.first.version.versionId);assert.equal(read.document.objectSha256,sha(f.baseBytes));assert.equal(read.document.format,format);
 assert.deepEqual(read.outline,officeOutline(f.baseBytes,format));assert.equal(store.rows.size,0,'a read never journals');
 const propose={action:'propose',summary:'Tighten the heading',operations:[{unit:f.edit.unit,kind:'replace_text',before:f.edit.before,after:f.edit.after}]};
 const prepared=await m.prepare({operation:OP,arguments:propose,deliveryId:delivery(2)}),p=prepared.proposal;
 assert.equal(prepared.status,'approval_required');assert.equal(p.kind,'office_edit');assert.equal(p.document.versionId,f.first.version.versionId);assert.equal(f.state.puts,1,'preparing writes nothing');
 assert.deepEqual(await m.prepare({operation:OP,arguments:propose,deliveryId:delivery(2)}),prepared,'the same delivery replays the same proposal');
 const owner=createIntentApprovalOwner({journal:store.port,office:f.office,now:f.now,limits:{maxRequestMs:5000},enabled:true}),principal=principalOf(f);
 const listed=await owner.list({principal,request:{conversationId:f.binding.conversationId}});
 assert.equal(listed.intents[0].kind,'office_edit');assert.equal(listed.intents[0].result.proposalStatus,'proposed');
 const request={conversationId:f.binding.conversationId,deliveryId:delivery(2),proposalId:p.proposalId,commandSha256:p.commandSha256,decision:'approved'};
 const applied=await owner.decide({principal,request});
 assert.equal(applied.status,'office_edit_decided');assert.equal(applied.result.proposalStatus,'applied');
 const version=applied.result.version;assert.equal(version.parentVersionId,f.first.version.versionId);assert.equal(version.sha256,p.result.sha256);assert.equal(f.state.puts,2);assert.equal(f.sql.state.versions.size,2);
 // The published bytes are exactly the pinned bytes: every untouched part is byte-identical to the manual document.
 const source=await f.options.artifacts.editorSource(version.versionId,f.context,{write:true});
 assert.equal(sha(source.bytes),p.result.sha256);
 const before=readZip(f.baseBytes),after=readZip(source.bytes),changed=format==='docx'?['word/document.xml']:format==='xlsx'?['xl/worksheets/sheet1.xml']:['ppt/slides/slide1.xml'];
 for(const [name,bytes] of before)if(!changed.includes(name))assert.ok(bytes.equals(after.get(name)),name);
 const record=await f.artifactOptions.versions.read(version.versionId);assert.equal(record.spec.sourceKind,OFFICE_PROPOSAL_KIND);assert.equal(record.spec.proposal.proposalId,p.proposalId);
 const again=await owner.decide({principal,request});assert.deepEqual(again.result,applied.result);assert.equal(f.state.puts,2,'Apply replays; no second publication');
 const after2=await owner.list({principal,request:{conversationId:f.binding.conversationId}});assert.equal(after2.intents[0].result.proposalStatus,'applied');assert.equal(after2.intents[0].result.version.versionId,version.versionId);
 // A new proposal against the applied version continues the same artifact: the old version is no longer the head.
 const stale=await m.prepare({operation:OP,arguments:{action:'read'},deliveryId:delivery(3)});assert.equal(stale.document.versionId,f.first.version.versionId);
 await assert.rejects(m.prepare({operation:OP,arguments:propose,deliveryId:delivery(4)}),e=>e.code==='CONFLICT');
 // The typed replacement model still refuses the retained Office version Meri just published, and says what to use instead.
 await assert.rejects(f.run({deliveryId:'typed-revision',baseVersionId:version.versionId,request:{operation:{docx:'create_word',xlsx:'create_excel',pptx:'create_powerpoint'}[format],format,title:'Synthetic',content:{docx:{blocks:[{kind:'paragraph',runs:[{text:'typed'}]}]},xlsx:{sheets:[{name:'Data',rows:[[{value:2}]]}]},pptx:{slides:[{title:'Typed',bullets:['x']}]}}[format]}}),
  e=>e.code==='EDITOR_TYPED_REVISION_UNAVAILABLE'&&e.message.includes('propose_office_edit'));
});
test('a proposal whose parent was superseded by a manual Publish refuses with the stale-head code and never writes',async t=>{
 const f=await fixture(t),selection=f.selectionFor(f.first.version),{store,mount:m}=mount({binding:f.binding,preparers:[f.preparerFor(selection)],now:f.now,scopes:f.scopes});
 const prepared=await m.prepare({operation:OP,arguments:{action:'propose',summary:'s',operations:[{unit:'p:1',kind:'replace_text',before:'Quarterly report — Ω',after:'New'}]},deliveryId:delivery(5)}),p=prepared.proposal;
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
 const out=await owner.decide({principal,request:{conversationId:f.binding.conversationId,deliveryId:delivery(5),proposalId:p.proposalId,commandSha256:p.commandSha256,decision:'approved'}});
 assert.equal(out.result.proposalStatus,'conflict');assert.equal(out.result.code,'OFFICE_EDIT_STALE_HEAD');assert.equal(out.result.version,null);assert.equal(f.state.puts,puts,'nothing was written');
 const listed=await owner.list({principal,request:{conversationId:f.binding.conversationId}});assert.equal(listed.intents[0].result.proposalStatus,'conflict');
});
test('reject records nothing, a tampered proposal is refused before any owner call, and each prepare refusal keeps its exact code',async t=>{
 const f=await fixture(t),selection=f.selectionFor(f.first.version),{store,mount:m}=mount({binding:f.binding,preparers:[f.preparerFor(selection)],now:f.now,scopes:f.scopes});
 const prepared=await m.prepare({operation:OP,arguments:{action:'propose',summary:'s',operations:[{unit:'p:1',kind:'replace_text',before:'Quarterly report — Ω',after:'New'}]},deliveryId:delivery(6)}),p=prepared.proposal;
 const owner=createIntentApprovalOwner({journal:store.port,office:f.office,now:f.now,limits:{maxRequestMs:5000},enabled:true}),principal=principalOf(f);
 const rejected=await owner.decide({principal,request:{conversationId:f.binding.conversationId,deliveryId:delivery(6),proposalId:p.proposalId,commandSha256:p.commandSha256,decision:'rejected'}});
 assert.equal(rejected.result.proposalStatus,'rejected');assert.equal(f.state.puts,1);
 await assert.rejects(owner.decide({principal,request:{conversationId:f.binding.conversationId,deliveryId:delivery(6),proposalId:p.proposalId,commandSha256:'0'.repeat(64),decision:'approved'}}),e=>e.message==='INTENT_MISMATCH');
 const foreign={...principal,actorId:'someone-else'};
 await assert.rejects(owner.decide({principal:foreign,request:{conversationId:f.binding.conversationId,deliveryId:delivery(6),proposalId:p.proposalId,commandSha256:p.commandSha256,decision:'approved'}}),e=>e.message==='INTENT_NOT_FOUND');
 // Unknown unit, changed text and an unsupported kind refuse at prepare, each with its exact code, and journal FAILED.
 for(const [n,operation,code] of [[7,{unit:'p:9',kind:'replace_text',before:'x',after:'y'},'REFUSED'],[8,{unit:'p:1',kind:'replace_text',before:'Other',after:'y'},'REFUSED'],[9,{unit:'p:3',kind:'replace_text',before:'See the site',after:'y'},'REFUSED'],[10,{unit:'p:1',kind:'replace_text',before:'x'},'INVALID_ARGUMENTS']])
  await assert.rejects(m.prepare({operation:OP,arguments:{action:'propose',summary:'s',operations:[operation]},deliveryId:delivery(n)}),e=>e.code===code);
});
