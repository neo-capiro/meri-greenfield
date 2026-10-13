import test from 'node:test';import assert from 'node:assert/strict';
import {assembleControl} from '../../../../../apps/runtime/control.mjs';
import {captureRuntimePorts} from '../../../../../apps/runtime/product-applications.mjs';
import {storeFixture,binding,scopes,versions,id} from '../../../../../apps/control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {selectSkill} from '../../../../../packages/skills/index.mjs';
const configuration={sourceEnabled:false,sessions:{maxSessions:20,maxTtlMs:30000},versions,limits:{requestMs:1000,requestBytes:131072},native:{maxResponseBytes:131072},temporal:{taskQueue:'synthetic-no-temporal'}};
const selected=selectSkill('quick_skill.commitments_audit','1.0.0');
function fixture(withOwners=true){const f=storeFixture(),state={starts:0,nativeCalls:0,admissions:0,publications:0};
 const identityContext={async verifyIdentity(){assert.equal(this,identityContext);return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'synthetic-native',checkedAtMs:Date.now(),expiresAtMs:Date.now()+10000};},async resolveContext({identity}){assert.equal(this,identityContext);return {identitySha256:hash(identity),binding,scopes,selectedClientId:id(5),contextRevision:'synthetic-context',checkedAtMs:Date.now(),expiresAtMs:Date.now()+10000};}};
 const admission={async admitSelection(args){assert.equal(this,admission);state.admissions++;assert.equal(args.selectedClientId,id(5));assert.deepEqual(args.scopes,scopes);return {binding:args.binding,skill:selected.pin,requestSha256:hash(args.request),selectionSha256:'a'.repeat(64),scopes:args.scopes,selectedClientId:args.selectedClientId,manifestSha256:selected.pin.manifestSha256,catalogSha256:selected.pin.catalogSha256,budgets:selected.manifest.budgets,allocationSha256:'b'.repeat(64),policyRevision:scopes[0].policyRevision,installationId:id(31),executionCatalogSha256:'c'.repeat(64),checkedAtMs:Date.now(),expiresAtMs:Date.now()+5000};}};
 const publication={async prepareEvent(args){assert.equal(this,publication);state.publications++;assert.deepEqual(args.binding,binding);assert.deepEqual(args.output,{state:'output awaiting approval'});return {event:{eventId:id(44),createdAt:new Date().toISOString(),type:'message.delta',data:{messageId:id(45),text:'output awaiting approval'}},checkedAtMs:Date.now(),expiresAtMs:Date.now()+5000};}};
 const assembly=assembleControl({configuration,pool:f.pool,client:{workflow:{async start(){state.starts++;},getHandle(){return {async cancel(){},async signal(){}};}}},native:{async call(){state.nativeCalls++;throw Error('native disabled');}},productPorts:{identityContext,...(withOwners?{selectedSkillAdmission:admission,selectedOutputPublication:publication}:{})}});
 return {...f,state,assembly,admission,publication};}

test('actual control assembly forwards captured selected admission and governed output publication to canonical service',async()=>{
 const x=fixture();try{const issued=await x.assembly.sessions.issue({identityCredential:'synthetic-no-native'}),credential=issued.credential;
 x.admission.admitSelection=()=>{throw Error('replacement must not run');};x.publication.prepareEvent=()=>{throw Error('replacement must not run');};
 const result=await x.assembly.service.submit({credential,input:{requestId:id(6),prompt:'Synthetic commitments',skill:{skillId:selected.pin.skillId,skillVersion:selected.pin.skillVersion},windowRequest:{basis:'unbounded'}}});assert.equal(result.run.state,'queued');assert.equal(x.state.admissions,3);assert.equal(x.state.starts,1);
 for(const [n,state]of [[40,'starting'],[41,'running']])await x.assembly.service.publish({credential,binding,event:{eventId:id(n),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}}});
 const event=await x.assembly.service.publishSelectedOutput({credential,binding,output:{state:'output awaiting approval'}});assert.equal(event.type,'message.delta');assert.equal(event.data.text,'output awaiting approval');assert.equal(x.state.publications,1);assert.equal(x.state.nativeCalls,0);
 const request=new Request('https://synthetic.invalid/internal/conversations/selected/prepare',{method:'POST',headers:{authorization:'Bearer opaque-synthetic','content-type':'application/json'},body:'{}'});assert.equal((await x.assembly.application.handle(request)).status,503);
 }finally{x.assembly.close();}
});

test('default service composition leaves selected output publication unavailable',async()=>{const x=fixture(false);try{await assert.rejects(x.assembly.service.publishSelectedOutput({credential:'opaque-synthetic',binding,output:{}}),/OUTPUT_PUBLICATION_UNAVAILABLE/);assert.equal(x.state.nativeCalls,0);}finally{x.assembly.close();}});

test('new selected service ports refuse direct and inherited accessors and proxy prototypes inertly',()=>{
 for(const [name,method]of [['selectedSkillAdmission','admitSelection'],['selectedOutputPublication','prepareEvent']]){let calls=0;const configurations=[Object.defineProperty({},method,{get(){calls++;return ()=>{};}}),Object.create(Object.defineProperty({},method,{get(){calls++;return ()=>{};}})),Object.create(new Proxy({[method](){}},{getOwnPropertyDescriptor(){calls++;return undefined;},getPrototypeOf(){calls++;return null;}}))];for(const port of configurations)assert.throws(()=>captureRuntimePorts({[name]:port}));assert.equal(calls,0);}
});
