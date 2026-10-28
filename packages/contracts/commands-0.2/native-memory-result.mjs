/** Shared browser/control correlation only; Core's candidate and decision owners remain authoritative. */
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,HEX=/^[a-f0-9]{64}$/u;
const fail=()=>{throw Error('Native memory result differs from its proposal');};
const instant=value=>{const n=typeof value==='string'?Date.parse(value):NaN;if(!Number.isSafeInteger(n)||new Date(n).toISOString()!==value)fail();return n;};
const closed=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail();return v;};
export function nativeMemoryCandidateFromProposal(p){
 const c=p.command,a=c.arguments,b=c.binding;
 return {schema:'meri.memory-candidate.v1',candidateId:p.proposalId,tenantId:b.tenantId,proposerActorId:b.actorId,kind:'addition',
  content:a.content,key:a.key,scope:a.scope,clientId:a.clientId,ttlDays:a.ttlDays,corrects:null,reason:null,sources:[],
  origin:{kind:'conversation',conversationId:b.conversationId,runId:b.runId,commandId:c.commandId,commandSha256:p.commandSha256},
  idempotencyKey:c.idempotencyKey,createdAt:p.createdAt};
}
export function assertNativeMemoryOutcome(value,p,{candidateSha256,decisionSha256,decision,same}){
 closed(value,['execution','result']);const e=closed(value.execution,['kind','proposalId','commandSha256','idempotencyKey','binding','completedAt','approvalDecisionSha256']),c=p.command;
 const r=closed(value.result,['candidateId','candidateSha256','reviewId','review']),v=closed(r.review,['status','decidedAt','publishedMemoryId','checkedAt']);
 if(c.action!=='memory.propose'||e.kind!=='native-memory'||e.proposalId!==p.proposalId||e.commandSha256!==p.commandSha256||e.idempotencyKey!==c.idempotencyKey||
  !same(e.binding,c.binding)||!HEX.test(e.approvalDecisionSha256)||decisionSha256&&e.approvalDecisionSha256!==decisionSha256||
  r.candidateId!==p.proposalId||r.candidateSha256!==candidateSha256||!UUID.test(r.reviewId))fail();
 const completed=instant(e.completedAt),checked=instant(v.checkedAt);
 if(completed<instant(p.createdAt)||decision&&completed<instant(decision.decidedAt)||checked<completed)fail();
 if(!['pending','approved','rejected','withdrawn','not_found'].includes(v.status))fail();
 if(['pending','not_found'].includes(v.status)){if(v.decidedAt!==null||v.publishedMemoryId!==null)fail();}
 else{
  if(instant(v.decidedAt)<completed||instant(v.decidedAt)>checked)fail();
  if(v.status==='approved'){if(typeof v.publishedMemoryId!=='string'||!/^(clio|item):[a-f0-9-]{36}$/u.test(v.publishedMemoryId)||!UUID.test(v.publishedMemoryId.split(':')[1]))fail();}
  else if(v.publishedMemoryId!==null)fail();
 }
 return value;
}
