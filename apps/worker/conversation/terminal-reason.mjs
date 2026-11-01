/** The terminal `run.status` reason a failed activity publishes: the specific closed code for a fault this worker can
 * name, `EXECUTION_FAILED` for every other fault. Every value is a member of the public RUN_REASON_CODES vocabulary. */
import {RUN_REASON_CODES} from '../../../packages/contracts/conversation-application/protocol.mjs';
const NAMED=new Map([
 ['SKILL_RUNTIME_REFUSED','SKILL_RUNTIME_REFUSED'],
 ['SKILL_SOURCES_UNAVAILABLE','SKILL_SOURCES_UNAVAILABLE'],
 ['MODEL_TURNS_EXHAUSTED','MODEL_TURNS_EXHAUSTED'],
 ['MODEL_BUDGET_EXHAUSTED','MODEL_BUDGET_EXHAUSTED'],
 ['OUTPUT_LIMIT','OUTPUT_LIMIT'],
]);
for(const code of NAMED.values())if(!RUN_REASON_CODES.includes(code))throw Error('TERMINAL_REASON_CONFIGURATION');
/** @param {unknown} error the activity's first failure @returns {string} */
export const terminalReasonCode=error=>NAMED.get(/** @type {any} */(error)?.code)??'EXECUTION_FAILED';
/** Every fault code this worker names on a terminal status, for the activity's own producers to agree with. */
export const NAMED_FAULT_CODES=Object.freeze([...NAMED.keys()]);
