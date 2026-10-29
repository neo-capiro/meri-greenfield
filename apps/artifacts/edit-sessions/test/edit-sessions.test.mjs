import test from 'node:test';import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';

import {admitEditSession,planSave,publishOutcome,reconcilePublish,conflictOptions,mayPublish} from '../edit-session.mjs';
import {createWopiAccessTokenCodec,MAX_TTL_MS} from '../wopi-access-token.mjs';
import {createSignedDownloadCodec} from '../../storage/signed-download.mjs';
import {EDITOR_ACTIVATION,EDITOR_REQUIREMENTS,editorActivationOpen} from '../activation.mjs';
import {plannedClasses,dataClass} from '../../../control/retention/data-classes.mjs';
/** Pure decisions only: no editor, storage, network or vendor. */
const code=c=>e=>e.code===c;
const clock=()=>{let t=1_760_000_000_000;const now=()=>t;now.advance=ms=>{t+=ms;};return now;};
const A='a'.repeat(64),B='b'.repeat(64),V1='00000001-0000-4000-8000-000000000001';

test('editor activation is held; the draft class stays planned until its owner and migration exist (Q-O9)',()=>{
 assert.equal(EDITOR_ACTIVATION.state,'held');assert.equal(editorActivationOpen(),false);
 assert.equal(editorActivationOpen({state:'open',evidence:'e/x.json',requirements:[...EDITOR_REQUIREMENTS]}),false);
 assert.ok(plannedClasses.includes('editorDrafts'));assert.equal(dataClass('editorDrafts').owner,null);
});

test('edit-session admission: inspect+revise edits, inspect only is read-only; PDF preview-only; desktop only; one editor',()=>{
 const base={format:'docx',suppressed:false,authority:{inspect:true,revise:true},desktop:true,activeEditor:false};
 assert.deepEqual(admitEditSession(base),{mode:'edit',userCanWrite:true});
 assert.deepEqual(admitEditSession({...base,authority:{inspect:true,revise:false}}),{mode:'read-only',userCanWrite:false});
 for(const [over,c] of [[{suppressed:true},'EDITOR_VERSION_SUPPRESSED'],[{authority:{revise:true}},'EDITOR_NOT_AUTHORIZED'],[{desktop:false},'EDITOR_DESKTOP_ONLY'],
  [{format:'pdf'},'EDITOR_FORMAT_PREVIEW_ONLY'],[{format:'txt'},'EDITOR_FORMAT_UNSUPPORTED'],[{activeEditor:true},'EDITOR_SESSION_BUSY']])
  assert.throws(()=>admitEditSession({...base,...over}),code(c));
});

test('saves: every accepted PutFile is a private draft; explicit Save never requests publication',()=>{
 const s=(kind,sha256,draftSeq=3,draftSha256=A)=>planSave({kind,sha256,bytes:10,maxBytes:100,draftSeq,draftSha256});
 assert.deepEqual(s('autosave',B),{newDraft:true,draftSeq:4,publishCandidate:false,closedWithDraft:false});
 assert.deepEqual(s('explicit',A),{newDraft:false,draftSeq:3,publishCandidate:false,closedWithDraft:false});
 assert.deepEqual(s('explicit',B),{newDraft:true,draftSeq:4,publishCandidate:false,closedWithDraft:false});
 assert.deepEqual(s('exit',B),{newDraft:true,draftSeq:4,publishCandidate:false,closedWithDraft:true});
 assert.equal(s('autosave',A,0,null).draftSeq,1,'the first draft');
 assert.throws(()=>planSave({kind:'explicit',sha256:A,bytes:101,maxBytes:100,draftSeq:0,draftSha256:null}),code('EDITOR_DRAFT_TOO_LARGE'));
 assert.throws(()=>s('save-as',B),code('EDITOR_SAVE_INVALID'));
 assert.throws(()=>s('publish',B),code('EDITOR_SAVE_INVALID'),'publishing must use a separate action');
 assert.throws(()=>s('explicit',B,Number.MAX_SAFE_INTEGER),code('EDITOR_SAVE_INVALID'));
 assert.equal(s('explicit',A,Number.MAX_SAFE_INTEGER).draftSeq,Number.MAX_SAFE_INTEGER);
});

test('publish outcomes: refusal keeps the draft, stale parent is a conflict without overwrite, anything else is an UNKNOWN barrier',()=>{
 assert.deepEqual(publishOutcome({status:'created',versionId:V1}),{draft:'published',versionId:V1});
 assert.deepEqual(publishOutcome({code:'EDITOR_STRUCTURE_REFUSED'}),{draft:'publish-refused',reason:'EDITOR_STRUCTURE_REFUSED'});
 const c=publishOutcome({code:'ARTIFACT_STALE_PARENT'});
 assert.deepEqual(c,{draft:'conflict',options:['reopen-on-latest','discard']});assert.ok(!c.options.includes('overwrite'));
 assert.deepEqual(conflictOptions({nonHeadParentLineage:true}),['branch','reopen-on-latest','discard'],'branch only after dot accepts Q-O10');
 for(const settlement of [{code:'ARTIFACT_EFFECT_UNKNOWN'},{code:'ARTIFACT_STORAGE_DEADLINE'},{},null,{code:'lowercase'}])assert.equal(publishOutcome(settlement).draft,'publish-unknown');
 assert.equal(mayPublish('publish-unknown'),false);assert.equal(mayPublish('conflict'),false);assert.equal(mayPublish('publish-refused'),true);
 assert.deepEqual(reconcilePublish({state:'present',versionId:V1}),{draft:'published',versionId:V1});
 assert.deepEqual(reconcilePublish({state:'absent'}),{draft:'draft',republish:true});
 assert.deepEqual(reconcilePublish({state:'timeout'}),{draft:'publish-unknown',republish:false},'never lifted by time or an indefinite answer');
});

test('WOPI access tokens: 10-minute bound, file binding, tamper and cross-domain refusal',()=>{
 const now=clock(),key=Buffer.alloc(32,7),codec=createWopiAccessTokenCodec({key,now});
 const claims={editSessionId:'00000002-0000-4000-8000-000000000002',fileId:'es-2',versionId:V1,conversationId:V1,editorId:V1,editorEpoch:1,actorId:'actor-synthetic',tenantId:'tenant-synthetic',userCanWrite:true,expiresAtMs:now()+MAX_TTL_MS,suppressionGeneration:4};
 const token=codec.issue(claims);
 assert.deepEqual(codec.verify(token,{fileId:'es-2'}),claims);
 assert.throws(()=>codec.verify(token,{fileId:'es-3'}),code('WOPI_TOKEN_FILE_MISMATCH'));
 assert.throws(()=>codec.issue({...claims,expiresAtMs:now()+MAX_TTL_MS+1}),code('WOPI_TOKEN_CLAIMS'));
 assert.throws(()=>codec.issue({...claims,extra:1}),code('WOPI_TOKEN_CLAIMS'));
 const [p,s]=token.split('.');assert.throws(()=>codec.verify(`${p}x.${s}`,{fileId:'es-2'}),code('WOPI_TOKEN_INVALID'));
 const download=createSignedDownloadCodec({key,now}).issue({versionId:V1,sha256:A,scopeDigest:B,actorId:'actor-synthetic',expiresAtMs:now()+1000,suppressionGeneration:4});
 assert.throws(()=>codec.verify(download,{fileId:'es-2'}),code('WOPI_TOKEN_INVALID'),'a download token never verifies as a WOPI token');
 now.advance(MAX_TTL_MS);assert.throws(()=>codec.verify(token,{fileId:'es-2'}),code('WOPI_TOKEN_EXPIRED'));
 assert.throws(()=>createWopiAccessTokenCodec({key:Buffer.alloc(31),now}),code('WOPI_TOKEN_CONFIGURATION'));
});
test('WOPI v1 binds the editor epoch and chat; old token domain and malformed proofs refuse',()=>{
 const now=clock(),key=Buffer.alloc(32,9),codec=createWopiAccessTokenCodec({key,now});
 const claims={editSessionId:V1,fileId:'draft',versionId:V1,conversationId:V1,editorId:V1,editorEpoch:2,actorId:'actor',tenantId:'tenant',userCanWrite:true,expiresAtMs:now()+10000,suppressionGeneration:1};
 const token=codec.issue(claims),[payload,signature]=token.split('.');
 assert.equal(codec.verify(token,{fileId:'draft'}).editorEpoch,2);
 const oldMac=createHmac('sha256',key).update('meri.wopi-access.v0.'+payload).digest('base64url');
 assert.throws(()=>codec.verify(`${payload}.${oldMac}`,{fileId:'draft'}),code('WOPI_TOKEN_INVALID'));
 const altered=Buffer.from(JSON.stringify({...claims,editorEpoch:3})).toString('base64url');
 assert.throws(()=>codec.verify(`${altered}.${signature}`,{fileId:'draft'}),code('WOPI_TOKEN_INVALID'));
 for(const patch of [{editorEpoch:0},{editorEpoch:2147483648},{editorId:'bad'},{conversationId:undefined}])
  assert.throws(()=>codec.issue({...claims,...patch}),code('WOPI_TOKEN_CLAIMS'));
});
test('invalid clocks and accessor claims never produce a usable WOPI token',()=>{
 const now=clock(),key=Buffer.alloc(32,9),claims={editSessionId:V1,fileId:'draft',versionId:V1,conversationId:V1,editorId:V1,editorEpoch:1,actorId:'actor',tenantId:'tenant',userCanWrite:true,expiresAtMs:now()+10000,suppressionGeneration:1};
 const codec=createWopiAccessTokenCodec({key,now}),token=codec.issue(claims);let touched=false;
 const value={...claims};Object.defineProperty(value,'editorId',{enumerable:true,get(){touched=true;return V1;}});
 assert.throws(()=>codec.issue(value),code('WOPI_TOKEN_CLAIMS'));assert.equal(touched,false);
 for(const bad of [NaN,-1,Infinity]){const broken=createWopiAccessTokenCodec({key,now:()=>bad});assert.throws(()=>broken.issue(claims));assert.throws(()=>broken.verify(token,{fileId:'draft'}));}
});
