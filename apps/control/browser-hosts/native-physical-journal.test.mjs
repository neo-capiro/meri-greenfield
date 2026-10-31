import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyPhysicalJournal,reservePhysicalEvent,completePhysicalEvent,physicalBytes,physicalTriplet,
 requireCausalAbsence,beginOrdinaryPhysical,readPhysicalSlots,PHYSICAL_COLUMNS} from './native-physical-journal.mjs';
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const context={phase:'managed',accountId:'111122223333',provisionToken:'a'.repeat(64),startedAtMs:1000,
 deadlineMs:26000,leaseDeadlineMs:1000,cleanupCeilingMs:26000,authority:{executionArn:'arn:aws:states:us-east-1:111122223333:execution:meri:test'}};
function reserve(j,n,now=1100){return reservePhysicalEvent(j,{phase:'managed',stage:'authentication',sessionId:uuid(n),
 operationId:uuid(n+1000),request:{api:'GetCallerIdentity'}},{context,now,callDeadlineMs:now+1000});}
test('original ordinary/managed windows remain separate and ordinary duplicate never renews',()=>{
 const initial={schema:'meri-native-physical-contexts/2',ordinary:null,managed:{...context,startedAtMs:61000,deadlineMs:86000}};
 const ordinary=beginOrdinaryPhysical(initial,uuid(1),2000);
 assert.equal(ordinary.ordinary.deadlineMs,27000);assert.equal(ordinary.managed.deadlineMs,86000);
 assert.strictEqual(beginOrdinaryPhysical(ordinary,uuid(2),50000),ordinary);
});
test('triplets reject missing columns, changed canonical bytes and wrong digest',()=>{
 const row={};for(const n of Object.keys(PHYSICAL_COLUMNS)){const [json,sha,canonical]=physicalTriplet(n,null);
  Object.assign(row,{[`native_physical_${n}_json`]:json,[`native_physical_${n}_sha256`]:sha,[`native_physical_${n}_canonical`]:canonical});}
 const [json,sha,canonical]=physicalTriplet('observations',emptyPhysicalJournal());
 Object.assign(row,{native_physical_observations_json:json,native_physical_observations_sha256:sha,native_physical_observations_canonical:canonical});
 assert.deepEqual(readPhysicalSlots(row).observations,json);
 assert.throws(()=>readPhysicalSlots({...row,native_physical_observations_canonical:canonical+' '}));
 assert.throws(()=>readPhysicalSlots({...row,native_physical_observations_sha256:'0'.repeat(64)}));
 const missing={...row};delete missing.native_physical_context_json;assert.throws(()=>readPhysicalSlots(missing));
});
test('four pending reads exhaust shared client capacity; replay does not create another permit',()=>{
 let j=emptyPhysicalJournal();for(let n=1;n<=4;n++)j=reserve(j,n).journal;
 assert.throws(()=>reserve(j,5));const replay=reserve(j,1);assert.equal(replay.created,false);assert.equal(replay.journal.entries.length,4);
 const completion={completedAtMs:1200,outcome:'success',requestId:'request-12345678',httpStatusCode:200,errorCode:null,
  facts:{accountId:context.accountId,arn:'arn:aws:sts::111122223333:assumed-role/control/session',userId:'role:session'}};
 j=completePhysicalEvent(j,uuid(1001),completion,{now:1200,validateFacts:()=>{}});
 assert.equal(reserve(j,5,1300).created,true);
 assert.deepEqual(completePhysicalEvent(j,uuid(1001),completion,{now:1400,validateFacts:()=>{}}),j);
 assert.throws(()=>completePhysicalEvent(j,uuid(1001),{...completion,requestId:'changed-12345678'},{now:1400,validateFacts:()=>{}}));
});
test('all pending completion capacity is reserved, so filling allowed replies cannot exceed the byte ceiling',()=>{
 // Retained complete discovery pages near the byte ceiling, followed by live pending replies.
 let j=emptyPhysicalJournal(),n=1;
 const matches=Array.from({length:16},(_,i)=>({instanceId:`i-${String(i+1).padStart(17,'0')}`,ownerAccountId:context.accountId,
  allocationSha256:'b'.repeat(64),provisionToken:'a'.repeat(64),placementSha256:'c'.repeat(64),
  rootVolumeId:'vol-0123456789abcdef0',networkInterfaceIds:['eni-0123456789abcdef0']}));
 while(physicalBytes(j)<490000){
  const pageIndex=(n-1)%20,scanId=uuid(5000+Math.floor((n-1)/20));
  j.entries.push({sequence:n,operationId:uuid(n+1000),phase:'managed',stage:'discovery',sessionId:uuid(1),
   request:{api:'DescribeInstances',kind:'discovery',provisionToken:context.provisionToken,nextToken:pageIndex===0?null:'page-token',
    maxResults:100,scanId,pageIndex},startedAtMs:1100,callDeadlineMs:2100,
   completion:{completedAtMs:1200,outcome:'success',requestId:'request-12345678',httpStatusCode:200,errorCode:null,
    facts:{scanId,pageIndex,nextToken:pageIndex===19?null:'page-token',matches,conflicts:[],observedCount:16,overflow:false,complete:pageIndex===19}}});n++;
 }
 let accepted=0;
 for(let k=0;k<4;k++){try{j=reserve(j,n++).journal;accepted++;}catch{break;}}
 assert.ok(accepted>0&&accepted<4,'pending capacity, not the four-client limit, refuses the next reservation');
 assert.throws(()=>reserve(j,n+1));
 const pending=j.entries.filter(e=>e.completion===null);
 assert.ok(physicalBytes(j)+pending.length*(8192-4)+4096<=524288);
 assert.ok(physicalBytes(j)+8192-4+4096<524288,'checking only the NEW reservation would incorrectly pass');
});
test('abandoned completion cannot be replaced, and closing intake prevents new reservations',()=>{
 let j=reserve(emptyPhysicalJournal(),1).journal;
 const c={completedAtMs:2100,outcome:'abandoned',requestId:null,httpStatusCode:null,errorCode:null,facts:null};
 assert.throws(()=>completePhysicalEvent(j,uuid(1001),c,{now:2000}));
 j=completePhysicalEvent(j,uuid(1001),c,{now:2100});
 assert.throws(()=>completePhysicalEvent(j,uuid(1001),{...c,outcome:'transport-unknown'},{now:2200}));
 assert.throws(()=>reserve({...j,closedForFullTeardown:{receiptSha256:'a'.repeat(64),closedAtMs:2200}},2,2300));
});
test('four uncertain client sends retain capacity through the original phase deadline',()=>{
 let j=emptyPhysicalJournal();for(let n=1;n<=4;n++)j=reserve(j,n).journal;
 for(let n=1;n<=4;n++)j=completePhysicalEvent(j,uuid(n+1000),{completedAtMs:2100,
  outcome:n%2?'abandoned':'transport-unknown',requestId:null,httpStatusCode:null,errorCode:null,facts:null},{now:2100});
 assert.throws(()=>reserve(j,5,2200));
 const ordinary={...context,phase:'ordinary',deadlineMs:52000};
 const r=reservePhysicalEvent(j,{phase:'ordinary',stage:'authentication',sessionId:uuid(5),operationId:uuid(1005),
  request:{api:'GetCallerIdentity'}},{context:ordinary,now:27000,callDeadlineMs:28000,phaseDeadlines:{managed:26000}});
 assert.equal(r.created,true);
});

test('orphan pending calls release client capacity only at their original phase deadline without mutating recovery evidence',()=>{
 let journal=emptyPhysicalJournal();for(let n=1;n<=4;n++)journal=reserve(journal,n).journal;
 const ordinary={...context,phase:'ordinary',deadlineMs:52000},args={phase:'ordinary',stage:'authentication',sessionId:uuid(5),
  operationId:uuid(1005),request:{api:'GetCallerIdentity'}};
 assert.throws(()=>reservePhysicalEvent(journal,args,{context:ordinary,now:25999,callDeadlineMs:28000,phaseDeadlines:{managed:26000}}));
 const r=reservePhysicalEvent(journal,args,{context:ordinary,now:26000,callDeadlineMs:28000,phaseDeadlines:{managed:26000}});
 assert.equal(r.created,true);assert.equal(journal.entries.filter(e=>e.completion===null).length,4);
});
test('an absence started before terminal completion cannot count even when its reply arrives later',()=>{
 const terminal={operationId:uuid(1),completion:{outcome:'success',completedAtMs:2000,facts:{state:'terminated'}}};
 const a={operationId:uuid(2),stage:'absence',startedAtMs:1900,callDeadlineMs:26000,completion:{completedAtMs:2100}};
 const b={operationId:uuid(3),stage:'absence',startedAtMs:2200,callDeadlineMs:26000,completion:{completedAtMs:2300}};
 const check=entries=>requireCausalAbsence({entries},{terminalId:uuid(1),eventIds:[uuid(2),uuid(3)],deadlineMs:26000});
 assert.throws(()=>check([terminal,a,b]));assert.equal(check([terminal,{...a,startedAtMs:2001},b]),true);
 assert.throws(()=>check([terminal,{...a,startedAtMs:2001},{...b,startedAtMs:2050}]));
});
