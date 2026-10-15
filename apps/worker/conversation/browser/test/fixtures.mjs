/** Scripted browser fixtures: synthetic binding, enabled policy with fake installation paths, and recording ports. No browser or MCP process is launched. */
export const binding=Object.freeze({tenantId:'tenant-synthetic-browser',actorId:'actor-synthetic',conversationId:'00000011-b0a1-4000-8000-000000000000',runId:'00000012-b0a1-4000-8000-000000000000',attemptId:'00000013-b0a1-4000-8000-000000000000',workerId:'00000014-b0a1-4000-8000-000000000000',writerFence:1});
export const enabledPolicy=(overrides={})=>({enabled:true,
 installation:{nodePath:'/opt/scripted/node',cliPath:'/opt/scripted/@playwright/mcp/cli.js',browsersPath:'/opt/scripted/browsers',version:'0.0.83'},
 tools:['browser_navigate','browser_snapshot','browser_click','browser_take_screenshot'],
 allowedOrigins:['https://www.congress.gov','https://sam.gov'],
 timeouts:{actionMs:5000,navigationMs:30000},
 downloads:{enabled:true,formats:['pdf','txt'],maxBytes:1024,maxFiles:2},
 sourceScopes:[{tenantId:binding.tenantId,kind:'public',resourceId:'public-web',policyRevision:'policy1'}],...overrides});
export function recorders(){
 const receipts=[],ingested=[];
 return {receipts,ingested,receiptPort:{async record(r){receipts.push(structuredClone(r));}},
  artifactPort:{async ingest(request){ingested.push({...request,bytes:request.bytes.length});return {versionId:`00000099-b0a1-4000-8000-00000000000${ingested.length}`,sha256:request.sha256,bytes:request.bytes.length};}}};
}
export const clock=()=>1760486400000;
