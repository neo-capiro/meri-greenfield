import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const root=process.argv[2],load=path=>import(pathToFileURL(root+'/'+path));
const [{default:Ajv},{default:addFormats},{canonicalSha256},{createPublicDomainDatasetRegistry},{createPublicDomainQueryValidators}]=await Promise.all([
 load('packages/contracts/node_modules/ajv/dist/2020.js'),load('packages/contracts/node_modules/ajv-formats/dist/index.js'),
 load('packages/contracts/validate.mjs'),load('packages/contracts/retrieval-0.2/public-domain-registry.mjs'),
 load('packages/contracts/retrieval-0.2/public-domain-query-validation.mjs')]);
const read=name=>JSON.parse(readFileSync(root+'/packages/contracts/retrieval-0.2/'+name));
const schema=read('public-domain-query.schema.json'),metadata=read('dataset-metadata.schema.json');
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);ajv.addSchema(metadata);
const validate=(source,name,value)=>{const check=ajv.getSchema(source.$id+'#/$defs/'+name)??ajv.compile({$ref:source.$id+'#/$defs/'+name});if(!check(value))throw Error(ajv.errorsText(check.errors));return value;};
const registry=createPublicDomainDatasetRegistry({canonicalSha256,validateMetadata:(name,value)=>validate(metadata,name,value)});
const validators=createPublicDomainQueryValidators({schema,canonicalSha256,datasetRegistry:registry,validateShape:(name,value)=>validate(schema,name,value)});
let mismatches=0;
for(const selector of ['January 1, 2020 12:30 PM -0500','Jan 1 12:30:00 -0500 2020']){
 const expected='2020-01-01T17:30:00.000Z';
 const asOf=validators.normalizePublicDomainQueryInput('query_global_data',{dataset:'lda_registrations',select:[{agg:'count'}],asOfDate:selector},{defaultAsOf:null}).input.asOfDate;
 const filter=validators.normalizePublicDomainQueryInput('query_global_data',{dataset:'federal_grants',select:[{field:'agency'}],filters:[{field:'open_date',op:'eq',value:selector}]},{defaultAsOf:null}).input.filters[0].value;
 const pass=asOf===expected&&filter===expected;if(!pass)mismatches++;
 console.log(JSON.stringify({timezone:process.env.TZ,selector,expected,asOf,filter,pass}));
}
process.exitCode=mismatches?1:0;
