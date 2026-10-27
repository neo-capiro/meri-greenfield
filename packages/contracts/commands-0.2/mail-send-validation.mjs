/** Exact mail intent and receipt correlation. Core alone owns mailbox, files, approval and dispatch. */
const fail=()=>{throw Error('Invalid native mail command');};
const instant=v=>{const n=Date.parse(v);if(!Number.isSafeInteger(n)||new Date(n).toISOString()!==v)fail();return n;};
const address=v=>typeof v==='string'&&v.length<=254&&v===v.trim().toLowerCase()&&/^[a-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/u.test(v);
export function createMailSendValidators({validateShape,canonicalSha256:hash,snapshotOperationData}){
 const same=(a,b)=>hash(a)===hash(b);
 function normalizeMailSendInput(value,options){
  validateShape('MailSendContext',options);const a=snapshotOperationData(value);validateShape('MailSendArguments',a);
  const recipients=[...a.to,...a.cc,...a.bcc];
  if(!address(a.senderEmail)||recipients.some(v=>!address(v))||new Set(recipients).size!==recipients.length||
   !a.subject.trim()||a.subject.length>300||/[\r\n]/u.test(a.subject)||!a.bodyHtml.trim()||a.bodyHtml.length>50000||
   new Set(a.files.map(f=>f.attachmentId)).size!==a.files.length||a.files.some(f=>/[\r\n]/u.test(f.fileName+f.contentType)))fail();
  if(a.mode==='send'){if(a.original!==null)fail();}
  else{if(a.original===null||a.bcc.length)fail();instant(a.original.updatedAt);
   if(a.mode==='forward'?a.original.bodySha256===null:a.original.bodySha256!==null)fail();}
  if(new TextEncoder().encode(JSON.stringify(a)).byteLength>262144)fail();return a;
 }
 function assertMailSendCommand(value,context){
  const c=snapshotOperationData(value);validateShape('MailSendCommand',c);
  normalizeMailSendInput(c.arguments,context);
  if(!same(c.binding,context.binding)||c.scopes.length!==1||c.scopes.some(s=>s.tenantId!==c.binding.tenantId)||
   (c.scopes[0].kind==='client'?c.arguments.clientId!==c.scopes[0].resourceId:
    c.scopes[0].kind!=='private-user'||c.scopes[0].resourceId!==c.binding.actorId))fail();return c;
 }
 function assertMailSendProposal(value,context){
  const p=snapshotOperationData(value);validateShape('MailSendApprovalProposal',p);assertMailSendCommand(p.command,context);
  if(hash(p.command)!==p.commandSha256||instant(p.expiresAt)<=instant(p.createdAt)||
   !same(p.requiredApprover,{tenantId:p.command.binding.tenantId,actorId:p.command.binding.actorId}))fail();return p;
 }
 function assertMailSendResult(value,command,requestKey){
  const r=snapshotOperationData(value);validateShape('MailSendResult',r);assertMailSendCommand(command,{binding:command.binding});
  if(r.requestKey!==requestKey)fail();if(r.state==='failed')return r;
  const a=command.arguments;
  if(r.senderConnectionId!==a.senderConnectionId||r.senderEmail!==a.senderEmail||r.mode!==a.mode||!same(r.original,a.original))fail();return r;
 }
 return Object.freeze({normalizeMailSendInput,assertMailSendCommand,assertMailSendProposal,assertMailSendResult});
}
