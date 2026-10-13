import test from 'node:test';import assert from 'node:assert/strict';
import {bindPreparedRelationshipArtifactOptions} from '../binding.mjs';
import {createRelationshipBriefCompiler} from '../compose.mjs';
import {unitContext,selected,makeInput,sourcePage,NOW} from './fixtures.mjs';
test('Relationship artifact options refuse accessors and Proxy before any trap',()=>{
 let effects=0;const options={get context(){effects++;throw Error('synthetic');},authority:{check(){}}};assert.throws(()=>bindPreparedRelationshipArtifactOptions({},options));
 const proxy=new Proxy({}, {ownKeys(){effects++;return [];},get(){effects++;throw Error('synthetic');},getOwnPropertyDescriptor(){effects++;throw Error('synthetic');}});assert.throws(()=>bindPreparedRelationshipArtifactOptions({},proxy));assert.equal(effects,0);
});
test('Relationship preparation preserves the authority receiver and borrowed extra options',async()=>{
 const context=unitContext(),prepared=await createRelationshipBriefCompiler({defaultCongress:119,now:()=>NOW,readSource:sourcePage}).prepare(makeInput(),context,{selection:selected(context)});
 let calls=0;const authority={marker:'borrowed',check(call){assert.equal(this,authority);calls++;return {receipt:'synthetic',call};}},objects={marker:'existing-store'},options=bindPreparedRelationshipArtifactOptions(prepared,{context:prepared.context,authority,objects});assert.equal(options.objects,objects);
 await options.authority.check({input:{request:prepared.request,context:prepared.context,baseVersionId:null}});assert.equal(calls,1);
 const changed=structuredClone(prepared.request);changed.title='substituted';await assert.rejects(options.authority.check({input:{request:changed,context:prepared.context,baseVersionId:null}}),{code:'ACCESS_DENIED'});assert.equal(calls,1);
 let effects=0;assert.throws(()=>bindPreparedRelationshipArtifactOptions(prepared,{context:prepared.context,authority:{get check(){effects++;throw Error('synthetic');}}}));assert.equal(effects,0);
});
