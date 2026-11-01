import test from 'node:test';
import assert from 'node:assert/strict';
import {createSdkReadAhead} from '../sdk-read-ahead.mjs';

/** An SDK stand-in: each read answers the next scripted step (a value, the end, or a failure) and is counted. */
function sdk(steps){let at=0,reads=0;return {get reads(){return reads;},read:async()=>{reads++;const step=steps[at++];if(step instanceof Error)throw step;return step===undefined?{done:true,value:undefined}:{done:false,value:step};}};}
const settle=()=>new Promise(resolve=>setTimeout(resolve,10));

test('nothing is read ahead outside during(); inside it the messages already produced are read in order',async()=>{
 const s=sdk(['a','b','c']),ahead=createSdkReadAhead(s.read);
 await settle();assert.equal(s.reads,0);assert.equal(ahead.peek(),undefined);
 await ahead.during(settle);
 assert.equal(ahead.peek(),'a');assert.equal(ahead.take(),'a');assert.equal(ahead.take(),'b');assert.equal(ahead.take(),'c');
 const reads=s.reads;await settle();assert.equal(s.reads,reads,'no read after during() settled');
 assert.deepEqual(await ahead.next(),{done:true,value:undefined});
});

test('a failed read keeps its place: earlier messages first, then the failure, and nothing is read after it',async()=>{
 const failure=Error('SDK_STREAM_FAILED'),s=sdk(['a',failure,'never']),ahead=createSdkReadAhead(s.read);
 await ahead.during(settle);
 assert.equal(ahead.peek(),'a');assert.deepEqual(await ahead.next(),{done:false,value:'a'});
 assert.equal(ahead.peek(),undefined,'a failure is never peeked as a message');await assert.rejects(ahead.next(),failure);
 assert.equal(s.reads,2);
});

test('reading ahead stops at the end and at the limit, and next() reads directly when nothing is queued',async()=>{
 const ended=sdk(['a']),done=createSdkReadAhead(ended.read);await done.during(settle);
 assert.equal(ended.reads,2,'one message, then the end');assert.equal(done.take(),'a');assert.equal(done.peek(),undefined);
 const many=sdk(Array.from({length:50},(_,i)=>i)),bounded=createSdkReadAhead(many.read,{limit:3});await bounded.during(settle);
 assert.equal(many.reads,3,'at most limit reads ahead');assert.equal(bounded.take(),0);
 assert.deepEqual(await bounded.next(),{done:false,value:1});assert.deepEqual(await bounded.next(),{done:false,value:2});assert.deepEqual(await bounded.next(),{done:false,value:3});
 assert.equal(many.reads,4,'the fourth came from a direct read');
 for(const options of [{limit:0},{last:true},{check:'always'}])assert.throws(()=>createSdkReadAhead(many.read,options),/READ_AHEAD_CONFIGURATION/);
 assert.throws(()=>createSdkReadAhead(null),/READ_AHEAD_CONFIGURATION/);
});

test('nothing is read ahead past a message last() accepts; the next one is then a direct read',async()=>{
 const s=sdk(['a','turn-end','b']),ahead=createSdkReadAhead(s.read,{last:value=>value==='turn-end'});
 await ahead.during(settle);assert.equal(s.reads,2,'up to the last message and no further');
 assert.equal(ahead.take(),'a');assert.deepEqual(await ahead.next(),{done:false,value:'turn-end'});
 await ahead.during(settle);assert.equal(s.reads,2,'reading ahead stays stopped');
 assert.deepEqual(await ahead.next(),{done:false,value:'b'});assert.equal(s.reads,3);
});

test('a message read ahead is consumed only while check() passes; a refused one keeps its place',async()=>{
 let open=true;const refused=Error('DEADLINE'),s=sdk(['a','b']),ahead=createSdkReadAhead(s.read,{check:()=>{if(!open)throw refused;}});
 await ahead.during(settle);open=false;
 assert.equal(ahead.peek(),'a','peeking consumes nothing');assert.throws(()=>ahead.take(),refused);await assert.rejects(ahead.next(),refused);
 open=true;assert.equal(ahead.take(),'a');assert.deepEqual(await ahead.next(),{done:false,value:'b'});
});

test('next() waits for a read still in flight when during() ends instead of starting a second one',async()=>{
 let release,reads=0;const read=()=>{reads++;return reads===1?new Promise(resolve=>{release=()=>resolve({done:false,value:'slow'});}):Promise.resolve({done:true,value:undefined});};
 const ahead=createSdkReadAhead(read);await ahead.during(()=>Promise.resolve());
 const pending=ahead.next();await settle();assert.equal(reads,1);release();
 assert.deepEqual(await pending,{done:false,value:'slow'});assert.equal(reads,1);
});

test('queued(), settled() and arrival() describe what has landed: arrival resolves when a read lands, at once when nothing more can',async()=>{
 let release;const read=()=>new Promise(resolve=>{release=()=>resolve({done:false,value:'a'});});
 const ahead=createSdkReadAhead(read,{last:value=>value==='a'});
 assert.equal(ahead.queued(),0);assert.equal(ahead.settled(),false);
 let arrived=false;const waiting=ahead.arrival().then(()=>{arrived=true;});
 await ahead.during(async()=>{await settle();assert.equal(arrived,false,'nothing has landed yet');release();await waiting;});
 assert.equal(arrived,true);assert.equal(ahead.queued(),1);assert.equal(ahead.settled(),true,'the last message landed and no read is in flight');
 await ahead.arrival();// at once: a result is queued
 assert.equal(ahead.take(),'a');assert.equal(ahead.queued(),0);
 await ahead.arrival();// at once: nothing more can land
 const ended=createSdkReadAhead(sdk([]).read);await ended.during(settle);assert.equal(ended.queued(),1,'the end is queued');assert.equal(ended.peek(),undefined);assert.equal(ended.settled(),true);
});
