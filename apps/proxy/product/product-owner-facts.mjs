/** Read-only product proxy facts over the product owner's one borrowed PostgreSQL pool.
 *
 * Fixed product tables locate a bearer digest; canonical issuance, conversation
 * and budget owners then verify its original custody. This resolver supplies
 * constructor inputs only. It authenticates no TLS peer, reads no credential,
 * chooses no pricing and creates no reservation, grant, task or second ledger.
 * A future :8444 service must separately authenticate both operation and host
 * capture channels before passing these facts to product-owner-composition.
 */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createPostgresModelGrantStore} from '../../runtime/prepared-run-issuance-postgres.mjs';
import {createPostgresAdmittedRunOwner} from '../../gateway/budget/admitted-run-owner.mjs';
import {parseAdmittedGrantSet,assertRun,dbTime} from '../../gateway/budget/admitted-run-binding.mjs';
import {PostgresBudgetStore,refuse} from '../../gateway/budget/postgres-budget-store.mjs';
import {digest,same} from '../../gateway/budget/tool-budget-binding.mjs';

const deny=()=>refuse('PRODUCT_PROXY_FACTS_UNAVAILABLE');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const active=run=>['queued','starting','running'].includes(run.state);
const sorted=values=>[...values].sort((a,b)=>a.grantId.localeCompare(b.grantId));

/** Explicitly enable only in trusted startup; import and construction do no I/O.
 * `selectedClientId` is deployment configuration, never selected by a caller.
 * The input digest may locate facts but cannot itself authenticate a send.
 */
export function createProductProxyPersistedFacts(configuration){
 const c=own(configuration,['pool','selectedClientId','now','limits'],['enabled']);
 const limits=data(own(c.limits,['maxRequestMs','maxFactBytes'])),enabled=c.enabled??false;
 if(typeof c.pool?.connect!=='function'||
    typeof c.now!=='function'||typeof enabled!=='boolean'||
    typeof c.selectedClientId!=='string'||!uuid.test(c.selectedClientId)||
    !Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>30000||
    !Number.isSafeInteger(limits.maxFactBytes)||limits.maxFactBytes<1||limits.maxFactBytes>131072)deny();
 const budget=new PostgresBudgetStore(c.pool,{namespace:'product'});
 const conversations=createPostgresConversationStore({pool:c.pool,now:c.now});
 let quarantined=false;

 async function locate(capabilitySha256,life){
  return life.run(()=>budget.transact(async client=>{
   const grants=(await client.query('SELECT * FROM meri_product_budget.grants WHERE capability_sha256=$1',[capabilitySha256])).rows;
   life.check();if(grants.length!==1)deny();const grant=grants[0];
   if(grant.state!=='ACTIVE'||grant.capability_sha256!==capabilitySha256)deny();
   const selectedRows=(await client.query('SELECT * FROM meri_product_budget.tool_grant_bindings WHERE grant_id=$1',[grant.grant_id])).rows;
   life.check();if(selectedRows.length!==1)deny();
   const allocations=(await client.query('SELECT * FROM meri_product_budget.tool_run_allocations WHERE run_id=$1',[grant.run_id])).rows;
   life.check();if(allocations.length!==1)deny();const installed=allocations[0];
   const rows=(await client.query('SELECT * FROM meri_product_budget.tool_grant_bindings WHERE run_id=$1 ORDER BY grant_id',[grant.run_id])).rows;
   life.check();if(rows.length<1||rows.length>16)deny();
   const allocationJson=JSON.stringify(installed.allocation),grantFactsJsons=rows.map(row=>JSON.stringify(row.facts));
   if(Buffer.byteLength(allocationJson)+Buffer.byteLength(JSON.stringify(grantFactsJsons))>limits.maxFactBytes)deny();
   const parsed=parseAdmittedGrantSet({allocationJson,grantFactsJsons});
   const selected=parsed.facts.find(fact=>fact.grantId===grant.grant_id);
   if(!selected||selected.capabilitySha256!==capabilitySha256||
      selectedRows[0].grant_id!==selected.grantId||selectedRows[0].run_id!==selected.binding.runId||
      !same(selectedRows[0].facts,selected)||installed.run_id!==selected.binding.runId||
      installed.allocation_sha256!==hash(parsed.allocation)||
      rows.some((row,index)=>row.grant_id!==parsed.facts[index].grantId||row.run_id!==selected.binding.runId))deny();
   const persisted=(await client.query('SELECT * FROM meri_product_budget.grants WHERE run_id=$1 ORDER BY grant_id',[grant.run_id])).rows;
   life.check();if(persisted.length!==parsed.facts.length)deny();
   const grantIntents=persisted.map(row=>{
    const fact=parsed.facts.find(fact=>fact.grantId===row.grant_id);
    if(!fact||row.state!=='ACTIVE'||row.capability_sha256!==fact.capabilitySha256)deny();
    assertRun(row,fact);const expiresAtMs=dbTime(row.expires_at);life.limitDeadline(expiresAtMs);
    return {grantId:fact.grantId,capabilitySha256:fact.capabilitySha256,expiresAtMs};
   });
   if(new Set(grantIntents.map(grant=>grant.grantId)).size!==grantIntents.length)deny();
   assertRun(grant,selected);const grantExpiresAtMs=dbTime(grant.expires_at);life.limitDeadline(grantExpiresAtMs);
   if(grantIntents.find(grant=>grant.grantId===selected.grantId)?.expiresAtMs!==grantExpiresAtMs)deny();
   return {allocationJson,grantFactsJsons,selected,grantExpiresAtMs,grantIntents};
  },life.check,undefined,true));
 }

 return Object.freeze({get available(){return enabled&&!quarantined;},async resolve(value){
  let life;
  try{
   const v=own(value,['capabilitySha256','deadlineMs'],['signal']);nativeSignal(v.signal);
   digest(v.capabilitySha256);
   const at=c.now();
   if(!enabled||quarantined||!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(v.deadlineMs)||v.deadlineMs<=at)deny();
   life=createOperationLifetime({deadlineMs:Math.min(v.deadlineMs,at+limits.maxRequestMs),now:c.now,signal:v.signal,errorFactory:()=>Error('PRODUCT_PROXY_FACTS_UNAVAILABLE')});
   const located=await locate(v.capabilitySha256,life),{selected}=located,binding=selected.binding,issuanceKey=hash(binding);
   // A generic ACTIVE task grant cannot substitute for the distinct model
   // grant: the canonical model table must own this exact issued identity.
   // Keep the canonical issuance SELECT/decoder, but execute it through the
   // same owned read-only transaction, SQL timeouts and release path. There
   // is no direct pool.query path outside that bounded transaction.
   const issued=await life.run(()=>budget.transact(async client=>{
    const modelIssuances=createPostgresModelGrantStore({pool:{async query(...args){
     life.check();const result=await client.query(...args);life.check();return result;
    }}});
    return modelIssuances.read({issuanceKey});
   },life.check,undefined,true));life.check();
   if(!issued||issued.state!=='ISSUED'||issued.issuanceKey!==issuanceKey||
      !same(issued.binding,binding)||issued.grantId!==selected.grantId||
      issued.capabilitySha256!==v.capabilitySha256||issued.expiresAtMs!==located.grantExpiresAtMs)deny();
   life.limitDeadline(issued.expiresAtMs);
   const saved=await life.run(()=>conversations.allocations.read({binding,allocationKey:issuanceKey},life.check));life.check();
   const record=saved?.record;
   const modelIntent=record?.grantIntents?.find(grant=>grant.grantId===selected.grantId);
   if(!record||record.state!=='ADMITTED'||!active(saved.run)||!modelIntent||
      modelIntent.capabilitySha256!==issued.capabilitySha256||modelIntent.expiresAtMs!==issued.expiresAtMs||
      record.allocationSha256!==selected.allocationSha256||
      record.original.expiresAtMs!==issued.expiresAtMs||record.expiresAtMs!==issued.expiresAtMs||
      record.resource.taskArn!==selected.qualificationBinding.workerArn||
      record.qualification.attempt!==selected.qualificationBinding.attempt||
      record.qualification.policyRevision!==selected.qualificationBinding.policyRevision||
      !same(saved.run.versions,record.original.versions)||!same(sorted(record.grantIntents),sorted(located.grantIntents))||
      !same(sorted(record.resource.grantFactsJsons.map(raw=>JSON.parse(raw))),sorted(located.grantFactsJsons.map(raw=>JSON.parse(raw)))))deny();
   // Later mutable budget observations can only shorten the immutable grant
   // window, including after a concurrent grants.expires_at extension.
   const nativeExpiresAtMs=Math.min(...record.grantIntents.map(grant=>grant.expiresAtMs));
   life.limitDeadline(nativeExpiresAtMs);
   const expectedScopes=[{kind:'client',tenantId:binding.tenantId,resourceId:c.selectedClientId,policyRevision:selected.qualificationBinding.policyRevision}];
   if(!same(saved.run.scopes,expectedScopes)||saved.run.policyRevision!==selected.qualificationBinding.policyRevision)deny();
   const accepted=await life.run(()=>conversations.readOptional(binding,{limit:1},life.check));life.check();
   if(!accepted||!same(accepted.run,saved.run)||hash(accepted.request)!==issued.requestSha256)deny();
   const current=createPostgresAdmittedRunOwner({pool:c.pool,allocationJson:located.allocationJson,
    grantFactsJsons:located.grantFactsJsons,namespace:'product',now:c.now,limits});
   const observation=JSON.parse(await life.run(signal=>current.currentTaskRun(binding,{signal})));life.check();
   const observed=own(observation,['binding','policyRevision','deadlineMs','checkedAtMs']);
   if(!same(observed.binding,binding)||observed.policyRevision!==selected.qualificationBinding.policyRevision)deny();
   life.limitDeadline(observed.deadlineMs);
   return data({binding,allocationJson:located.allocationJson,grantFactsJsons:located.grantFactsJsons,
    modelGrantId:selected.grantId,selectedClientId:c.selectedClientId,original:record.original,
    resource:Object.fromEntries(['taskArn','createdAtMs','clusterArn','taskDefinitionArn','containerName'].map(key=>[key,record.resource[key]])),
    requestSha256:issued.requestSha256,expiresAtMs:Math.min(nativeExpiresAtMs,issued.expiresAtMs,observed.deadlineMs)});
  }catch{deny();}finally{
   // A deadline races I/O; it cannot prove a hung pool/driver stopped. Refuse
   // every later lookup on this instance rather than accumulating new work.
   if(life?.close().unsettledOperations>0)quarantined=true;
  }
 }});
}
