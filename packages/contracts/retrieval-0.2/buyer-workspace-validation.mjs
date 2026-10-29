import {snapshotOperationData} from './operation-contracts.mjs';
import {canonicalSha256} from '../validate.mjs';
const fail=()=>{throw Error('BUYER_WORKSPACE_INVALID');};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const requireSame=(a,b)=>{if(!same(a,b))fail();};
const pageDetail='More rows remain; follow this section’s next cursor with the same fiscal year and knowledge timestamp.';
function canonicalInstant(value){const time=Date.parse(value);if(!Number.isFinite(time))fail();return new Date(time).toISOString();}
function page(value,count){if(value.hasMore!==(value.nextCursor!==null)||value.hasMore&&count===0)fail();}
function section(value,name,input){
 const d=value.data;
 requireSame(d.subject,{type:'pe',id:input.peCode});
 if(d.asOfFy!==input.asOfFy||d.knownAt!==input.knownAt)fail();
 const state=d.page.hasMore&&d.coverage.state==='complete'?'partial':d.coverage.state;
 const coverage=d.page.hasMore?{...d.coverage,state,unresolvedReasons:[...d.coverage.unresolvedReasons,{
  code:name+'_page_incomplete',count:null,detail:pageDetail}]}:d.coverage;
 if(value.state!==state)fail();requireSame(value.coverage,coverage);requireSame(value.freshness,d.coverage.sourceFreshness);
}
function cents(value){
 if(typeof value!=='string'||!/^(-?)(\d+)(?:\.(\d{1,2}))?$/.test(value))return null;
 const [,sign,whole,fraction='']=/^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
 return (sign==='-'?-1n:1n)*(BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0')));
}
const decimal=value=>(value<0n?'-':'')+(value<0n?-value:value)/100n+'.'+String((value<0n?-value:value)%100n).padStart(2,'0');
function total(rows){
 let sum=0n;for(const row of rows){const value=cents(row.amountUsd);if(value===null)return null;sum+=value;}return decimal(sum);
}
function fundingFact(row){
 const amount=cents(row.amountUsd);
 const authoritative=row.measure==='allocation'&&row.authorityState==='enacted'&&row.allocationCertification==='certified'&&
  row.reviewState==='verified'&&row.exactAccountLevel&&row.accountId&&amount!==null&&amount>=0n&&row.evidence.length>0?decimal(amount):null;
 if(row.authoritativeAmountUsd!==authoritative)fail();
}
function funding(value){
 const d=value.data,primary=[],seen=new Set();
 for(const [name,bucket] of [['enacted',d.enacted],['proposed',d.proposed]]){
  for(const [field,measure] of [['cumulativeSnapshots','cumulative_snapshot'],['transactionDeltas','transaction_delta'],['transferLegs','transfer_leg']])
   for(const row of bucket[field]){if(row.authorityState!==name||row.measure!==measure)fail();primary.push(row);}
  const groups=bucket.cumulativeSnapshots.map(row=>row.snapshotGroupId);
  const snapshots=groups.some(id=>!id)||new Set(groups).size!==groups.length?null:total(bucket.cumulativeSnapshots);
  requireSame(bucket.totals,{cumulativeSnapshotUsd:snapshots,transactionDeltaUsd:total(bucket.transactionDeltas)});
 }
 for(const row of d.allocations){if(row.measure!=='allocation')fail();primary.push(row);}
 for(const row of d.residuals)if(row.measure==='residual')primary.push(row);
 for(const row of primary){if(seen.has(row.stableKey))fail();seen.add(row.stableKey);fundingFact(row);}
 if(primary.length>51)fail();page(d.page,primary.length);
 const byKey=new Map(primary.map(row=>[row.stableKey,row]));
 for(const row of d.residuals){if(row.measure!=='residual'&&!row.unresolvedReasons.length)fail();requireSame(row,byKey.get(row.stableKey));}
 const transferRows=primary.filter(row=>row.measure==='transfer_leg'),groups=new Map();
 for(const row of transferRows)if(row.transferGroupId)groups.set(row.transferGroupId,[...(groups.get(row.transferGroupId)??[]),row]);
 if(d.transferPairs.length!==groups.size)fail();
 const observed=new Set();
 for(const pair of d.transferPairs){
  if(observed.has(pair.transferGroupId))fail();observed.add(pair.transferGroupId);
  const legs=groups.get(pair.transferGroupId);if(!legs)fail();
  const outs=legs.filter(row=>row.transferLeg==='outflow'),ins=legs.filter(row=>row.transferLeg==='inflow');
  const out=outs.length===1?outs[0]:null,inside=ins.length===1?ins[0]:null;
  requireSame(pair.outflow,out);requireSame(pair.inflow,inside);
  const paired=legs.length===2&&out&&inside&&out.authorityState===inside.authorityState;
  if(pair.state!==(paired?'paired':'unresolved')||pair.unresolvedReason!==(paired?null:'transfer_pair_incomplete_or_ambiguous')||
   pair.authorityState!==(out?.authorityState??inside?.authorityState??legs[0].authorityState))fail();
 }
}
function acquisition(value){
 const d=value.data,seen=new Set(),groups=[['accepted',d.accepted],['candidate',d.candidates],['unresolved',d.unresolved]];
 let count=0;
 for(const [status,rows] of groups)for(const row of rows){
  count++;if(row.status!==status||seen.has(row.stableKey))fail();seen.add(row.stableKey);
  const f=row.financialFact,amount=f.sourceAmountUsd;
  const authoritative=['source_stated_financial_allocation','deterministic_financial_allocation'].includes(f.classification)&&
   row.status==='accepted'&&f.reviewState==='verified'&&f.evidencePresent&&f.actionEffect==='ordinary'&&
   typeof amount==='string'&&/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount)?amount:null;
  if(row.authoritativeAmountUsd!==authoritative)fail();
 }
 if(count>50)fail();page(d.page,count);
}
function evidence(value,input){
 const {mentions,lifecycle}=value.data,partial=mentions.hasMore||lifecycle.hasMore;
 if(value.state!==(partial?'partial':'complete')||value.coverage.state!==value.state||
  value.freshness.knownAt!==input.knownAt||value.coverage.unresolvedReasons.length!==(partial?1:0))fail();
 page(mentions,mentions.items.length);page(lifecycle,lifecycle.items.length);
 for(const row of [...mentions.items,...lifecycle.items])if(row.canonicalPeCode!==input.peCode||
  Date.parse(row.createdAt)>Date.parse(input.knownAt))fail();
 for(const row of lifecycle.items)for(const [field,revision] of [['beforeEvidence',row.previousRevisionId],['afterEvidence',row.currentRevisionId]]){
  const side=row[field];if(side.revisionId!==revision)fail();
  if(side.availability==='available'){
   if(!revision||side.reason!==null||!side.contentHash||!side.extractionHash||!side.sourceUrl||!side.locator||!side.evidence||
    !side.languageHash||side.qualificationState!=='qualified')fail();
   let url;try{url=new URL(side.sourceUrl);}catch{fail();}if(!['http:','https:'].includes(url.protocol))fail();
   if(side.textSpan&&side.textSpan.end<=side.textSpan.start)fail();
  }else if(!side.reason||['contentHash','extractionHash','sourceUrl','locator','textSpan','evidence','languageHash','publishedAt','sourceModifiedAt'].some(key=>side[key]!==null))fail();
 }
}
export function createBuyerWorkspaceValidators({validateShape}){
 function normalizeInput(request,context={}){
  const raw=snapshotOperationData(request),c=snapshotOperationData(context);
  if(!c||Object.keys(c).length)fail();
  validateShape('BuyerWorkspaceInput',raw);
  for(const key of ['acquisitionCursor','fundingCursor','mentionsCursor','lifecycleCursor'])
   if(raw[key]!==undefined&&raw[key].trim()!==raw[key])fail();
  const input={...raw,peCode:raw.peCode.trim().toUpperCase(),knownAt:canonicalInstant(raw.knownAt)};
  if(!input.peCode)fail();return {input};
 }
 function assertOutput(value,request,context={}){
  const {input}=normalizeInput(request,context),out=snapshotOperationData(value);
  validateShape('BuyerWorkspaceOutput',out);
  requireSame(out.subject,{type:'pe',id:input.peCode});
  if(out.asOfFy!==input.asOfFy||out.knownAt!==input.knownAt||out.budget.coverage.unresolvedReasons.length!==1)fail();
  section(out.acquisition,'acquisition',input);section(out.fundingExecution,'funding',input);
  acquisition(out.acquisition);funding(out.fundingExecution);evidence(out.federalEvidence,input);
  return value;
 }
 return Object.freeze({normalizeInput,assertOutput});
}
