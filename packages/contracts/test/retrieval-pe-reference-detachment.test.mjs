import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createPeReferenceValidators} from '../retrieval-0.2/pe-references-validation.mjs';
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';

const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/pe-references.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const checks=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const {assertPeReferenceOutput:check}=createPeReferenceValidators({schema,validateShape(name,value){
  const validate=checks.get(name);assert.ok(validate(value),ajv.errorsText(validate.errors));return value;
}});
const request={peCode:'0601234A'},generatedAt='2026-10-12T00:00:00.000Z';
const fixtures=[
  ['get_pe_bills',()=>({tool:'get_pe_bills',generatedAt,bills:[{id:'synthetic-detachment-bill',congress:119,billType:'hr',billNumber:'1',title:'Original title',policyArea:null,latestActionText:null,latestActionDate:null,url:null,sponsor:null,committee:null,peCodeCount:1,link:null,budgetPackage:null}]}),'bills','title'],
  ['get_pe_report_language',()=>({tool:'get_pe_report_language',generatedAt,peCode:request.peCode,provisions:[{id:'synthetic-detachment-provision',committee:'HASC',fy:2027,heading:'Original heading',text:'Original text',pageStart:null,pageEnd:null,actionType:null,sourceUrl:null,matchBasis:'pe_code',reviewStatus:'accepted',confidence:0.7,matchScope:'pe_specific',attributionCaveat:null}]}),'provisions','text'],
  ['get_pe_contractors',()=>({tool:'get_pe_contractors',generatedAt,data:[],todo:schema.$defs.PeContractorsMissingTable.properties.todo.const}),'data',null],
];

for(const [operation,fixture,array,field] of fixtures){
  test(`${operation}: direct result excludes later caller mutation`,()=>{
    const caller=fixture(),before=structuredClone(caller),result=check(operation,caller,request,{});
    caller.generatedAt='invalid-after-validation';
    if(field)caller[array][0][field]='changed-after-validation';else caller[array].push({unvalidated:true});
    assert.deepEqual(result,before);assert.notEqual(result,caller);assert.notEqual(result[array],caller[array]);
  });
  test(`${operation}: result mutation cannot change caller data`,()=>{
    const caller=fixture(),before=structuredClone(caller),result=check(operation,caller,request,{});
    result.generatedAt='changed-result';result[array].push({unvalidated:true});
    assert.deepEqual(caller,before);
  });
  test(`${operation}: canonical resolver already detaches caller data`,()=>{
    const caller=fixture(),before=structuredClone(caller);
    const operationContract=resolveOperationContract({id:operation,version:'0.2.0'});
    const result=operationContract.assertOutput(caller,{request});
    caller.generatedAt='changed-caller';caller[array].push({unvalidated:true});
    assert.deepEqual(result,before);
  });
}
