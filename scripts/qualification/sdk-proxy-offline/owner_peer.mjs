#!/usr/bin/env node
/** Bounded, private subprocess accounting fixture. IPC is explicitly not the
 * product owner's HTTPS transport. Canonical JS owners execute real decisions
 * against the existing scripted SQL boundary and independently request captures. */
import {createInterface} from 'node:readline';
import {createProductProxyOwnerComposition} from '../../../apps/proxy/product/product-owner-composition.mjs';
import {BudgetCommitUncertain} from '../../../apps/gateway/budget/postgres-budget-store.mjs';
import {createModelLedgerFixture} from './model_ledger_fixture.mjs';

const fixture=await createModelLedgerFixture(),owners=new Map(),pending=new Map();
const mode=process.argv[2]??'complete';let sequence=0,reserveFault=false,settleFault=false;
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
function encode(value){if(Buffer.isBuffer(value))return {$bytes:value.toString('base64')};
 if(Array.isArray(value))return value.map(encode);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]));return value;}
function decode(value){if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).join()==='$bytes')return Buffer.from(value.$bytes,'base64');
 if(Array.isArray(value))return value.map(decode);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v)]));return value;}
function capture(kind,request){const id=String(++sequence);return new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{pending.delete(id);reject(Error('OFFLINE_CAPTURE_DEADLINE'));},3000);
 pending.set(id,{resolve,reject,timer});send({type:'capture',id,kind,request:encode(request)});
});}
function owner(requestId){if(!owners.has(requestId))owners.set(requestId,createProductProxyOwnerComposition({
 ...fixture.config,requestId,hostChannel:{requestId,
  captureAuthenticatedCall:request=>capture('request',request),
  captureAuthenticatedComplete:request=>capture('complete',request)}}));return owners.get(requestId);}
async function dispatch(message){
 if(message.method==='init')return {binding:fixture.selected.binding,
  qualificationBinding:fixture.selected.qualificationBinding,grantId:fixture.selected.grantId,
  clientId:fixture.config.selectedClientId,pricing:fixture.config.pricing,
  capabilitySha256:fixture.selected.capabilitySha256};
 if(message.method==='snapshot')return fixture.snapshot();
 fixture.syncClock();
 if(message.method==='reserve'){
  if(mode==='reservation-ack-lost'&&!reserveFault){reserveFault=true;fixture.seed.faults.commit=true;}
  return owner(message.requestId).reserve(decode(message.value),decode(message.claim));
 }
 if(message.method==='settle'){
  if(mode.startsWith('settlement-ack-')&&!settleFault){settleFault=true;fixture.seed.faults.commit=true;}
  return owner(message.requestId).settleComplete(message.requestId,decode(message.claim));
 }
 if(message.method==='outcome'){
  if(mode==='settlement-ack-unresolved')throw Error('OFFLINE_READBACK_UNAVAILABLE');
  return owner(message.requestId).readOutcome(message.requestId);
 }
 throw Error('OFFLINE_OPERATION_REFUSED');
}
const deadline=setTimeout(()=>process.exit(75),120000);
const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
lines.on('line',line=>{
 if(line.length>16*1024*1024){process.exitCode=2;lines.close();return;}
 let m;try{m=JSON.parse(line);}catch{process.exitCode=2;lines.close();return;}
 if(m.type==='capture-result'){
  const item=pending.get(m.id);if(!item)return;
  pending.delete(m.id);clearTimeout(item.timer);
  if(m.ok)item.resolve(decode(m.value));else item.reject(Error('OFFLINE_CAPTURE_REFUSED'));return;
 }
 void dispatch(m).then(value=>send({type:'result',id:m.id,ok:true,value:encode(value)}),error=>
  send({type:'result',id:m.id,ok:false,code:error instanceof BudgetCommitUncertain?'BudgetCommitUncertain':
   /^[A-Z][A-Z0-9_]{1,80}$/u.test(error?.message)?error.message:'OFFLINE_OWNER_REFUSED'}));
});
lines.once('close',()=>{clearTimeout(deadline);for(const item of pending.values()){
 clearTimeout(item.timer);item.reject(Error('OFFLINE_OWNER_CLOSED'));}pending.clear();});
