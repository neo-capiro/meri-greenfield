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
 * Everything else (tools, allowedTools, permissionMode, settings, model, maxTurns, maxBudgetUsd, env, MCP servers, hooks,
 * output format, resume/fork fields and the system prompt template) stays in the hashed template, so the one configured
 * sdkOptionsSha256 matches every run of the reviewed workload and refuses any other option. */
import {join} from 'node:path';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {REQUEST_CONTEXT_MARKER,requestContextSuffix} from '../../worker/conversation/request-context.mjs';
import {projectNativeSdkOptions} from './sdk-option-projection.mjs';
import {executionFault} from './execution-broker.mjs';
export {REQUEST_CONTEXT_MARKER,requestContextSuffix};
export const SDK_OPTIONS_TEMPLATE_SCHEMA='meri.sdk-options-template.v1';
export const TEMPLATE_PLACEHOLDERS=Object.freeze({workspace:'[run workspace]',configDirectory:'[run sdk config directory]',window:'[request window]',scopes:'[authorized run scopes]'});
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
/** The run-invariant template of one run's options. Refuses (SDK_OPTIONS_REFUSED) when a per-run value is not this run's value. */
export function projectSdkOptionsTemplate(options,run){
 const r=assertRun(run),p=projectNativeSdkOptions(options);
 if(p.cwd!==r.workspace)refuse();
 const env=p.env;if(!env||env.CLAUDE_CONFIG_DIR!==r.configDirectory)refuse();
 const prompt=p.systemPrompt;if(typeof prompt!=='string')refuse();
 // JSON.stringify never emits a raw newline, so the marker's last occurrence is the activity's suffix.
 const at=prompt.lastIndexOf(REQUEST_CONTEXT_MARKER);if(at<0)refuse();
 let context;try{context=JSON.parse(prompt.slice(at+REQUEST_CONTEXT_MARKER.length));}catch{refuse();}
 if(context===null||typeof context!=='object'||Array.isArray(context)||Object.keys(context).some(k=>!['window','scopes','skill'].includes(k)))refuse();
 if(requestContextSuffix(context)!==prompt.slice(at)||!authorizedScopes(context.scopes,r.authoritySha256))refuse();
 const P=TEMPLATE_PLACEHOLDERS;
 return data({schema:SDK_OPTIONS_TEMPLATE_SCHEMA,options:{...p,cwd:P.workspace,env:{...env,CLAUDE_CONFIG_DIR:P.configDirectory},
  systemPrompt:{template:prompt.slice(0,at),requestContext:{window:P.window,scopes:P.scopes,skill:context.skill??null}}}});
}
export const sdkOptionsTemplateSha256=(options,run)=>hash(projectSdkOptionsTemplate(options,run));
/** The runner gate: this run's options reduce to exactly the configured template. */
export function assertSdkOptions(options,pin){const p=assertSdkOptionsPin(pin);if(sdkOptionsTemplateSha256(options,p.run)!==p.sdkOptionsSha256)refuse();}
