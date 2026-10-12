import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createOutreachQueryValidators, OUTREACH_QUERY_OPERATION_IDS} from '../retrieval-0.2/outreach-query-validation.mjs';
const schema = JSON.parse(readFileSync(new URL('../retrieval-0.2/outreach-query.schema.json', import.meta.url)));
const ajv = new Ajv({strict:true, allErrors:true}); addFormats(ajv); ajv.addSchema(schema);
const validators = new Map(Object.keys(schema.$defs).map(name => [name, ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const v = createOutreachQueryValidators({schema, validateShape(name, value) {
  const check=validators.get(name); if (!check?.(value)) throw new Error(ajv.errorsText(check?.errors));
}});
const operation='query_outreach', at='2026-10-12T12:00:00.000Z';
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const context={clientResolution:null};
const resolve = (reference, clientId=id(3)) => ({clientResolution:{reference,clientId}});
const normalize = (raw={}, ctx=context) => v.normalizeOutreachQueryInput(operation,raw,ctx);
const check = (page, raw={}, ctx=context) => v.assertOutreachQueryOutput(operation,page,raw,ctx);
const user = () => ({id:id(4),email:'stored non-email',firstName:null,lastName:''});
const client = () => ({id:id(3),name:'Client',website:null,primaryContactName:null,primaryContactEmail:'free text',intakeData:[1,null,'opaque']});
const prep = () => ({id:id(6),tenantId:id(2),meetingId:id(5),clientId:null,status:'generated',agenda:[],talkingPoints:{},risks:null,followUps:'opaque',emailEvidence:false,summary:null,provider:null,model:null,promptHash:null,generatedFrom:0,editedByUserId:null,sharedAt:null,sharedByUserId:null,createdAt:at,updatedAt:at});
const debrief = () => ({id:id(7),meetingId:id(5),clientId:null,authorUserId:id(4),author:user(),confidential:true,accessLevel:'stored free text',status:'generated',keyVersion:null,sharedAt:null,sharedByUserId:null,createdAt:at,updatedAt:at});
const meeting = () => ({id:id(5),clientId:id(3),subject:'Meeting',location:null,startsAt:at,endsAt:at,organizerEmail:null,organizerName:null,metadata:{opaque:true},client:client(),attendees:[{id:id(8),email:null,name:null,role:null}],preps:[prep()],debriefs:[debrief()]});
const record = () => ({id:id(1),tenantId:id(2),clientId:id(3),meetingId:id(5),createdByUserId:id(4),type:'campaign',status:'draft',title:'',subject:null,body:'Synthetic normalized body',recipients:{opaque:true},recipientCount:0,stats:[],metadata:null,lastStep:1,sentAt:null,openedInEmailAt:null,deletedAt:null,deletedByUserId:null,createdAt:at,updatedAt:at,client:client(),meeting:meeting(),createdBy:user()});
const exact = () => ({tool:operation,generatedAt:at,record:record()});
const campaign = (n=1) => ({id:id(n),name:'Campaign',type:'stored type',status:'stored status',subject:null,clientId:null,sentAt:null,createdAt:at,clientName:null,recipientCount:0,createdBy:null});
const list = (rows=[]) => ({tool:operation,generatedAt:at,total:rows.length,campaigns:rows});
const exactCheck = page => check(page,{outreachId:id(1)});

test('single canonical operation and explicit definitions',()=>{
  assert.deepEqual(OUTREACH_QUERY_OPERATION_IDS,[operation]); assert.ok(Object.isFrozen(OUTREACH_QUERY_OPERATION_IDS));
  assert.equal(v.outreachQuerySchemaId,'urn:meri:retrieval:outreach-query:0.2.0');
  assert.equal(v.outreachQueryInputDefinition(operation),'OutreachQueryInput');
  assert.equal(v.outreachQueryOutputDefinition(operation),'OutreachQueryOutput');
  assert.throws(()=>v.outreachQueryInputDefinition('constructor'));
  assert.throws(()=>v.validateOutreachQueryShape('unknown',{}));
});
test('unselected and blank list selectors normalize with default limit',()=>{
  for(const raw of [{},{outreachId:null,clientId:null,status:null},{outreachId:' ',clientId:'\n',status:'\t'}])
    assert.deepEqual(normalize(raw),{input:{clientId:null,status:null,limit:20},metadata:{}});
});
test('exact selection suppresses all valid list selectors',()=>{
  assert.deepEqual(normalize({outreachId:' arbitrary-id ',clientId:'Client',status:'sent',limit:1}).input,{outreachId:'arbitrary-id'});
  assert.throws(()=>normalize({outreachId:id(1),clientId:'Client'},resolve('Client')));
});
test('exact selector is not narrowed to UUID and caps UTF16 after initial trim',()=>{
  assert.equal(normalize({outreachId:'x'.repeat(79)+'😀tail'}).input.outreachId,'x'.repeat(79)+'\ud83d');
  assert.equal(normalize({outreachId:'x'.repeat(79)+' y'}).input.outreachId,'x'.repeat(79)+' ');
});
test('trusted resolution is required only for effective list client selection',()=>{
  assert.deepEqual(normalize({clientId:' Client '},resolve('Client')).input,{clientId:id(3),status:null,limit:20});
  assert.throws(()=>normalize({clientId:'Client'}));
  assert.throws(()=>normalize({},resolve('Client')));
  assert.throws(()=>normalize({clientId:' '},resolve('Client')));
  assert.throws(()=>normalize({clientId:'Client'},resolve('Other')));
});
test('resolved UUID identity preserves case equivalence and cannot be rebound',()=>{
  const upper='ABCDEF00-0000-0000-0000-000000000003';
  assert.equal(normalize({clientId:upper},resolve(upper,upper)).input.clientId,upper.toLowerCase());
  assert.throws(()=>normalize({clientId:id(3)},resolve(id(3),id(9))));
});
test('client and status are trimmed again after wrapper UTF16 truncation',()=>{
  const reference='x'.repeat(79);
  assert.equal(normalize({clientId:reference+' y'},resolve(reference)).input.clientId,id(3));
  assert.equal(normalize({status:'x'.repeat(39)+' y'}).input.status,'x'.repeat(39));
  assert.equal(normalize({status:'x'.repeat(39)+'😀y'}).input.status,'x'.repeat(39)+'\ud83d');
});
test('original finite numeric conversion, truncation and clamp are preserved',()=>{
  for(const [value,want] of [[null,20],['oops',20],['Infinity',20],['',1],['  ',1],['0x10',16],['1e2',50],[-2,1],[51,50],[3.9,3],['4.9',4]])
    assert.equal(normalize({limit:value}).input.limit,want);
});
test('wrong scalar and unknown authority fields are explicit private admission refusals',()=>{
  for(const raw of [null,[],{outreachId:1},{clientId:true},{status:{}},{limit:[]},{limit:Infinity},{clientId:undefined},{tenantId:id(2)},{actorRole:'admin'}]) assert.throws(()=>normalize(raw));
  for(const ctx of [undefined,null,{},[],{clientResolution:null,actorId:id(4)}]) assert.throws(()=>v.normalizeOutreachQueryInput(operation,{},ctx));
});
test('standalone normalized selectors and trusted references enforce UTF16 bounds',()=>{
  assert.throws(()=>v.validateOutreachQueryShape('OutreachQueryExactInput',{outreachId:'😀'.repeat(41)}));
  assert.throws(()=>v.validateOutreachQueryShape('OutreachQueryListInput',{clientId:null,status:'😀'.repeat(21),limit:1}));
  assert.throws(()=>normalize({clientId:'x'},resolve(' x ')));
});
test('normalization is detached and immutable',()=>{
  const raw={clientId:'Client'},ctx=resolve('Client'),out=normalize(raw,ctx);
  raw.clientId='Other';ctx.clientResolution.clientId=id(99);
  assert.equal(out.input.clientId,id(3));for(const value of [out,out.input,out.metadata]) assert.ok(Object.isFrozen(value));
});
test('complete exact record including nested prep and debrief metadata is admitted',()=>{
  const page=exact();assert.deepEqual(exactCheck(page),page);
});
test('nullable relations and opaque JSON values retain producer scalar compatibility',()=>{
  const page=exact();Object.assign(page.record,{clientId:null,client:null,meetingId:null,meeting:null,createdByUserId:null,createdBy:null,body:'',recipients:null,stats:false,metadata:'opaque'});
  assert.deepEqual(exactCheck(page),page);
});
test('record storage types include outbound campaign but exclude internal records',()=>{
  for(const type of ['campaign','follow_up','prep','outbound_campaign']) {const p=exact();p.record.type=type;exactCheck(p);}
  for(const type of ['outreach_v3','other']) {const p=exact();p.record.type=type;assert.throws(()=>exactCheck(p));}
});
test('record status and widened step bounds follow pinned migration constraints',()=>{
  for(const status of ['draft','sent','opened_in_email','failed']) {const p=exact();p.record.status=status;p.record.lastStep=7;exactCheck(p);}
  for(const [field,value] of [['status','other'],['lastStep',0],['lastStep',8],['recipientCount',-1]]) {const p=exact();p.record[field]=value;assert.throws(()=>exactCheck(p));}
});
test('known deleted records and expanded scalar output are refused',()=>{
  for(const change of [{deletedAt:at},{ciphertext:'secret'},{currentAuthority:true}]) {const p=exact();Object.assign(p.record,change);assert.throws(()=>exactCheck(p));}
});
test('source scalar fields are required including nullable fields',()=>{
  for(const key of ['tenantId','deletedByUserId','openedInEmailAt','metadata','client','createdBy']) {const p=exact();delete p.record[key];assert.throws(()=>exactCheck(p));}
});
test('body is normalized and capped in UTF16 with no invented max-length ellipsis rule',()=>{
  for(const body of ['', 'x'.repeat(2000), 'x'.repeat(1997)+'...', 'x'.repeat(1996)+'\ud83d...']) {const p=exact();p.record.body=body;exactCheck(p);}
  for(const body of [null,' x','x ','x\ny','😀'.repeat(1001)]) {const p=exact();p.record.body=body;assert.throws(()=>exactCheck(p));}
});
test('selected record ID is bound without creating an existence or authority claim',()=>{
  assert.throws(()=>check(exact(),{outreachId:id(99)}));
  assert.throws(()=>check(exact(),{outreachId:'arbitrary-id'}));
  const p=exact();p.record.id='abcdef00-0000-0000-0000-000000000001';check(p,{outreachId:p.record.id.toUpperCase()});
});
test('no-match and branch substitutions are not successful result variants',()=>{
  assert.throws(()=>exactCheck({tool:operation,generatedAt:at,record:null}));
  assert.throws(()=>exactCheck(list()));assert.throws(()=>check(exact()));
  assert.throws(()=>check({...list(),found:false}));
});
test('non-null included relations match scalar identities',()=>{
  for(const field of ['clientId','meetingId','createdByUserId']) {const p=exact();p.record[field]=id(90);assert.throws(()=>exactCheck(p));}
  const p=exact();p.record.meeting.debriefs[0].authorUserId=id(90);assert.throws(()=>exactCheck(p));
});
test('prep and debrief rows belong to selected meeting without current client reassignment',()=>{
  const p=exact();p.record.meeting.preps[0].clientId=id(90);p.record.meeting.debriefs[0].clientId=id(91);exactCheck(p);
  for(const branch of ['preps','debriefs']) {const q=exact();q.record.meeting[branch][0].meetingId=id(99);assert.throws(()=>exactCheck(q));}
});
test('at most one latest prep and debrief but attendees are uncapped',()=>{
  const p=exact();p.record.meeting.attendees=Array.from({length:70},(_,i)=>({id:id(100+i),email:'free text',name:'',role:null}));exactCheck(p);
  for(const branch of ['preps','debriefs']) {const q=exact();q.record.meeting[branch].push(structuredClone(q.record.meeting[branch][0]));assert.throws(()=>exactCheck(q));}
});
test('all prep scalars are retained and exact enums are enforced',()=>{
  for(const status of ['generated','edited','reviewed','approved','stale','failed']) {const p=exact();p.record.meeting.preps[0].status=status;exactCheck(p);}
  const p=exact();delete p.record.meeting.preps[0].generatedFrom;assert.throws(()=>exactCheck(p));
  const q=exact();q.record.meeting.preps[0].status='draft';assert.throws(()=>exactCheck(q));
});
test('debrief encrypted body fields and unselected tenant fields never enter projection',()=>{
  for(const key of ['ciphertext','iv','authTag','body','tenantId']) {const p=exact();p.record.meeting.debriefs[0][key]='opaque';assert.throws(()=>exactCheck(p));}
  const p=exact();p.record.meeting.debriefs[0].status='reviewed';assert.throws(()=>exactCheck(p));
});
test('stored dates are canonical values with no freshness or chronological invention',()=>{
  const p=exact();p.generatedAt='0000-01-01T00:00:00.000Z';p.record.createdAt='9999-12-31T23:59:59.999Z';p.record.meeting.endsAt='0000-01-01T00:00:00.000Z';exactCheck(p);
});
test('nested invalid calendar dates and alternate wire representations refuse',()=>{
  for(const value of ['2026-02-30T00:00:00.000Z','2026-10-12','2026-10-12T00:00:00Z','+010000-01-01T00:00:00.000Z']) {const p=exact();p.record.meeting.preps[0].updatedAt=value;assert.throws(()=>exactCheck(p));}
});
test('empty campaigns are a projection, not evidence of system absence',()=>{
  assert.deepEqual(check(list()),list());assert.throws(()=>check({...list(),absenceEvidence:true}));
});
test('campaign projection retains nullable email string rather than creator object',()=>{
  const row=campaign();row.createdBy='stored email';row.type='free campaign type';check(list([row]));
  row.createdBy=user();assert.throws(()=>check(list([row])));
});
test('campaign total is exact full-array count before selected slice',()=>{
  const p=list([campaign(1),campaign(2)]);p.total=20;check(p,{limit:2});
  assert.throws(()=>check(p,{limit:3}));p.total=1;assert.throws(()=>check(p,{limit:2}));
  assert.throws(()=>check({...list(),total:1}));
});
test('campaign selected client and status must match every row',()=>{
  const row=campaign();row.clientId=id(3);row.status='sent';const raw={clientId:'Client',status:'sent'};
  check(list([row]),raw,resolve('Client'));
  assert.throws(()=>check(list([row]),{...raw,status:'draft'},resolve('Client')));
  assert.throws(()=>check(list([row]),raw,resolve('Client',id(9))));
});
test('hidden updatedAt order does not imply createdAt order or date relationships',()=>{
  const a=campaign(1),b=campaign(2);a.createdAt='9999-12-31T23:59:59.999Z';b.createdAt='0000-01-01T00:00:00.000Z';check(list([a,b]));check(list([b,a]));
});
test('campaign and attendee IDs cannot repeat even in different UUID case',()=>{
  assert.throws(()=>check(list([campaign(),campaign()])));
  const p=exact();p.record.meeting.attendees.push({...p.record.meeting.attendees[0]});assert.throws(()=>exactCheck(p));
});
test('complete envelope is closed and campaign derived count has no arbitrary small bound',()=>{
  const row=campaign();row.recipientCount=100000;check(list([row]));
  for(const value of [-1,1.5]) {row.recipientCount=value;assert.throws(()=>check(list([row])));}
  assert.throws(()=>check({...list(),tool:'other'}));assert.throws(()=>check({...list(),coverage:'complete'}));
});
test('getters and proxies are refused before any observation',()=>{
  let touched=0;const raw={};Object.defineProperty(raw,'clientId',{enumerable:true,get(){touched++;return 'Client';}});
  assert.throws(()=>normalize(raw));assert.equal(touched,0);
  const proxy=new Proxy({}, {ownKeys(){touched++;return [];}});assert.throws(()=>normalize(proxy));assert.equal(touched,0);
});
test('hostile nested JSON and prototype-bearing output are refused inertly',()=>{
  for(const bad of [undefined,NaN,Infinity,1n,()=>{},new Date(),new Map()]) {const p=exact();p.record.metadata=bad;assert.throws(()=>exactCheck(p));}
  const p=exact();p.record.metadata=p;assert.throws(()=>exactCheck(p));
  const q=exact();q.record.metadata=JSON.parse('{"__proto__":{"admin":true}}');const out=exactCheck(q);
  assert.ok(Object.hasOwn(out.record.metadata,'__proto__'));assert.equal(Object.getPrototypeOf(out.record.metadata),Object.prototype);assert.equal({}.admin,undefined);
});
test('validated complete output is detached; canonical resolver owns recursive freezing',()=>{
  const p=exact(),saved=structuredClone(p),out=exactCheck(p);p.record.meeting.preps[0].agenda.push('changed');
  assert.deepEqual(out,saved);assert.notEqual(out,p);assert.notEqual(out.record.meeting.preps[0].agenda,p.record.meeting.preps[0].agenda);
});
