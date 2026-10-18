// Independent public-normalizer review control. No source edits or test-runner inheritance.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=process.argv[2],require=createRequire(join(root,'packages/contracts/package.json'));
assert.equal(process.env.NODE_TEST_CONTEXT,undefined,'Must execute as a real independent child');
const Ajv=require('ajv/dist/2020.js'),addFormats=require('ajv-formats');
const {canonicalSha256}=await import(pathToFileURL(join(root,'packages/contracts/validate.mjs')));
const {createPublicDomainDatasetRegistry}=await import(pathToFileURL(join(root,'packages/contracts/retrieval-0.2/public-domain-registry.mjs')));
const sourcePath='packages/contracts/retrieval-0.2/public-domain-query-validation.mjs';
const {createPublicDomainQueryValidators}=await import(pathToFileURL(join(root,sourcePath)));
const read=name=>JSON.parse(readFileSync(join(root,'packages/contracts/retrieval-0.2',name)));
const schema=read('public-domain-query.schema.json'),metadata=read('dataset-metadata.schema.json');
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);ajv.addSchema(metadata);
const validate=(s,name,value)=>{const check=ajv.getSchema(s.$id+'#/$defs/'+name)??ajv.compile({$ref:s.$id+'#/$defs/'+name});if(!check(value))throw Error(ajv.errorsText(check.errors));return value;};
const registry=createPublicDomainDatasetRegistry({canonicalSha256,validateMetadata:(name,value)=>validate(metadata,name,value)});
const validators=createPublicDomainQueryValidators({schema,canonicalSha256,datasetRegistry:registry,validateShape:(name,value)=>validate(schema,name,value)});
const cases=[
 ['January 1, 2020 12:30 PM -0500','2020-01-01T17:30:00.000Z'],
 ['Jan 1 12:30:00 -0500 2020','2020-01-01T17:30:00.000Z'],
 ['Jan 1 2020 12:30 PM,-0500','2020-01-01T17:30:00.000Z'],
 ['Jan 1 2020 12:30 PM-0500','2020-01-01T17:30:00.000Z'],
 ['Jan 1 2020 12:30 -0500 PM','2020-01-01T17:30:00.000Z'],
 ['Jan 1 2020 12:30 +5:3','2020-01-01T07:27:00.000Z'],
 ['Jan 1 2020 12:30 +05:3','2020-01-01T07:27:00.000Z'],
 ['Jan 1 2020 12:30 -5:3','2020-01-01T17:33:00.000Z'],
 ['Jan 1 2020 12:30 +5:030','2020-01-01T07:00:00.000Z'],
 ['Jan 1 2020 12:30 +5:','2020-01-01T07:30:00.000Z'],
 ['Jan 1 2020 12:30 +5:000030','2020-01-01T07:00:00.000Z'],
 ['Jan 1 2020 1:2 -0500','2020-01-01T06:02:00.000Z'],
 ['Jan 1 2020 12:3 PM -0500','2020-01-01T17:03:00.000Z'],
 ['Jan 1 2020 1:2:3 -0500','2020-01-01T06:02:03.000Z'],
 ['12:30:00 -5 Jan 1 2020','2020-01-01T17:30:00.000Z'],
 ['12:30:00 2020-01-01','2020-01-01T12:30:00.000Z'],
 ['Jan-1-2020 12:30','2020-01-01T12:30:00.000Z'],
 ['-0500 Jan 1 2020 12:30','0500-01-01T12:30:00.000Z'],
 ['+002020-01-01T12:30:00','2020-01-01T12:30:00.000Z'],
 ['-000001-01-01T12:30:00','-000001-01-01T12:30:00.000Z','reject-asOf'],
 ['-000001-01-01T12:30:00Z','-000001-01-01T12:30:00.000Z','reject-asOf'],
 ['January 1, 2020 (foo','2020-01-01T00:00:00.000Z'],
 ['January 1, 2020 12:30:00 (foo','2020-01-01T12:30:00.000Z'],
 ['Jan 1 2020 UTC 12:30','2020-01-01T12:30:00.000Z'],
 ['PST January 1 2020 12:30','2020-01-01T12:30:00.000Z'],
 ['Jan PST 1 2020 12:30','2020-01-01T12:30:00.000Z'],
 ['Jan 1 PST 2020 12:30','2020-01-01T20:30:00.000Z'],
 ['GMT+0200 January 1 2020 12:30','0200-01-01T12:30:00.000Z'],
 ['Jan 1PST 2020 12:30','2020-01-01T20:30:00.000Z'],
 ['Jan 1 PST2020 12:30','2020-01-01T20:30:00.000Z'],
 ['Jan 1PST2020 12:30','2020-01-01T20:30:00.000Z'],
 ['2020PST Jan 1 12:30','2020-01-01T20:30:00.000Z'],
 ['January 1,2020GMT+0200','2019-12-31T22:00:00.000Z'],
 ['Jan 1 2020 12:30 PM;-0500','2020-01-01T17:30:00.000Z'],
 ['Jan 1 2020 12:30 PM/-0500','2020-01-01T17:30:00.000Z'],
 ['Jan 1 2020 12:30 PM.-0500','2020-01-01T17:30:00.000Z'],
 ['Jan 1 2020 12:30 PM:-0500','2020-01-01T17:30:00.000Z'],
 ['Jan 1 2020 12:30 PM!-0500','2020-01-01T17:30:00.000Z'],
 ['12:30 Jan;-1 2020','2020-01-01T13:30:00.000Z'],
 ['12:30 Jan-1-2020','2020-01-01T12:30:00.000Z'],
 ['Jan 1(foo)2020 12:30','2020-01-01T12:30:00.000Z'],
 ['Jan 1(foo(bar))2020 12:30','2020-01-01T12:30:00.000Z'],
 ['1 PST(foo)Jan 2020 12:30','2020-01-01T20:30:00.000Z'],
 ['Jan 1 2020 12:(foo)30 -0500','2020-01-01T17:30:00.000Z'],
 ['Jan 1 2020 1 : 2 -0500',null],
 ['Jan 1 12:30:00 -000001',null],
 ['January 1, -2020 12:30:00',null],
 ['Jan 1 2020 12:30 --0500',null],
 ['Jan 1 2020 12:30 +-0500',null],
 ['Jan 1 2020 12:30 -+0500',null],
 ['2020-01-01T12:30:00 invalid',null],
 [' 2020-01-01T12:30:00Z ',null],
];
console.log(JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourcePath,sourceSha256:createHash('sha256').update(readFileSync(join(root,sourcePath))).digest('hex'),node:process.version,TZ:process.env.TZ,NODE_TEST_CONTEXT:null,control:'independent actual public normalizer'}));
let assertions=0,failed=0;
for(const [value,expected,special] of cases)for(const kind of ['asOf','filter']){
 const reject=expected===null||special==='reject-asOf'&&kind==='asOf';
 const request=kind==='asOf'?{dataset:'lda_registrations',select:[{agg:'count'}],asOfDate:value}:{dataset:'federal_grants',select:[{field:'agency'}],filters:[{field:'open_date',op:'eq',value}]};
 let actual,error;
 try{const result=validators.normalizePublicDomainQueryInput('query_global_data',request,{defaultAsOf:null});actual=kind==='asOf'?result.input.asOfDate:result.input.filters[0].value;}catch(caught){error=caught.message;}
 assertions++;try{if(reject)assert.equal(typeof error,'string');else{assert.equal(error,undefined);assert.equal(actual,expected);}console.log(JSON.stringify({kind,value,expected:reject?'reject':expected,actual:actual??'reject',pass:true}));}
 catch(caught){failed++;console.log(JSON.stringify({kind,value,expected:reject?'reject':expected,actual:actual??'reject',error,assertion:caught.message,pass:false}));}
}
console.log(JSON.stringify({assertions,passed:assertions-failed,failed}));process.exitCode=failed?1:0;
