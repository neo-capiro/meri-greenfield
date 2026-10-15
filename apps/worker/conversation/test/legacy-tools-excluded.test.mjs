/** Product-owner exclusion (15 Oct 2026): these 43 legacy Meri tools must never be implemented. Data-driven guard over
 * the catalog, every original skill manifest, the operation resolver and the SDK tool surface this worker can build.
 * The list is copied verbatim from the owner's list; nothing is read from outside the repository at run time. */
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {listSkills,selectSkill} from '../../../../packages/skills/index.mjs';
import {BUILTIN_TOOL_NAMES} from '../capabilities/workspace-tools.mjs';
import {WORKSPACE_TOOLS,SUBAGENT_TYPES,assertCapabilityPolicy} from '../capabilities/policy.mjs';
import {createSubagents} from '../capabilities/subagents.mjs';
import {createSdkCapabilities} from '../capabilities/index.mjs';
import {sdkToolName} from '../skills/mcp.mjs';
import {binding,id} from '../../../control/conversations/test/application-fixture.mjs';
import {plugin,preparedWorkspace} from './capability-fixture.mjs';
const LEGACY_TOOLS=Object.freeze([ "manage_research_portfolio", "get_research_portfolio_analytics", "create_research_portfolio_snapshot", "request_research_portfolio_output", "save_research_portfolio_output_to_client", "watch_research_portfolio", "update_research_portfolio_change_state", "get_research_portfolio_bookmarks", "create_research_portfolio_bookmark", "get_research_portfolio_fit", "get_research_portfolio_reviews", "add_research_portfolio_review_note", "get_research_portfolio_rules", "get_research_portfolio_imports", "get_research_portfolio_operations", "prepare_research_portfolio_brief", "prepare_research_portfolio_meeting", "find_path_to", "get_legiwatch_review", "compare_florida_budget_amounts", "prepare_legiwatch_briefing", "compare_legislative_versions", "save_legislative_research", "preview_legiwatch_relevance", "save_legiwatch_relevance", "apply_legiwatch_suggestion", "create_meeting_brief", "draft_policy_memo", "save_note", "send_email", "reply_email", "confirm_memory", "correct_memory", "forget_memory", "get_pe_buyer_workspace", "create_client", "update_client_profile", "explain_opportunity_match", "compare_funding_opportunities", "build_opportunity_action_plan", "get_business_development_brief", "resolve_business_development_source", "save_business_development_brief"]);
const cwd=preparedWorkspace(binding.conversationId);

test('the exclusion list is the owner\'s 43 distinct names',()=>{assert.equal(LEGACY_TOOLS.length,43);assert.equal(new Set(LEGACY_TOOLS).size,43);});

test('every excluded name is deferred in the catalog originals and absent from catalog operations and aliases',()=>{
 const originals=new Map(catalog.originals.map(o=>[o.id,o])),operationNames=new Set(catalog.operations.flatMap(o=>[o.operation.id,sdkToolName(o.operation),...(o.aliases??[])]));
 for(const name of LEGACY_TOOLS){const row=originals.get(name);assert.ok(row,name);assert.equal(row.disposition,'deferred',name);assert.equal(row.state,'deferred',name);assert.equal(row.replacement,null,name);assert.equal(operationNames.has(name),false,name);}
});

test('no original skill manifest allows an excluded name, and the operation resolver refuses each one',()=>{
 const root=new URL('../../../../packages/skills/originals/',import.meta.url),files=[];
 for(const skill of readdirSync(root))for(const version of readdirSync(new URL(skill+'/',root))){const file=new URL(`${skill}/${version}/manifest.json`,root);if(existsSync(file))files.push(file);}
 assert.ok(files.length>=13,'every packaged original manifest is scanned');
 const allowed=[...files.flatMap(file=>JSON.parse(readFileSync(file,'utf8')).allowedOperations??[]),...listSkills().flatMap(s=>selectSkill(s.skillId,s.skillVersion).manifest.allowedOperations)];
 const allowedNames=new Set(allowed.flatMap(op=>[op.id,sdkToolName(op)]));
 for(const name of LEGACY_TOOLS){assert.equal(allowedNames.has(name),false,name);
  for(const version of ['0.2.0','1.0.0',catalog.catalogVersion])assert.throws(()=>resolveOperationContract({id:name,version}),/Unknown operation contract version/,name+'@'+version);}
});

test('no excluded name can enter the SDK tool surface the worker builds',()=>{
 const attested={available:true,sdk:'0.3.295',cli:'2.1.295',weakerNestedSandbox:false,outerIsolationBoundary:true};
 const full=createSdkCapabilities({subagents:true,auditHooks:true,compactionHooks:true,skillPlugin:true,workspaceTools:true,subagentProgress:true,bash:true},{runOwner:{append:async()=>{}},binding,cwd,now:Date.now,newId:()=>id(1),skillPluginDirectory:plugin,bashSandbox:attested}).options;
 const subagents=createSubagents(assertCapabilityPolicy({subagents:true,workspaceTools:true}),{latch:()=>{}});
 const originalReads=listSkills().flatMap(s=>selectSkill(s.skillId,s.skillVersion).manifest.allowedOperations.map(op=>`mcp__meri_original_reads__${sdkToolName(op)}`));
 const surface=new Set([...BUILTIN_TOOL_NAMES,...WORKSPACE_TOOLS,...SUBAGENT_TYPES,...full.tools,...full.allowedTools,...(full.skills??[]),...Object.keys(full.agents),...Object.values(subagents.agents).flatMap(a=>a.tools),...originalReads]);
 for(const name of LEGACY_TOOLS){for(const entry of surface){assert.notEqual(entry,name,name);assert.equal(entry.endsWith('__'+name),false,`${entry} exposes ${name}`);assert.equal(entry.endsWith(':'+name),false,`${entry} exposes ${name}`);}}
});

test('the only browser code on this branch (the qualification probe) calls no excluded name; no product browser tool list exists here',()=>{
 const source=readFileSync(new URL('../../qualification/probes/browser.mjs',import.meta.url),'utf8');
 for(const name of LEGACY_TOOLS)assert.equal(new RegExp(`\\b${name}\\b`,'u').test(source),false,name);
});
