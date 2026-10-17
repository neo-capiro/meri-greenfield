/** The one derivation of a run's SDK continuation, shared by the runner's SDK options pin (sdk-option-template.mjs) and the launch
 * descriptor match on both sides (preparation-intent.mjs, used by the task-side pre-check and control's preparation authority).
 *
 * A continuation run (the next turn of a conversation, or a lifecycle resume/fork) carries exactly lineageResumeOptions of its lineage
 * (apps/worker/conversation/continuation/options.mjs): resume, optionally resumeSessionAt, and for a fork forkSession + sessionId. A
 * fresh run carries none. Who supplies the lineage differs by side and is never the other side's claim:
 *  - task side: sdkOptionsContinuation over the restoration the runner initialized the task's SDK session mirror with
 *    (checkpoint-session-factory.mjs restoration: the lineage control accepted for runner/runtime and the session key it issued);
 *  - control side: continuation-runtime.mjs resumeOptions over control's own durable saved lineage (next-run journal / lifecycle).
 * continuationLaunchArgs places the matching CLI arguments exactly where the pinned SDK (0.3.295, options.mjs refuses any other)
 * emits them, so a continuation descriptor is the one configured fresh launch template plus exactly these arguments. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {assertSdkSessionKey} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {assertContinuationEnvelope} from '../../../packages/contracts/conversation-lifecycle/validate.mjs';
import {assertContinuationTarget,lineageResumeOptions} from '../../worker/conversation/continuation/options.mjs';
import {assertNextTurnLineage} from '../../worker/conversation/continuation/next-turn-options.mjs';
import {executionFault} from './execution-broker.mjs';
const optionsRefused=()=>{throw executionFault('SDK_OPTIONS_REFUSED');};
const launchRefused=()=>{throw executionFault('PREPARATION_REFUSED');};
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value);
const text=value=>typeof value==='string'&&value.length>0&&value.length<=4096&&!/[\x00-\x1f\x7f]/u.test(value);
/** The SDK continuation option fields, the one fixed set both checks cover. */
export const SDK_CONTINUATION_FIELDS=Object.freeze(['resume','resumeSessionAt','forkSession','sessionId']);
/** The SDK session store key the native owners derive from a run workspace (native-restorer.mjs, session-registration.mjs). */
export const projectKeyOf=workspace=>workspace.replace(/[^a-zA-Z0-9]/gu,'-');
/** A continuation option set exactly as lineageResumeOptions produces it, or null (fresh). Anything else throws `fault`. */
export function assertResumeOptions(value,fault=optionsRefused){
 if(value===null)return null;
 let e;try{e=own(value,['resume'],['resumeSessionAt','forkSession','sessionId']);}catch{fault();}
 if(!uuid(e.resume)||e.resumeSessionAt!==undefined&&!uuid(e.resumeSessionAt)||(e.forkSession===undefined)!==(e.sessionId===undefined)||e.forkSession!==undefined&&(e.forkSession!==true||!uuid(e.sessionId)||e.sessionId===e.resume))fault();
 return Object.freeze(e);
}
/** The exact SDK continuation fields this run may carry, from the restoration its SDK session was initialized with: null for a fresh run
 * (none allowed), else lineageResumeOptions of the verified lineage. `restoration` is {sessionKey, nextTurn?|continuation?} as the runner
 * handed it to the SDK session factory (conversation-runner.mjs prepareRuntime): the lineage is the one control matched to its durable
 * record before issuing the restore receipt and this session key (continuation-runtime.mjs prepare). Here the lineage is re-verified
 * against this run's own binding (target, conversation, tenant/actor, writer fence, checkpoint digest) and the key must be the session
 * the options resume or fork into, under this run's workspace. Anything else refuses (SDK_OPTIONS_REFUSED). */
export function sdkOptionsContinuation(restoration,{binding,workspace}){
 let r;try{r=own(restoration,['sessionKey'],['nextTurn','continuation']);}catch{optionsRefused();}
 if(r.nextTurn===undefined&&r.continuation===undefined)return null;
 if(r.nextTurn!==undefined&&r.continuation!==undefined)optionsRefused();
 let expected;
 try{
  validateShape('RunBinding',binding);if(!text(workspace))optionsRefused();
  if(r.nextTurn!==undefined){const n=assertNextTurnLineage(r.nextTurn,binding);expected=lineageResumeOptions({sessionId:n.checkpoint.sessionId,resumeSessionAt:n.resumeSessionAt,targetSessionId:null});}
  else{const c=assertContinuationEnvelope(r.continuation);assertContinuationTarget(c,binding);expected=lineageResumeOptions({sessionId:c.checkpoint.sessionId,resumeSessionAt:c.resumeSessionAt,targetSessionId:c.mode==='fork'?c.targetSessionId:null});}
  // The SDK session this run writes: the resumed checkpoint session, or a fork's new target session.
  const key=assertSdkSessionKey(r.sessionKey,{main:true});if(key.sessionId!==(expected.sessionId??expected.resume)||key.projectKey!==projectKeyOf(workspace))optionsRefused();
 }catch{optionsRefused();}
 return assertResumeOptions(expected);
}
/** SDK 0.3.295 ProcessTransport argument layout (sdk.mjs initialize): after the fixed stream-json header it pushes, in this order, the
 * flags of BEFORE_RESUME, then `--resume=<id>`, then the flags of BEFORE_FORK (`--mcp-config` as two tokens), then `--fork-session`,
 * `--resume-session-at=<id>`, `--resume-drops-turn=...`, `--session-id=<id>`, then persistence, managed settings, settings and extra args. */
const HEADER=Object.freeze(['--output-format','stream-json','--verbose','--input-format','stream-json']);
const BEFORE_RESUME=new Set(['--thinking','--max-thinking-tokens','--thinking-display','--effort','--max-turns','--max-budget-usd','--task-budget','--model','--agent','--betas','--json-schema','--debug-file','--debug','--permission-prompt-tool','--permission-prompts','--continue']);
const BEFORE_FORK=new Set(['--channels','--allowedTools','--disallowedTools','--tools','--mcp-config','--setting-sources','--strict-mcp-config','--permission-mode','--allow-dangerously-skip-permissions','--fallback-model','--include-hook-events','--include-partial-messages','--session-mirror','--project-config-root','--add-dir','--await-initialize','--plugin-dir','--plugin-dir-no-mcp']);
const BEFORE_SESSION_ID=new Set(['--resume-drops-turn']);
const CONTINUATION_FLAGS=new Set(['--resume','--fork-session','--resume-session-at','--session-id']);
const flagOf=token=>token.startsWith('--')?token.split('=')[0]:null;
function after(args,start,flags){let i=start;while(i<args.length){const flag=flagOf(args[i]);if(flag===null||!flags.has(flag))break;i+=flag==='--mcp-config'&&!args[i].includes('=')?2:1;}return i;}
/** The launch arguments of a run: the configured fresh template's arguments, plus exactly the continuation's CLI arguments where the
 * SDK emits them. A template that already carries a continuation argument, or has no SDK header, refuses (PREPARATION_REFUSED). */
export function continuationLaunchArgs(templateArgs,continuation){
 const e=assertResumeOptions(continuation,launchRefused);
 if(!Array.isArray(templateArgs)||templateArgs.some(a=>typeof a!=='string'||CONTINUATION_FLAGS.has(flagOf(a))))launchRefused();
 if(e===null)return [...templateArgs];
 const h=templateArgs.findIndex((_,i)=>HEADER.every((token,j)=>templateArgs[i+j]===token));if(h<0)launchRefused();
 const r=after(templateArgs,h+HEADER.length,BEFORE_RESUME),f=after(templateArgs,r,BEFORE_FORK),s=after(templateArgs,f,BEFORE_SESSION_ID);
 return [...templateArgs.slice(0,r),`--resume=${e.resume}`,...templateArgs.slice(r,f),...(e.forkSession?['--fork-session']:[]),
  ...(e.resumeSessionAt===undefined?[]:[`--resume-session-at=${e.resumeSessionAt}`]),...templateArgs.slice(f,s),...(e.sessionId===undefined?[]:[`--session-id=${e.sessionId}`]),...templateArgs.slice(s)];
}
