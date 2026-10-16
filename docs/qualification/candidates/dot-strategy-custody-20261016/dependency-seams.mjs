// Author SYNTHETIC controls: public Ajv/Run/Checkpoint validators and canonicalize imports are substituted.
// This finite sorted JSON hash matches these closed ASCII-key fixtures; it does not qualify installed JCS/schema bytes.
import {mock} from 'node:test';import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
const json=v=>Array.isArray(v)?'['+v.map(json).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+json(v[k])).join(',')+'}':JSON.stringify(v);
export const hash=v=>createHash('sha256').update(json(v),'utf8').digest('hex');
mock.module(new URL('../../../../packages/contracts/validate.mjs',import.meta.url).href,{namedExports:{canonicalSha256:hash,validateShape:(_name,v)=>v,assertWorkspacePaths:()=>{}}});
registerHooks({resolve(specifier,context,next){if(specifier==='@capiro/meri-contracts/node')return {url:new URL('../../../../packages/contracts/validate.mjs',import.meta.url).href,shortCircuit:true};if(specifier==='@anthropic-ai/claude-agent-sdk')return {url:new URL('./sdk-seam.mjs',import.meta.url).href,shortCircuit:true};return next(specifier,context);}});
mock.module(new URL('../../../../packages/contracts/retrieval-0.2/validate.mjs',import.meta.url).href,{namedExports:{artifactValidators:{hash},validateShape:(_name,v)=>v,assertSkillManifest:()=>{}}});
mock.module(new URL('../../../../packages/contracts/conversation-lifecycle/shape.mjs',import.meta.url).href,{namedExports:{assertLifecycleShape:(_name,v)=>v}});
// This batch covers original runs, not resume/fork DTO compilation or a plugin filesystem installation.
mock.module(new URL('../../../../apps/worker/conversation/continuation/options.mjs',import.meta.url).href,{namedExports:{buildContinuationOptions:()=>{throw Error('SYNTHETIC_CONTINUATION_UNAVAILABLE');},continuationContextSha256:(request,scopes)=>hash({window:request.window,skill:request.skill,scopes})}});
mock.module(new URL('../../../../apps/worker/conversation/continuation/next-turn-options.mjs',import.meta.url).href,{namedExports:{buildNextTurnOptions:()=>{throw Error('SYNTHETIC_NEXT_TURN_UNAVAILABLE');}}});
mock.module(new URL('../../../../apps/worker/conversation/capabilities/skill-plugin.mjs',import.meta.url).href,{namedExports:{assertSkillPluginDirectory:()=>{throw Error('SYNTHETIC_PLUGIN_UNAVAILABLE');}}});
// Physical capture tests provide scripted opaque SessionStore bytes, not an installed SDK/session snapshot proof.
mock.module(new URL('../../../../apps/runtime/native-authority/checkpoint-snapshot.mjs',import.meta.url).href,{namedExports:{createCheckpointSdkSnapshot:async({key,transcripts})=>({key,transcripts:()=>structuredClone(transcripts)})}});
