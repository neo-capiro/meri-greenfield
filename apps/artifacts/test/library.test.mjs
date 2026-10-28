import test from 'node:test';import assert from 'node:assert/strict';
import {libraryFixture,libraryRecord,id,NOW} from './library-fixture.mjs';import {commit} from '../storage/test/sql-fixture.mjs';
test('library returns own cross-conversation heads with fresh admission and release, preserving direct-read fences',async()=>{
 const f=await libraryFixture(),page=await f.owner().list(f.query,f.context);assert.deepEqual(page.versions,[f.a.version,f.b.version]);assert.match(page.nextCursor,/^[a-f0-9]{64}$/u);
 assert.deepEqual(f.state.calls.map(x=>x.phase),['admission','admission','release','release']);
 const last=await f.owner().list({...f.query,cursor:page.nextCursor},f.context);assert.deepEqual(last.versions,[f.c.version]);assert.equal(last.nextCursor,null);assert.equal(f.state.calls.some(x=>x.versionId===f.d.version.versionId),false);
 await assert.rejects(f.owner().inspect(f.b.version.versionId,f.context),{code:'ARTIFACT_VERSION_CONTEXT'});
 assert.deepEqual((await f.owner().list({...f.query,scope:'client',limit:100},f.context)).versions,[f.a.version,f.b.version]);
 assert.deepEqual((await f.owner().list({...f.query,scope:'conversation'},f.context)).versions,[f.a.version]);
});
test('an entirely denied bounded page has an opaque continuation to a later authorized row',async()=>{
 const f=await libraryFixture();f.state.denied.add(f.a.version.binding.conversationId);
 const first=await f.owner().list({...f.query,limit:1},f.context);assert.deepEqual(first.versions,[]);assert.match(first.nextCursor,/^[a-f0-9]{64}$/u);assert.deepEqual(Object.keys(first).sort(),['nextCursor','scope','versions']);assert.equal(f.state.calls.length,1);
 const next=await f.owner().list({...f.query,limit:1,cursor:first.nextCursor},f.context);assert.deepEqual(next.versions,[f.b.version]);assert.notEqual(next.nextCursor,null);
});
test('suppression and release-time revocation omit rows; unknown authority never becomes an empty success',async()=>{
 const f=await libraryFixture();f.sql.suppressed.add(`${f.context.binding.tenantId}:artifact:${f.a.version.artifactId}`);f.state.releaseDenied.add(f.b.version.binding.conversationId);
 assert.deepEqual((await f.owner().list(f.query,f.context)).versions,[]);assert.equal(f.state.calls.some(x=>x.versionId===f.a.version.versionId),false);
 f.state.unavailable=true;await assert.rejects(f.owner().list({...f.query,cursor:null},f.context),{code:'UNAVAILABLE'});
});
test('cursor binds query, current scope/binding and candidate heads across reconstruction',async()=>{
 const f=await libraryFixture(),page=await f.owner().list(f.query,f.context),query={...f.query,cursor:page.nextCursor};
 for(const change of[{limit:1},{scope:'conversation'},{cursor:'f'.repeat(64)}])await assert.rejects(f.owner().list({...query,...change},f.context),{code:'ARTIFACT_LIBRARY_CURSOR'});
 await assert.rejects(f.owner().list(query,{...f.context,binding:{...f.context.binding,runId:id(888)}}),{code:'ARTIFACT_LIBRARY_CURSOR'});
 await assert.rejects(f.owner().list(query,{...f.context,scopes:[{...f.context.scopes[0],policyRevision:'changed'}]}),{code:'ARTIFACT_LIBRARY_CURSOR'});
 const next=libraryRecord(11,{artifactId:f.a.version.artifactId,parentVersionId:f.a.version.versionId});await f.sql.create().commit(commit(next));await assert.rejects(f.owner().list(query,f.context),{code:'ARTIFACT_LIBRARY_CURSOR'});
});
test('borrowed discovery cannot substitute tenant/actor/origin metadata or authority receipts',async()=>{
 const f=await libraryFixture(),list=f.options.versions.list;
 for(const change of[r=>{r.records[0].version.binding.actorId='other';},r=>{r.records.push(r.records[0]);}]){const versions={...f.options.versions,async list(...args){const r=await list(...args);change(r);return r;}};await assert.rejects(f.owner({versions}).list(f.query,f.context));}
 const origin=f.options.authorizeOrigin;for(const change of[r=>({...r,versionSha256:'f'.repeat(64)}),r=>({...r,checkedAtMs:NOW-1}),r=>({...r,expiresAtMs:NOW}),r=>({...r,selectedClientId:id(999)})])await assert.rejects(f.owner({authorizeOrigin:async x=>change(await origin(x))}).list(f.query,f.context),{code:'ARTIFACT_LIBRARY_AUTHORITY'});
});
test('more than ten owned heads survive pagination and owner reconstruction without local recent-state',async()=>{
 const f=await libraryFixture();for(let n=50;n<61;n++)await f.sql.create().commit(commit(libraryRecord(n)));
 const rows=[];let cursor=null;do{const page=await f.owner().list({...f.query,limit:5,cursor},f.context);rows.push(...page.versions);cursor=page.nextCursor;}while(cursor!==null);
 assert.equal(rows.length,14);assert.equal(new Set(rows.map(v=>v.artifactId)).size,14);assert.equal(rows.some(v=>v.binding.actorId==='colleague'),false);
});
test('a new head during origin admission refuses the stale candidate snapshot',async()=>{
 const f=await libraryFixture();let changed=false;f.state.originHook=async({phase})=>{if(phase==='admission'&&!changed){changed=true;await f.sql.create().commit(commit(libraryRecord(11,{artifactId:f.a.version.artifactId,parentVersionId:f.a.version.versionId})));}};
 await assert.rejects(f.owner().list(f.query,f.context),{code:'ARTIFACT_LIBRARY_CURSOR'});
});
test('same-phase cached origin receipts retain their original check time and release is separately fresh',async()=>{
 const f=await libraryFixture(),cached=new Map(),origin=f.options.authorizeOrigin;const authorizeOrigin=async input=>{const key=input.phase;f.state.clock+=5;let receipt=cached.get(key);if(!receipt){receipt=await origin(input);cached.set(key,receipt);}const exact=await origin(input);return {...exact,checkedAtMs:receipt.checkedAtMs};};
 const page=await f.owner({authorizeOrigin}).list(f.query,f.context);assert.equal(page.versions.length,2);assert.ok(cached.get('release').checkedAtMs>cached.get('admission').checkedAtMs);
});
test('corrupt SQL cannot be exposed from otherwise valid publication candidates',async()=>{
 const f=await libraryFixture();f.sql.state.versions.get(f.a.version.versionId).record_sha256='f'.repeat(64);await assert.rejects(f.owner().list(f.query,f.context),error=>error.code==='RETENTION_STORE_UNAVAILABLE'&&error.cause?.code==='ARTIFACT_VERSION_CORRUPT');
});
