// @ts-check
/** Per-run wiring of the native question registry into one activity's control pump.
 *
 * The lifecycle pump already claims controls and applies steer/pause; a clarifying answer is a live control too, but its
 * effect is to resolve one suspended `AskUserQuestion` callback rather than to steer or to hold the run. This adapter
 * therefore intercepts only the claimed `answerQuestion` control, hands the answer to the per-run registry, and
 * acknowledges it through the same durable control owner the pump uses. Every other claim is returned untouched, so
 * steer/pause/approval behaviour is exactly the lifecycle owner's.
 *
 * It owns no store and no authority: the registry is the durable pending-question owner and the control service decides
 * whether the ack is allowed. A refused answer (stale, duplicate, expired, malformed) is acknowledged as UNKNOWN, so the
 * control owner's own state machine reports the refusal instead of this adapter inventing a success. The control itself was
 * pinned to this run by the control journal and refused by the pump's envelope check otherwise, so no run or tenant check
 * is repeated here.
 */
/** @param {unknown} runOwner */
const isControlOwner=runOwner=>typeof /** @type {{claimControl?:unknown}} */(runOwner)?.claimControl==='function'&&
 typeof /** @type {{ackControl?:unknown}} */(runOwner)?.ackControl==='function';
/** @param {{runOwner:object,registry:object,binding:object}} input */
export function createQuestionControlDispatch({runOwner,registry,binding}){
 if(!isControlOwner(runOwner)||typeof registry?.deliver!=='function'||!binding)fail('USER_QUESTION_CONFIGURATION');
 /** Claim one control; an answer is delivered here and its ack replaces the pump's apply step. */
 async function claimControl(input){
  const claim=await runOwner.claimControl(input);
  if(claim?.claimed!==true||claim.control?.command?.action!=='answerQuestion')return claim;
  // The real lifecycle claim carries the command digest on the envelope beside the command, never inside it. A claim
  // without that digest is not deliverable here: it stays with the lifecycle owner instead of being half-applied.
  const {commandSha256,command}=claim.control;
  if(typeof commandSha256!=='string'||!/^[a-f0-9]{64}$/u.test(commandSha256))return claim;
  const outcome=await registry.deliver({questionId:command.questionId,answers:command.answers});
  // A delivered answer is only clean once the same bounded control owner has accepted the ack for that exact digest.
  const receipt=await runOwner.ackControl({binding,input:{controlId:command.controlId,commandSha256,outcome:outcome==='ANSWERED'?'APPLIED':'UNKNOWN'},
   ...(input?.signal===undefined?{}:{signal:input.signal})});
  // `claimed:false` is the pump's "already settled, advance the cursor" answer; the durable ack above is the real record.
  return {claimed:false,receipt};
 }
 return Object.freeze({claimControl});
}
/** @param {string} code @returns {never} */
function fail(code){throw Object.assign(Error(code),{code});}
