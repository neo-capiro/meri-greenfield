/** Scripted AWS/SQL plus the real owner TLS/channel/budget path. No network qualification. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {Agent,Server} from 'node:https';
import {createInterface} from 'node:readline';
import {productFixture} from '../../../gateway/budget/product-scripted-fixture.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createP2OwnerFixture} from './p2-owner-fixture.mjs';
import {OWNER_PATHS} from '../owner-channel.mjs';

const output=value=>process.stdout.write(JSON.stringify(value)+'\n');
let recoveryArmed=false,settlementSocket,oldCloseObserved=false,closeListenersBeforeRecovery,native;
const recoveryOrder=[];
// Observe the production body iterator without a second consumer. The old
// carrier stays physically open in Python until this complete OUTCOME arrives.
function observeRecovery(server){native=server;server.prependListener('request',req=>{
 const iterate=req[Symbol.asyncIterator].bind(req);
 req[Symbol.asyncIterator]=async function*(){
  const parts=[];for await(const part of {[Symbol.asyncIterator]:iterate}){parts.push(part);yield part;}
  if(parts.length===0)return;
  const frame=JSON.parse(Buffer.concat(parts).toString());
  if(!recoveryArmed||frame[0]!=='meri.proxy.operation/2')return;
  if(frame[2][0]==='meri.proxy.settlement/1'){
   assert.equal(settlementSocket,undefined);settlementSocket=req.socket;
   settlementSocket.once('close',()=>{oldCloseObserved=true;recoveryOrder.push('old-close');});
  }else if(frame[2][0]==='meri.proxy.outcome/1'&&recoveryOrder.length===0){
   assert.ok(settlementSocket);assert.notEqual(req.socket,settlementSocket);
   assert.equal(settlementSocket.destroyed,false);assert.equal(oldCloseObserved,false);
   closeListenersBeforeRecovery=new Set(settlementSocket.rawListeners('close'));
   recoveryOrder.push('outcome-before-close');
   output({event:'outcome-before-close',distinctSocket:true,oldCloseObserved});
  }
 };
});}

const at=Date.now(),expiry=at+300000,seed=productFixture(),fact=seed.context(),allocation=structuredClone(seed.allocation);
for(const budgets of [allocation.budgets,allocation.manifest.budgets])Object.assign(budgets,{maxRuntimeSeconds:600,maxCostMicroUSD:10000000});
allocation.manifestSha256=canonicalSha256(allocation.manifest);allocation.schedule.expiresAt=new Date(expiry).toISOString();
fact.allocationSha256=canonicalSha256(allocation);
const credential='synthetic-p2-credential-for-loopback-only';fact.capabilitySha256=createHash('sha256').update(credential).digest('hex');
const clientId='11111111-1111-4111-8111-111111111111',execution=canonicalSha256(fact.binding),commands=[];
const pricing={modelId:'anthropic.claude-sonnet-4-6',profileId:'us.anthropic.claude-sonnet-4-6',revision:'b'.repeat(64),validUntilMs:expiry,
 actualInputMicroUSDPerK:3300,reserveInputMicroUSDPerK:6600,outputMicroUSDPerK:16500,maxInputTokens:8192,maxOutputTokens:256};
const resource={taskArn:fact.qualificationBinding.workerArn,createdAtMs:at-1000,
 clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/Synthetic',
 taskDefinitionArn:'arn:aws:ecs:us-east-1:967807252336:task-definition/Synthetic:1',containerName:'worker'};
const versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
const facts={binding:fact.binding,allocationJson:JSON.stringify(allocation),grantFactsJsons:[JSON.stringify(fact)],modelGrantId:fact.grantId,
 selectedClientId:clientId,original:{binding:fact.binding,executionKey:execution,executionId:execution,planSha256:'d'.repeat(64),expiresAtMs:expiry,versions},
 resource,requestSha256:'e'.repeat(64),expiresAtMs:expiry};
let coreCalls=0,factReads=0,state={budget:{id:1,cap_micro_usd:'10000000',consumed_micro_usd:'0',quarantined:false},run:seed.state().run,
 grant:{...seed.state().grant,capability_sha256:fact.capabilitySha256,expires_at:new Date(expiry)},allocation:{run_id:fact.binding.runId,allocation_sha256:fact.allocationSha256,allocation,
 max_tool_calls:String(allocation.budgets.maxToolCalls),max_cost_micro_usd:String(allocation.budgets.maxCostMicroUSD),started_at:new Date(at)},
 binding:{grant_id:fact.grantId,run_id:fact.binding.runId,facts:fact},requests:new Map()};
const pool={async connect(){let local,readOnly=false;return {async query(sql,p=[]){
 commands.push(sql);const rows=values=>({rows:structuredClone(values),rowCount:values.length});
 if(sql.startsWith('BEGIN')){readOnly=sql.includes('READ ONLY');local=structuredClone(state);return rows([]);}
 if(sql.startsWith('SET LOCAL'))return rows([]);
 if(sql==='ROLLBACK'){local=null;return rows([]);}
 if(sql==='COMMIT'){if(!readOnly)state=local;local=null;return rows([]);}
 if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date()}]);
 assert.equal(sql.includes('meri_qualification.'),false);
 if(sql==='SELECT * FROM meri_product_budget.budget WHERE id=1 FOR UPDATE'||sql==='SELECT cap_micro_usd,consumed_micro_usd,quarantined FROM meri_product_budget.budget WHERE id=1')return rows([local.budget]);
 for(const [table,key] of [['runs','run'],['tool_run_allocations','allocation'],['grants','grant'],['tool_grant_bindings','binding']])
  if(sql.startsWith('SELECT * FROM meri_product_budget.'+table+' WHERE'))return rows([local[key]]);
 if(sql.startsWith('SELECT * FROM meri_product_budget.requests WHERE')){
  if(readOnly&&recoveryArmed){assert.equal(oldCloseObserved,true);recoveryOrder.push('outcome-read');}
  return rows(local.requests.has(p[0])?[local.requests.get(p[0])]:[]);}
 const all=[...local.requests.values()];
 if(sql.startsWith('SELECT 1 FROM meri_product_budget.budget_liabilities'))return rows(all.filter(r=>r.slot===p[0]||r.grant_id===p[1]&&r.state==='UNKNOWN').map(()=>({one:1})));
 if(sql.includes(' AS run_total FROM meri_product_budget.budget_liabilities'))return rows([{held:String(all.filter(r=>r.state==='UNKNOWN').reduce((v,r)=>v+BigInt(r.hold_micro_usd),0n)),run_total:String(all.filter(r=>r.run_id===p[0]).reduce((v,r)=>v+BigInt(r.state==='UNKNOWN'?r.hold_micro_usd:r.actual_micro_usd),0n))}]);
 if(sql.includes(' AS held FROM meri_product_budget.budget_liabilities'))return rows([{held:'0'}]);
 if(sql.includes(' AS total FROM meri_product_budget.budget_liabilities'))return rows([{total:'0'}]);
 if(sql.startsWith('INSERT INTO meri_product_budget.requests(')){
  assert.equal(local.requests.has(p[0]),false);local.requests.set(p[0],{kind:'model',slot:p[0],request_id:p[0],grant_id:p[1],run_id:p[2],attempt:p[3],worker_arn:p[4],fence:p[5],policy_revision:p[6],native_body_sha256:p[7],raw_request_sha256:p[8],model_id:p[9],profile_id:p[10],pricing_revision:p[11],pricing_valid_until:p[12],input_tokens:p[13],max_output_tokens:p[14],hold_micro_usd:p[15],state:'UNKNOWN',actual_micro_usd:null,evidence_sha256:null,settled_at:null});return rows([]);
 }
 if(sql.startsWith('UPDATE meri_product_budget.budget SET')){local.budget.consumed_micro_usd=String(BigInt(local.budget.consumed_micro_usd)+BigInt(p[0]));local.budget.quarantined||=p[1];return {rows:[],rowCount:1};}
 if(sql.startsWith('UPDATE meri_product_budget.requests SET')){const r=local.requests.get(p[0]);if(r?.state!=='UNKNOWN')return {rows:[],rowCount:0};Object.assign(r,{state:'SETTLED',actual_micro_usd:p[1],evidence_sha256:p[2],settled_at:new Date()});return {rows:[],rowCount:1};}
 assert.fail('unsupported composed SQL: '+sql);
 },release(){}};}};
const issued={binding:{run_id:fact.qualificationBinding.runId,attempt:1,worker_arn:resource.taskArn,fence:1,policy_revision:fact.qualificationBinding.policyRevision},
 grant_id:fact.grantId,cluster_arn:resource.clusterArn,task_definition_arn:resource.taskDefinitionArn,container_name:resource.containerName,image_digest:versions.imageDigest,
 execution_binding:fact.binding,started_by:execution,group:'meri:'+execution,created_at_ms:resource.createdAtMs,expires_at_ms:expiry,
 vpc_id:'vpc-aaaaaaaaaaaaaaaaa',subnet_id:'subnet-bbbbbbbbbbbbbbbbb',security_group_ids:['sg-ccccccccccccccccc'],
 tags:[['meri:execution-id',execution],['meri:binding-sha256',execution],['meri:plan-sha256','d'.repeat(64)],['meri:expires-at-ms',String(expiry)]]};
const pairIdentities=Object.fromEntries(['owner','proxy'].map((role,i)=>[role,{taskArn:'arn:aws:ecs:us-east-1:967807252336:task/capiro-dev/'+String(i+1).repeat(32),createdAtMs:at-10000}]));
const listen=Server.prototype.listen;
Server.prototype.listen=function(...args){observeRecovery(this);return Reflect.apply(listen,this,args);};
let fixture;
try{fixture=await createP2OwnerFixture({pairIdentities,maxRequestMs:15000,
 persistedFacts:{available:true,async resolve({capabilitySha256}){assert.equal(capabilitySha256,fact.capabilitySha256);factReads++;return structuredClone(facts);}},
 ownerPorts:{pool,pricing,limits:{maxRequestMs:15000,maxFactBytes:65536},async checkCurrentConversation(){coreCalls++;return {identitySha256:'a'.repeat(64),binding:fact.binding,
  scopes:[{kind:'client',tenantId:fact.binding.tenantId,resourceId:clientId,policyRevision:fact.qualificationBinding.policyRevision}],selectedClientId:clientId,contextRevision:'b'.repeat(64),checkedAtMs:Date.now(),expiresAtMs:Date.now()+15000};}},
 placement:{available:true,async resolve(value){assert.equal(value.capabilitySha256,fact.capabilitySha256);return {issuedTaskNetwork:issued,checkedAtMs:Date.now(),effectiveExpiresAtMs:Math.min(value.deadlineMs,expiry)};}}});}finally{Server.prototype.listen=listen;}
output({at,pins:fixture.pins,clientPolicy:fixture.clientPolicy,clientFiles:fixture.clientFiles,credential,capability:fact.capabilitySha256,pricingRevision:pricing.revision,binding:fact.binding,grantId:fact.grantId});
const lines=createInterface({input:process.stdin});
for await(const line of lines){const input=JSON.parse(line);
 if(input.command==='arm-lost-settle'){recoveryArmed=true;output({armed:true});}
 else if(input.command==='abort-recovery'){
  // Production retirement aborts the existing request before closing sockets.
  // Prove the wait removes its listener on that abort, before close can fire.
  assert.equal(oldCloseObserved,false);
  const waitListeners=settlementSocket.rawListeners('close').filter(listener=>!closeListenersBeforeRecovery.has(listener));
  assert.equal(waitListeners.length,1);
  const destroy=settlementSocket.destroy;let checked=false;
  settlementSocket.destroy=function(...args){
   if(!checked){
    assert.equal(settlementSocket.rawListeners('close').includes(waitListeners[0]),false);
    assert.equal(oldCloseObserved,false);recoveryOrder.push('recovery-aborted');checked=true;
   }
   return Reflect.apply(destroy,this,args);
  };
  try{native.emit('error',Error('synthetic recovery cancellation'));}
  finally{settlementSocket.destroy=destroy;}
  assert.equal(checked,true);assert.equal(fixture.server.available,false);
  if(!oldCloseObserved)await once(settlementSocket,'close');
  output({aborted:true,waitListenerRemovedBeforeClose:true});
 }
 else if(input.command==='stats')output({recoveryOrder,oldCloseObserved,coreCalls,factReads,pairProofs:fixture.counts.pairProofs,placement:fixture.counts.placement,commands,requests:[...state.requests.values()],budget:state.budget});
 else if(input.command==='foreign-principal'){
  // The same CA's owner certificate is not the pinned proxy principal and has
  // serverAuth, not clientAuth. A real TLS attempt must reach no budget query.
  const using=new Agent({...fixture.clientTls,cert:fixture.tlsMaterial.cert,key:fixture.tlsMaterial.key});
  let refused=false;try{refused=(await fixture.request(OWNER_PATHS.operation,input.frame,{using})).status===403;}
  catch{refused=true;}finally{using.destroy();}output({refused,commands});
 }
 else if(input.command==='close'){await fixture.close();break;}
 else throw Error('unknown composed command');
}
lines.close();process.stdin.destroy();
