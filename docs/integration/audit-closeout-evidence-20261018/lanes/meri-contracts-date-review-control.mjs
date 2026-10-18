// Reconstructed read-only source-function controls from the independent review.
// Run from a Meri checkout: TZ=America/Toronto node <this file> <source pin> <offset|comment|final>
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const [pin,kind]=process.argv.slice(2),file='packages/contracts/retrieval-0.2/public-domain-query-validation.mjs';
const offsets=[
 ['2020-01-01 12:30:00+05','2020-01-01T07:30:00.000Z'],
 ['2020-01-01 12:30:00-05','2020-01-01T17:30:00.000Z'],
 ['January 1, 2020 12:30:00 -5','2020-01-01T17:30:00.000Z'],
 ['01 Jan 2020 12:30:00 +0530 (India Standard Time)','2020-01-01T07:00:00.000Z'],
];
const comments=[
 ['January 1, 2020 (foo','2020-01-01T00:00:00.000Z'],
 ['January 1, 2020 12:30:00 (foo','2020-01-01T12:30:00.000Z'],
];
const cases=kind==='offset'?offsets:kind==='comment'?comments:kind==='final'?[...offsets,...comments]:null;
assert(cases,'Expected offset, comment or final control');
const commit=execFileSync('git',['rev-parse',pin],{encoding:'utf8',timeout:10000}).trim();
const content=execFileSync('git',['show',commit+':'+file],{encoding:'utf8',timeout:10000,maxBuffer:1048576});
const start=content.indexOf('function queryDate(value){'),end=content.indexOf('\n}',start)+2;
assert(start>=0&&end>start,'Expected bounded queryDate source function');
const source=content.slice(start,end),query=Function('value',source+';return queryDate(value);');
console.log(JSON.stringify({source:commit,sourceFile:file,extractedFunctionSha256:createHash('sha256').update(source).digest('hex'),node:process.version,TZ:process.env.TZ,classification:'reconstructed read-only source-function review control'}));
let failures=0;
for(const [value,expected] of cases){
 const time=query(value),actual=Number.isFinite(time)?new Date(time).toISOString():'invalid';
 try{assert.equal(actual,expected);console.log(JSON.stringify({value,expected,actual,pass:true}));}
 catch(error){failures++;console.log(JSON.stringify({value,expected,actual,pass:false,assertion:error.message}));}
}
console.log(JSON.stringify({cases:cases.length,passed:cases.length-failures,failed:failures}));
process.exitCode=failures?1:0;
