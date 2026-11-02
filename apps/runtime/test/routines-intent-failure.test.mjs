/** The closed intent failure a failed SDK schedule preparation reports (`routines-intents.mjs`): the owner's own constant decides
 * the code and travels as the bounded detail, so a conversation journal row says what refused instead of a bare REFUSED. */
import test from 'node:test';import assert from 'node:assert/strict';
import {routineIntentFailure} from '../routines-intents.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
const failure=(code,extra={})=>Object.assign(Error(String(code)),{...(code===undefined?{}:{code}),...extra});
const shape=error=>({code:error.code,effect:error.effect,...(Object.hasOwn(error,'detail')?{detail:error.detail}:{}),...(Object.hasOwn(error,'reason')?{reason:error.reason}:{})});

test('session and context refusals map by their own constant: plain words as the detail, the constant as the reason; nothing was dispatched',()=>{
 assert.deepEqual(shape(routineIntentFailure(failure('SESSION_UNAVAILABLE'))),{code:'UNAVAILABLE',effect:'none',detail:'no live session or schedule service answered for this run',reason:'SESSION_UNAVAILABLE'});
 assert.deepEqual(shape(routineIntentFailure(failure('SESSION_AUTHORITY_UNAVAILABLE'))),{code:'UNAVAILABLE',effect:'none',detail:'no live session or schedule service answered for this run',reason:'SESSION_AUTHORITY_UNAVAILABLE'});
 assert.deepEqual(shape(routineIntentFailure(failure('ROUTINES_UNAVAILABLE'))),{code:'UNAVAILABLE',effect:'none',detail:'no live session or schedule service answered for this run',reason:'ROUTINES_UNAVAILABLE'});
 assert.deepEqual(shape(routineIntentFailure(failure('ROUTINES_INVALID_REQUEST'))),{code:'INVALID_ARGUMENTS',effect:'none',detail:'the schedule request is not a canonical request',reason:'ROUTINES_INVALID_REQUEST'});
 assert.deepEqual(shape(routineIntentFailure(failure('ROUTINES_ACCESS_DENIED'))),{code:'ACCESS_DENIED',effect:'none',detail:'current access does not allow this schedule request',reason:'ROUTINES_ACCESS_DENIED'});
 assert.deepEqual(shape(routineIntentFailure(failure('ROUTINES_STALE'))),{code:'REFUSED',effect:'none',detail:'the schedule service refused the request as it stands',reason:'ROUTINES_STALE'});
 assert.deepEqual(shape(routineIntentFailure(failure('SESSION_REFUSED'))),{code:'REFUSED',effect:'none',detail:'the schedule service refused the request as it stands',reason:'SESSION_REFUSED'});
});

test('the service\'s own closed answer passes through with its detail; an unknown outcome stays unknown and carries none',()=>{
 assert.deepEqual(shape(routineIntentFailure(failure('DEADLINE'))),{code:'DEADLINE',effect:'none'});
 assert.deepEqual(shape(routineIntentFailure(failure('CANCELLED'))),{code:'CANCELLED',effect:'none'});
 assert.deepEqual(shape(routineIntentFailure(intentFault('INVALID_ARGUMENTS','none',"data must have required property 'cadence'"))),{code:'INVALID_ARGUMENTS',effect:'none',detail:"data must have required property 'cadence'"});
 assert.deepEqual(shape(routineIntentFailure(failure('INVALID_ARGUMENTS',{detail:"data must have required property 'cadence'"}))),{code:'INVALID_ARGUMENTS',effect:'none'},'a plain error\'s detail never travels');
 assert.deepEqual(shape(routineIntentFailure(failure('CONFLICT'))),{code:'CONFLICT',effect:'none'});
 assert.deepEqual(shape(routineIntentFailure(failure('UNKNOWN',{detail:'dropped'}))),{code:'UNKNOWN',effect:'unknown'});
 assert.deepEqual(shape(routineIntentFailure(failure('ROUTINES_UNKNOWN'))),{code:'UNKNOWN',effect:'unknown',reason:'ROUTINES_UNKNOWN'});
 // A service answer that is already an intent fault keeps its own words and reason; a plain error's `reason` or `detail` never travels.
 assert.deepEqual(shape(routineIntentFailure(intentFault('REFUSED','none','the schedule changed while preparing','ROUTINES_STALE'))),{code:'REFUSED',effect:'none',detail:'the schedule changed while preparing',reason:'ROUTINES_STALE'});
 assert.deepEqual(shape(routineIntentFailure(failure('REFUSED',{reason:'ROUTINES_STALE',detail:'core.internal.example'}))),{code:'REFUSED',effect:'none'});
});

test('anything without an owned constant is a plain REFUSED: no message, stack or foreign value ever becomes the detail',()=>{
 for(const error of [failure(undefined),Error('socket hang up'),failure('lower_case'),failure(7),failure('X'.repeat(64)),failure({code:'REFUSED'}),null,undefined,'REFUSED'])
  assert.deepEqual(shape(routineIntentFailure(error)),{code:'REFUSED',effect:'none'},String(error));
 const proxied=new Proxy(Error('x'),{get(){throw Error('trap');}});assert.deepEqual(shape(routineIntentFailure(proxied)),{code:'REFUSED',effect:'none'});
});
