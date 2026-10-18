/** Run-invariant SDK option template: the one definition of what the runner's options pin (preparationIntent.sdkOptionsSha256,
 * checked by runner-query.mjs) covers, shared by the runner gate, the in-image measurement and the qualification rehearsals.
 *
 * A run's SDK options carry exactly three per-run values (apps/worker/conversation/options.mjs, activity.mjs):
 *  cwd                    the run workspace `/workspace/<conversationId>` (conversation-runner.mjs prepareRuntime: configuration.workspace)
 *  env.CLAUDE_CONFIG_DIR  `<configParentDirectory>/sdk-<runId>` (conversation-runner.mjs sdkConfigurationDirectories; sdkConfigDirectory below)
 *  systemPrompt suffix    the normalized request context {window, scopes, skill} (apps/worker/conversation/request-context.mjs)
 * The template is projectNativeSdkOptions(options) with those three replaced by fixed placeholders, but only after each is
 * verified against the run's control-issued preparation intent and original binding:
 *  cwd === intent.workspace; CLAUDE_CONFIG_DIR === sdkConfigDirectory(intent.configParentDirectory, binding.runId);
 *  the suffix is the exact canonical encoding of {window, scopes, skill}, the scopes are the ones intent.authoritySha256
 *  commits to, and the skill pin stays literal in the template. Only `window` (request data, the same class as the prompt,
 *  which the pin never covers) is not compared to an intent value.
 * A continuation run (the next turn of a conversation, or a lifecycle resume/fork) additionally carries its SDK continuation fields
 * (resume, resumeSessionAt, and for a fork forkSession + sessionId; continuation/options.mjs lineageResumeOptions). They are removed
 * from the template, but only after they equal exactly the set derived from the run's restoration (continuation-pin.mjs
 * sdkOptionsContinuation, the derivation the launch descriptor match shares): the lineage
 * control verified for this run's runtime and the SDK session key control issued with its restore receipt, as the runner handed both to
 * its SDK session factory (checkpoint-session-factory.mjs restoration). A fresh run (no lineage) must carry none of them. So a first
 * and a later turn reduce to the same template.
 * Everything else (tools, allowedTools, permissionMode, settings, model, maxTurns, maxBudgetUsd, env, MCP servers, hooks,
 * output format and the system prompt template) stays in the hashed template, so the one configured
 * sdkOptionsSha256 matches every run of the reviewed workload and refuses any other option.
 *
 * G3, capability-bearing runs (apps/worker/conversation/capabilities/index.mjs fragment and capabilities/mounts.mjs MCP mounts). The
 * fragment repeats two of the run facts above inside data options; both are placed with the same verification, nothing else is:
 *  settings.permissions.allow  exactly `Read(/<workspace>/**)` / `Edit(/<workspace>/**)` (capabilities/workspace-tools.mjs
 *                         workspaceRule) for THIS run's workspace become `Read(/[run workspace]/**)` / `Edit(...)`; any other rule refuses.
 *  plugins[].path         exactly sdkSkillPluginDirectory(<config parent>) (the parent of CLAUDE_CONFIG_DIR, the admitted
 *                         intent.configParentDirectory) becomes TEMPLATE_PLACEHOLDERS.skillPluginDirectory; any other path refuses.
 * The MCP mounts are availability-invariant (always the profile's full tool list), so one profile has one template. */
import {join,dirname} from 'node:path';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {REQUEST_CONTEXT_MARKER,requestContextSuffix} from '../../worker/conversation/request-context.mjs';
import {projectNativeSdkOptions} from './sdk-option-projection.mjs';
import {executionFault} from './execution-broker.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {SDK_CONTINUATION_FIELDS,sdkOptionsContinuation,assertResumeOptions} from './continuation-pin.mjs';
export {SDK_CONTINUATION_FIELDS,sdkOptionsContinuation};
export {REQUEST_CONTEXT_MARKER,requestContextSuffix};
export const SDK_OPTIONS_TEMPLATE_SCHEMA='meri.sdk-options-template.v1';
export const TEMPLATE_PLACEHOLDERS=Object.freeze({workspace:'[run workspace]',configDirectory:'[run sdk config directory]',window:'[request window]',scopes:'[authorized run scopes]',skillPluginDirectory:'[run skill plugin directory]'});
/** The run's read-only skill plugin copy (capabilities/skill-plugin.mjs prepareRunSkillPlugin) under the admitted private SDK configuration
 * parent. Deliberately free of any per-run value: the SDK passes it as the `--plugin-dir-no-mcp` launch argument, which the one measured
 * launch template (preparation-intent.mjs matchPreparedDescriptor) pins byte-exactly for every run. */
export const SKILL_PLUGIN_DIRECTORY_NAME='meri-skill-plugin';
export const sdkSkillPluginDirectory=configParentDirectory=>join(configParentDirectory,SKILL_PLUGIN_DIRECTORY_NAME);
const refuse=()=>{throw executionFault('SDK_OPTIONS_REFUSED');};
const misconfigured=()=>{throw executionFault('SDK_PREPARATION_CONFIGURATION');};
const hexOk=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const text=value=>typeof value==='string'&&value.length>0&&value.length<=4096&&!/[\x00-\x1f\x7f]/u.test(value);
/** The run's private SDK configuration directory under the admitted parent: the same expression as conversation-runner.mjs
 * sdkConfigurationDirectories, which is deliberately not edited because its bytes are the pinned runner entrypoint (runnerSha256).
 * Any divergence fails closed (SDK_OPTIONS_REFUSED); apps/runtime/test/dynamic-sdk-options.test.mjs runs the real function against it. */
export const sdkConfigDirectory=(configParentDirectory,runId)=>join(configParentDirectory,'sdk-'+runId);
/** preparationIntent.authoritySha256 as control computes it (prepared-candidate-config.mjs, prepared-run-bindings.mjs retargetPreparation,
 * checked by prepared-runtime.mjs against the task verifier's receipt). */
export const authorityDigest=({scopes,selectedClientId,policyRevision})=>hash({scopes,selectedClientId,policyRevision});
/** True when `scopes` are exactly the scopes the intent's authority digest commits to (the selected client is one of its client scopes). */
function authorizedScopes(scopes,authoritySha256){
 if(!Array.isArray(scopes)||!scopes.length)return false;
 try{return scopes.some(s=>s!==null&&typeof s==='object'&&!Array.isArray(s)&&s.kind==='client'&&text(s.resourceId)&&typeof s.policyRevision==='string'&&authorityDigest({scopes,selectedClientId:s.resourceId,policyRevision:s.policyRevision})===authoritySha256);}
 catch{return false;}
}
/** The per-run facts a run's options are verified against, from the compiled preparation intent and the original run binding. */
export function sdkOptionsRun(intent,binding){
 let i;try{i=own(intent,['workspace','configParentDirectory','authoritySha256'],['secureStorageDirectory','launchTemplate','executableSha256','imageSha256','runnerSha256','sdkOptionsSha256']);validateShape('RunBinding',binding);}catch{misconfigured();}
 if(!text(i.workspace)||!text(i.configParentDirectory)||!hexOk(i.authoritySha256))misconfigured();
 return Object.freeze({workspace:i.workspace,configDirectory:sdkConfigDirectory(i.configParentDirectory,binding.runId),authoritySha256:i.authoritySha256});
}
const assertRun=value=>{let r;try{r=own(value,['workspace','configDirectory','authoritySha256']);}catch{misconfigured();}if(!text(r.workspace)||!text(r.configDirectory)||!hexOk(r.authoritySha256))misconfigured();return Object.freeze(r);};
/** The runner gate's configuration: the intent's configured template hash and this run's facts. */
export function sdkOptionsPin(intent,binding){if(!hexOk(intent?.sdkOptionsSha256))misconfigured();return Object.freeze({sdkOptionsSha256:intent.sdkOptionsSha256,run:sdkOptionsRun(intent,binding)});}
export function assertSdkOptionsPin(value){let p;try{p=own(value,['sdkOptionsSha256','run']);}catch{misconfigured();}if(!hexOk(p.sdkOptionsSha256))misconfigured();return Object.freeze({sdkOptionsSha256:p.sdkOptionsSha256,run:assertRun(p.run)});}
/** A run's restoration source for the runner gate: this run's binding and the checkpoint session mirror whose factory the runner calls
 * (remote-conversation-runner.mjs passes the same mirror's session to the worker and its factory to the runner). Read at query time. */
export function sdkOptionsRestoration(binding,session){
 let b,read;try{b=data(binding);validateShape('RunBinding',b);read=storageMethod(session,'restoration');}catch{misconfigured();}
 return Object.freeze({binding:b,read});
}
export function assertSdkOptionsRestoration(value){let r;try{r=own(value,['binding','read']);validateShape('RunBinding',r.binding);}catch{misconfigured();}if(typeof r.read!=='function')misconfigured();return Object.freeze(r);}
/** Exactly the expected continuation fields (none for a fresh run), then the options without them. */
function withoutContinuation(p,expected){
 const e=assertResumeOptions(expected);
 for(const k of SDK_CONTINUATION_FIELDS)if(e!==null&&Object.hasOwn(e,k)?!Object.hasOwn(p,k)||p[k]!==e[k]:Object.hasOwn(p,k))refuse();
 return Object.fromEntries(Object.entries(p).filter(([k])=>!SDK_CONTINUATION_FIELDS.includes(k)));
}
/** The run-invariant template of one run's options. Refuses (SDK_OPTIONS_REFUSED) when a per-run value is not this run's value.
 * `continuation` is sdkOptionsContinuation's result for this run (null: a fresh run, which must carry no continuation field). */
export function projectSdkOptionsTemplate(options,run,continuation=null){
 const r=assertRun(run),p=withoutContinuation(projectNativeSdkOptions(options),continuation);
 if(p.cwd!==r.workspace)refuse();
 const env=p.env;if(!env||env.CLAUDE_CONFIG_DIR!==r.configDirectory)refuse();
 const prompt=p.systemPrompt;if(typeof prompt!=='string')refuse();
 // JSON.stringify never emits a raw newline, so the marker's last occurrence is the activity's suffix.
 const at=prompt.lastIndexOf(REQUEST_CONTEXT_MARKER);if(at<0)refuse();
 let context;try{context=JSON.parse(prompt.slice(at+REQUEST_CONTEXT_MARKER.length));}catch{refuse();}
 if(context===null||typeof context!=='object'||Array.isArray(context)||Object.keys(context).some(k=>!['window','scopes','skill'].includes(k)))refuse();
 if(requestContextSuffix(context)!==prompt.slice(at)||!authorizedScopes(context.scopes,r.authoritySha256))refuse();
 const P=TEMPLATE_PLACEHOLDERS;
 return data({schema:SDK_OPTIONS_TEMPLATE_SCHEMA,options:{...p,...placeCapabilityFacts(p,r),cwd:P.workspace,env:{...env,CLAUDE_CONFIG_DIR:P.configDirectory},
  systemPrompt:{template:prompt.slice(0,at),requestContext:{window:P.window,scopes:P.scopes,skill:context.skill??null}}}});
}
/** The capability fragment's copies of the run facts (see the module comment), verified and placed; absent keys stay absent. */
function placeCapabilityFacts(p,r){
 const P=TEMPLATE_PLACEHOLDERS,placed={};
 if(Object.hasOwn(p,'plugins')){const expected=sdkSkillPluginDirectory(dirname(r.configDirectory));if(p.plugins.some(plugin=>plugin.path!==expected))refuse();placed.plugins=p.plugins.map(plugin=>({...plugin,path:P.skillPluginDirectory}));}
 const permissions=p.settings!==null&&typeof p.settings==='object'?p.settings.permissions:undefined;
 if(permissions!==null&&typeof permissions==='object'&&Object.hasOwn(permissions,'allow')){
  if(!Array.isArray(permissions.allow))refuse();
  const rule=value=>{for(const tool of ['Read','Edit'])if(value===`${tool}(/${r.workspace}/**)`)return `${tool}(/${P.workspace}/**)`;return refuse();};
  placed.settings={...p.settings,permissions:{...permissions,allow:permissions.allow.map(rule)}};
 }
 return placed;
}
export const sdkOptionsTemplateSha256=(options,run,continuation=null)=>hash(projectSdkOptionsTemplate(options,run,continuation));
/** The runner gate: this run's options reduce to exactly the configured template. Without a restoration source the run is fresh; with
 * one, its continuation fields must be exactly those of the restoration read now (after the runner initialized the SDK session). */
export function assertSdkOptions(options,pin,restoration){
 const p=assertSdkOptionsPin(pin);let continuation=null;
 if(restoration!==undefined){const s=assertSdkOptionsRestoration(restoration);let raw;try{raw=s.read();}catch{refuse();}continuation=sdkOptionsContinuation(raw,{binding:s.binding,workspace:p.run.workspace});}
 if(sdkOptionsTemplateSha256(options,p.run,continuation)!==p.sdkOptionsSha256)refuse();
}
