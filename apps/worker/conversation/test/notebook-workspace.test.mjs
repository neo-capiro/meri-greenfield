/** Notebook cell editing in the conversation workspace: the pinned SDK's native NotebookEdit tool, admitted as a
 * bounded workspace file tool. This module owns admission and confinement only. The SDK refuses Read/Grep/Glob
 * outside the working directory, checks notebook writes against the `Edit(path)` rules (a `NotebookEdit(...)` rule is
 * accepted but never matched), and the permission callback denies every call the rules did not pre-approve. Creating
 * a notebook is `Write` of valid `.ipynb` JSON; NotebookEdit then replaces, inserts or deletes one cell by id and
 * keeps every other cell, its outputs and the notebook metadata intact. Notebook execution is not part of this tool. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createWorkspaceTools,assertWorkspacePermissions,assertWorkspaceRoot,FILE_TOOLS,NOTEBOOK_TOOL,WORKSPACE_PERMISSION_LOCKS} from '../capabilities/workspace-tools.mjs';
/** A resolved run policy supplies the allowlist this module reads; validating that policy stays with `policy.mjs`. */
const policyWith=names=>Object.freeze({workspaceToolNames:Object.freeze([...names])});
const hookOptions={signal:new AbortController().signal};
// The runtime workspace contract is POSIX (the conversation runs in a Linux container), so the rules are exercised
// exactly as the SDK receives them there instead of depending on this host's path style.
const cwd='/workspace/0f7f0b0e-6c1a-4f3a-9d5e-6f2b1c3d4e5f';
const READ_RULE=`Read(/${cwd}/**)`,EDIT_RULE=`Edit(/${cwd}/**)`,notebook=`${cwd}/analysis.ipynb`;
const cell={notebook_path:notebook,cell_id:'c9f1',new_source:'df.head()',cell_type:'code',edit_mode:'replace'};

test('the notebook editor is a write tool: admitting it alone still emits the Edit rules it is checked against',async()=>{
 assert.equal(NOTEBOOK_TOOL,'NotebookEdit');
 assert.ok(FILE_TOOLS.includes(NOTEBOOK_TOOL),'the notebook editor belongs to the bounded native file-tool set');
 const w=createWorkspaceTools(policyWith([NOTEBOOK_TOOL]),{cwd});
 assert.deepEqual(w.tools,[NOTEBOOK_TOOL],'admitted tools are exactly the policy allowlist');
 assert.deepEqual(w.settings.permissions.allow,[READ_RULE,EDIT_RULE],'a cell edit is pre-approved by the Edit path rule');
 assert.deepEqual(w.managedSettings,{permissions:{...WORKSPACE_PERMISSION_LOCKS}},'the policy tier keeps the restrictive locks');
 assert.deepEqual(w.allowedTools,[],'notebook writes are pre-approved by path rule, never by tool name');
 assert.equal(w.hooks,undefined,'no textual notebook path gate is added beside the SDK rules');
 assert.equal(assertWorkspacePermissions(w.settings.permissions,{withRules:true}),w.settings.permissions,'the capability-fragment validator accepts the emitted settings');
 assert.deepEqual(createWorkspaceTools(policyWith(['Read',NOTEBOOK_TOOL]),{cwd}).tools,['Read',NOTEBOOK_TOOL],'the admitted set keeps the canonical tool order');
});

test('only an admitted byte-changing tool emits the Edit rule',()=>{
 for(const readOnly of [[],['Read'],['Read','Glob','Grep']])assert.deepEqual(createWorkspaceTools(policyWith(readOnly),{cwd}).settings.permissions.allow,[READ_RULE],JSON.stringify(readOnly));
 for(const writes of [['Write'],['Edit'],[NOTEBOOK_TOOL],['Read',NOTEBOOK_TOOL]])assert.deepEqual(createWorkspaceTools(policyWith(writes),{cwd}).settings.permissions.allow,[READ_RULE,EDIT_RULE],JSON.stringify(writes));
});

test('the permission callback is never a grant: notebook paths the rules did not pre-approve are denied',async()=>{
 const w=createWorkspaceTools(policyWith([NOTEBOOK_TOOL]),{cwd});
 const denied=[cell,{...cell,notebook_path:`${cwd}/../other-conversation/x.ipynb`},{...cell,notebook_path:'/etc/notebook.ipynb'},{...cell,cell_id:''},{...cell,edit_mode:'overwrite'},{}];
 for(const input of denied)assert.equal((await w.canUseTool(NOTEBOOK_TOOL,input,hookOptions)).behavior,'deny',JSON.stringify(input));
 assert.equal((await w.canUseTool('Read',{file_path:notebook},hookOptions)).behavior,'deny','an inside-workspace call is approved by the SDK rule, never by the callback');
 assert.equal((await w.canUseTool('Write',{file_path:notebook},hookOptions)).behavior,'deny','a tool outside the admitted allowlist gains nothing from the callback');
});

test('a NotebookEdit(...) path rule is refused, so notebook confinement stays on the Edit rules',()=>{
 const locks={...WORKSPACE_PERMISSION_LOCKS};
 assert.throws(()=>assertWorkspacePermissions({...locks,allow:[`NotebookEdit(/${cwd}/**)`]},{withRules:true}),/CAPABILITY_FRAGMENT_REFUSED|INVALID_COMMAND/,'the SDK would accept this rule and never match it');
 assert.doesNotThrow(()=>assertWorkspacePermissions({...locks,allow:[EDIT_RULE]},{withRules:true}));
});

test('the workspace root fence is unchanged for a notebook-capable run',()=>{
 for(const bad of ['workspace/conv','/workspace/conv/','/workspace/../etc','/workspace/(x)','/workspace/*',`${cwd}\0`])assert.throws(()=>createWorkspaceTools(policyWith([NOTEBOOK_TOOL]),{cwd:bad}),/WORKSPACE_ROOT_REFUSED/,JSON.stringify(bad));
 assert.equal(assertWorkspaceRoot(cwd),cwd);
});
