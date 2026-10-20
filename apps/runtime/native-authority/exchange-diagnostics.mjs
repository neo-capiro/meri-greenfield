/** One bounded exchange's boundary record: fixed vocabulary only, written once as a JSON event line.
 * The first failure (phase, category) is kept; cleanup is appended separately. Nothing from requests,
 * credentials, bodies or peer errors is recorded. Each exchange owns its record; nothing is shared.
 * certainty: before-effect (refused before the side-effect boundary), effect-uncertain (inside it, no
 * answer), effect-answered (the downstream owner answered). It describes this exchange only. */
const categories=new Set(['DEADLINE','CANCELLED','REFUSED','DOWNSTREAM_REFUSED']);
const correlation=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value)?value.slice(0,16):null;
export const writeEventLine=line=>{process.stderr.write(line);};
export function createExchangeRecord({event,boundary,effectPhase,now,report=writeEventLine}){
 const began=now();let phase='request',operation=null,executionKey,first,effect=false,answered=false,finished=false;
 return Object.freeze({
  phase(name){phase=name;if(name===effectPhase)effect=true;},
  /** Called only with an operation name the boundary has already validated against its fixed set. */
  operation(name){operation=name;},
  bind(original){executionKey=original?.executionKey;},
  answered(){answered=true;},
  /** Keep only the first failure; a lifetime code recorded when it fires wins over the later generic refusal. */
  fail(category){if(!first&&!finished)first={phase,category:categories.has(category)?category:'REFUSED'};},
  finish({outcome,remainingMs,cleanup='none'}){
   if(finished)return;finished=true;
   const record={event,boundary,operation,correlation:correlation(executionKey),outcome,
    phase:first?.phase??phase,category:first?.category??null,elapsedMs:Math.max(0,now()-began),
    remainingMs:Number.isSafeInteger(remainingMs)?Math.max(0,remainingMs):null,
    certainty:!effect?'before-effect':answered?'effect-answered':'effect-uncertain',cleanup};
   try{report(JSON.stringify(record)+'\n');}catch{}
  },
 });
}
