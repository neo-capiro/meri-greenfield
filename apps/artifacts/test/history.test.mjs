/** Real artifact service and publication owners over scripted SQL, with no live effects. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createArtifactService} from '../service.mjs';import {nativeDocumentFixture} from './native-document-fixture.mjs';
async function fixture(){const f=nativeDocumentFixture(),a=await f.run(),b=await f.run({...f.call,deliveryId:'second',baseVersionId:a.version.versionId}),c=await f.run({...f.call,deliveryId:'third',baseVersionId:b.version.versionId});
 const owner=change=>createArtifactService({...f.options,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()}),...change});
 return {f,a,b,c,owner,query:{versionId:a.version.versionId,limit:2,cursor:null}};}
test('history pages newest first with an old anchor, preserving exact versions without reading bytes or allocating writes',async()=>{
 const {f,a,b,c,owner,query}=await fixture(),before={gets:f.state.gets,puts:f.state.puts,executions:f.state.executions.length,deliveries:f.state.rows.size};
 const first=await owner().history(query,f.context);assert.deepEqual(first.versions,[c.version,b.version]);assert.equal(first.anchorVersionId,a.version.versionId);assert.equal(first.headVersionId,c.version.versionId);assert.match(first.nextCursor,/^[a-f0-9]{64}$/u);
 const last=await owner().history({...query,cursor:first.nextCursor},f.context);assert.deepEqual(last.versions,[a.version]);assert.equal(last.nextCursor,null);assert.equal(Object.hasOwn(first,'inspection'),false);
 assert.deepEqual({gets:f.state.gets,puts:f.state.puts,executions:f.state.executions.length,deliveries:f.state.rows.size},before);
});
test('cursor cannot survive anchor, limit, binding, scope or head changes',async()=>{
 const {f,b,c,owner,query}=await fixture(),first=await owner().history(query,f.context),next={...query,cursor:first.nextCursor};
 for(const change of[{limit:1},{versionId:b.version.versionId},{cursor:'f'.repeat(64)}])await assert.rejects(owner().history({...next,...change},f.context),{code:'ARTIFACT_HISTORY_CURSOR'});
 await assert.rejects(owner().history(next,{...f.context,binding:{...f.context.binding,runId:randomUUID()}}),{code:'ARTIFACT_HISTORY_CURSOR'});
 await assert.rejects(owner().history(next,{...f.context,scopes:[{...f.context.scopes[0],policyRevision:'changed'}]}),{code:'ARTIFACT_VERSION_CONTEXT'});
 await f.run({...f.call,deliveryId:'fourth',baseVersionId:c.version.versionId});await assert.rejects(owner().history(next,f.context),{code:'ARTIFACT_HISTORY_CURSOR'});
});
test('current denial or retention suppression before release withholds all history',async()=>{
 const {f,a,owner,query}=await fixture();f.state.denied=true;await assert.rejects(owner().history(query,f.context),/CURRENT_ACCESS_DENIED/);f.state.denied=false;
 let checks=0;f.state.authorizeHook=()=>{if(++checks===3)f.sql.suppressed.add(`${f.context.binding.tenantId}:artifact:${a.version.artifactId}`);};
 await assert.rejects(owner().history(query,f.context),{code:'RETENTION_SUPPRESSED'});
});
test('a borrowed history owner cannot substitute, omit or reorder immutable versions',async()=>{
 const {f,owner,query}=await fixture(),history=f.options.versions.history;
 for(const change of[result=>{result.records.reverse();},result=>{result.records.splice(1,1);},result=>{result.records[0].version.binding.actorId='foreign';},result=>{result.anchorVersionId=randomUUID();},result=>{result.records[0].version.filename='Other.txt';}]){
  const versions={...f.options.versions,async history(...args){const result=await history(...args);change(result);return result;}};
  await assert.rejects(owner({versions}).history(query,f.context));
 }
});
test('more than ten durable versions remain pageable after reconstructing the service',async()=>{
 const {f,a,b,c,owner,query}=await fixture(),versions=[a.version,b.version,c.version];
 for(let i=4;i<=12;i++){const next=await f.run({...f.call,deliveryId:'version-'+i,baseVersionId:versions.at(-1).versionId});versions.push(next.version);}
 const pages=[];let cursor=null;do{const page=await owner().history({...query,limit:5,cursor},f.context);pages.push(...page.versions);cursor=page.nextCursor;}while(cursor!==null);
 assert.deepEqual(pages,versions.toReversed());assert.equal(new Set(pages.map(version=>version.versionId)).size,12);
});
