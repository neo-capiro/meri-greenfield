import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;
if(!root)throw new Error('Exact independent source root required');
const {resolveWindow,WindowResolutionError}=await import(pathToFileURL(root+'/packages/window-resolution/index.mjs'));
const context={referenceAt:'2026-10-13T12:00:00Z'};
function window(basis,timezone,offset=0,weekStartsOn='monday'){
 return {basis,timezone,offset,...(basis==='calendar-week'?{weekStartsOn}:{})};
}
function expected(request,startInclusive,endExclusive){
 return {basis:request.basis,timezone:request.timezone,startInclusive,endExclusive,weekStartsOn:request.basis==='calendar-week'?request.weekStartsOn:null};
}
for(const [name,request,referenceAt,start,end,hours] of [
 ['Kathmandu45minute offset',window('calendar-year','Asia/Kathmandu'),'2026-01-01T00:00:00Z','2025-12-31T18:15:00Z','2026-12-31T18:15:00Z',8760],
 ['Berlin Sunday DST fall',window('calendar-week','Europe/Berlin',0,'sunday'),'2026-10-25T12:00:00Z','2026-10-24T22:00:00Z','2026-10-31T23:00:00Z',169],
 ['Lord Howe half hour fall',window('calendar-week','Australia/Lord_Howe'),'2026-04-05T12:00:00Z','2026-03-29T13:00:00Z','2026-04-05T13:30:00Z',168.5],
 ['New York March month',window('calendar-month','America/New_York'),'2026-03-31T23:00:00Z','2026-03-01T05:00:00Z','2026-04-01T04:00:00Z',743],
 ['Samoa December skipped day',window('calendar-month','Pacific/Apia'),'2011-12-29T12:00:00Z','2011-12-01T10:00:00Z','2011-12-31T10:00:00Z',720],
 ['UTC Sunday prior year boundary',window('calendar-week','Etc/UTC',0,'sunday'),'2026-01-01T12:00:00Z','2025-12-28T00:00:00Z','2026-01-04T00:00:00Z',168],
 ['Local previous leap-year start',window('calendar-year','Pacific/Kiritimati',-1),'2025-01-01T00:00:00Z','2023-12-31T10:00:00Z','2024-12-31T10:00:00Z',8784],
])test(name,()=>{
 const actual=resolveWindow(request,{referenceAt});
 assert.deepEqual(actual,expected(request,start,end));
 assert.equal((Date.parse(actual.endExclusive)-Date.parse(actual.startInclusive))/3600000,hours);
 console.log(JSON.stringify({case:name,request,referenceAt,actual,elapsedHours:hours}));
});
test('Reference local boundary nanoseconds select current week',()=>{
 const request=window('calendar-week','America/New_York');
 assert.equal(resolveWindow(request,{referenceAt:'2026-10-12T03:59:59.999999999Z'}).startInclusive,'2026-10-05T04:00:00Z');
 assert.equal(resolveWindow(request,{referenceAt:'2026-10-12T04:00:00.000000001Z'}).startInclusive,'2026-10-12T04:00:00Z');
});
test('Relative duration preserves nanoseconds and maximum3660 elapsed days',()=>{
 const request={basis:'relative-duration',days:3660,anchorAt:'2026-10-13T12:34:56.123456789Z',timezone:'America/New_York'};
 const actual=resolveWindow(request,context);
 assert.equal(actual.startInclusive,'2016-10-05T12:34:56.123456789Z');
 assert.equal(actual.endExclusive,request.anchorAt);
 assert.equal(Date.parse(actual.endExclusive)-Date.parse(actual.startInclusive),3660*86400000);
 console.log(JSON.stringify({case:'maximum relative duration',actual}));
});
test('Explicit nanosecond representation remains byte exact',()=>{
 const request={basis:'explicit',startInclusive:'2026-01-01T00:00:00.123456789Z',endExclusive:'2026-01-01T00:00:01.123456789Z',timezone:'Asia/Kathmandu'};
 assert.deepEqual(resolveWindow(request,context),{...request,weekStartsOn:null});
});
test('Canonical millisecond resolution refuses submillisecond-only intervals',()=>{
 assert.throws(()=>resolveWindow({basis:'explicit',startInclusive:'2026-01-01T00:00:00.123456781Z',endExclusive:'2026-01-01T00:00:00.123456789Z',timezone:'Etc/UTC'},context),/increase/);
});
const fiscal={basis:'fiscal-year',calendarId:'florida-state',year:2027,stage:'appropriated',revisionId:'enrolled-exact-v2',timezone:'America/New_York',startInclusive:'2026-07-01T04:00:00Z',endExclusive:'2027-07-01T04:00:00Z'};
const request=Object.fromEntries(Object.entries(fiscal).filter(([k])=>!['startInclusive','endExclusive'].includes(k)));
test('Fiscal selection never synthesizes federal October rollover',()=>{
 const actual=resolveWindow(request,{...context,fiscalCalendars:[fiscal]});
 assert.deepEqual(actual,fiscal);assert.notStrictEqual(actual,fiscal);assert.ok(Object.isFrozen(actual));
 fiscal.startInclusive='2026-07-02T04:00:00Z';assert.equal(actual.startInclusive,'2026-07-01T04:00:00Z');fiscal.startInclusive=actual.startInclusive;
 console.log(JSON.stringify({case:'exact nonfederal fiscal',actual}));
});
test('Fiscal source identity is exact, including case of revision',()=>{
 assert.throws(()=>resolveWindow({...request,revisionId:'ENROLLED-EXACT-V2'},{...context,fiscalCalendars:[fiscal]}),e=>e.code==='fiscal_window_unavailable');
});
test('Fiscal ambiguous bounds cannot be resolved by array order',()=>{
 const changed={...fiscal,startInclusive:'2026-07-03T04:00:00Z'};
 for(const fiscalCalendars of [[fiscal,changed],[changed,fiscal]])assert.throws(()=>resolveWindow(request,{...context,fiscalCalendars}),e=>e.code==='fiscal_window_conflict');
});
test('Malformed unrelated fiscal source is refused rather than ignored',()=>{
 assert.throws(()=>resolveWindow(request,{...context,fiscalCalendars:[fiscal,{...fiscal,revisionId:'other',endExclusive:'2026-02-30T00:00:00Z'}]}));
});
test('Calendar resolution uses explicit reference even when ambient clock fails',()=>{
 const old=Date.now;Date.now=()=>{throw new Error('ambient clock called');};
 try{assert.equal(resolveWindow(window('calendar-week','Etc/UTC'),context).startInclusive,'2026-10-12T00:00:00Z');}finally{Date.now=old;}
});
test('Repeated or skipped midnight is a typed refusal',()=>{
 for(const [timezone,basis,referenceAt] of [['America/Havana','calendar-month','2020-11-15T12:00:00Z'],['America/Sao_Paulo','calendar-week','2018-11-05T12:00:00Z']])
 assert.throws(()=>resolveWindow(window(basis,timezone,0,'sunday'),{referenceAt}),e=>e instanceof WindowResolutionError&&e.code==='unrepresentable_calendar_boundary');
});
test('Imports start no timers, network, filesystem writes or globalTemporal mutation',()=>{
 const code=`import fs from 'node:fs';import net from 'node:net';import http from 'node:http';import https from 'node:https';import {syncBuiltinESMExports} from 'node:module';
 void process.stdout;void process.stderr;const before=process.getActiveResourcesInfo();const refused=()=>{throw Error('forbidden import effect');};
 globalThis.setTimeout=refused;globalThis.setInterval=refused;globalThis.fetch=refused;fs.writeFileSync=refused;fs.mkdirSync=refused;net.connect=refused;net.createConnection=refused;http.request=refused;https.request=refused;syncBuiltinESMExports();
 await import('./packages/window-resolution/index.mjs');await new Promise(resolve=>setImmediate(resolve));
 if('Temporal'in globalThis)throw Error('global Temporal mutation');if(JSON.stringify(before)!==JSON.stringify(process.getActiveResourcesInfo()))throw Error('new active resource');`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:root,encoding:'utf8',timeout:10000});
 assert.equal(child.status,0,child.stderr);assert.equal(child.stdout,'');assert.equal(child.signal,null);
});
