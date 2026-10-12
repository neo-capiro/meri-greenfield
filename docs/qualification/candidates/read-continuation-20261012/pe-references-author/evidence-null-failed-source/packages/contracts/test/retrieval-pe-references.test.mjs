import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createPeReferenceValidators} from '../retrieval-0.2/pe-references-validation.mjs';
const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/pe-references.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const checks=new Map(Object.keys(schema.$defs).map(key=>[key,ajv.compile({$ref:`${schema.$id}#/$defs/${key}`})]));
const validateShape=(name,value)=>{const check=checks.get(name);assert.ok(check(value),ajv.errorsText(check.errors));return value;};
const {normalizePeReferenceInput:normalize,assertPeReferenceOutput:check}=createPeReferenceValidators({validateShape,schema});
const B='get_pe_bills',C='get_pe_contractors',R='get_pe_report_language',NOW='2026-10-12T00:00:00.000Z',OLD='2026-10-11T00:00:00.000Z';
const input=()=>({peCode:'0601234A'}),note=key=>schema.$defs[key].const;
const bill=()=>({id:'119-hr-1',congress:119,billType:'hr',billNumber:'1',title:'Synthetic bill',policyArea:null,latestActionText:null,latestActionDate:NOW,url:null,sponsor:null,committee:null,peCodeCount:1,link:null,budgetPackage:null});
const bills=()=>({tool:B,generatedAt:NOW,bills:[bill()]});
const provision=()=>({id:'synthetic-provision',committee:'HASC',fy:2027,heading:'Synthetic heading',text:'Synthetic language',pageStart:null,pageEnd:null,actionType:null,sourceUrl:null,matchBasis:'pe_code',reviewStatus:'accepted',confidence:0.7,matchScope:'pe_specific',attributionCaveat:null});
const report=()=>({tool:R,generatedAt:NOW,peCode:input().peCode,provisions:[provision()]});
const program=()=>({...provision(),id:'synthetic-program',matchBasis:'program_alias',matchScope:'program_level',attributionCaveat:note('PeProgramAttributionCaveat')});
const programNote=(n,total)=>`${n} of ${total} linked provision(s) are PROGRAM-LEVEL matches (matched via a program alias, because FY committee reports name programs, not PE codes). They may apply to sibling PEs in the same program — attribute such language at the program level, not exclusively to this budget line. Each carries matchScope:"program_level" and an attributionCaveat.`;
function fillConst(def){if(Object.hasOwn(def,'const'))return def.const;if(def.type==='object')return Object.fromEntries(Object.entries(def.properties).filter(([,v])=>Object.hasOwn(v,'const')||v.type==='object').map(([k,v])=>[k,fillConst(v)]));throw new Error('Fixture constant only');}
const contractor=()=>({contractorName:'Synthetic direct',amount:3,awards:2,source:'direct',attribution:'Award attributed to this program element'});
const prime=()=>({contractorName:'Synthetic prime',location:null,contractMethod:null,totalCostM:7,fy:2027,sourceUrl:null,pageNumber:2,publisher:'DoD',attribution:'Named prime per DoD FY2027 R-3 exhibit (p. 2)'});
function contractors(){
 const governmentExhibit={...fillConst(schema.$defs.PeGovernmentExhibit),amountM:7,count:1};
 const federalAwards={...fillConst(schema.$defs.PeFederalAwards),amountM:5,count:3,buckets:schema.$defs.PeAwardBuckets.prefixItems.map((b,index)=>({...fillConst(b),amountM:[3,2,0][index],count:[2,1,0][index]}))};
 federalAwards.provenance.asOf=NOW;
 return {tool:C,generatedAt:NOW,namedPrimes:[prime()],data:[contractor(),{contractorName:'Synthetic candidate',amount:2,awards:1,source:'program',attribution:'Linked via DoD Acquisition Program (USAspending)'}],evidence:{governmentExhibit,federalAwards},evidenceNote:note('PeContractorEvidenceNote'),todo:null};
}
const missing=()=>({tool:C,generatedAt:NOW,data:[],todo:'federal_award table not yet created (Step 28)'});
const copy=structuredClone;

test('three required selectors trim/cap UTF-16 and preserve case',()=>{
 for(const op of [B,C,R]){assert.deepEqual(normalize(op,{peCode:' 0601234a '},{}),{peCode:'0601234a'});assert.equal(normalize(op,{peCode:'😀'.repeat(17)},{}).peCode.length,32);}
});
test('missing and non-string selectors are typed refusals, never fabricated empty source pages',()=>{
 for(const op of [B,C,R])for(const raw of [{},{peCode:null},{peCode:''},{peCode:'   '},{peCode:1},{peCode:false}])assert.throws(()=>normalize(op,raw,{}));
});
test('closed model and context objects accept no authority or request aliases',()=>{
 for(const extra of ['actorId','tenantId','clientId','pe_code','limit','authorized'])assert.throws(()=>normalize(B,{...input(),[extra]:'x'},{}));
 for(const ctx of [undefined,null,[],{nowMs:1},{authorized:true}])assert.throws(()=>normalize(B,input(),ctx));
});
test('operation admission rejects unknowns and hostile coercion without effects',()=>{
 let calls=0;const value={get [Symbol.toPrimitive](){calls++;return()=>B;}};
 for(const op of [value,new Proxy({}, {get(){calls++;throw Error();}}),'constructor','get_pe_unknown',null])assert.throws(()=>normalize(op,input(),{}));assert.equal(calls,0);
});
test('all success and fallback envelopes round-trip without caller mutation',()=>{
 for(const [op,page]of [[B,bills()],[C,contractors()],[C,missing()],[R,report()]]){const before=copy(page);assert.equal(check(op,page,input(),{}),page);assert.deepEqual(page,before);}
});
test('bill envelope has no invented PE echo, source coverage or total',()=>{
 for(const k of ['peCode','total','coverageComplete','authorized']){const page=bills();page[k]='x';assert.throws(()=>check(B,page,input(),{}));}
 const page={tool:B,generatedAt:NOW,bills:[]};check(B,page,input(),{});
});
test('bill optional storage values remain nullable and links/package preserve their exact tuples',()=>{
 const page=bills();page.bills[0].link={type:'versioned',confidence:-2,evidence:null,status:'candidate'};page.bills[0].budgetPackage={name:'Synthetic package',fiscalYear:2027,track:'authorization',stage:'introduced'};check(B,page,input(),{});
 page.bills[0].link.evidence='Synthetic pointer';page.bills[0].link.status='dismissed';check(B,page,input(),{});
 page.bills[0].link.status='rejected';assert.throws(()=>check(B,page,input(),{}));
});
test('independent stored bill identity columns and unknown values are not normalized into fabricated facts',()=>{
 const page=bills();Object.assign(page.bills[0],{congress:-1,billType:'future_type',billNumber:'zero-like',peCodeCount:0});check(B,page,input(),{});
});
test('bill specificity then stored date ordering permits ties and null epoch semantics',()=>{
 const page=bills();page.bills.push({...bill(),id:'b2',latestActionDate:OLD});check(B,page,input(),{});
 page.bills.reverse();assert.throws(()=>check(B,page,input(),{}));page.bills.reverse();page.bills[1].peCodeCount=0;assert.throws(()=>check(B,page,input(),{}));
 page.bills[1].peCodeCount=2;page.bills[1].latestActionDate=null;check(B,page,input(),{});
});
test('bill source cap and unique stored IDs are enforced',()=>{
 const page=bills();page.bills.push(bill());assert.throws(()=>check(B,page,input(),{}));
 page.bills=Array.from({length:101},(_,i)=>({...bill(),id:`b${i}`}));assert.throws(()=>check(B,page,input(),{}));
});
test('bill SQL Date and all generated timestamps retain exact canonical serialization',()=>{
 const page=bills();page.bills[0].latestActionDate='2026-10-12T01:00:00.000Z';assert.throws(()=>check(B,page,input(),{}));
 for(const stamp of ['2026-10-12','2026-10-12T00:00:00Z','2016-12-31T23:59:60Z']){const p=report();p.generatedAt=stamp;assert.throws(()=>check(R,p,input(),{}));}
});
test('contractor absent-table fallback cannot carry fabricated rows or success evidence',()=>{
 for(const mutate of [p=>p.data.push(contractor()),p=>p.todo=null,p=>p.evidence=contractors().evidence,p=>p.namedPrimes=[]]){const page=missing();mutate(page);assert.throws(()=>check(C,page,input(),{}));}
});
test('R-3 exhibit money cannot be included in award buckets or award count',()=>{
 for(const mutate of [p=>p.evidence.federalAwards.amountM+=7,p=>p.evidence.federalAwards.count++,p=>p.evidence.federalAwards.buckets[0].amountM+=7,p=>p.evidence.governmentExhibit.amountM=5]){const page=contractors();mutate(page);assert.throws(()=>check(C,page,input(),{}));}
});
test('candidate and uninventory buckets remain distinct; zeros do not grant coverage',()=>{
 for(const mutate of [p=>p.evidence.federalAwards.buckets.reverse(),p=>p.evidence.federalAwards.buckets[1].amountM=0,p=>p.evidence.federalAwards.buckets[2].amountM=1,p=>p.evidence.federalAwards.buckets[2].count=1,p=>p.coverageComplete=true,p=>p.evidenceNote='All awards matched']){const page=contractors();mutate(page);assert.throws(()=>check(C,page,input(),{}));}
});
test('award window/provenance/unit/category attribution cannot be silently upgraded',()=>{
 for(const mutate of [p=>p.evidence.federalAwards.provenance.windowMonths=12,p=>p.evidence.governmentExhibit.provenance.kind='canonical',p=>p.evidence.federalAwards.unit='USD',p=>p.data[1].attribution=p.data[0].attribution]){const page=contractors();mutate(page);assert.throws(()=>check(C,page,input(),{}));}
});
test('negative award adjustments and nullable exhibit costs preserve finite arithmetic',()=>{
 const page=contractors();page.data[1].amount=-2;page.evidence.federalAwards.amountM=1;page.evidence.federalAwards.buckets[1].amountM=-2;page.namedPrimes[0].totalCostM=null;page.evidence.governmentExhibit.amountM=0;check(C,page,input(),{});
});
test('exhibit attribution follows null defaults and page truthiness without invented positive numeric constraints',()=>{
 const page=contractors();Object.assign(page.namedPrimes[0],{publisher:null,fy:null,pageNumber:0,attribution:'Named prime per DoD FY R-3 exhibit'});check(C,page,input(),{});
 page.namedPrimes[0].attribution+=' (p. 0)';assert.throws(()=>check(C,page,input(),{}));
});
test('contractor count/money correlations and own sorted group identity are enforced',()=>{
 for(const mutate of [p=>p.data.reverse(),p=>p.data[1].contractorName=p.data[0].contractorName,p=>p.data[0].awards=0,p=>p.evidence.federalAwards.count++,p=>p.evidence.governmentExhibit.count++]){const page=contractors();mutate(page);assert.throws(()=>check(C,page,input(),{}));}
});
test('contractor data and named performer source caps cannot imply population totals',()=>{
 for(const [key,size,fixture]of [['data',11,contractor],['namedPrimes',26,prime]]){const page=contractors();page[key]=Array.from({length:size},fixture);assert.throws(()=>check(C,page,input(),{}));}
});
test('report echoed PE binds only the selected syntax',()=>{
 const page=report();page.peCode='other';assert.throws(()=>check(R,page,input(),{}));page.peCode=input().peCode;page.authorized=true;assert.throws(()=>check(R,page,input(),{}));
});
test('empty report requires loaded-source caveat and cannot certify global absence',()=>{
 const page=report();page.provisions=[];page.note=note('PeNoReportNote');check(R,page,input(),{});
 for(const text of [undefined,'No report exists']){if(text===undefined)delete page.note;else page.note=text;assert.throws(()=>check(R,page,input(),{}));}
});
test('any program-level row requires aggregate caution and exact per-row caveat',()=>{
 const page=report();page.provisions.push(program());page.note=programNote(1,2);check(R,page,input(),{});
 page.provisions[1].attributionCaveat=null;assert.throws(()=>check(R,page,input(),{}));page.provisions[1]=program();delete page.note;assert.throws(()=>check(R,page,input(),{}));
});
test('source link scope is basis-derived including future unknown bases',()=>{
 const page=report();page.provisions[0].matchBasis='project_title';check(R,page,input(),{});
 page.provisions[0].matchScope='program_level';assert.throws(()=>check(R,page,input(),{}));
 page.provisions=[{...program(),matchBasis:'future_basis'}];page.note=programNote(1,1);check(R,page,input(),{});
});
test('accepted and candidate links preserve source evidence without approving candidate',()=>{
 const page=report();page.provisions[0].reviewStatus='candidate';page.provisions[0].confidence=-2;check(R,page,input(),{});
 for(const status of ['pending','rejected','approved']){page.provisions[0].reviewStatus=status;assert.throws(()=>check(R,page,input(),{}));}
});
test('report dedup cannot impose accepted-over-stronger-basis selection',()=>{
 const page=report();page.provisions[0].reviewStatus='candidate';check(R,page,input(),{});
 page.provisions.push({...provision(),reviewStatus:'accepted'});assert.throws(()=>check(R,page,input(),{}));
});
test('report sorting is review status, basis, FY, confidence with ties allowed',()=>{
 const page=report();page.provisions.push({...provision(),id:'second',fy:2026});check(R,page,input(),{});
 page.provisions.reverse();assert.throws(()=>check(R,page,input(),{}));page.provisions.reverse();page.provisions[0].reviewStatus='candidate';assert.throws(()=>check(R,page,input(),{}));
});
test('report cap, nullable Int pages and unknown committee/action values remain distinct',()=>{
 const page=report();Object.assign(page.provisions[0],{pageStart:-1,pageEnd:0,committee:'future',actionType:'future'});check(R,page,input(),{});
 page.provisions=Array.from({length:51},(_,i)=>({...provision(),id:`p${i}`}));assert.throws(()=>check(R,page,input(),{}));
});
test('inert admission rejects getters/proxies/cycles/nonfinite fields before effects',()=>{
 let calls=0;const raw={get peCode(){calls++;return'0601234A';}};assert.throws(()=>normalize(B,raw,{}));assert.equal(calls,0);
 const proxy=new Proxy({}, {ownKeys(){calls++;return[];}});assert.throws(()=>normalize(C,proxy,{}));assert.equal(calls,0);
 const page=contractors();page.evidence.federalAwards.amountM=Infinity;assert.throws(()=>check(C,page,input(),{}));
 const cyclic=report();cyclic.self=cyclic;assert.throws(()=>check(R,cyclic,input(),{}));
});

test('present bill links require stored string evidence, while the whole link may be null',()=>{
 const page=bills();page.bills[0].link={type:'versioned',confidence:0.7,evidence:null,status:'qualified'};
 assert.throws(()=>check(B,page,input(),{}));page.bills[0].link.evidence='Synthetic provenance';check(B,page,input(),{});
});
