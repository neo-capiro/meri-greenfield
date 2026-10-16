/** Control-side read of one already-issued model selection. No grant issuance, proxy
 * configuration, listener, credential creation or provider call occurs here.
 *
 * `preparedFacts.read` must be the current owner that rechecks the accepted run,
 * immutable issuance, admitted allocation and task. `modelIssuer` is the canonical
 * durable model issuer's read/resolve facade. `proxyAttestation.read` must be a
 * separately authenticated product proxy owner that checks the ACTIVE grant and
 * task, and attests its current provider/upstream configuration. No production
 * implementation of that last port is supplied by this module. Both owners must
 * expose synchronous `available()` gates, so method presence never opens reads.
 */
import {createHash} from 'node:crypto';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {typedFault} from '../../../packages/runtime/objective-generation-custody.mjs';

const refuse=()=>{throw typedFault();};
const same=(a,b)=>hash(a)===hash(b);
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(value);
const sha=value=>createHash('sha256').update(value).digest('hex');
function proxyUrl(value){let url;try{url=new URL(value);}catch{refuse();}
 if(url.protocol!=='https:'||url.href!==value||url.username||url.password||url.search||url.hash)refuse();return value;}
function selection(value){const s=data(own(value,['provider','model']));
 if(Object.values(s).some(v=>typeof v!=='string'||!v.trim()||v.length>128))refuse();return s;}

export function createObjectiveQuerySelectionReader(configuration){
 const c=own(configuration,[],['preparedFacts','modelIssuer','proxyAttestation','enabled','now','maxRequestMs']);
 const now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000,enabled=c.enabled??false;
 if(typeof enabled!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)refuse();
 const readFacts=c.preparedFacts===undefined?null:storageMethod(c.preparedFacts,'read');
 const factsAvailable=c.preparedFacts===undefined?null:storageMethod(c.preparedFacts,'available');
 const readModel=c.modelIssuer===undefined?null:storageMethod(c.modelIssuer,'read');
 const resolveModel=c.modelIssuer===undefined?null:storageMethod(c.modelIssuer,'resolve');
 const attest=c.proxyAttestation===undefined?null:storageMethod(c.proxyAttestation,'read');
 const proxyAvailable=c.proxyAttestation===undefined?null:storageMethod(c.proxyAttestation,'available');
 const available=()=>{if(!enabled||readFacts===null||factsAvailable===null||readModel===null||resolveModel===null||attest===null||proxyAvailable===null)return false;
  try{return factsAvailable()===true&&proxyAvailable()===true;}catch{return false;}};

 async function read(value){
  const v=own(value,['binding','sourceRequestSha256','proxyUrl','proxyCredentialSha256'],['signal']);nativeSignal(v.signal);
  if(!available())refuse();validateShape('RunBinding',v.binding);
  if(!digest(v.sourceRequestSha256)||!digest(v.proxyCredentialSha256))refuse();proxyUrl(v.proxyUrl);
  const life=createOperationLifetime({now,signal:v.signal,deadlineMs:now()+maxRequestMs,errorFactory:typedFault});
  try{
   const entry=data(await life.run(signal=>readFacts({binding:v.binding,signal})));life.check();
   const issuance=data(own(entry.issuance,['issuanceKey','binding','requestSha256','expiresAtMs','grantId','capabilitySha256','factsSha256']));
   const {issuance:ignored,factsSha256:ignoredHash,...facts}=entry;
   if(!same(issuance.binding,v.binding)||issuance.issuanceKey!==hash(v.binding)||issuance.requestSha256!==v.sourceRequestSha256||
      !digest(issuance.factsSha256)||issuance.factsSha256!==entry.factsSha256||hash(facts)!==entry.factsSha256||
      !uuid(issuance.grantId)||!digest(issuance.capabilitySha256)||!Number.isSafeInteger(issuance.expiresAtMs)||issuance.expiresAtMs<=now()||
      !same(entry.original?.binding,v.binding)||entry.original?.expiresAtMs!==issuance.expiresAtMs||entry.original?.executionKey!==hash(v.binding)||
      entry.grantId!==issuance.grantId||!entry.objectiveGeneration||!entry.objectiveStrategy)refuse();
   life.limitDeadline(issuance.expiresAtMs);
   const expected=selection(entry.objectiveStrategy.executionSelection),grants=data(entry.grantIntents);
   if(!Array.isArray(grants)||grants.length!==2||grants.filter(g=>g.grantId===issuance.grantId).length!==1)refuse();
   const task=grants.find(g=>g.grantId===issuance.grantId),model=grants.find(g=>g.grantId!==issuance.grantId);
   if(task.capabilitySha256!==issuance.capabilitySha256||task.expiresAtMs!==issuance.expiresAtMs||!model||!uuid(model.grantId)||!digest(model.capabilitySha256)||model.capabilitySha256===task.capabilitySha256||model.expiresAtMs!==issuance.expiresAtMs)refuse();
   const intent=data({issuanceKey:issuance.issuanceKey,binding:v.binding,requestSha256:issuance.requestSha256,expiresAtMs:issuance.expiresAtMs});
   async function currentModel(){const state=data(own(await life.run(signal=>readModel({...intent,signal})),['state'],['issuance']));life.check();
    if(state.state!=='ISSUED')refuse();const selected=data(own(state.issuance,['issuanceKey','binding','requestSha256','expiresAtMs','grantId','capabilitySha256']));
    if(!same(selected,{...intent,grantId:model.grantId,capabilitySha256:model.capabilitySha256}))refuse();return selected;}
   const modelReceipt=await currentModel();
   async function currentMaterial(){const credential=await life.run(signal=>resolveModel({...modelReceipt,signal}));life.check();
    if(typeof credential!=='string'||!/^[!-~]{32,256}$/u.test(credential)||sha(credential)!==model.capabilitySha256||sha(credential)!==v.proxyCredentialSha256)refuse();}
   await currentMaterial();
   const attestedAt=now(),attested=data(own(await life.run(signal=>attest({binding:v.binding,grantId:model.grantId,capabilitySha256:model.capabilitySha256,proxyUrl:v.proxyUrl,signal})),
    ['binding','grantId','capabilitySha256','proxyUrl','provider','model','upstreamModelId','configSha256','checkedAtMs','expiresAtMs']));life.check();
   if(!same(attested.binding,v.binding)||attested.grantId!==model.grantId||attested.capabilitySha256!==model.capabilitySha256||attested.proxyUrl!==v.proxyUrl||
      !same(selection({provider:attested.provider,model:attested.model}),expected)||typeof attested.upstreamModelId!=='string'||!attested.upstreamModelId.trim()||attested.upstreamModelId.length>256||
      !digest(attested.configSha256)||!Number.isSafeInteger(attested.checkedAtMs)||attested.checkedAtMs<attestedAt||attested.checkedAtMs>now()||
      !Number.isSafeInteger(attested.expiresAtMs)||attested.expiresAtMs<=now())refuse();
   life.limitDeadline(Math.min(issuance.expiresAtMs,attested.expiresAtMs));
   await currentMaterial();await currentModel();
   const current=data(await life.run(signal=>readFacts({binding:v.binding,signal})));life.check();
   if(!same(current,entry))refuse();
   const expiresAtMs=Math.min(issuance.expiresAtMs,attested.expiresAtMs),checkedAtMs=now();
   if(expiresAtMs<=checkedAtMs||!available())refuse();life.check();
   return data({binding:v.binding,sourceRequestSha256:v.sourceRequestSha256,proxyUrl:v.proxyUrl,
    proxyCredentialSha256:v.proxyCredentialSha256,provider:expected.provider,model:expected.model,checkedAtMs,expiresAtMs});
  }catch{refuse();}finally{life.close();}
 }
 return Object.freeze({available,read});
}
