import test from 'node:test';import assert from 'node:assert/strict';
import {admitInputBatch,createInputLimiter,INPUT_LIMITS,REFUSED_INPUT_TYPES} from '../input.mjs';
import {takeoverActivationOpen,TAKEOVER_ACTIVATION,TAKEOVER_REQUIREMENTS} from '../activation.mjs';
import {BROWSER_ACTIVATION,EGRESS_REQUIREMENTS} from '../../activation.mjs';
const code=c=>e=>e.code===c;
const clock=()=>{let t=0;const now=()=>t;now.advance=ms=>{t+=ms;};return now;};
const viewport={width:1280,height:800};
const admit=(events,limiter=createInputLimiter({now:clock()}))=>admitInputBatch({leaseEpoch:2,events},{viewport,limiter});

test('takeover activation is held, and cannot open while the browser gate is held',()=>{
 assert.equal(TAKEOVER_ACTIVATION.state,'held');assert.equal(takeoverActivationOpen(),false);
 const open={state:'open',evidence:'evidence/takeover-d005.json',requirements:TAKEOVER_REQUIREMENTS};
 assert.equal(takeoverActivationOpen(open),false,'browser gate still held');
 const browser={state:'open',evidence:'evidence/d005.json',requirements:EGRESS_REQUIREMENTS};
 assert.equal(takeoverActivationOpen(open,browser),true,'only both open records with evidence open it');
 assert.equal(takeoverActivationOpen({...open,evidence:null},browser),false);
 assert.equal(takeoverActivationOpen({...open,requirements:[...TAKEOVER_REQUIREMENTS]},browser),false,'a copied requirement list is not the reviewed one');
 assert.equal(BROWSER_ACTIVATION.state,'held');
 assert.ok(TAKEOVER_REQUIREMENTS.some(r=>r.startsWith('placement:')&&r.includes('awaiting Neo')));
});

test('mouse, wheel, key and text events inside the viewport are admitted and normalized',()=>{
 const r=admit([{type:'mouse',action:'move',x:10,y:10},{type:'mouse',action:'down',x:10,y:10,button:'left'},{type:'wheel',x:5,y:5,deltaX:0,deltaY:-120},{type:'key',action:'down',key:'Enter'},{type:'key',action:'down',key:'é',shift:true},{type:'text',text:'hello world'}]);
 assert.equal(r.events.length,6);assert.equal(r.events[3].shift,false);assert.ok(Object.isFrozen(r.events[0]));
});

test('Q-T6 exclusions: clipboard, drag/drop, file and audio input are refused as a kind',()=>{
 for(const type of REFUSED_INPUT_TYPES)assert.throws(()=>admit([{type,text:'x'}]),code('TAKEOVER_INPUT_KIND_REFUSED'));
 assert.throws(()=>admit([{type:'gamepad'}]),code('TAKEOVER_INPUT_KIND_REFUSED'));
});

test('coordinates outside the viewport, chords, control characters and oversized text are refused; a refused batch injects nothing',()=>{
 const bad=[[{type:'mouse',action:'down',x:1280,y:1,button:'left'}],[{type:'mouse',action:'down',x:-1,y:1,button:'left'}],[{type:'mouse',action:'move',x:1,y:1,button:'left'}],
  [{type:'wheel',x:1,y:1,deltaX:0,deltaY:INPUT_LIMITS.maxWheelDelta+1}],[{type:'key',action:'down',key:'a',ctrl:true}],[{type:'text',text:'a\u0007b'}],
  [{type:'text',text:'x'.repeat(INPUT_LIMITS.maxText+1)}],[{type:'text',text:''}]];
 for(const events of bad)assert.throws(()=>admit(events),code('TAKEOVER_INPUT_INVALID'));
 assert.throws(()=>admit([{type:'key',action:'down',key:'F12'}]),code('TAKEOVER_INPUT_KEY_REFUSED'));
 assert.throws(()=>admit([{type:'key',action:'down',key:'Control'}]),code('TAKEOVER_INPUT_KEY_REFUSED'));
 assert.throws(()=>admitInputBatch({leaseEpoch:0,events:[{type:'text',text:'a'}]},{viewport,limiter:createInputLimiter({now:clock()})}),code('TAKEOVER_INPUT_INVALID'));
 assert.throws(()=>admitInputBatch({leaseEpoch:1,events:Array(INPUT_LIMITS.maxEvents+1).fill({type:'text',text:'a'})},{viewport,limiter:createInputLimiter({now:clock()})}),code('TAKEOVER_INPUT_INVALID'));
});

test('the per-lease rate limit refuses bursts beyond the bucket and refills over time',()=>{
 const now=clock(),limiter=createInputLimiter({now,eventsPerSecond:10,burst:20}),ev={type:'mouse',action:'move',x:1,y:1};
 admit(Array(20).fill(ev),limiter);
 assert.throws(()=>admit([ev],limiter),code('TAKEOVER_INPUT_RATE_LIMITED'));
 now.advance(1000);admit(Array(10).fill(ev),limiter);
 assert.throws(()=>createInputLimiter({now,eventsPerSecond:0}),code('TAKEOVER_INPUT_CONFIGURATION'));
});
