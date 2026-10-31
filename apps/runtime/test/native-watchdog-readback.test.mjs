import test from 'node:test';
import assert from 'node:assert/strict';
import {createManagedWatchdogReadback} from '../native-watchdog-readback.mjs';
const arn='arn:aws:states:us-east-1:967807252336:stateMachine:meri-host-watchdog:7';
const definitionSha256='a'.repeat(64),qualificationEvidenceSha256='b'.repeat(64);
const hostId='0f8fad5b-d9cb-469f-a165-70867728950e',generation=3,t0Ms=1000,deadlineMs=901000;
function raw(over={}){
 return {executionArn:`arn:aws:states:us-east-1:967807252336:execution:meri-host-watchdog:${hostId}-g3`,
  stateMachineArn:arn.replace(/:\d+$/u,''),stateMachineVersionArn:arn,status:'RUNNING',startDate:new Date(t0Ms),
  input:JSON.stringify({schema:'meri-d005-host-watchdog-input/2',hostId,generation,originalT0Ms:t0Ms,
   deadlineMs,definitionSha256,qualificationEvidenceSha256}),...over};
}
const sfn=(value)=>({sdk:{DescribeExecutionCommand:class{constructor(input){this.input=input;}}},
 async send(){if(value instanceof Error)throw value;return value;}});
test('a prearmed exact watchdog execution is read back without starting another',async()=>{
 const readback=createManagedWatchdogReadback({stateMachineVersionArn:arn,definitionSha256,
  qualificationEvidenceSha256,now:()=>t0Ms});
 const out=await readback.verify({stepFunctions:sfn(raw()),hostId,generation,t0Ms,deadlineMs});
 assert.equal(out.armed,true);assert.equal(out.deadlineMs,deadlineMs);
});
test('wrong identity, deadline, version, status or input is refused and never replaced',async()=>{
 for(const value of [raw({stateMachineVersionArn:arn.replace(':7',':8')}),raw({status:'SUCCEEDED'}),
  raw({startDate:new Date(t0Ms+60000)}),Object.assign(Error('gone'),{name:'ExecutionDoesNotExist'}),
  raw({input:JSON.stringify({schema:'meri-d005-host-watchdog-input/2',hostId,generation,originalT0Ms:t0Ms,
   deadlineMs:deadlineMs+1,definitionSha256,qualificationEvidenceSha256})})]){
  const readback=createManagedWatchdogReadback({stateMachineVersionArn:arn,definitionSha256,
   qualificationEvidenceSha256,now:()=>t0Ms});
  await assert.rejects(async()=>readback.verify({stepFunctions:sfn(value),hostId,generation,t0Ms,deadlineMs}));
 }
});
