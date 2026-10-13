import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=process.env.MERI_WORKFLOW_REVIEW_ROOT;assert(root);
const load=path=>import(pathToFileURL(root+'/'+path));
const {bindPreparedRelationshipArtifactOptions}=await load('apps/control/document-application/relationship-brief/binding.mjs');
const {createRelationshipBriefCompiler}=await load('apps/control/document-application/relationship-brief/compose.mjs');
const f=await load('apps/control/document-application/relationship-brief/test/fixtures.mjs');
const prepared=()=>{const context=f.unitContext();return createRelationshipBriefCompiler({defaultCongress:119,now:()=>f.NOW,readSource:f.sourcePage}).prepare(f.makeInput(),context,{selection:f.selected(context)});};
test('extra-option getters, inherited authority and nested authority proxies cause no configuration effects',async()=>{
 const p=await prepared();let effects=0;
 const cases=[{context:p.context,authority:{check(){}},get objects(){effects++;throw Error('effect');}},Object.assign(Object.create({get authority(){effects++;throw Error('effect');}}),{context:p.context}),{context:p.context,authority:new Proxy({}, {getOwnPropertyDescriptor(){effects++;throw Error('effect');},get(){effects++;throw Error('effect');},ownKeys(){effects++;return [];}})}];
 for(const options of cases)assert.throws(()=>bindPreparedRelationshipArtifactOptions(p,options));assert.equal(effects,0);
});
test('WeakMap-backed borrowed authority keeps its receiver and exact prepared scope before any authority effect',async()=>{
 const p=await prepared(),state=new WeakMap(),authority={check(){const s=state.get(this);assert(s,'borrowed receiver lost');s.calls++;return {allowed:true};}},objects={borrowed:true};state.set(authority,{calls:0});
 const options=bindPreparedRelationshipArtifactOptions(p,{context:p.context,authority,objects});assert.equal(options.objects,objects);
 const intent={request:p.request,context:p.context,baseVersionId:null};assert.deepEqual(await options.authority.check({input:intent}),{allowed:true});
 const changed=structuredClone(intent);changed.context.scopes[0].policyRevision='substituted';await assert.rejects(options.authority.check({input:changed}),{code:'ACCESS_DENIED'});assert.equal(state.get(authority).calls,1);
});
