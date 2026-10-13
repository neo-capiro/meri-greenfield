import {createSdkMcpServer} from '@anthropic-ai/claude-agent-sdk';
import type {Options,SDKResultSuccess} from '@anthropic-ai/claude-agent-sdk';
const mounted:Pick<Options,'mcpServers'|'allowedTools'|'hooks'|'canUseTool'>={
 mcpServers:{meri_original_reads:createSdkMcpServer({name:'meri_original_reads',version:'1.0.0',tools:[]})},
 allowedTools:['mcp__meri_original_reads__query_tasks'],
 hooks:{PreToolUse:[{matcher:'mcp__meri_original_reads__.*',hooks:[async()=>({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny'}})]}]},
 canUseTool:async(_name,input)=>({behavior:'allow',updatedInput:input}),
};
export function literalOutput(result:SDKResultSuccess){return result.structured_output;}
void mounted;
