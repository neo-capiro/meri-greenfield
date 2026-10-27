/** Remaining owner exclusions after the explicit 27 October Wave4 amendment.
 * The historical43-name input stays intact; only eight named authorizations are removed from this guard.
 * The guard covers catalog, original manifests, resolver and SDK surface, without granting runtime access. */
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,realpathSync} from 'node:fs';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import exclusions from '../../../../scripts/scope-ledger/owner-exclusion.json' with {type:'json'};
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {listSkills,selectSkill} from '../../../../packages/skills/index.mjs';
import {BUILTIN_TOOL_NAMES} from '../capabilities/workspace-tools.mjs';
import {WORKSPACE_TOOLS,SUBAGENT_TYPES,assertCapabilityPolicy} from '../capabilities/policy.mjs';
import {createSubagents} from '../capabilities/subagents.mjs';
import {createSdkCapabilities} from '../capabilities/index.mjs';
import {sdkToolName} from '../skills/mcp.mjs';
import {familyReads,DEFERRED_ORIGINALS} from '../reads/availability.mjs';
import {readToolName} from '../reads/tools.mjs';
import {INTENT_ROWS,NOT_INTENTS,intentToolName} from '../intents/catalog.mjs';
import {binding,id} from '../../../control/conversations/test/application-fixture.mjs';
import {plugin,preparedWorkspace} from './capability-fixture.mjs';
const AUTHORIZED=Object.freeze(["get_legiwatch_review", "compare_florida_budget_amounts", "compare_legislative_versions", "preview_legiwatch_relevance", "save_legiwatch_relevance", "apply_legiwatch_suggestion", "get_business_development_brief", "resolve_business_development_source"]);
const LEGACY_TOOLS=Object.freeze(exclusions.groups.flatMap(group=>group.tools).filter(name=>!AUTHORIZED.includes(name)));
const prepared=preparedWorkspace(binding.conversationId);
// The production SDK workspace contract is POSIX; on Windows the same current-drive directory has a rooted slash spelling.
const cwd=process.platform==='win32'?prepared.replace(/^[A-Za-z]:/u,'').replaceAll('\\','/'):prepared;
assert.equal(realpathSync(cwd),realpathSync(prepared));

test('only eight explicit Wave4 authorizations amend the historical43 names',()=>{assert.deepEqual(exclusions.wave4Amendment.authorizedOperations,AUTHORIZED);assert.equal(exclusions.groups.flatMap(group=>group.tools).length,43);assert.equal(LEGACY_TOOLS.length,35);assert.equal(new Set(LEGACY_TOOLS).size,35);});

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
 const generalReads=familyReads().map(readToolName);assert.ok(generalReads.length>0,'the general read surface is scanned');
 const intents=[...INTENT_ROWS.flatMap(r=>[intentToolName(r.tool),r.tool,r.operation.id]),...Object.keys(NOT_INTENTS)];assert.equal(INTENT_ROWS.length,16,'the governed intent surface is scanned');
 const surface=new Set([...BUILTIN_TOOL_NAMES,...WORKSPACE_TOOLS,...SUBAGENT_TYPES,...full.tools,...full.allowedTools,...(full.skills??[]),...Object.keys(full.agents),...Object.values(subagents.agents).flatMap(a=>a.tools),...originalReads,...generalReads,...intents]);
 for(const name of LEGACY_TOOLS){for(const entry of surface){assert.notEqual(entry,name,name);assert.equal(entry.endsWith('__'+name),false,`${entry} exposes ${name}`);assert.equal(entry.endsWith(':'+name),false,`${entry} exposes ${name}`);}}
});

test('the only browser code on this branch (the qualification probe) calls no excluded name; no product browser tool list exists here',()=>{
 const source=readFileSync(new URL('../../qualification/probes/browser.mjs',import.meta.url),'utf8');
 for(const name of LEGACY_TOOLS)assert.equal(new RegExp(`\\b${name}\\b`,'u').test(source),false,name);
});

test('the general read server derives its never-register list from the same35 remaining catalog originals',()=>{
 assert.deepEqual([...DEFERRED_ORIGINALS].sort(),[...LEGACY_TOOLS].sort());
});

test('the governed intent surface never names an excluded tool, including the three direct canonical-memory writes',()=>{
 for(const name of ['confirm_memory','correct_memory','forget_memory'])assert.ok(LEGACY_TOOLS.includes(name),name);
 for(const r of INTENT_ROWS)for(const name of [r.operation.id,r.tool])assert.equal(LEGACY_TOOLS.includes(name),false,name);
});
