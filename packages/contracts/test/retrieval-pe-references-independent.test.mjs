import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const source=process.env.MERI_PE_REVIEW_SOURCE_ROOT?pathToFileURL(process.env.MERI_PE_REVIEW_SOURCE_ROOT.replace(/\/$/,'')+'/packages/contracts/'):new URL('../',import.meta.url);
const {createPeReferenceValidators}=await import(new URL('retrieval-0.2/pe-references-validation.mjs',source));
const schema=JSON.parse(readFileSync(new URL('retrieval-0.2/pe-references.schema.json',source))),defs=schema.$defs;
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const shapes=new Map(Object.keys(defs).map(n=>[n,ajv.compile({$ref:`${schema.$id}#/$defs/${n}`})]));
const {normalizePeReferenceInput:norm,assertPeReferenceOutput:check}=createPeReferenceValidators({schema,validateShape(n,v){assert.equal(shapes.get(n)(v),true,`Invalid ${n}`);return v;}});
const B='get_pe_bills',C='get_pe_contractors',R='get_pe_report_language',T='2026-10-01T12:00:00.000Z',D='2026-10-01T00:00:00.000Z',P='0600001A',raw={peCode:P};
// Independent synthetic projection values; fixed warning/provenance literals use
// the public-to-this-test new private Meri schema, never legacy code execution.
const constants=s=>Object.fromEntries(Object.entries(s.properties).filter(([,v])=>Object.hasOwn(v,'const')).map(([k,v])=>[k,v.const]));
function bill(){return {id:'synthetic-bill',congress:119,billType:'stored-type',billNumber:'0001',title:'Synthetic bill',policyArea:null,latestActionText:null,latestActionDate:D,url:null,sponsor:null,committee:null,peCodeCount:1,link:null,budgetPackage:null};}
const bills=()=>({tool:B,generatedAt:T,bills:[bill()]});
function provision(){return {id:'synthetic-provision',committee:'stored-committee',fy:2027,heading:'Synthetic heading',text:'Synthetic provision text',pageStart:null,pageEnd:null,actionType:null,sourceUrl:null,matchBasis:'pe_code',reviewStatus:'accepted',confidence:0.7,matchScope:'pe_specific',attributionCaveat:null};}
const reports=()=>({tool:R,generatedAt:T,peCode:P,provisions:[provision()]});
const programNote=(n,total)=>`${n} of ${total} linked provision(s) are PROGRAM-LEVEL matches (matched via a program alias, because FY committee reports name programs, not PE codes). They may apply to sibling PEs in the same program — attribute such language at the program level, not exclusively to this budget line. Each carries matchScope:"program_level" and an attributionCaveat.`;
function program(){return {...provision(),id:'program-provision',matchBasis:'opaque_program_alias',matchScope:'program_level',attributionCaveat:defs.PeProgramAttributionCaveat.const};}
function prime(){return {contractorName:'Named example',location:null,contractMethod:null,totalCostM:17,fy:2025,sourceUrl:null,pageNumber:null,publisher:null,attribution:'Named prime per DoD FY2025 R-3 exhibit'};}
const award=(source='direct',amount=2,name='Award example')=>({contractorName:name,amount,awards:1,source,attribution:source==='direct'?'Award attributed to this program element':'Linked via DoD Acquisition Program (USAspending)'});
function contractors(){return {tool:C,generatedAt:T,namedPrimes:[prime()],data:[award()],evidence:{governmentExhibit:{...constants(defs.PeGovernmentExhibit),amountM:17,count:1,provenance:constants(defs.PeGovernmentExhibit.properties.provenance)},federalAwards:{...constants(defs.PeFederalAwards),amountM:2,count:1,provenance:{...constants(defs.PeFederalAwards.properties.provenance),asOf:T},buckets:defs.PeAwardBuckets.prefixItems.map((s,i)=>({...constants(s),amountM:i===0?2:0,count:i===0?1:0}))}},evidenceNote:defs.PeContractorEvidenceNote.const,todo:null};}
const missing=()=>({tool:C,generatedAt:T,data:[],todo:defs.PeContractorsMissingTable.properties.todo.const});
const reject=(op,p,input=raw,ctx={})=>assert.throws(()=>check(op,p,input,ctx));
function mutate(op,make,fns){for(const fn of fns){const p=make();fn(p);reject(op,p);}}

test('independent complete stored bill report contractor and missing-table variants admit',()=>{check(B,bills(),raw,{});check(R,reports(),raw,{});check(C,contractors(),raw,{});check(C,missing(),raw,{});});
test('closed required selector uses exact trim and UTF16 cap without case or authority inference',()=>{
 for(const op of [B,C,R]){assert.deepEqual(norm(op,{peCode:'  '+P+'  '},{}),raw);assert.equal(norm(op,{peCode:'A'.repeat(31)+'😀'},{}).peCode.length,32);assert.equal(norm(op,{peCode:'aBc'},{}).peCode,'aBc');for(const x of [{},{peCode:''},{peCode:' '},{peCode:1},{peCode:P,actorId:'forged'},{peCode:P,cursor:'forged'}])assert.throws(()=>norm(op,x,{}));}
});
test('empty trusted context refuses model authority and omitted non-JSON context',()=>{for(const ctx of [{actorId:'x'},{authorized:true},[],null,undefined])assert.throws(()=>norm(B,raw,ctx));});
test('operation and own-data admission reject coercion getters and proxies without effects',()=>{
 let effects=0;const operation={[Symbol.toPrimitive](){effects++;return B;}};assert.throws(()=>norm(operation,raw,{}));
 const x={};Object.defineProperty(x,'peCode',{enumerable:true,get(){effects++;return P;}});assert.throws(()=>norm(B,x,{}));
 const proxy=new Proxy({}, {ownKeys(){effects++;throw Error('effect');},get(){effects++;throw Error('effect');}});assert.throws(()=>norm(B,raw,proxy));assert.equal(effects,0);
});
test('report echo is exact while original bill contractor envelopes cannot prove requested PE',()=>{
 reject(R,reports(),{peCode:'OTHER'});check(B,bills(),{peCode:'OTHER'},{});check(C,contractors(),{peCode:'OTHER'},{});
 mutate(B,bills,[p=>p.peCode=P,p=>p.authorized=true]);mutate(C,contractors,[p=>p.peCode=P,p=>p.complete=true]);
});
test('bill nullable fields are required and unselected fields cannot leak',()=>{mutate(B,bills,[p=>delete p.bills[0].sponsor,p=>delete p.bills[0].link,p=>p.bills[0].peCodes=[P],p=>p.bills[0].status='fresh',p=>p.total=1]);});
test('bill stored columns and signed values are not manufactured from canonical identity',()=>{const p=bills();Object.assign(p.bills[0],{id:'119-hr-1',congress:-1,billType:'different',billNumber:'opaque'});check(B,p,raw,{});p.bills[0].congress=2147483648;reject(B,p);});
test('bill nullable links and packages retain nonrejected stored semantics',()=>{
 const p=bills();p.bills[0].link={type:'opaque',confidence:-2,evidence:null,status:'candidate'};p.bills[0].budgetPackage={name:'Synthetic package',fiscalYear:-2,track:'opaque-track',stage:'opaque-stage'};check(B,p,raw,{});
 p.bills[0].link.status='rejected';reject(B,p);p.bills[0].link.status='accepted';p.bills[0].link.confidence=5;check(B,p,raw,{});
});
test('bill specificity then date order is checked without global freshness claim',()=>{
 const p=bills();p.bills.push({...bill(),id:'other',peCodeCount:2,latestActionDate:'2026-10-02T00:00:00.000Z'});check(B,p,raw,{});p.bills.reverse();reject(B,p);
 const q=bills();q.bills.push({...bill(),id:'other',latestActionDate:'2026-09-01T00:00:00.000Z'});check(B,q,raw,{});q.bills.reverse();reject(B,q);
});
test('bill identity duplication and source100 window refuse without count proof',()=>{
 const p=bills();p.bills=Array.from({length:100},(_,i)=>({...bill(),id:'b'+i}));check(B,p,raw,{});p.bills.push({...bill(),id:'overflow'});reject(B,p);p.bills=[bill(),bill()];reject(B,p);
});
test('bill SQL date-only projection and canonical generatedAt reject invalid time shapes',()=>{mutate(B,bills,[p=>p.bills[0].latestActionDate=T,p=>p.generatedAt='2016-12-31T23:59:60Z',p=>p.bills[0].latestActionDate='bad']);const p=bills();p.bills[0].latestActionDate=null;check(B,p,raw,{});});
test('report empty coverage requires exact loaded-source caveat not a global absence proof',()=>{
 const p=reports();p.provisions=[];reject(R,p);p.note=defs.PeNoReportNote.const;check(R,p,raw,{});p.note='No report language exists';reject(R,p);p.note=defs.PeNoReportNote.const;p.evidenceOfAbsence=true;reject(R,p);
});
test('program-only and mixed report language keep per-item and aggregate attribution caveats',()=>{
 const p=reports();p.provisions=[program()];p.note=programNote(1,1);check(R,p,raw,{});delete p.note;reject(R,p);
 p.provisions=[provision(),program()];p.note=programNote(1,2);check(R,p,raw,{});p.note=programNote(2,2);reject(R,p);p.note=programNote(1,2);p.provisions[1].attributionCaveat=null;reject(R,p);
});
test('report basis establishes scope without turning candidate into accepted',()=>{
 const p=reports();p.provisions[0].reviewStatus='candidate';check(R,p,raw,{});p.provisions[0].matchBasis='project_title';check(R,p,raw,{});p.provisions[0].matchBasis='program_alias';reject(R,p);
 mutate(R,reports,[p=>p.provisions[0].reviewStatus='pending',p=>p.provisions[0].reviewStatus='rejected',p=>p.provisions[0].matchScope='program_level',p=>p.provisions[0].attributionCaveat='approved']);
});
test('report status precedes basis FY and confidence but source winner is not reconstructed',()=>{
 const p=reports();p.provisions=[{...program(),fy:2020},{...provision(),id:'candidate',reviewStatus:'candidate',fy:2030}];p.note=programNote(1,2);check(R,p,raw,{});p.provisions.reverse();reject(R,p);
 const q=reports();q.provisions=[{...provision(),fy:2026},{...provision(),id:'older',fy:2025}];check(R,q,raw,{});q.provisions.reverse();reject(R,q);
});
test('report confidence ties and out-of-range stored Float remain projection facts',()=>{
 const p=reports();p.provisions[0].confidence=4;p.provisions.push({...provision(),id:'other',confidence:-2});check(R,p,raw,{});p.provisions.reverse();reject(R,p);
 p.provisions=[{...provision(),pageStart:-1,pageEnd:-3,actionType:'unknown',fy:-1}];check(R,p,raw,{});
});
test('report unique identity and50cap do not certify completeness',()=>{const p=reports();p.provisions=Array.from({length:50},(_,i)=>({...provision(),id:'p'+i}));check(R,p,raw,{});p.provisions.push({...provision(),id:'overflow'});reject(R,p);p.provisions=[provision(),provision()];reject(R,p);});
test('report nullable fields are complete fields not optional proof markers',()=>{mutate(R,reports,[p=>delete p.provisions[0].sourceUrl,p=>delete p.provisions[0].pageStart,p=>p.provisions[0].authorized=true,p=>p.hasMore=false,p=>p.note='Unnecessary proof']);});
test('missing award table fallback cannot carry normal evidence or fabricate rows',()=>{mutate(C,missing,[p=>p.data=[award()],p=>p.namedPrimes=[],p=>p.evidence=contractors().evidence,p=>p.todo=null,p=>p.todo='generic unavailable']);});
test('normal contractor projection keeps fixed24month award provenance apart from exhibit FY',()=>{
 const p=contractors();assert.equal(p.namedPrimes[0].fy,2025);check(C,p,raw,{});
 mutate(C,contractors,[p=>p.evidence.federalAwards.provenance.windowMonths=12,p=>p.evidence.federalAwards.provenance.kind='government_budget',p=>p.evidence.governmentExhibit.provenance.kind='canonical',p=>p.evidence.federalAwards.unit='USD',p=>delete p.evidenceNote]);
});
test('contractor direct and candidate buckets correlate only returned grouped awards',()=>{
 const p=contractors();p.data.push(award('program',1,'Program example'));p.evidence.federalAwards.amountM=3;p.evidence.federalAwards.count=2;p.evidence.federalAwards.buckets[1].amountM=1;p.evidence.federalAwards.buckets[1].count=1;check(C,p,raw,{});
 p.evidence.federalAwards.buckets[0].amountM=3;reject(C,p);p.evidence.federalAwards.buckets[0].amountM=2;p.evidence.federalAwards.buckets.reverse();reject(C,p);
});
test('named exhibit money never inflates federal accepted-direct obligations',()=>{const p=contractors();p.evidence.federalAwards.amountM+=17;p.evidence.federalAwards.buckets[0].amountM+=17;reject(C,p);p.evidence.federalAwards.amountM=2;p.evidence.federalAwards.buckets[0].amountM=2;p.evidence.governmentExhibit.amountM=2;reject(C,p);});
test('unmatched zero bucket and caveat do not become invented inventory',()=>{mutate(C,contractors,[p=>p.evidence.federalAwards.buckets[2].amountM=1,p=>p.evidence.federalAwards.buckets[2].count=1,p=>p.evidence.federalAwards.buckets[2].evidenceClass='accepted_direct',p=>p.evidenceNote='All awards attributed',p=>p.evidence.complete=true]);});
test('negative award adjustments and negative exhibit values remain distinct finite numbers',()=>{
 const p=contractors();p.data[0].amount=-2;p.evidence.federalAwards.amountM=-2;p.evidence.federalAwards.buckets[0].amountM=-2;p.namedPrimes[0].totalCostM=-5;p.evidence.governmentExhibit.amountM=-5;check(C,p,raw,{});
 p.data[0].amount=NaN;reject(C,p);
});
test('contractor source and attribution text cannot promote a candidate or named prime',()=>{mutate(C,contractors,[p=>p.data[0].source='program',p=>p.data[0].attribution='Government budget',p=>p.namedPrimes[0].attribution='Award winner',p=>p.namedPrimes[0].fy=2026]);});
test('grouped contractor names unique while repeated exhibit names remain valid separate rows',()=>{
 const p=contractors();p.data.push(award());p.evidence.federalAwards.amountM=4;p.evidence.federalAwards.count=2;p.evidence.federalAwards.buckets[0].amountM=4;p.evidence.federalAwards.buckets[0].count=2;reject(C,p);
 const q=contractors();q.namedPrimes.push(prime());q.evidence.governmentExhibit.amountM=34;q.evidence.governmentExhibit.count=2;check(C,q,raw,{});
});
test('source descending contractor ordering and null exhibit sentinel are preserved',()=>{
 const p=contractors();p.namedPrimes.push({...prime(),totalCostM:null,fy:null,attribution:'Named prime per DoD FY R-3 exhibit'});p.evidence.governmentExhibit.count=2;check(C,p,raw,{});p.namedPrimes.reverse();reject(C,p);
 const q=contractors();q.data.push(award('direct',3,'larger'));q.evidence.federalAwards.amountM=5;q.evidence.federalAwards.count=2;q.evidence.federalAwards.buckets[0].amountM=5;q.evidence.federalAwards.buckets[0].count=2;reject(C,q);
});
test('contractor missing nullable fields extra money authority and malformed dates refuse',()=>{mutate(C,contractors,[p=>delete p.namedPrimes[0].sourceUrl,p=>delete p.namedPrimes[0].totalCostM,p=>p.data[0].authorized=true,p=>p.evidence.governmentExhibit.amountM='17',p=>p.evidence.federalAwards.provenance.asOf='2016-12-31T23:59:60Z']);});
test('nested output getters symbols and cycles refuse without observable effects',()=>{
 let effects=0;const p=reports();Object.defineProperty(p.provisions[0],'text',{enumerable:true,get(){effects++;return 'x';}});reject(R,p);assert.equal(effects,0);
 const q=bills();q.bills[0][Symbol('hidden')]=1;reject(B,q);const c=contractors();c.data[0].cycle=c;reject(C,c);
});
