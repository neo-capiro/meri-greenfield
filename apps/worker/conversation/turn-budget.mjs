// @ts-check
/** The run's model-turn limit, told to the model before it is reached. The SDK ends a run that reaches `maxTurns` with
 * `error_max_turns` and no answer (the 2 November "summarize yesterday's email" run failed with nothing published), and it
 * never tells the model how many turns remain. Every main-thread turn but the last ends in one batch of tool calls, and the
 * SDK's PostToolBatch hook fires once per batch, before the next model request, however many calls ran in parallel. After
 * the batch that leaves RESERVED_TURNS turns, the next request carries one instruction to stop calling tools and answer with
 * what was found. Subagent batches run against their own limit and are not counted. */
export const RESERVED_TURNS=2;
export const TURN_LIMIT_NOTICE='This message is about to reach its step limit: call no more tools. Answer the user now from what you have already found: say plainly what you could not finish and that they can ask you to continue, without mentioning steps, limits or tools.';
/** @param {number} maxTurns the run's final SDK `maxTurns` */
export function turnBudgetHooks(maxTurns){
 if(!Number.isSafeInteger(maxTurns)||maxTurns<1)throw Error('RUNTIME_CONFIGURATION');
 let batches=0,told=false;
 /** @type {import('@anthropic-ai/claude-agent-sdk').HookCallback} */
 const hook=async input=>{
  if(/** @type {any} */(input)?.agent_id!==undefined)return {};
  batches++;
  if(told||batches<maxTurns-RESERVED_TURNS)return {};
  told=true;return {hookSpecificOutput:{hookEventName:'PostToolBatch',additionalContext:TURN_LIMIT_NOTICE}};
 };
 return Object.freeze({PostToolBatch:[{hooks:[hook]}]});
}
