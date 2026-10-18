import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import {objectiveReaderSchema,readerPurposes,readerTokenType,readerLimits} from './schema.mjs';
import {emitObjectiveReaderSchema} from './emit-schema.mjs';
import {strategyTypes} from '../strategy-operations-candidate/shapes.mjs';
const schema=JSON.parse(readFileSync(new URL('./reader.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});formats(ajv);ajv.addSchema(schema);
const validate=name=>ajv.compile({$ref:schema.$id+'#/$defs/'+name});
const id='00000000-0000-4000-8000-000000000001',sha='a'.repeat(64);
test('generated self-contained wire matches canonical source and compiles every closed definition',()=>{
 assert.deepEqual(schema,emitObjectiveReaderSchema());
 assert.equal(JSON.stringify(schema).includes('urn:meri:'),false);
 for(const name of Object.keys(schema.$defs))assert.equal(typeof validate(name),'function');
 assert.deepEqual(schema.$defs.Observation.properties.queuedType.enum,strategyTypes);
});
test('all object boundaries are closed; new wire envelopes require every declared field',()=>{
 function inspect(value){
  if(!value||typeof value!=='object')return;
  if(value.type==='object'){assert.equal(value.additionalProperties,false);assert.ok(value.required.every(key=>Object.hasOwn(value.properties,key)));}
  for(const child of Object.values(value))if(typeof child==='object')Array.isArray(child)?child.forEach(inspect):inspect(child);
 }
 inspect(schema);
 // Existing candidate patch-node schemas intentionally retain optional fields.
 // New Objective reader envelopes make all of their fields mandatory.
 for(const name of Object.keys(objectiveReaderSchema.$defs))assert.deepEqual(schema.$defs[name].required,Object.keys(schema.$defs[name].properties));
});
test('three purpose routes/audiences/subjects are distinct and versioned',()=>{
 assert.equal(new Set(Object.values(readerPurposes).map(p=>p.path)).size,3);
 assert.equal(new Set(Object.values(readerPurposes).map(p=>p.audience)).size,3);
 assert.equal(new Set(Object.values(readerPurposes).map(p=>p.subject)).size,3);
 assert.equal(readerTokenType,'capiro-objective-reader-v2+jwt');
 assert.equal(readerLimits.maxTokenSeconds,60);assert.equal(readerLimits.maxRequestMs,3000);
});
test('request allows only source lookup hints, never caller binding, keys or material',()=>{
 const check=validate('Request'),r={schemaVersion:2,purpose:'active-source',generationJobId:id,sourceAdmissionSha256:sha};
 assert.equal(check(r),true);
 for(const key of ['binding','tenantId','actorId','issuer','jwk','materialRef','proxyCredential','grantId','result','signal'])assert.equal(check({...r,[key]:'injected'}),false,key);
 for(const key of Object.keys(r)){const x={...r};delete x[key];assert.equal(check(x),false,key);}
 for(const purpose of ['admit','retained-result-read','active','v1'])assert.equal(check({...r,purpose}),false);
});
test('claim object remains closed nested v2 shape; legacy flat/extra fields deny',()=>{
 const p=readerPurposes['historical-source'],check=validate('Claims');
 const c={iss:'urn:synthetic:history:v2',sub:p.subject,aud:p.audience,iat:1,nbf:1,exp:60,jti:id,
  objective:{purpose:'historical-source',operation:p.operation,phase:p.phase,method:'POST',path:p.path,query:'',bodySha256:sha,sourceAdmissionSha256:sha,generationJobId:id}};
 assert.equal(check(c),true);
 assert.equal(check({...c,bodySha256:sha}),false);
 assert.equal(check({...c,objective:{...c.objective,sourceSha256:sha}}),false);
 assert.equal(check({...c,objective:{...c.objective,query:'x=1'}}),false);
 assert.equal(check({...c,objective:{...c.objective,binding:{}}}),false);
 assert.equal(check({...c,objective:{...c.objective,purpose:'active-source'}}),false);
});
