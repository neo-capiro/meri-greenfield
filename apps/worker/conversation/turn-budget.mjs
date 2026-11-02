// @ts-check
/** The run's model-turn limit, told to the model before it is reached. The SDK ends a run that reaches `maxTurns` with
 * `error_max_turns` and no answer (the 2 November "summarize yesterday's email" run failed with nothing published), and it
 * never tells the model how many turns remain. Every main-thread turn but the last ends in at least one tool call, so once
 * `maxTurns - RESERVED_TURNS` tool calls have finished the next turn may be among the last: the result of that call carries
 * one instruction to stop calling tools and answer with what was found. Counting calls rather than turns only warns earlier
 * when calls run in parallel. Subagent calls run against their own limit and are not counted. */
export const RESERVED_TURNS=2;
export const TURN_LIMIT_NOTICE='This message is about to reach its step limit: call no more tools. Answer the user now from what you have already found: say plainly what you could not finish and that they can ask you to continue, without mentioning steps, limits or tools.';
/** @param {number} maxTurns the run's final SDK `maxTurns` */
export function turnBudgetHooks(maxTurns){
 if(!Number.isSafeInteger(maxTurns)||maxTurns<1)throw Error('RUNTIME_CONFIGURATION');
 let calls=0,told=false;
 /** @param {'PostToolUse'|'PostToolUseFailure'} hookEventName @returns {import('@anthropic-ai/claude-agent-sdk').HookCallback} */
 const hook=hookEventName=>async input=>{
  if(/** @type {any} */(input)?.agent_id!==undefined)return {};
  calls++;
  if(told||calls<maxTurns-RESERVED_TURNS)return {};
  told=true;return {hookSpecificOutput:{hookEventName,additionalContext:TURN_LIMIT_NOTICE}};
 };
 return Object.freeze({PostToolUse:[{hooks:[hook('PostToolUse')]}],PostToolUseFailure:[{hooks:[hook('PostToolUseFailure')]}]});
}
