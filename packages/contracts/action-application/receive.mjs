import canonicalize from 'canonicalize';
import {validateQuery,validateDraft,validatePrepare,validateExecute,validateError,validatePrepareRequest,validateTaskProposal,validateTaskArguments} from './generated-validator.mjs';
import {snapshotExpected} from '../task-command-application/boundary.mjs';
import {errorStatuses} from './generated-status.mjs';
const routes=Object.freeze({query:validateQuery,draft:validateDraft,prepare:validatePrepare,execute:validateExecute});
export class ActionResponseError extends Error {constructor(code){super(code);this.name='ActionResponseError';this.code=code;}}
const fail=code=>{throw new ActionResponseError(code);};
const same=(a,b)=>canonicalize(a)===canonicalize(b);
const sha=async value=>Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalize(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
const instant=value=>{const at=Date.parse(value);if(!Number.isSafeInteger(at)||new Date(at).toISOString()!==value)fail('ACTION_RESPONSE_CORRELATION');return at;};
function inert(value){
 const stack=[[value,0]],objects=[];let nodes=0;
 while(stack.length){const [v,depth]=stack.pop();if(++nodes>100000||depth>64)fail('ACTION_RESPONSE_LIMIT');
  if(typeof v==='number'&&!Number.isFinite(v))fail('ACTION_RESPONSE_JSON');
  if(v&&typeof v==='object'){objects.push(v);for(const key of Object.keys(v)){if(['__proto__','prototype','constructor'].includes(key))fail('ACTION_RESPONSE_JSON');stack.push([v[key],depth+1]);}}
 }
 return ()=>{for(const object of objects.reverse())Object.freeze(object);};
}
function scope(binding,scopes){if(scopes.some(s=>s.tenantId!==binding.tenantId))fail('ACTION_RESPONSE_CORRELATION');}
async function draft(v){
 const {draftSha256,...content}=v,s=v.source,r=v.recommendation;
 if(await sha(content)!==draftSha256||await sha(r)!==s.actionSha256||s.actionId!==r.id||typeof r.clientId!=='string'||s.clientId.toLowerCase()!==r.clientId.toLowerCase()||v.task.clientId?.toLowerCase()!==s.clientId.toLowerCase())fail('ACTION_RESPONSE_CORRELATION');
}
async function correlate(route,v,expected){
 if(route==='query'){
  const o=v.observation,p=o.result,[started,completed]=v.events,s=o.subject;
  if(!same(o.binding,p.binding)||!same(s,p.subject)||s.kind!=='client'||s.entityType!=='client'||s.entityIds.length!==1||s.entityIds[0]!==p.clientId||s.tenantId!==o.binding.tenantId||s.actorId!==o.binding.actorId||p.returned!==p.actions.length||await sha(o)!==v.resultSha256)fail('ACTION_RESPONSE_CORRELATION');
  scope(o.binding,s.scopes);
  if(started.type!=='tool.started'||completed.type!=='tool.completed'||started.data.tool!=='actions.query@0.2.0'||started.data.requestId!==completed.data.requestId||completed.data.resultReference!==v.resultReference||started.eventId===completed.eventId||completed.sequence<=started.sequence)fail('ACTION_RESPONSE_CORRELATION');
  for(const event of v.events)if(!same(event.binding,o.binding)||!same(event.scopes,s.scopes))fail('ACTION_RESPONSE_CORRELATION');
  for(const row of p.actions)if(row.clientId!==p.clientId)fail('ACTION_RESPONSE_CORRELATION');
 }else if(route==='draft')await draft(v);
 else if(route==='prepare'){
  if(expected!==undefined){
   let expectation;try{expectation=snapshotExpected(expected);}catch{fail('ACTION_RESPONSE_EXPECTATION');}
   if(!expectation||Object.keys(expectation).length!==1||!validatePrepareRequest(expectation.request)||!same(expectation.request.draft,v.draft))fail('ACTION_RESPONSE_CORRELATION');
  }
  await draft(v.draft);const p=v.proposal,c=p.command;
  if(c.action!=='task.create'||c.attachments.length!==0||!same(c.arguments,v.draft.task)||['tenantId','actorId','conversationId','runId'].some(k=>c.binding[k]!==v.draft.source.originalBinding[k])||await sha(c)!==p.commandSha256||p.requiredApprover.tenantId!==c.binding.tenantId||Date.parse(p.expiresAt)<=Date.parse(p.createdAt))fail('ACTION_RESPONSE_CORRELATION');scope(c.binding,c.scopes);
 }else if(v.status==='observed'){
  if(v.outcome.execution?.kind==='native-task'){
   let expectation;try{expectation=snapshotExpected(expected);}catch{fail('ACTION_RESPONSE_EXPECTATION');}
   if(!expectation||Object.keys(expectation).length!==1||!validateTaskProposal(expectation.proposal))fail('ACTION_RESPONSE_EXPECTATION');
   const p=expectation.proposal,c=p.command,e=v.outcome.execution,r=v.outcome.result;
   if(c.action!=='task.create'||c.attachments.length||!validateTaskArguments(c.arguments)||await sha(c)!==p.commandSha256||c.arguments.title?.trim()!==c.arguments.title||
    p.requiredApprover.tenantId!==c.binding.tenantId||instant(p.expiresAt)<=instant(p.createdAt)||
    e.proposalId!==p.proposalId||e.commandSha256!==p.commandSha256||e.idempotencyKey!==c.idempotencyKey||!same(e.binding,c.binding)||
    instant(e.completedAt)<Date.parse(p.createdAt)||r.status!=='todo'||['title','clientId','dueDate'].some(key=>r[key]!==c.arguments[key]))fail('ACTION_RESPONSE_CORRELATION');
   scope(c.binding,c.scopes);instant(r.createdAt);if(r.dueDate!==null&&instant(r.dueDate)%86400000!==0)fail('ACTION_RESPONSE_CORRELATION');return;
  }
  if(v.outcome.receipt.outcome!=='succeeded')fail('ACTION_RESPONSE_CORRELATION');scope(v.outcome.receipt.binding,v.outcome.receipt.scopes);
 }
}
/** Read Response.text(), never Response.json(). Shape/hash equality is not authority. */
export async function receiveActionResponse(route,httpStatus,jsonText,expected){
 if(typeof route!=='string'||!Object.hasOwn(routes,route)||typeof httpStatus!=='number'||!Number.isInteger(httpStatus))fail('ACTION_RESPONSE_ROUTE');
 if(typeof jsonText!=='string')fail('ACTION_RESPONSE_JSON');
 if(jsonText.length>16777216||new TextEncoder().encode(jsonText).length>16777216)fail('ACTION_RESPONSE_LIMIT');
 let value;try{value=JSON.parse(jsonText);}catch{fail('ACTION_RESPONSE_JSON');}
 const freeze=inert(value);
 if(httpStatus===200){if(!routes[route](value))fail('ACTION_RESPONSE_SHAPE');await correlate(route,value,expected);}
 else {if(!validateError(value)||errorStatuses[value.error.code]!==httpStatus)fail('ACTION_RESPONSE_STATUS');}
 freeze();return value;
}
/** Exact immutable delivery identity for standalone preparation; validation grants no authority. */
export async function receiveActionPrepareRequest(jsonText){
 if(typeof jsonText!=='string'||jsonText.length>16777216)fail('ACTION_RESPONSE_JSON');
 let value;try{value=JSON.parse(jsonText);}catch{fail('ACTION_RESPONSE_JSON');}
 const freeze=inert(value);if(!validatePrepareRequest(value))fail('ACTION_RESPONSE_SHAPE');await draft(value.draft);freeze();return value;
}
