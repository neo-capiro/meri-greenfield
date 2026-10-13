/** Configuration must refuse before canonical artifact constructor effects. */
import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;assert.ok(root);
const {bindPreparedRelationshipArtifactOptions:bind}=await import(pathToFileURL(root+'/apps/control/document-application/relationship-brief/binding.mjs'));
test('Relationship binder refuses outer configuration accessors without executing them',()=>{
 let effects=0;const options={};Object.defineProperty(options,'context',{enumerable:true,get(){effects++;throw Error('synthetic getter effect');}});
 assert.throws(()=>bind({},options));console.log(JSON.stringify({case:'Relationship outer context getter',effects}));assert.equal(effects,0);
});
test('Relationship binder refuses configuration Proxy without invoking traps',()=>{
 let effects=0;const options=new Proxy({},{get(){effects++;throw Error('synthetic proxy effect');},ownKeys(){effects++;return [];},getPrototypeOf(){effects++;return Object.prototype;}});
 assert.throws(()=>bind({},options));console.log(JSON.stringify({case:'Relationship outer Proxy',effects}));assert.equal(effects,0);
});
