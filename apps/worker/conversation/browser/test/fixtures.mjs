/** Scripted browser fixtures: synthetic binding, policies, trusted runtime facts and recording ports. No browser or MCP
 * process is launched. */
import {buildOpenBrowserFragment} from '../fragment.mjs';
import {validateBrowserPolicy} from '../policy.mjs';
import {APPROVAL_RECEIPT_SCHEMA} from '../approval-binding.mjs';
export const binding=Object.freeze({tenantId:'tenant-synthetic-browser',actorId:'actor-synthetic',conversationId:'00000011-b0a1-4000-8000-000000000000',runId:'00000012-b0a1-4000-8000-000000000000',attemptId:'00000013-b0a1-4000-8000-000000000000',workerId:'00000014-b0a1-4000-8000-000000000000',writerFence:1});
export const installation=Object.freeze({nodePath:'/opt/scripted/node',cliPath:'/opt/scripted/@playwright/mcp/cli.js',browsersPath:'/opt/scripted/browsers',version:'0.0.83',egressProxy:'http://127.0.0.1:3128'});
export const sourceScopes=Object.freeze([{tenantId:binding.tenantId,kind:'public',resourceId:'public-web',policyRevision:'policy1'}]);
/** Synthetic destinations standing in for a platform-approved list supplied as trusted configuration (never product content). */
export const APPROVED=Object.freeze(['https://records.example','https://notices.example','https://archive.example']);
/** Enabled policy with two allowlisted synthetic destinations used by the fragment cases. */
export const enabledPolicy=(overrides={})=>({enabled:true,
 tools:['browser_navigate','browser_snapshot','browser_click','browser_take_screenshot'],
 allowedOrigins:APPROVED.slice(0,2),
 timeouts:{actionMs:5000,navigationMs:30000},
 downloads:{enabled:true,formats:['pdf','txt','docx','xlsx','pptx','zip'],maxBytes:4096,maxFiles:2},...overrides});
export function recorders(){
 const receipts=[],ingested=[],approvalRequests=[];
 return {receipts,ingested,approvalRequests,receiptPort:{async record(r){receipts.push(structuredClone(r));}},
  artifactPort:{async ingest(request){ingested.push({...request,bytes:request.bytes.length});return {versionId:`00000099-b0a1-4000-8000-${String(ingested.length).padStart(12,'0')}`,sha256:request.sha256,bytes:request.bytes.length,idempotencyKey:request.idempotencyKey};}},
  approvals:decision=>({async decide(request){approvalRequests.push(structuredClone(request));return approvalReceipt(request,{decision:decision==='approve'?'approved':'rejected'});}})};
}
export const clock=()=>1760486400000;
let receiptSequence=0;
/** A canonical-owner receipt for `request` (scripted: the real owner authenticates, decides and consumes). Each call
 * mints new proposal and consumption ids; `overrides` replace receipt fields, `decision` fields of the decision. */
export function approvalReceipt(request,{decision='approved',approver={tenantId:binding.tenantId,actorId:'approver-synthetic'},receipt={},decisionFields={}}={}){
 const n=String(++receiptSequence).padStart(12,'0'),at=new Date(clock()).toISOString();
 const proposalId=`00000031-b0a1-4000-8000-${n}`;
 return {schema:APPROVAL_RECEIPT_SCHEMA,proposalId,subjectSha256:request.subjectSha256,toolUseId:request.subject.toolUseId,
  decision:{proposalId,commandSha256:request.subjectSha256,decision,decidedAt:at,expiresAt:new Date(clock()+60000).toISOString(),approver,policyRevision:'approval-policy-1',...decisionFields},
  consumption:{consumed:true,consumptionId:`00000032-b0a1-4000-8000-${n}`,consumedAtMs:clock()},...receipt};
}
const T=t=>`mcp__meri_browser__${t}`;
/** Drives the fragment's own hooks: a call's PreToolUse (which registers it with the page tracker) and its
 * PostToolUse (whose response reports `page`). */
export const hookInput=(event,tool,input,id,extra={})=>({hook_event_name:event,session_id:'00000000-0000-4000-8000-0000000000aa',transcript_path:'/x',cwd:'/x',tool_name:T(tool),tool_input:input,tool_use_id:id,...extra});
export async function runHooks(cap,event,tool,input,id,extra){const out=[];for(const m of cap.hooks[event]??[])for(const hook of m.hooks)out.push(await hook(hookInput(event,tool,input,id,extra),id,{signal:new AbortController().signal}));return out;}
export const pageResponse=url=>({content:[{type:'text',text:`### Page state\n- Page URL: ${url}\n- Page Title: synthetic`}]});
/** Navigates (through the hooks) to `url`, then registers interaction call `id` so it starts from that page. */
export async function startFrom(cap,url,tool,input,id){
 const nav=`toolu_nav_${id}`;await runHooks(cap,'PreToolUse','browser_navigate',{url},nav);await runHooks(cap,'PostToolUse','browser_navigate',{url},nav,{tool_response:pageResponse(url)});
 return runHooks(cap,'PreToolUse',tool,input,id);
}
/** The open (activation-gated) fragment, built the way index.mjs would build it once the gate opens. */
export function openFragment({cwd,policy=enabledPolicy(),r=recorders(),approvals,...rest}={}){
 return {r,cap:buildOpenBrowserFragment({binding,cwd,policy:validateBrowserPolicy(policy),installation,sourceScopes,artifacts:r.artifactPort,receipts:r.receiptPort,approvals,now:clock,...rest})};
}
