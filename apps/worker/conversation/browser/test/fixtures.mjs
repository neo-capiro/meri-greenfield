/** Scripted browser fixtures: synthetic binding, policies, trusted runtime facts and recording ports. No browser or MCP
 * process is launched. */
import {buildOpenBrowserFragment} from '../fragment.mjs';
import {validateBrowserPolicy} from '../policy.mjs';
export const binding=Object.freeze({tenantId:'tenant-synthetic-browser',actorId:'actor-synthetic',conversationId:'00000011-b0a1-4000-8000-000000000000',runId:'00000012-b0a1-4000-8000-000000000000',attemptId:'00000013-b0a1-4000-8000-000000000000',workerId:'00000014-b0a1-4000-8000-000000000000',writerFence:1});
export const installation=Object.freeze({nodePath:'/opt/scripted/node',cliPath:'/opt/scripted/@playwright/mcp/cli.js',browsersPath:'/opt/scripted/browsers',version:'0.0.83'});
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
  artifactPort:{async ingest(request){ingested.push({...request,bytes:request.bytes.length});return {versionId:`00000099-b0a1-4000-8000-${String(ingested.length).padStart(12,'0')}`,sha256:request.sha256,bytes:request.bytes.length};}},
  approvals:decision=>({async decide(request){approvalRequests.push(structuredClone(request));return {decision,toolUseId:request.toolUseId,inputDigest:request.inputDigest};}})};
}
export const clock=()=>1760486400000;
/** The open (activation-gated) fragment, built the way index.mjs would build it once the gate opens. */
export function openFragment({cwd,policy=enabledPolicy(),r=recorders(),approvals,...rest}={}){
 return {r,cap:buildOpenBrowserFragment({binding,cwd,policy:validateBrowserPolicy(policy),installation,sourceScopes,artifacts:r.artifactPort,receipts:r.receiptPort,approvals,now:clock,...rest})};
}
