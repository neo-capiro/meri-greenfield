import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createEntityCandidatesValidators} from '../retrieval-0.2/entity-candidates-validation.mjs';
const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/entity-candidates.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const compiled=new Map(Object.keys(schema.$defs).map(k=>[k,ajv.compile({$ref:`${schema.$id}#/$defs/${k}`})]));
const v=createEntityCandidatesValidators({schema,validateShape(k,value){const f=compiled.get(k);if(!f?.(value))throw new Error(`${k}: ${ajv.errorsText(f?.errors)}`);return value;}});
const id='resolve_entity',stamp='2026-10-12T00:00:00.000Z',context={defaultCongress:119};
const member=(x={})=>({entityType:'member',canonicalIdType:'bioguide',canonicalId:'A000001',display:'Synthetic member',party:null,state:null,district:null,chamber:'stored chamber',lisId:null,isCurrent:false,matchedBy:'name-search',...x});
const committee=(x={})=>({entityType:'committee',canonicalIdType:'committee',canonicalId:'hsag00',display:'Synthetic committee',chamber:'stored chamber',parentSystemCode:null,isCurrent:false,matchedBy:'name-search',...x});
const bill=(x={})=>({entityType:'bill',canonicalIdType:'billId',canonicalId:'119-hr-1',display:'Synthetic bill',congress:119,sponsorName:null,sponsorBioguideId:null,latestActionText:null,latestActionDate:null,matchedBy:'bill-id',...x});
const stateBill=(x={})=>({entityType:'state_bill',canonicalIdType:'stateBillKey',canonicalId:'xx-2026-hb1',display:'Synthetic state bill',state:'XX',session:'2026',sponsorName:null,latestActionText:null,latestActionDate:null,matchedBy:'state-bill-key',...x});
const legislator=(x={})=>({entityType:'state_legislator',canonicalIdType:'openstatesPersonId',canonicalId:'synthetic-person',display:'Synthetic legislator',state:'XX',chamber:null,district:null,party:null,isCurrent:false,matchedBy:'name-search',...x});
const page=matches=>({tool:id,generatedAt:stamp,matchesFound:matches.length,matches});
const absent=query=>({...page([]),note:query?`No canonical entity matched "${query}". Say so explicitly — do NOT fabricate a member, committee, or bill identifier.`:'resolve_entity requires a query (an id, bill designation, or name).'});
const normalize=(request={},ctx=context)=>v.normalizeEntityCandidatesInput(id,request,ctx);
const check=(output,request={query:'Synthetic'},ctx=context)=>v.assertEntityCandidatesOutput(id,output,request,ctx);

test('independent entity: exact definitions and closed operation selector',()=>{
 assert.equal(v.entityCandidatesInputDefinition(id),'EntityCandidatesInput');assert.equal(v.entityCandidatesOutputDefinition(id),'EntityCandidatesOutput');
 for(const other of ['constructor','__proto__','get_state_bill_status',''])assert.throws(()=>v.entityCandidatesInputDefinition(other));
});
test('independent entity: missing optional selectors omitted and query has second trim',()=>{
 assert.deepEqual(normalize({}).input,{limit:5});assert.deepEqual(normalize({query:null,type:' '}).input,{limit:5});
 assert.equal(normalize({query:'x'.repeat(198)+'  trailing'}).input.query,'x'.repeat(198));
 assert.equal(normalize({query:'  Synthetic ',type:' MEMBER '}).input.type,'member');
 const clippedType='member'+' '.repeat(14)+'x';assert.equal(normalize({query:'Synthetic',type:clippedType}).input.type,'member'+' '.repeat(14));check(absent('Synthetic'),{query:'Synthetic',type:clippedType});
});
test('independent entity: legacy scalar clamp is retained without complex coercion',()=>{
 for(const [value,expected] of [[null,5],['bad',5],['',1],['  ',1],[-1,1],[0,1],[2.9,2],['2.9',2],[999,10],['1e2',10]])assert.equal(normalize({limit:value}).input.limit,expected);
 for(const value of [true,{},[],NaN,Infinity])assert.throws(()=>normalize({limit:value}));
 for(const key of ['query','type'])for(const value of [true,2,{},[]])assert.throws(()=>normalize({[key]:value}));
});
test('independent entity: unsupported types remain empty outcomes and never aliases',()=>{
 for(const type of ['company','state legislator','constructor','__proto__']){check(absent('Synthetic'),{query:'Synthetic',type});assert.throws(()=>check(page([member()]),{query:'Synthetic',type}));}
});
test('independent entity: lowercase expansion preserves unsupported type semantics',()=>{
 const type='İ'.repeat(20),n=normalize({query:'Synthetic',type});assert.equal(n.input.type,type.toLowerCase());check(absent('Synthetic'),{query:'Synthetic',type});
});
test('independent entity: defaultCongress is mandatory positiveInt32 trusted context on every branch',()=>{
 for(const request of [{},{query:'Synthetic'},{query:'H.R. 1 (118th)'}]){
  assert.throws(()=>v.normalizeEntityCandidatesInput(id,request));
  for(const ctx of [{},null,[],{defaultCongress:0},{defaultCongress:2147483648},{defaultCongress:1.5},{defaultCongress:'119'},{defaultCongress:119,now:stamp}])assert.throws(()=>normalize(request,ctx));
 }
 normalize({}, {defaultCongress:1});normalize({}, {defaultCongress:2147483647});
 for(const key of ['defaultCongress','tenantId','actorId','source','state','live','sql','authorized'])assert.throws(()=>normalize({[key]:'forged'}));
});
test('independent entity: missing-query and nonempty-zero notes are exact',()=>{
 for(const request of [{},{query:null},{query:'  '}]){check(absent(null),request);assert.throws(()=>check(page([member()]),request));}
 check(absent('Synthetic'),{query:' Synthetic '});assert.throws(()=>check(absent('Synthetic'),{}));assert.throws(()=>check(absent(null),{query:'Synthetic'}));
 const missing=page([]);assert.throws(()=>check(missing));const extra=page([member()]);extra.note='qualified';assert.throws(()=>check(extra));
});
test('independent entity: returned count is exact and constrained by normalized limit',()=>{
 const rows=[member(),member({canonicalId:'B000002'})];check(page(rows),{query:'Synthetic',limit:2});assert.throws(()=>check(page(rows),{query:'Synthetic',limit:1}));
 for(const n of [-1,0,1,3,1.5]){const p=page(rows);p.matchesFound=n;assert.throws(()=>check(p));}
});
test('independent entity: five exact variants retain their required projections',()=>{
 for(const [candidate,query] of [[member(),'Synthetic'],[committee(),'Synthetic'],[bill(),'H.R. 1'],[stateBill(),'xx-2026-hb1'],[legislator(),'Synthetic']]){
  check(page([candidate]),{query,type:candidate.entityType});
  for(const key of Object.keys(candidate)){const clone={...candidate};delete clone[key];assert.throws(()=>check(page([clone]),{query,type:candidate.entityType}));}
  assert.throws(()=>check(page([{...candidate,sourceConnected:true}]),{query,type:candidate.entityType}));
 }
});
test('independent entity: stored scalars and current flags have no invented enums or positive-only Int',()=>{
 check(page([member({district:-2147483648,isCurrent:false,party:'Unmapped',state:'raw',chamber:'future'})]));
 check(page([member({district:2147483647})]));assert.throws(()=>check(page([member({district:2147483648})])));
 check(page([committee({parentSystemCode:'raw stored parent',chamber:'future',isCurrent:false})]));
 check(page([legislator({canonicalId:'',state:'not-two-letters',chamber:'future',district:'raw district',party:'unmapped',isCurrent:false})]));
});
test('independent entity: raw bill congress/state/session are not fabricated ID consistency rules',()=>{
 check(page([bill({congress:-2147483648})]),{query:'H.R. 1',type:'bill'});
 check(page([stateBill({state:'other',session:'stored session'})]),{query:'xx-2026-hb1',type:'state_bill'});
 for(const candidate of [bill(),stateBill()]){candidate.isCurrent=true;assert.throws(()=>check(page([candidate]),{query:candidate.canonicalId}));}
});
test('independent entity: direct member/committee IDs correlate case normalization and discriminator',()=>{
 check(page([member({matchedBy:'bioguide-id'})]),{query:' a000001 ',type:'member'});
 check(page([committee({matchedBy:'system-code'})]),{query:'HSAG00',type:'committee'});
 assert.throws(()=>check(page([member({matchedBy:'bioguide-id',canonicalId:'B000002'})]),{query:'a000001'}));
 assert.throws(()=>check(page([committee({matchedBy:'system-code',canonicalId:'ssag00'})]),{query:'HSAG00'}));
 assert.throws(()=>check(page([member({matchedBy:'system-code'})]),{query:'HSAG00'}));
});
test('independent entity: canonical federal grammar uses trusted default and explicit suffix override',()=>{
 check(page([bill()]),{query:'H. R. 1'});check(page([bill({canonicalId:'118-hr-1',congress:118})]),{query:'H.R. 1 (118th)'},{defaultCongress:120});
 check(page([bill({canonicalId:'120-hr-1'})]),{query:'H.R. 1'},{defaultCongress:120});
 assert.throws(()=>check(page([bill()]),{query:'H.R. 1'},{defaultCongress:120}));
 check(page([bill()]),{query:'119-HR-1'});assert.throws(()=>check(page([bill()]),{query:'HR zero'}));
});
test('independent entity: approved state syntax helper correlates canonical keys without live lookup',()=>{
 check(page([stateBill()]),{query:' X.X.-2026-H.B.1 ',type:'state_bill'});
 assert.throws(()=>check(page([stateBill({canonicalId:'xx-2026-hb2'})]),{query:'xx-2026-hb1'}));
 check(page([stateBill({canonicalId:'xx-2025x100-hb1'})]),{query:'XX H.B. 1'});
 check(page([stateBill({canonicalId:'dc-2025-b260001',state:'DC',session:'2025'})]),{query:'DC B26-0001'});
});
test('independent entity: raw state designation match does not claim latest-session authority',()=>{
 check(page([stateBill({canonicalId:'xx-2020-hb1'})]),{query:'XX HB 1'});
 check(page([stateBill({canonicalId:'xx-2026x777-hb1'})]),{query:'XX HB 1'});
});
test('independent entity: crosswalk allows dynamic suffixes and repeat canonical candidates',()=>{
 for(const matchedBy of ['lis-crosswalk','unknown future system-crosswalk','-crosswalk','constructor-crosswalk'])check(page([member({matchedBy})]),{query:'123'});
 check(page([member({matchedBy:'lis-crosswalk'}),member({matchedBy:'fec-crosswalk'})]),{query:'external'});
 check(page([stateBill({canonicalId:'raw-key',matchedBy:'external-crosswalk'})]),{query:'123'});
 check(page([legislator({canonicalId:'raw-person',matchedBy:'external-crosswalk'})]),{query:'123'});
});
test('independent entity: crosswalk phase has no committee or federal-bill adapter',()=>{
 for(const candidate of [committee({matchedBy:'external-crosswalk'}),bill({matchedBy:'external-crosswalk'})])assert.throws(()=>check(page([candidate]),{query:'external'}));
});
test('independent entity: syntax alone cannot prohibit fallbacks after a missing direct row',()=>{
 check(page([member({canonicalId:'other',matchedBy:'external-crosswalk'})]),{query:'A000001'});
 check(page([member({canonicalId:'other',matchedBy:'name-search'})]),{query:'A000001'});
});
test('independent entity: phase mixing is refused',()=>{
 assert.throws(()=>check(page([member({matchedBy:'bioguide-id'}),member({canonicalId:'other',matchedBy:'name-search'})]),{query:'A000001'}));
 assert.throws(()=>check(page([member({matchedBy:'external-crosswalk'}),committee()]),{query:'Synthetic'}));
});
test('independent entity: name search requires Latin letters and supported name families',()=>{
 assert.throws(()=>check(page([member()]),{query:'123'}));assert.throws(()=>check(page([member()]),{query:'é'}));
 for(const candidate of [bill({matchedBy:'name-search'}),stateBill({matchedBy:'name-search'})])assert.throws(()=>check(page([candidate])));
 check(page([member({display:'No textual relation to query'})]),{query:'hiddenLastName'});
});
test('independent entity: name family order and current-first apply within each group only',()=>{
 check(page([member({isCurrent:false}),committee({isCurrent:true}),legislator({isCurrent:true})]));
 assert.throws(()=>check(page([committee(),member()])));assert.throws(()=>check(page([legislator(),committee()])));
 assert.throws(()=>check(page([member(),member({canonicalId:'B000002',isCurrent:true})])));
 check(page([member({isCurrent:true}),member({canonicalId:'B000002',isCurrent:false})]));
});
test('independent entity: supplied supported type restricts every candidate family',()=>{
 for(const candidate of [member(),committee(),legislator()])for(const type of ['member','committee','bill','state_bill','state_legislator'])if(type!==candidate.entityType)assert.throws(()=>check(page([candidate]),{query:'Synthetic',type}));
});
test('independent entity: both bill dates are SQLDate UTC midnight and nullable',()=>{
 for(const [candidate,query] of [[bill(),'H.R. 1'],[stateBill(),'xx-2026-hb1']]){
  check(page([{...candidate,latestActionDate:'2024-02-29T00:00:00.000Z'}]),{query});
  for(const latestActionDate of ['2024-02-29T12:00:00.000Z','2026-02-30T00:00:00.000Z','2026-10-12','2026-10-12T00:00:00Z'])assert.throws(()=>check(page([{...candidate,latestActionDate}]),{query}));
 }
});
test('independent entity: generatedAt is serialization metadata, not freshness authority',()=>{
 const p=page([member()]);p.generatedAt='1900-01-01T00:00:00.000Z';check(p);p.generatedAt='2026-02-30T00:00:00.000Z';assert.throws(()=>check(p));
});
test('independent entity: canonicalIdType and closed projection cannot substitute',()=>{
 for(const candidate of [member(),committee(),bill(),stateBill(),legislator()]){
  const invalid={...candidate,canonicalIdType:'other'};assert.throws(()=>check(page([invalid]),{query:candidate.canonicalId}));
 }
 for(const key of ['complete','source','current','authorization','query']){const p=page([member()]);p[key]=true;assert.throws(()=>check(p));}
});
test('independent entity: normalized selection and nested helper metadata are immutable copies',()=>{
 const input={query:' XX HB 1 ',type:' STATE_BILL '},saved=structuredClone(input),n=normalize(input);
 assert.deepEqual(input,saved);assert.notEqual(n.input,input);assert.ok(Object.isFrozen(n)&&Object.isFrozen(n.input)&&Object.isFrozen(n.metadata)&&Object.isFrozen(n.metadata.stateBillSelector));
 const ctx=Object.freeze({defaultCongress:119});normalize(Object.freeze({query:'H.R. 1'}),ctx);check(Object.freeze(absent('Synthetic')),{query:'Synthetic'},ctx);
});
test('independent entity: defaultCongress does not read ambient clock',()=>{
 const old=Date.now;let effects=0;Date.now=()=>{effects++;throw new Error('ambient clock');};try{normalize({query:'H.R. 1'});check(page([bill()]),{query:'H.R. 1'});assert.equal(effects,0);}finally{Date.now=old;}
});
test('independent entity: getters proxies cycles and hidden fields do not execute',()=>{
 let effects=0;const input={get query(){effects++;return'Synthetic';}},ctx={get defaultCongress(){effects++;return119;}};
 const p=page([member()]);Object.defineProperty(p.matches[0],'display',{enumerable:true,get(){effects++;return'Synthetic';}});
 assert.throws(()=>normalize(input));assert.throws(()=>normalize({},ctx));assert.throws(()=>check(p));
 const proxy=new Proxy({}, {ownKeys(){effects++;return[];}});assert.throws(()=>normalize(proxy));assert.throws(()=>check(proxy));assert.equal(effects,0);
 const cycle={};cycle.self=cycle;for(const raw of [cycle,new Date(),Object.defineProperty({},'query',{value:'Synthetic'})])assert.throws(()=>normalize(raw));
});
test('independent entity: operation and shape names refuse hostile coercion',()=>{
 let effects=0;const value={[Symbol.toPrimitive](){effects++;return id;},toString(){effects++;return id;}};
 for(const unknown of [value,{},[],null,Symbol('selector')]){
  assert.throws(()=>v.entityCandidatesInputDefinition(unknown));assert.throws(()=>v.entityCandidatesOutputDefinition(unknown));assert.throws(()=>v.normalizeEntityCandidatesInput(unknown,{},context));assert.throws(()=>v.assertEntityCandidatesOutput(unknown,page([member()]),{},context));assert.throws(()=>v.validateEntityCandidatesShape(unknown,{}));
 }assert.equal(effects,0);
});

for(const [kind,candidate] of [['member',member],['committee',committee],['state_legislator',legislator]])test(`independent entity: name-query identities cannot repeat within ${kind}`,()=>{
 assert.throws(()=>check(page([candidate(),candidate()])));
});
