import test from 'node:test';import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';

import {createWopiAccessTokenCodec,MAX_TTL_MS} from '../wopi-access-token.mjs';
import {createSignedDownloadCodec} from '../../storage/signed-download.mjs';
import {plannedClasses,dataClass} from '../../../control/retention/data-classes.mjs';
/** Pure decisions only: no editor, storage, network or vendor. */
const code=c=>e=>e.code===c;
const clock=()=>{let t=1_760_000_000_000;const now=()=>t;now.advance=ms=>{t+=ms;};return now;};
const A='a'.repeat(64),B='b'.repeat(64),V1='00000001-0000-4000-8000-000000000001';
const attended=(tenantId='tenant',actorId='actor')=>({runBinding:{tenantId,actorId,conversationId:V1,runId:V1,attemptId:V1,workerId:V1,writerFence:1},selectedClientId:null,scopesSha256:A,sessionSha256:B});

test('the drafts class is owner-managed and its owner stays the shipped one (Q-O9)',()=>{
 const drafts=dataClass('editorDrafts');
 assert.equal(drafts.status,'owner-managed');assert.equal(drafts.owner,'apps/control/retention/office-core-client.mjs');
 assert.equal(drafts.deletion,'owner-custody');assert.equal(plannedClasses.includes('editorDrafts'),false);
});

test('WOPI access tokens: 10-minute bound, file binding, tamper and cross-domain refusal',()=>{
 const now=clock(),key=Buffer.alloc(32,7),codec=createWopiAccessTokenCodec({key,now});
 const claims={...attended('tenant-synthetic','actor-synthetic'),editSessionId:'00000002-0000-4000-8000-000000000002',fileId:'es-2',versionId:V1,conversationId:V1,editorId:V1,editorEpoch:1,actorId:'actor-synthetic',tenantId:'tenant-synthetic',userCanWrite:true,expiresAtMs:now()+MAX_TTL_MS,suppressionGeneration:4};
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
test('WOPI v2 binds the editor epoch, native run and client; old token domains and malformed proofs refuse',()=>{
 const now=clock(),key=Buffer.alloc(32,9),codec=createWopiAccessTokenCodec({key,now});
 const claims={...attended(),editSessionId:V1,fileId:'draft',versionId:V1,conversationId:V1,editorId:V1,editorEpoch:2,actorId:'actor',tenantId:'tenant',userCanWrite:true,expiresAtMs:now()+10000,suppressionGeneration:1};
 const token=codec.issue(claims),[payload,signature]=token.split('.');
 assert.equal(codec.verify(token,{fileId:'draft'}).editorEpoch,2);
 for(const domain of ['meri.wopi-access.v0.','meri.wopi-access.v1.']){
  const oldMac=createHmac('sha256',key).update(domain+payload).digest('base64url');
  assert.throws(()=>codec.verify(`${payload}.${oldMac}`,{fileId:'draft'}),code('WOPI_TOKEN_INVALID'));
 }
 const altered=Buffer.from(JSON.stringify({...claims,editorEpoch:3})).toString('base64url');
 assert.throws(()=>codec.verify(`${altered}.${signature}`,{fileId:'draft'}),code('WOPI_TOKEN_INVALID'));
 for(const patch of [{editorEpoch:0},{editorEpoch:2147483648},{editorId:'bad'},{conversationId:undefined},{runBinding:{...claims.runBinding,actorId:'another'}},{selectedClientId:'bad'},{scopesSha256:'bad'}])
  assert.throws(()=>codec.issue({...claims,...patch}),code('WOPI_TOKEN_CLAIMS'));
});
test('invalid clocks and accessor claims never produce a usable WOPI token',()=>{
 const now=clock(),key=Buffer.alloc(32,9),claims={...attended(),editSessionId:V1,fileId:'draft',versionId:V1,conversationId:V1,editorId:V1,editorEpoch:1,actorId:'actor',tenantId:'tenant',userCanWrite:true,expiresAtMs:now()+10000,suppressionGeneration:1};
 const codec=createWopiAccessTokenCodec({key,now}),token=codec.issue(claims);let touched=false;
 const value={...claims};Object.defineProperty(value,'editorId',{enumerable:true,get(){touched=true;return V1;}});
 assert.throws(()=>codec.issue(value),code('WOPI_TOKEN_CLAIMS'));assert.equal(touched,false);
 for(const bad of [NaN,-1,Infinity]){const broken=createWopiAccessTokenCodec({key,now:()=>bad});assert.throws(()=>broken.issue(claims));assert.throws(()=>broken.verify(token,{fileId:'draft'}));}
});
