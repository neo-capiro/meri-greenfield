/** Shared post-schema correlation and request normalization; receives parsed/snapshotted JSON only. */
import canonicalize from 'canonicalize';
export class ConversationHistoryResponseError extends Error{constructor(code){super(code);this.name='ConversationHistoryResponseError';this.code=code;}}
export const fail=code=>{throw new ConversationHistoryResponseError(code);};
const same=(a,b)=>canonicalize(a)===canonicalize(b),uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(v);
const integer=(v,min,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
function closed(value,required,optional,code){if(!value||typeof value!=='object'||Array.isArray(value)||required.some(k=>!Object.hasOwn(value,k))||Object.keys(value).some(k=>![...required,...optional].includes(k)))fail(code);return value;}
const page=value=>{const n=value===undefined?50:value;if(!integer(n,1,100))fail('CONVERSATION_CURSOR_INVALID');return n;};
export function normalizeHistoryRequest(route,value){
 if(route==='list'){const v=closed(value,[],['before','limit'],'CONVERSATION_REQUEST_INVALID');let before=null;
  if(v.before!==undefined&&v.before!==null){before=closed(v.before,['createdAt','conversationId'],[],'CONVERSATION_CURSOR_INVALID');if(!uuid(before.conversationId))fail('CONVERSATION_REQUEST_INVALID');if(typeof before.createdAt!=='string'||!Number.isFinite(Date.parse(before.createdAt))||new Date(before.createdAt).toISOString()!==before.createdAt)fail('CONVERSATION_CURSOR_INVALID');}
  return {before,limit:page(v.limit)};
 }
 if(route==='transcript'){const v=closed(value,['conversationId'],['after','limit'],'CONVERSATION_REQUEST_INVALID');if(!uuid(v.conversationId))fail('CONVERSATION_REQUEST_INVALID');const after=v.after===undefined?0:v.after;if(!integer(after,0))fail('CONVERSATION_CURSOR_INVALID');return {conversationId:v.conversationId,after,limit:page(v.limit)};}
 if(route==='nextTurn'){const v=closed(value,['conversationId','sourceRunId'],[],'CONVERSATION_REQUEST_INVALID');if(!uuid(v.conversationId)||!uuid(v.sourceRunId))fail('CONVERSATION_REQUEST_INVALID');return v;}
 fail('INVALID_ROUTE');
}
const order=(a,b)=>a.createdAt<b.createdAt?-1:a.createdAt>b.createdAt?1:a.conversationId<b.conversationId?-1:a.conversationId>b.conversationId?1:0;
function conversation(c){if(c.scopes.some(s=>s.tenantId!==c.owner.tenantId||s.policyRevision!==c.policyRevision))fail('SCOPE_MISMATCH');}
function run(r,c){if(r.binding.tenantId!==c.owner.tenantId||r.binding.actorId!==c.owner.actorId||r.binding.conversationId!==c.conversationId||r.policyRevision!==c.policyRevision||!same(r.scopes,c.scopes))fail('RUN_MISMATCH');}
function target(source,target){if(target.tenantId!==source.tenantId||target.actorId!==source.actorId||target.conversationId!==source.conversationId||['runId','attemptId','workerId'].some(k=>target[k]===source[k])||target.writerFence!==source.writerFence+1)fail('TARGET_MISMATCH');}
export function assertHistoryResponseSemantics(route,request,result){
 if(route==='list'){
  if(result.conversations.length>request.limit)fail('PAGE_MISMATCH');const ids=new Set();let previous;
  for(const c of result.conversations){conversation(c);if(ids.has(c.conversationId)||request.before&&order(c,request.before)>=0||previous&&(order(c,previous)>=0||!same(c.owner,previous.owner)))fail('DISCOVERY_MISMATCH');ids.add(c.conversationId);previous=c;}
  const cursor=result.nextBefore;if(cursor){if(!Number.isFinite(Date.parse(cursor.createdAt))||new Date(cursor.createdAt).toISOString()!==cursor.createdAt||request.before&&order(cursor,request.before)>=0||previous&&order(cursor,previous)>0)fail('CURSOR_MISMATCH');}return result;
 }
 if(route==='nextTurn'){if(result.sourceBinding.conversationId!==request.conversationId||result.sourceBinding.runId!==request.sourceRunId)fail('REQUEST_MISMATCH');target(result.sourceBinding,result.targetBinding);return result;}
 const c=result.conversation;conversation(c);if(c.conversationId!==request.conversationId)fail('REQUEST_MISMATCH');run(result.latestRun,c);
 if(result.latestSequenceBase>=result.lastSequence||request.after>result.lastSequence||result.events.length>request.limit)fail('CURSOR_MISMATCH');
 const turns=new Map(),requests=new Set();let prior;
 for(const t of result.turns){run(t.run,c);const b=t.run.binding,l=t.promptLineage,end=t.sequenceBase+t.lastSequence;
  if(!integer(end,1)||t.sequenceEnd!==null&&t.sequenceEnd!==end||b.writerFence>result.latestRun.binding.writerFence||t.sequenceBase<0||end>result.lastSequence||turns.has(b.runId)||requests.has(t.request.requestId)||prior&&(prior.run.binding.writerFence>=b.writerFence||prior.sequenceBase+prior.lastSequence!==t.sequenceBase))fail('TURN_MISMATCH');
  if(b.runId===result.latestRun.binding.runId){if(!same(t.run,result.latestRun)||t.sequenceBase!==result.latestSequenceBase||end!==result.lastSequence)fail('TURN_MISMATCH');}
  else if(t.sequenceEnd===null||b.writerFence>=result.latestRun.binding.writerFence||end>result.latestSequenceBase)fail('TURN_MISMATCH');
  if(l.kind==='submission'){if(l.logicalRequestId!==t.request.requestId)fail('PROMPT_LINEAGE_MISMATCH');}
  else{const s=l.sourceBinding;if(s.tenantId!==b.tenantId||s.actorId!==b.actorId||s.runId===b.runId||l.sourceRequestId===t.request.requestId)fail('PROMPT_LINEAGE_MISMATCH');
   if(l.kind==='fork'){if(s.conversationId===b.conversationId||b.writerFence!==1||l.logicalRequestId!==t.request.requestId)fail('PROMPT_LINEAGE_MISMATCH');}
   else{if(s.conversationId!==b.conversationId||s.writerFence>=b.writerFence)fail('PROMPT_LINEAGE_MISMATCH');const source=turns.get(s.runId);if(source&&(!same(source.run.binding,s)||source.request.requestId!==l.sourceRequestId||source.promptLineage.logicalRequestId!==l.logicalRequestId||!same({...source.request,requestId:t.request.requestId},t.request)))fail('PROMPT_LINEAGE_MISMATCH');}
  }
  turns.set(b.runId,t);requests.add(t.request.requestId);prior=t;
 }
 let sequence=request.after;const touched=new Set(),eventIds=new Set();
 for(const wrapped of result.events){const e=wrapped.event,t=turns.get(e.binding.runId);if(!t||!same(e.binding,t.run.binding)||!same(e.scopes,t.run.scopes)||wrapped.sequence!==++sequence||wrapped.sequence!==t.sequenceBase+e.sequence||e.sequence<1||e.sequence>t.lastSequence||eventIds.has(e.eventId))fail('EVENT_MISMATCH');
  if(e.type==='source.available'&&e.data.scopes.some(s=>!t.run.scopes.some(parent=>same(s,parent))))fail('SCOPE_MISMATCH');touched.add(t.run.binding.runId);eventIds.add(e.eventId);
 }
 if(touched.size!==turns.size||result.nextSequence!==sequence||result.nextSequence>result.lastSequence||result.hasMore!==(sequence<result.lastSequence)||result.hasMore&&result.events.length!==request.limit)fail('CURSOR_MISMATCH');
 if(result.pendingTurn){const p=result.pendingTurn;if(!same(p.sourceBinding,result.latestRun.binding)||!['completed','failed','cancelled'].includes(result.latestRun.state))fail('TARGET_MISMATCH');target(p.sourceBinding,p.targetBinding);}
 return result;
}
