import test from 'node:test';import assert from 'node:assert/strict';
import {bindPreparedRelationshipArtifactOptions} from '../binding.mjs';
import {createRelationshipBriefCompiler} from '../compose.mjs';
import {artifactValidators as v} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {unitContext,selected,makeInput,sourcePage,NOW} from './fixtures.mjs';
test('Relationship artifact options refuse accessors and Proxy before any trap',()=>{
 let effects=0;const options={get context(){effects++;throw Error('synthetic');},authorize(){}};assert.throws(()=>bindPreparedRelationshipArtifactOptions({},options));
 const proxy=new Proxy({}, {ownKeys(){effects++;return [];},get(){effects++;throw Error('synthetic');},getOwnPropertyDescriptor(){effects++;throw Error('synthetic');}});assert.throws(()=>bindPreparedRelationshipArtifactOptions({},proxy));assert.equal(effects,0);
});
test('Relationship preparation preserves current authorization and rejects request substitution',async()=>{
 const context=unitContext(),prepared=await createRelationshipBriefCompiler({defaultCongress:119,now:()=>NOW,readSource:sourcePage}).prepare(makeInput(),context,{selection:selected(context)});
 let calls=0;const objects={marker:'existing-store'},owner={context:prepared.context,objects,authorize(call){assert.equal(this,owner);calls++;return {receipt:'synthetic',call};}},options=bindPreparedRelationshipArtifactOptions(prepared,owner);assert.equal(options.objects,objects);
 const call={action:'artifact.generate',resource:{versionId:null},binding:prepared.context.binding,scopes:prepared.context.scopes,requestSha256:v.nativeRequestSha256(prepared.request,prepared.context,null)};
 await options.authorize(call);assert.equal(calls,1);
 const changed={...prepared.request,title:'substituted'};await assert.rejects(options.authorize({...call,requestSha256:v.nativeRequestSha256(changed,prepared.context,null)}),{code:'ACCESS_DENIED'});assert.equal(calls,1);
 let effects=0;assert.throws(()=>bindPreparedRelationshipArtifactOptions(prepared,{context:prepared.context,get authorize(){effects++;throw Error('synthetic');}}));assert.equal(effects,0);
});
