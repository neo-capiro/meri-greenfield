// Independent derived projection controls. No producer source is imported/executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const sourceRoot = process.env.MERI_STATE_STATUS_REVIEW_SOURCE_ROOT || path.resolve(import.meta.dirname, '../../..');
const dir = path.join(sourceRoot, 'packages/contracts/retrieval-0.2');
const schema = JSON.parse(fs.readFileSync(path.join(dir, 'state-status-votes.schema.json'), 'utf8'));
const ajv = new Ajv2020({strict: true, allErrors: true}); addFormats(ajv); ajv.addSchema(schema);
const {createStateStatusVotesValidators} = await import(pathToFileURL(path.join(dir, 'state-status-votes-validation.mjs')));
const {inspectStateBillSelector} = await import(pathToFileURL(path.join(dir, 'state-bill-identity.mjs')));
const api = createStateStatusVotesValidators({schema, validateShape(name, value) {
 const check = ajv.getSchema(`${schema.$id}#/$defs/${name}`); assert.ok(check, name);
 if (!check(value)) throw new Error(`shape:${name}:${ajv.errorsText(check.errors)}`);
}});
const S='get_state_bill_status', V='search_state_floor_votes', now='2026-10-12T11:12:13.000Z', day='2026-10-10T00:00:00.000Z';
const clone=x=>structuredClone(x), normalize=(id,x,o={})=>api.normalizeStateStatusVotesInput(id,x,o);
const check=(id,x,r={},o={})=>api.assertStateStatusVotesOutput(id,x,r,o);
const note=n=>schema.$defs[n].const;
function vote(x={}) {return {chamber:null,motion:null,date:null,yeas:-2,nays:7,nv:0,absent:-9,passed:null,sourceUrl:null,...x};}
function floor(x={}) {return {id:'row-1',billKey:null,...vote(),...x};}
function votes(rows=[],x={}) {return {tool:V,generatedAt:now,votesFound:rows.length,votes:rows,...(rows.length?{}:{note:note('NoStateVotesNote')}),...x};}
function found(x={}) {return {tool:S,generatedAt:now,billId:'tx-2025-hb123',found:true,state:'stored-state',session:'stored-session',identifier:'stored-identifier',title:'',status:null,statusLabel:'Unknown',statusAt:null,latestAction:{text:null,date:null},sponsor:{name:null,party:null,count:-1},recentActions:[],votes:[vote()],companions:[],url:null,...x};}
function absent(key='tx-2025-hb123') {return {tool:S,generatedAt:now,billId:key,found:false,note:`No bill ${key} on record in the Capiro database. Say so explicitly — do not describe its status from memory.`};}
function unresolved(reason=note('MissingStateBillNote')) {return {tool:S,generatedAt:now,found:false,note:reason};}
const req={billId:'tx-2025-hb123'};

test('syntax helper canonical normalization and hint precedence',()=>{
 assert.deepEqual(inspectStateBillSelector(' T.X. -2025 X2-H.B.001a ', 'CA'),{kind:'canonical',key:'tx-2025x2-hb001a'});
 assert.deepEqual(inspectStateBillSelector('H.B. 01-23a','tx'),{kind:'designation',state:'TX',billNumber:'hb0123a'});
 assert.deepEqual(inspectStateBillSelector('TX HB 123','CA'),{kind:'designation',state:'TX',billNumber:'hb123'});
 assert.deepEqual(inspectStateBillSelector('HB 123'),{kind:'invalid'});
 assert.deepEqual(inspectStateBillSelector(null),{kind:'missing'});
});
test('syntax helper refuses effectful scalar coercion',()=>{let calls=0; const x={toString(){calls++;return 'TX HB123';}}; assert.throws(()=>inspectStateBillSelector(x));assert.throws(()=>inspectStateBillSelector('HB123',x));assert.equal(calls,0);});
test('status bill precedence and query fallback retain trimmed UTF16 caps',()=>{
 assert.deepEqual(normalize(S,{billId:' tx-2025-hb123 ',query:'CA SB 9',state:' ca-long '}).input,{billId:'tx-2025-hb123',state:'ca'});
 assert.equal(normalize(S,{billId:' ',query:' 😀'.repeat(50)}).input.billId.length,60);
 assert.deepEqual(normalize(S,{}).input,{});
});
test('vote query is motion query, never alias for bill selection',()=>{const n=normalize(V,{query:' TX HB123 ',state:' tx ',chamber:' LOWER '}); assert.equal(n.metadata.selector.kind,'missing');assert.deepEqual(n.input,{state:'tx',query:'TX HB123',chamber:'lower',limit:10});});
test('limits preserve primitive numeric coercion and default semantics',()=>{
 for(const [raw,expected] of [[undefined,10],[null,10],['',1],['  ',1],['0x10',16],['-2.9',1],[3.9,3],['Infinity',10],['bad',10],[1e6,25]]) assert.equal(normalize(V,raw===undefined?{}:{limit:raw}).input.limit,expected);
 for(const limit of [true,{},[],NaN,Infinity])assert.throws(()=>normalize(V,{limit}));
});
test('options closed and no caller actor/tenant/source context accepted',()=>{for(const options of [null,[],{actorId:'x'},{resolvedBillKey:'tx-2025-hb123'},{scope:{}}])assert.throws(()=>normalize(S,req,options));assert.throws(()=>normalize(S,{...req,tenantId:'x'}));});
test('unknown operation cannot invoke coercion',()=>{let calls=0;assert.throws(()=>normalize({toString(){calls++;return S;}},req));assert.equal(calls,0);assert.throws(()=>normalize('__proto__',req));});
test('missing status selection carries no fabricated id or found payload',()=>{check(S,unresolved(),{});assert.throws(()=>check(S,found(),{}));assert.throws(()=>check(S,{...unresolved(),billId:req.billId},{}));assert.throws(()=>check(S,{...unresolved(),found:true},{}));});
test('unparseable status preserves reason and cannot become absent resolved result',()=>{const r={billId:'nonsense'};check(S,unresolved('Could not parse "nonsense" as a state bill designation — specify the state, e.g. "TX HB 1234".'),r);assert.throws(()=>check(S,absent(),r));assert.throws(()=>check(S,unresolved('No such bill exists.'),r));});
test('direct key absent preserves exact identity and cannot pretend unresolved',()=>{check(S,absent(),req);assert.throws(()=>check(S,absent('ca-2025-hb123'),req));assert.throws(()=>check(S,unresolved(),req));});
test('direct found does not derive stored tuple from canonical id',()=>{check(S,found(),{...req,state:'CA'});assert.throws(()=>check(S,found({billId:'ca-2025-hb123'}),req));});
test('designation permits historical session but requires selected state and bill',()=>{check(S,found({billId:'tx-2001x2-hb123'}),{billId:'TX HB123'});for(const key of ['ca-2001-hb123','tx-2001-sb123','tx-2001-hb124'])assert.throws(()=>check(S,found({billId:key}),{billId:'TX HB123'}));});
test('ordinary unknown and empty status labels are retained',()=>{for(const status of ['', 'future_status'])check(S,found({status,statusLabel:status}),req);check(S,found({status:'introduced',statusLabel:'Introduced'}),req);assert.throws(()=>check(S,found({status:'introduced',statusLabel:'Enacted'}),req));});
test('inherited status metadata retains omission instead of fabricated label',()=>{for(const status of ['constructor','toString','__proto__']){const p=found({status});delete p.statusLabel;check(S,p,req);assert.throws(()=>check(S,{...p,statusLabel:status},req));}});
test('source date instants and SQLDate distinctions',()=>{check(S,found({statusAt:now,latestAction:{text:'',date:day}}),req);for(const value of ['2026-10-10','2026-10-10T01:00:00.000Z','2026-10-10T00:00:00+00:00'])assert.throws(()=>check(S,found({latestAction:{text:null,date:value}}),req));assert.throws(()=>check(S,found({generatedAt:'2026-10-12T11:12:13+00:00'}),req));});
test('action 15-window allows ties, signed importance and rejects ascending',()=>{const a={date:day,text:'',chamber:null,importance:-5};check(S,found({recentActions:Array(15).fill(a)}),req);assert.throws(()=>check(S,found({recentActions:Array(16).fill(a)}),req));assert.throws(()=>check(S,found({recentActions:[a,{...a,date:'2026-10-11T00:00:00.000Z'}]}),req));});
test('status votes nullable dates first, ties allowed, no tally inference',()=>{check(S,found({votes:[vote(),vote({date:day}),vote({date:day,passed:true})]}),req);assert.throws(()=>check(S,found({votes:[vote({date:day}),vote()]}),req));assert.throws(()=>check(S,found({votes:Array(16).fill(vote())}),req));assert.throws(()=>check(S,found({votes:[vote({yeas:2147483648})]}),req));});
test('empty rollcall and dead status caveats must be exact and cumulative',()=>{const p=found({status:'dead_by_deadline',statusLabel:'Dead — session adjourned sine die',votes:[],note:note('NoBillVotesNote')+' '+note('DeadStateBillNote')});check(S,p,req);assert.throws(()=>check(S,{...p,note:note('NoBillVotesNote')},req));assert.throws(()=>check(S,found({note:note('NoBillVotesNote')}),req));});
test('companion null enrichment differs from present row null status',()=>{const c={relatedBillKey:'opaque',linkType:'anything',identifier:null,status:null,statusLabel:null};check(S,found({companions:[c,c]}),req);check(S,found({companions:[{...c,identifier:'',statusLabel:'Unknown'}]}),req);assert.throws(()=>check(S,found({companions:[{...c,status:'enacted'}]}),req));assert.throws(()=>check(S,found({companions:[{...c,identifier:'',statusLabel:null}]}),req));});
test('companion inherited status may omit label while other fields remain required',()=>{const c={relatedBillKey:'opaque',linkType:'x',identifier:'HB1',status:'constructor'};check(S,found({companions:[c]}),req);assert.throws(()=>check(S,found({companions:[{...c,statusLabel:'constructor'}]}),req));});
test('unresolved requested vote bill cannot broaden to state or motion search',()=>{const r={billId:'nonsense',state:'TX',query:'funding'};const reason='Could not parse "nonsense" as a state bill designation.';check(V,votes([],{note:reason}),r);assert.throws(()=>check(V,votes([floor({billKey:'tx-2025-hb1',motion:'funding'})]),r));assert.throws(()=>check(V,votes(),r));});
test('designation vote unresolved note is empty only, successful rows share one selected key',()=>{const r={billId:'TX HB123'};check(V,votes([],{note:'No bill found matching "TX HB123" in TX.'}),r);check(V,votes([floor({billKey:'tx-2001-hb123'})]),r);assert.throws(()=>check(V,votes([floor({billKey:'tx-2001-hb123'}),floor({billKey:'tx-2003-hb123'})]),r));assert.throws(()=>check(V,votes([floor({billKey:'tx-2001-hb124'})]),r));});
test('direct bill votes override state hint but never allow nullable or foreign keys',()=>{check(V,votes([floor({billKey:req.billId})]),{...req,state:'CA'});for(const billKey of [null,'ca-2025-hb123'])assert.throws(()=>check(V,votes([floor({billKey})]),req));});
test('state-wide prefix is SQL prefix only, no invented bill grammar',()=>{check(V,votes([floor({billKey:'tx-opaque-record'})]),{state:'TX'});assert.throws(()=>check(V,votes([floor({billKey:null})]),{state:'TX'}));check(V,votes([floor()]),{});});
test('unsupported chamber remains no-filter; supported chamber exact',()=>{check(V,votes([floor({chamber:'local'})]),{chamber:'assembly'});check(V,votes([floor({chamber:'lower'})]),{chamber:'LOWER'});assert.throws(()=>check(V,votes([floor()]),{chamber:'lower'}));});
test('query excludes null motion but SQL owns substring/collation semantics',()=>{check(V,votes([floor({motion:'opaque source collation match'})]),{query:'NEEDLE'});assert.throws(()=>check(V,votes([floor()]),{query:'NEEDLE'}));});
test('votesFound equals returned window, no total or member-level fields invented',()=>{check(V,votes([floor(),floor()]),{limit:2});assert.throws(()=>check(V,votes([floor()],{votesFound:2}),{}));assert.throws(()=>check(V,votes([floor(),floor()]),{limit:1}));assert.throws(()=>check(V,{...votes(),total:0},{}));assert.throws(()=>check(V,votes([{...floor(),memberVotes:[]}]),{}));});
test('nonempty vote response cannot carry unavailable note',()=>{assert.throws(()=>check(V,votes([floor()],{note:note('NoStateVotesNote')}),{}));const p=votes();delete p.note;assert.throws(()=>check(V,p,{}));});
test('hostile own-data admission causes no getter, proxy, symbol or coercion effects',()=>{let effects=0;const getter={};Object.defineProperty(getter,'billId',{enumerable:true,get(){effects++;return req.billId;}});const proxy=new Proxy({}, {ownKeys(){effects++;return []},get(){effects++;return undefined},getPrototypeOf(){effects++;return Object.prototype}});for(const x of [getter,proxy,{...req,[Symbol('x')]:1},Object.create({billId:req.billId})])assert.throws(()=>normalize(S,x));assert.equal(effects,0);});
test('result snapshots refuse effects and close all nested fields',()=>{let effects=0;const p=found();Object.defineProperty(p,'title',{enumerable:true,get(){effects++;return '';}});assert.throws(()=>check(S,p,req));assert.equal(effects,0);for(const patch of [{authority:true},{sponsor:{name:null,party:null,count:0,actorId:'x'}},{votes:[{...vote(),proof:true}]}])assert.throws(()=>check(S,found(patch),req));});
test('normalization and assertions preserve caller-owned data',()=>{const r=Object.freeze({...req}),p=found(),before=clone(p);const n=normalize(S,r);assert.ok(Object.isFrozen(n)&&Object.isFrozen(n.input)&&Object.isFrozen(n.metadata));const out=check(S,p,r);assert.deepEqual(p,before);assert.notEqual(out,p);});
