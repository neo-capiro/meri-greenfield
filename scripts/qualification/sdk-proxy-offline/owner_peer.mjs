#!/usr/bin/env node
/** Inherited-pipe transport for the actual JS owner wire/channel and canonical
 * accounting. TLS peer facts and the persisted-facts resolver are explicitly
 * synthetic; the database is the existing scripted SQL boundary. */
import {createInterface} from 'node:readline';
import {createProductOwnerChannel,createProductOwnerServiceGate,OWNER_PATHS} from '../../../apps/proxy/product/owner-channel.mjs';
import {parseOwnerWire} from '../../../apps/proxy/product/owner-wire-codec.mjs';
import {createModelLedgerFixture} from './model_ledger_fixture.mjs';

const fixture=await createModelLedgerFixture(),sessions=new Map(),serviceGate=createProductOwnerServiceGate();
const mode=process.argv[2]??'complete';let reserveFault=false,settleFault=false;
const clientPolicy={clientCertSha256:'3'.repeat(64),clientSubject:'proxy-subject',
 deploymentRevision:'offline-proxy-revision',issuerSha256:'2'.repeat(64),
 selectedClientId:fixture.config.selectedClientId,ownerTaskArn:'owner-task',proxyTaskArn:'proxy-task'};
const peerBase={clientCertSha256:clientPolicy.clientCertSha256,clientSubject:clientPolicy.clientSubject,
 deploymentRevision:clientPolicy.deploymentRevision,issuerSha256:clientPolicy.issuerSha256,
 proxyTaskArn:clientPolicy.proxyTaskArn,tlsVersion:'TLSv1.3'};
const peers={operation:{...peerBase,connectionId:'operation-A'},capture:{...peerBase,connectionId:'capture-A'}};
// Trusted qualification fact source only. Genuine persisted-facts SQL/Core
// custody is an explicit separate gate, not supplied by an operation claim.
const persistedFacts={available:true,async resolve({capabilitySha256,deadlineMs,signal}){
 if(signal?.aborted||capabilitySha256!==fixture.selected.capabilitySha256||
    deadlineMs>Date.now()+3000||fixture.ownerFacts.expiresAtMs<=Date.now())throw Error('OFFLINE_FACTS_UNAVAILABLE');
 return structuredClone(fixture.ownerFacts);
}};
const ownerPorts=Object.fromEntries(['pool','pricing','limits','checkCurrentConversation'].map(key=>[key,fixture.config[key]]));
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
function encode(value){if(Buffer.isBuffer(value))return {$bytes:value.toString('base64')};
 if(Array.isArray(value))return value.map(encode);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]));return value;}
function decode(value){if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).join()==='$bytes')return Buffer.from(value.$bytes,'base64');
 if(Array.isArray(value))return value.map(decode);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v)]));return value;}
async function dispatch(message){
 if(message.method==='init')return {binding:fixture.selected.binding,
  qualificationBinding:fixture.selected.qualificationBinding,grantId:fixture.selected.grantId,
  clientId:fixture.config.selectedClientId,pricing:fixture.config.pricing,
  capabilitySha256:fixture.selected.capabilitySha256,expiresAtMs:fixture.ownerFacts.expiresAtMs};
 if(message.method==='snapshot')return {...fixture.snapshot(),ownerServiceGateAvailable:serviceGate.available,
  ownerChannelCount:sessions.size};
 if(message.method!=='wire')throw Error('OFFLINE_OPERATION_REFUSED');
 fixture.syncClock();
 const body=decode(message.body),frame=parseOwnerWire(body),peer=peers[message.channel];
 if(!peer)throw Error('OFFLINE_CARRIER_REFUSED');
 if(message.path===OWNER_PATHS.open&&message.channel==='operation'){
  const channel=createProductOwnerChannel({clientPolicy,persistedFacts,ownerPorts,serviceGate,now:Date.now,maxExchangeMs:3000});
  const reply=await channel.open(body,peer),session=parseOwnerWire(reply)[1];
  sessions.set(session,channel);return reply;
 }
 const channel=sessions.get(frame[1]);
 if(!channel)throw Error('OFFLINE_SESSION_REFUSED');
 if(message.path===OWNER_PATHS.poll&&message.channel==='capture')return channel.poll(body,peer);
 if(message.path===OWNER_PATHS.reply&&message.channel==='capture')return channel.reply(body,peer);
 if(message.path!==OWNER_PATHS.operation||message.channel!=='operation')throw Error('OFFLINE_CARRIER_REFUSED');
 const kind=frame[2]?.[0];
 if(kind==='meri.proxy.reservation/1'&&mode==='reservation-ack-lost'&&!reserveFault){
  reserveFault=true;fixture.seed.faults.commit=true;
 }
 if(kind==='meri.proxy.settlement/1'&&mode.startsWith('settlement-ack-')&&!settleFault){
  settleFault=true;fixture.seed.faults.commit=true;
 }
 if(kind==='meri.proxy.outcome/1'&&mode==='settlement-ack-unresolved'){
  fixture.seed.faults.query=sql=>{if(sql.startsWith('SELECT * FROM meri_product_budget.requests '))throw Error('OFFLINE_READBACK_UNAVAILABLE');};
 }
 return channel.operation(body,peer);
}
const deadline=setTimeout(()=>process.exit(75),120000);
const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
lines.on('line',line=>{
 if(line.length>16*1024*1024){process.exitCode=2;lines.close();return;}
 let m;try{m=JSON.parse(line);}catch{process.exitCode=2;lines.close();return;}
 void dispatch(m).then(value=>send({type:'result',id:m.id,ok:true,value:encode(value)}),error=>
  send({type:'result',id:m.id,ok:false,code:/^[A-Z][A-Z0-9_]{1,80}$/u.test(error?.message)?error.message:'OFFLINE_OWNER_REFUSED'}));
});
lines.once('close',()=>clearTimeout(deadline));
