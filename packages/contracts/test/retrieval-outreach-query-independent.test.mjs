import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createOutreachQueryValidators} from '../retrieval-0.2/outreach-query-validation.mjs';

const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/outreach-query.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const validators=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const v=createOutreachQueryValidators({schema,validateShape(name,value){const check=validators.get(name);if(!check?.(value))throw new Error(`${name}: ${ajv.errorsText(check?.errors)}`);}});
const ID='query_outreach',at='2026-10-12T12:00:00.000Z';
const uuid=n=>`${n.toString(16).padStart(8,'0')}-abcd-1234-abcd-0123456789ab`;
const [recordId,tenantId,userId,clientId,meetingId,prepId,debriefId,otherId]=Array.from({length:8},(_,i)=>uuid(i+1));
const context={clientResolution:null};
const person=()=>({id:userId,email:'unformatted stored address',firstName:null,lastName:''});
const client=()=>({id:clientId,name:'Synthetic client',website:'not a URL',primaryContactName:null,primaryContactEmail:null,intakeData:{nested:[null,true]}});
const prep=()=>({id:prepId,tenantId,meetingId,clientId,status:'generated',agenda:[],talkingPoints:{opaque:true},risks:null,followUps:'opaque',emailEvidence:5,summary:null,provider:null,model:null,promptHash:null,generatedFrom:{},editedByUserId:null,sharedAt:null,sharedByUserId:null,createdAt:at,updatedAt:at});
const debrief=()=>({id:debriefId,meetingId,clientId,authorUserId:userId,author:person(),confidential:true,accessLevel:'stored custom level',status:'generated',keyVersion:null,sharedAt:null,sharedByUserId:null,createdAt:at,updatedAt:at});
const meeting=()=>({id:meetingId,clientId,subject:'Meeting',startsAt:at,endsAt:at,location:null,organizerEmail:null,organizerName:null,metadata:{},client:client(),attendees:[{id:otherId,email:null,name:null,role:null}],preps:[prep()],debriefs:[debrief()]});
const record=()=>({id:recordId,tenantId,clientId,meetingId,createdByUserId:userId,type:'campaign',status:'draft',title:'Title',subject:null,body:'',recipients:[],recipientCount:0,stats:{},metadata:{},lastStep:1,sentAt:null,openedInEmailAt:null,deletedAt:null,deletedByUserId:null,createdAt:at,updatedAt:at,client:client(),meeting:meeting(),createdBy:person()});
const exact=()=>({tool:ID,generatedAt:at,record:record()});
const campaign=()=>({id:recordId,name:'Campaign',type:'custom stored type',status:'custom stored status',subject:null,clientId:null,clientName:null,recipientCount:0,createdBy:'unformatted stored address',sentAt:null,createdAt:at});
const list=()=>({tool:ID,generatedAt:at,total:1,campaigns:[campaign()]});
const norm=(raw={},options=context)=>v.normalizeOutreachQueryInput(ID,raw,options);
const check=(page=list(),raw={},options=context)=>v.assertOutreachQueryOutput(ID,page,raw,options);
const exactCheck=(page=exact(),raw={outreachId:recordId},options=context)=>check(page,raw,options);

test('independent outreach: exact schema namespace and operation selectors',()=>{
 assert.equal(schema.$id,'urn:meri:retrieval:outreach-query:0.2.0');assert.equal(v.outreachQueryInputDefinition(ID),'OutreachQueryInput');assert.equal(v.outreachQueryOutputDefinition(ID),'OutreachQueryOutput');
 for(const name of ['__proto__','constructor','query_tasks','']){assert.throws(()=>v.outreachQueryInputDefinition(name));assert.throws(()=>v.normalizeOutreachQueryInput(name,{},context));}
});
test('independent outreach: frozen detached normalized defaults',()=>{
 const raw={clientId:null,status:'  ',limit:null},saved=structuredClone(raw),n=norm(raw);
 assert.deepEqual(n.input,{clientId:null,status:null,limit:20});assert.deepEqual(n.metadata,{});assert.ok(Object.isFrozen(n));assert.ok(Object.isFrozen(n.input));assert.ok(Object.isFrozen(n.metadata));assert.deepEqual(raw,saved);
});
test('independent outreach: exact branch suppresses all list selectors and preserves nonUUID input',()=>{
 assert.deepEqual(norm({outreachId:'  unresolvable text  ',clientId:'ignored',status:'sent',limit:'3'}).input,{outreachId:'unresolvable text'});
 assert.deepEqual(norm({outreachId:recordId,clientId:'ignored',limit:1}).input,{outreachId:recordId});
 assert.throws(()=>norm({outreachId:recordId},{clientResolution:{reference:'ignored',clientId}}));
});
test('independent outreach: trusted client resolution is required and request cannot forge it',()=>{
 const raw={clientId:'  Synthetic client  '};assert.throws(()=>norm(raw));
 const ctx={clientResolution:{reference:'Synthetic client',clientId:clientId.toUpperCase()}};
 assert.equal(norm(raw,ctx).input.clientId,clientId);assert.throws(()=>norm(raw,{clientResolution:{...ctx.clientResolution,reference:'Other'}}));
 assert.throws(()=>norm({clientResolution:ctx.clientResolution}));assert.throws(()=>norm({},ctx));
});
test('independent outreach: UUID input cannot be rebound while case equivalent identity can',()=>{
 const raw={clientId:clientId.toUpperCase()};assert.equal(norm(raw,{clientResolution:{reference:clientId.toUpperCase(),clientId}}).input.clientId,clientId);
 assert.throws(()=>norm(raw,{clientResolution:{reference:clientId.toUpperCase(),clientId:otherId}}));
});
test('independent outreach: UTF16 caps and downstream second trim',()=>{
 assert.equal(norm({status:'s'.repeat(39)+' x'}).input.status,'s'.repeat(39));
 assert.equal(norm({status:'s'.repeat(39)+'😀'}).input.status,'s'.repeat(39)+'\ud83d');
 assert.equal(norm({outreachId:'x'.repeat(79)+'😀'}).input.outreachId,'x'.repeat(79)+'\ud83d');
 const raw={clientId:'x'.repeat(79)+' y'};assert.equal(norm(raw,{clientResolution:{reference:'x'.repeat(79),clientId}}).input.clientId,clientId);
});
test('independent outreach: source scalar limit conversion and finite fallback',()=>{
 for(const [limit,want] of [[-20,1],[500,50],[3.9,3],['2.9',2],['',1],['no',20],['Infinity',20],[null,20],['0x10',16]])assert.equal(norm({limit}).input.limit,want);
 for(const limit of [true,{},[],NaN,Infinity,undefined])assert.throws(()=>norm({limit}));
});
test('independent outreach: strict selected scalar and closed context admissions',()=>{
 for(const key of ['outreachId','clientId','status'])for(const value of [1,false,{},[],undefined])assert.throws(()=>norm({[key]:value}));
 for(const ctx of [{},{clientResolution:null,tenantId},{clientResolution:{}},{clientResolution:{reference:'x',clientId:'not uuid'}}])assert.throws(()=>norm({},ctx));
 assert.throws(()=>norm({unknown:true}));assert.throws(()=>norm({tenantId}));
});
test('independent outreach: inert getters, proxies, hidden fields and symbols',()=>{
 let effects=0;const getter={};Object.defineProperty(getter,'status',{enumerable:true,get(){effects++;throw Error('effect');}});assert.throws(()=>norm(getter));
 const proxy=new Proxy({},{get(){effects++;throw Error('effect');},ownKeys(){effects++;throw Error('effect');}});assert.throws(()=>norm(proxy));
 const hidden={};Object.defineProperty(hidden,'status',{value:'sent'});assert.throws(()=>norm(hidden));assert.throws(()=>norm({[Symbol('authority')]:true}));assert.equal(effects,0);
 const badctx={};Object.defineProperty(badctx,'clientResolution',{enumerable:true,get(){effects++;return null;}});assert.throws(()=>norm({},badctx));assert.equal(effects,0);
});
test('independent outreach: list total is full pre-slice count and exact returned window',()=>{
 let p=list();p.total=10;check(p,{limit:1});p.total=0;assert.throws(()=>check(p));
 p=list();p.total=2;assert.throws(()=>check(p));p.campaigns.push({...campaign(),id:otherId});check(p);
 p.total=100;assert.throws(()=>check(p,{limit:3}));check(p,{limit:2});
});
test('independent outreach: empty list and unknown source status are ordinary projections',()=>{
 check({tool:ID,generatedAt:at,total:0,campaigns:[]},{status:'not a known enum'});
 const p=list();check(p,{status:' custom stored status '});p.campaigns[0].status='other';assert.throws(()=>check(p,{status:'custom stored status'}));
});
test('independent outreach: list client correlation uses resolved identity not raw name',()=>{
 const p=list();p.campaigns[0].clientId=clientId;p.campaigns[0].clientName='Different display spelling';const ctx={clientResolution:{reference:'Synthetic client',clientId}};
 check(p,{clientId:'Synthetic client'},ctx);p.campaigns[0].clientId=otherId;assert.throws(()=>check(p,{clientId:'Synthetic client'},ctx));
});
test('independent outreach: unprojected updatedAt does not imply createdAt ordering',()=>{
 const p=list();p.total=2;p.campaigns.push({...campaign(),id:otherId,createdAt:'2026-10-13T12:00:00.000Z'});check(p);
 p.campaigns.reverse();check(p);
});
test('independent outreach: list projected columns complete and no leaked bodies/recipients',()=>{
 for(const key of Object.keys(campaign())){const p=list();delete p.campaigns[0][key];assert.throws(()=>check(p));}
 for(const key of ['body','metadata','tenantId','recipients','updatedAt']){const p=list();p.campaigns[0][key]=null;assert.throws(()=>check(p));}
});
test('independent outreach: campaign count, uniqueness and null scalar boundaries',()=>{
 for(const total of [-1,1.2,Number.MAX_SAFE_INTEGER+1]){const p=list();p.total=total;assert.throws(()=>check(p));}
 const p=list();p.total=2;p.campaigns.push(campaign());assert.throws(()=>check(p));
 for(const count of [-1,1.5,null]){const p=list();p.campaigns[0].recipientCount=count;assert.throws(()=>check(p));}
 const q=list();q.campaigns[0].createdBy=null;check(q);q.campaigns[0].createdBy=person();assert.throws(()=>check(q));
});
test('independent outreach: complete exact record and deep detachment',()=>{
 const p=exact(),saved=structuredClone(p),out=exactCheck(p);assert.deepEqual(out,p);assert.notEqual(out,p);assert.notEqual(out.record,p.record);assert.notEqual(out.record.meeting.preps[0],p.record.meeting.preps[0]);
 p.record.meeting.preps[0].talkingPoints.opaque=false;assert.equal(out.record.meeting.preps[0].talkingPoints.opaque,true);assert.deepEqual(saved.record.metadata,out.record.metadata);
});
test('independent outreach: all exact record scalar keys are required',()=>{
 for(const key of Object.keys(record())){const p=exact();delete p.record[key];assert.throws(()=>exactCheck(p),key);}
});
test('independent outreach: exact output binds ID with UUID case equivalence',()=>{
 exactCheck(exact(),{outreachId:recordId.toUpperCase()});const p=exact();p.record.id=otherId;assert.throws(()=>exactCheck(p));
 assert.throws(()=>exactCheck(exact(),{outreachId:'a source name cannot select UUID'}));assert.throws(()=>check(exact()));assert.throws(()=>exactCheck(list()));
});
test('independent outreach: exact source excludes deleted and reserved internal records',()=>{
 for(const change of [{deletedAt:at},{type:'outreach_v3'}]){const p=exact();Object.assign(p.record,change);assert.throws(()=>exactCheck(p));}
});
test('independent outreach: body normalization and UTF16 boundary preserve missing/truncated evidence',()=>{
 for(const body of ['', 'x'.repeat(2000),'x'.repeat(1997)+'...','x'.repeat(1996)+'\ud83d...']){const p=exact();p.record.body=body;exactCheck(p);}
 for(const body of [null,'  text','text  here','line\nbreak','x'.repeat(2001)]){const p=exact();p.record.body=body;assert.throws(()=>exactCheck(p));}
});
test('independent outreach: nullable record relations remain explicit',()=>{
 const p=exact();Object.assign(p.record,{clientId:null,client:null,meetingId:null,meeting:null});exactCheck(p);
 for(const key of ['id','tenantId','createdAt','updatedAt']){const p=exact();p.record[key]=null;assert.throws(()=>exactCheck(p));}
});
test('independent outreach: visible relation IDs cannot be substituted',()=>{
 for(const path of ['client','meeting','createdBy']){const p=exact();p.record[path].id=otherId;assert.throws(()=>exactCheck(p),path);}
 const p=exact();p.record.meeting.client.id=otherId;assert.throws(()=>exactCheck(p));
});
test('independent outreach: meeting can have different client than outreach itself',()=>{
 const p=exact();p.record.meeting.clientId=otherId;p.record.meeting.client.id=otherId;exactCheck(p);
});
test('independent outreach: meeting includes complete selected scalars and uncapped attendee array',()=>{
 for(const key of Object.keys(meeting())){const p=exact();delete p.record.meeting[key];assert.throws(()=>exactCheck(p),key);}
 const p=exact();p.record.meeting.attendees=Array.from({length:60},(_,i)=>({id:uuid(i+100),email:null,name:null,role:null}));exactCheck(p);
 p.record.meeting.attendees[0].metadata={};assert.throws(()=>exactCheck(p));
});
test('independent outreach: latest prep and debrief each at most one',()=>{
 const p=exact();p.record.meeting.preps=[];p.record.meeting.debriefs=[];exactCheck(p);
 for(const key of ['preps','debriefs']){const p=exact();p.record.meeting[key].push({...p.record.meeting[key][0],id:otherId});assert.throws(()=>exactCheck(p));}
});
test('independent outreach: all prep scalars and status alternatives survive',()=>{
 for(const key of Object.keys(prep())){const p=exact();delete p.record.meeting.preps[0][key];assert.throws(()=>exactCheck(p),key);}
 for(const status of ['generated','edited','reviewed','approved','stale','failed']){const p=exact();p.record.meeting.preps[0].status=status;exactCheck(p);}
 const p=exact();p.record.meeting.preps[0].status='published';assert.throws(()=>exactCheck(p));
});
test('independent outreach: debrief metadata excludes encrypted or decrypted content',()=>{
 for(const key of Object.keys(debrief())){const p=exact();delete p.record.meeting.debriefs[0][key];assert.throws(()=>exactCheck(p),key);}
 for(const key of ['body','bodyCiphertext','iv','authTag']){const p=exact();p.record.meeting.debriefs[0][key]='unreturned';assert.throws(()=>exactCheck(p));}
 for(const status of ['generated','edited','approved']){const p=exact();p.record.meeting.debriefs[0].status=status;exactCheck(p);}
});
test('independent outreach: opaque JSON types are retained without inferred counts or authority',()=>{
 const p=exact();p.record.recipients={not:'a counted recipient list'};p.record.recipientCount=7;p.record.stats=false;p.record.metadata=null;p.record.client.intakeData='opaque';p.record.meeting.metadata=[1,null];exactCheck(p);
});
test('independent outreach: opaque JSON hostile data is refused inertly',()=>{
 let effects=0;const p=exact();Object.defineProperty(p.record.metadata,'bad',{enumerable:true,get(){effects++;return true;}});assert.throws(()=>exactCheck(p));assert.equal(effects,0);
 const q=exact();q.record.metadata.loop=q.record.metadata;assert.throws(()=>exactCheck(q));
 const r=exact();r.record.meeting.preps[0].generatedFrom=Infinity;assert.throws(()=>exactCheck(r));
});
test('independent outreach: JSON date admission and generatedAt are not chronology authority',()=>{
 const p=exact();p.generatedAt='2000-01-01T00:00:00.000Z';exactCheck(p);
 for(const stamp of ['invalid','2026-10-12T12:00:00Z','2026-02-30T12:00:00.000Z','+010000-01-01T00:00:00.000Z']){const p=exact();p.record.createdAt=stamp;assert.throws(()=>exactCheck(p));}
 const q=list();q.generatedAt='invalid';assert.throws(()=>check(q));
});
test('independent outreach: source visible identities refuse malformed UUID but accept nonv4',()=>{
 exactCheck();const p=exact();p.record.id='not uuid';assert.throws(()=>exactCheck(p));
 const q=exact();q.record.meeting.preps[0].id='not uuid';assert.throws(()=>exactCheck(q));
});
test('independent outreach: closed envelopes do not claim send/auth/publication authority',()=>{
 for(const key of ['authorized','complete','sourceConnected','sent','canEdit']){const p=exact();p[key]=true;assert.throws(()=>exactCheck(p));}
 const p=list();p.note='no campaigns exist';assert.throws(()=>check(p));
});
