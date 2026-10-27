/** Fixed Strategy/Planner owner records, selected-client binding and whole-record pages. */
import {createHash} from 'node:crypto';
import {snapshotOperationData} from './operation-contracts.mjs';
const fail=()=>{throw Error('Invalid saved Strategy contract');};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const fields={planner_projects:['archived'],planner_tasks:['archived','projectId'],planner_task:['id'],planner_events:['id','target'],strategy_versions:['strategyId'],strategy_activity:['strategyId'],objective_versions:['objectiveId']};
const relations={planner_projects:'sp_planner_projects',planner_tasks:'sp_planner_tasks',planner_task:'sp_planner_tasks',planner_events:'sp_planner_events',strategy_versions:'sp_version',strategy_activity:'sp_activity_log',objective_versions:'client_objective_revisions'};
const binding=r=>[r.kind,r.clientId,r.id??null,r.projectId??null,r.strategyId??null,r.objectiveId??null,r.target??null,r.archived??false];
const cursor=(r,after)=>Buffer.from(JSON.stringify({binding:binding(r),after})).toString('base64url');
function after(r,value){
 try{const d=JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
  if(typeof d.after!=='string'||!uuid.test(d.after)||cursor(r,d.after)!==value)fail();return d.after;
 }catch{fail();}
}
export function createStrategySavedValidators({validateShape}){
 function normalizeInput(id,raw,context={}){
  if(id!=='read_saved_strategy_records')fail();const input=snapshotOperationData(raw);validateShape('StrategySavedRequest',input);
  if(Object.keys(input).some(k=>!['kind','clientId',...(input.kind==='planner_task'?[]:['cursor']),...fields[input.kind]].includes(k)))fail();
  for(const name of ['clientId','id','projectId','strategyId','objectiveId'])if(input[name]!==undefined)input[name]=input[name].toLowerCase();
  if(['planner_task','planner_events'].includes(input.kind)&&!input.id||input.kind==='planner_events'&&!input.target||
   input.kind.startsWith('strategy_')&&!input.strategyId||input.kind==='objective_versions'&&!input.objectiveId)fail();
  const s=context.strategySavedScope;
  if(!s||Object.keys(s).sort().join(',')!=='clientId,identityRevision,membershipRevision'||s.clientId!==input.clientId||
   ![s.identityRevision,s.membershipRevision].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v)))fail();
  if(input.cursor)after(input,input.cursor);
  return {input};
 }
 function assertOutput(id,raw,request,context={}){
  const {input}=normalizeInput(id,request,context),page=snapshotOperationData(raw);validateShape('StrategySavedOutput',page);
  if(page.kind!==input.kind||page.clientId!==input.clientId||Buffer.byteLength(JSON.stringify(page),'utf8')>262144||
   page.coverage.representation!==(input.kind==='strategy_activity'?'activity_summaries':'owner_records'))fail();
  let previous=input.cursor?after(input,input.cursor):null;
  for(const item of page.items){const r=item.record;
   if(item.source.relation!==relations[input.kind]||item.source.id!==r.id||
    item.source.contentSha256!==createHash('sha256').update(JSON.stringify(r)).digest('hex')||previous!==null&&r.id<=previous)fail();
   previous=r.id;
   if(['planner_projects','planner_tasks','planner_task','objective_versions'].includes(input.kind)&&r.clientId!==input.clientId)fail();
   if(input.kind==='planner_task'&&r.id!==input.id)fail();
   if(input.kind==='planner_events'&&r[input.target==='task'?'taskId':'projectId']!==input.id)fail();
   if(input.kind==='planner_tasks'&&input.projectId&&!r.memberships.some(m=>m.projectId===input.projectId))fail();
   if(['planner_projects','planner_tasks'].includes(input.kind)&&r.archived!==(input.archived??false))fail();
   if(input.kind==='strategy_versions'&&(r.strategyId!==input.strategyId||r.snapshot.meta.id!==input.strategyId||r.snapshot.meta.clientId!==input.clientId))fail();
   if(input.kind==='strategy_activity'&&r.entityId!==input.strategyId)fail();
   if(input.kind==='objective_versions'&&(r.objectiveId!==input.objectiveId||r.snapshot.id!==input.objectiveId||r.snapshot.clientId!==input.clientId||r.snapshot.version!==r.version))fail();
  }
  if(input.kind==='planner_task'&&(page.items.length!==1||page.nextCursor!==null||page.coverage.byteTruncated))fail();
  if(page.nextCursor!==null&&(!page.items.length||after(input,page.nextCursor)!==page.items.at(-1).source.id))fail();
  if(page.coverage.byteTruncated&&page.nextCursor===null)fail();
  return page;
 }
 return Object.freeze({normalizeInput,assertOutput});
}
