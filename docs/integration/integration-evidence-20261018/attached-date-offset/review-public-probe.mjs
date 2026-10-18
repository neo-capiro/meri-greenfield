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
const cases=JSON.parse(readFileSync('/tmp/meri-date-attached-offset-review/cases.json','utf8')).map(({value,expected})=>[value,expected]);
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
