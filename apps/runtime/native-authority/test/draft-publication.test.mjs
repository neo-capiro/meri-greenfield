/** SYNTHETIC: the document draft publication over a scripted conversation store; no database, model or HTTP. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraftPublication,draftEventId} from '../draft-publication.mjs';
import {binding,scopes} from '../../../control/conversations/test/store-fixture.mjs';
const at=1800000000000,artifactId='7'.repeat(8)+'-7777-4777-8777-'+'7'.repeat(12),versionId='8'.repeat(8)+'-8888-4888-8888-'+'8'.repeat(12);
const version=(patch={})=>({artifactId,versionId,binding,scopes,filename:'Note.docx',...patch});
function fixture({current=async()=>({scopes}),fail=false}={}){
 const appended=[];
 const store={async append(b,input,check,expected){check();if(fail)throw Error('store down');appended.push({binding:b,input,expected});return {...input,binding:b,sequence:appended.length,scopes:expected};}};
 return {appended,publish:createDraftPublication({store,binding,current,now:()=>at})};
}

test('a draft becomes the run\'s artifact.available event, bound to the run and its current scopes, with a replay-stable id',async()=>{
 const f=fixture();
 const event=await f.publish({version:version(),signal:new AbortController().signal});
 assert.equal(f.appended.length,1);
 const {input,expected}=f.appended[0];
 assert.deepEqual(input,{eventId:draftEventId({binding,type:'artifact.available',data:{artifactId,versionId}}),createdAt:new Date(at).toISOString(),type:'artifact.available',data:{artifactId,versionId}});
 assert.deepEqual(expected,scopes);assert.equal(event.sequence,1);
 assert.match(input.eventId,/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/u);
 assert.equal(input.eventId,(await f.publish({version:version()})).eventId,'the same version publishes the same event identity');
 assert.notEqual(input.eventId,draftEventId({binding,type:'artifact.available',data:{artifactId,versionId:versionId.replace('8','9')}}));
});

test('a version of another run, another scope or a malformed identity is refused before the store; store failures and cancellation surface',async()=>{
 const f=fixture(),code=c=>e=>e.code===c;
 await assert.rejects(f.publish({version:version({binding:{...binding,runId:'0'.repeat(8)+'-0000-4000-8000-'+'0'.repeat(12)}})}),code('ACCESS_DENIED'));
 await assert.rejects(f.publish({version:version({scopes:[{...scopes[0],resourceId:'other'}]})}),code('ACCESS_DENIED'));
 await assert.rejects(f.publish({version:version({scopes:[]})}),code('ACCESS_DENIED'));
 await assert.rejects(f.publish({version:version({versionId:'not-a-uuid'})}),code('ACCESS_DENIED'));
 await assert.rejects(f.publish({version:version({artifactId:undefined})}),code('ACCESS_DENIED'));
 assert.equal(f.appended.length,0);
 // A policy revision that moved between the draft and the publication is not a different scope.
 const moved=fixture({current:async()=>({scopes:scopes.map(s=>({...s,policyRevision:'policy2'}))})});
 assert.equal((await moved.publish({version:version()})).sequence,1);assert.equal(moved.appended[0].expected[0].policyRevision,'policy2');
 // Current facts without scopes refuse; a failing store and an aborted lifetime surface to the caller (the mount keeps the draft).
 await assert.rejects(fixture({current:async()=>({scopes:[]})}).publish({version:version()}),code('ACCESS_DENIED'));
 await assert.rejects(fixture({fail:true}).publish({version:version()}),/store down/u);
 const aborted=new AbortController();aborted.abort();
 await assert.rejects(fixture().publish({version:version(),signal:aborted.signal}),code('CANCELLED'));
 assert.throws(()=>createDraftPublication({store:{},binding,current:async()=>({scopes}),now:()=>at}),code('INTENT_CONFIGURATION'));
 assert.throws(()=>createDraftPublication({store:{append(){}},binding:{...binding,runId:'x'},current:async()=>({scopes}),now:()=>at}));
});
