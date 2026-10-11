// Managed fixture Task/ownership reconstruction. No IO, clients or admission.
import { isDeepStrictEqual } from 'node:util';
import { FIXTURE as F, fixtureTags } from './fixture-volume-binding.mjs';
import { decodeFixtureHistoryCapture, decodeFixtureTaskPayload, fixtureHistoryTimestamp as timestamp } from './fixture-volume-history-wire.mjs';

const fail = reason => { throw new Error(`Managed fixture history refused: ${reason}`); };
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x)===Object.prototype;
const exact = (x, keys) => object(x) && Reflect.ownKeys(x).length===keys.length && keys.every(k=>Object.hasOwn(x,k)&&Object.hasOwn(Object.getOwnPropertyDescriptor(x,k),'value'));
const integer = x => Number.isSafeInteger(x);
const id = x => typeof x === 'string' && x.length===21 && /^vol-[0-9a-f]{17}$/.test(x);
function volume(row, b, states) {
  if (!object(row) || !id(row.VolumeId) || !Array.isArray(row.Tags) || row.Tags.length !== 3 ||
      !fixtureTags().every(t => row.Tags.filter(x => object(x) && x.Key === t.Key && x.Value === t.Value).length === 1) ||
      (Object.hasOwn(row, 'OwnerId') && row.OwnerId !== F.account)) fail('volume ownership');
  if(typeof row.CreateTime!=='string')fail('EC2 timestamp wire profile');
  const created = timestamp(row.CreateTime);
  if (created < b.t0Ms || created > b.createNotAfterMs || row.AvailabilityZone !== F.az || row.KmsKeyId !== F.keyArn ||
      row.Size !== 1 || row.VolumeType !== 'gp3' || row.Encrypted !== true || !Array.isArray(row.Attachments) || row.Attachments.length ||
      (Object.hasOwn(row, 'SnapshotId') && row.SnapshotId !== '') || Object.hasOwn(row, 'SourceVolumeId') || !states.includes(row.State)) fail('volume security/window/state');
  return row.VolumeId;
}

/** SOURCE-only managed evidence; owner must separately verify capture origin. */
export function decodeFixtureVolumeHistory(options) {
  const {binding:b,graph,events,execution,rawHashes,pins,terminalAtMs:previousTime}=decodeFixtureHistoryCapture(options);
  const calls=[]; let active=null, lastState=null, createRecord=null, deleteRecord=null,pendingTask=false;
  for(const ev of events.slice(1,-1)) {
    if(ev.type.endsWith('StateEntered')) {
      if(active||pendingTask) fail('overlapping/unresolved task');
      const name=ev.stateEnteredEventDetails?.name, state=graph.States[name];
      if(!state||ev.type!==`${state.Type}StateEntered`) fail('unknown graph state');
      lastState=ev;
      pendingTask=ev.type==='TaskStateEntered';
      if(name==='SourceOnlyRefusal')fail('refusal state cannot precede lifecycle provenance');
      if(name==='RecordCreateAttempt') {if(createRecord)fail('duplicate create attempt');createRecord=ev;}
      if(name==='RecordDeleteAttempt') {if(deleteRecord)fail('duplicate delete attempt');deleteRecord=ev;}
    } else if(ev.type==='TaskScheduled') {
      if(active||!lastState||ev.previousEventId!==lastState.id||lastState.type!=='TaskStateEntered') fail('Task schedule ancestry');
      const name=lastState.stateEnteredEventDetails.name, state=graph.States[name], d=ev.taskScheduledEventDetails;
      if(!object(d)||d.region!==F.region||d.resourceType!=='aws-sdk:ec2'||state.Resource!==`arn:aws:states:::aws-sdk:ec2:${d.resource}`||Object.hasOwn(d,'taskCredentials')||timestamp(ev.timestamp)>=b.C-2000||
          !integer(d.timeoutInSeconds)||d.timeoutInSeconds<1||d.timeoutInSeconds>Math.min(15,Math.floor((b.C-timestamp(ev.timestamp)-1000)/1000))) fail('Task resource/role/deadline');
      const payload=decodeFixtureTaskPayload(d.parameters??''),args=payload.data;
      pendingTask=false;
      active={state:name, scheduledEventId:ev.id, scheduledAtMs:timestamp(ev.timestamp),parameters:args,parametersSha256:payload.sha256,startedEventId:null};
      if(name==='CreateVolume'&&(!createRecord||createRecord.id>=lastState.id||active.scheduledAtMs>b.createNotAfterMs))fail('create attempt ordering/window');
      if(name==='DeleteVolume'&&(!deleteRecord||deleteRecord.id>=lastState.id))fail('delete attempt ordering');
    } else if(ev.type==='TaskStarted') {
      if(!active||active.startedEventId||ev.previousEventId!==active.scheduledEventId)fail('Task start ancestry');
      const d=ev.taskStartedEventDetails;if(d?.resourceType!=='aws-sdk:ec2'||d.resource!==graph.States[active.state].Resource.split(':').at(-1))fail('Task start resource');
      active.startedEventId=ev.id;
    } else if(['TaskSucceeded','TaskFailed','TaskTimedOut','TaskStartFailed','TaskSubmitFailed'].includes(ev.type)) {
      const beforeStart=['TaskStartFailed','TaskSubmitFailed'].includes(ev.type);
      if(!active||beforeStart&&active.startedEventId!==null||!beforeStart&&active.startedEventId===null||ev.previousEventId!==(active.startedEventId??active.scheduledEventId))fail('Task terminal ancestry');
      const key=ev.type[0].toLowerCase()+ev.type.slice(1)+'EventDetails',d=ev[key];
      if(!object(d)||d.resourceType!=='aws-sdk:ec2'||d.resource!==graph.States[active.state].Resource.split(':').at(-1))fail('Task terminal resource');
      const output=ev.type==='TaskSucceeded'?decodeFixtureTaskPayload(d.output??''):null;
      calls.push({...active,terminalEventId:ev.id,completedAtMs:timestamp(ev.timestamp),outcome:ev.type,
        ...(ev.type==='TaskSucceeded'?{output:output.data,outputSha256:output.sha256}:{error:{...d}})});active=null;
    } else if(ev.type.endsWith('StateExited')) {
      if(active||!lastState||ev.stateExitedEventDetails?.name!==lastState.stateEnteredEventDetails.name||ev.type!==lastState.type.replace('Entered','Exited'))fail('state exit association');
    } else fail('unsupported event profile');
  }
  if(active||pendingTask||calls.length>F.maxCalls)fail('unfinished/capped Tasks');
  const creates=calls.filter(c=>c.state==='CreateVolume'),deletes=calls.filter(c=>c.state==='DeleteVolume');
  if(creates.length!==1||deletes.length>1||calls[0]!==creates[0]||!createRecord||Boolean(deleteRecord)!==Boolean(deletes.length))fail('single create/delete attempt');
  if(!isDeepStrictEqual(creates[0].parameters,graph.States.CreateVolume.Arguments))fail('create request');
  let known=null,scan=null,proof=null,direct=null,deleted=false,uncertain=false;
  const retain=x=>{if(!id(x))fail('unknown volume ID');if(known&&known!==x)fail('conflicting volume identity');known=x;};
  if(creates[0].outcome==='TaskSucceeded')retain(creates[0].output.VolumeId);else uncertain=true;
  for(const call of calls.slice(1)) {
    if(call.state==='ListFirst'||call.state==='ListNext') {
      if(deleted)fail('inventory after delete');
      if(call.state==='ListFirst'){scan={pages:0,rows:[],tokens:[],next:undefined,complete:false,eventIds:[]};proof=null;direct=null;}
      if(!scan||scan.complete||call.state==='ListNext'&&scan.next===undefined)fail('inventory chain');
      const expected={...graph.States.ListFirst.Arguments,...(call.state==='ListNext'?{NextToken:scan.next}:{})};
      if(!isDeepStrictEqual(call.parameters,expected)||call.outcome!=='TaskSucceeded')fail('incomplete/failed ownership inventory');
      const out=call.output;if(!object(out)||!Array.isArray(out.Volumes)||out.Volumes.length>F.pageSize||!Object.keys(out).every(k=>['Volumes','NextToken'].includes(k))||JSON.stringify(out).length>F.maxResultChars)fail('inventory result shape');
      for(const row of out.Volumes){const v=volume(row,b,['creating','available']);retain(v);if(scan.rows.some(r=>r.VolumeId===v))fail('duplicate inventory row');scan.rows.push(row);}
      if(++scan.pages>F.maxPages||scan.rows.length>F.maxRows)fail('inventory bounds');
      scan.eventIds.push(call.terminalEventId);
      if(Object.hasOwn(out,'NextToken')) {const token=out.NextToken;if(typeof token!=='string'||!token.length||token.length>F.maxTokenChars||scan.tokens.includes(token))fail('inventory token');scan.tokens.push(token);scan.next=token;}
      else {scan.complete=true;scan.next=undefined;proof=scan.rows.length===1?{eventIds:[...scan.eventIds],volume:{...scan.rows[0]},completedAtMs:call.completedAtMs}:null;}
    } else if(call.state==='DescribeOwned') {
      if(deleted||!proof||!scan?.complete||!isDeepStrictEqual(call.parameters,{VolumeIds:[known]})||call.outcome!=='TaskSucceeded'||!exact(call.output,['Volumes'])||!Array.isArray(call.output.Volumes)||call.output.Volumes.length!==1||JSON.stringify(call.output).length>F.maxResultChars)fail('unknown singleton ownership');
      retain(volume(call.output.Volumes[0],b,['creating','available']));direct={eventId:call.terminalEventId,completedAtMs:call.completedAtMs,volume:call.output.Volumes[0]};
    } else if(call.state==='DeleteVolume') {
      if(deleted||!known||!proof||!direct||direct.volume.State!=='available'||deleteRecord.id<=direct.eventId||timestamp(deleteRecord.timestamp)<direct.completedAtMs||call.scheduledAtMs-direct.completedAtMs>15000||call.scheduledAtMs<direct.completedAtMs||!isDeepStrictEqual(call.parameters,{VolumeId:known}))fail('stale/unknown delete ownership');
      deleted=true;if(call.outcome!=='TaskSucceeded')uncertain=true;
    } else if(call.state==='ReadAbsent') {
      if(!deleted||!isDeepStrictEqual(call.parameters,{VolumeIds:[known]}))fail('unbound absence read');
      if(call.outcome!=='TaskSucceeded')uncertain=true;
      else {if(!exact(call.output,['Volumes'])||!Array.isArray(call.output.Volumes)||call.output.Volumes.length!==1||JSON.stringify(call.output).length>F.maxResultChars)fail('unknown absence evidence');retain(volume(call.output.Volumes[0],b,['available','deleting']));}
    } else fail('unexpected Task');
  }
  if(!known||!proof||!direct)fail('missing complete ownership proof');
  if(!deleted&&previousTime-direct.completedAtMs>15000)fail('stale terminal ownership');
  return {schema:'meri-browser-MANAGED-fixture-history-source/1',provenance:'MANAGED',runtimeAdmitted:false,sourceGuardLiteralFalse:true,
    absenceWireQualified:false,physicalAbsenceProven:false,cleanup:'UNKNOWN',runUuid:F.runUuid,clock:{t0Ms:b.t0Ms,createNotAfterMs:b.createNotAfterMs,C:b.C},
    externallyPinnedSourceCommit:pins.sourceCommit,definitionSha256:pins.definitionSha256,versionArn:pins.versionArn,executionArn:execution,inputSha256:pins.inputSha256,
    rawPages:rawHashes,eventCount:events.length,createAttempt:{recordEventId:createRecord.id,recordAtMs:timestamp(createRecord.timestamp),...creates[0]},volumeId:known,uncertain,
    ownership:{inventory:proof,direct},firstDeleteAttempt:deletes.length?{recordEventId:deleteRecord.id,recordAtMs:timestamp(deleteRecord.timestamp),...deletes[0]}:null,
    errors:calls.filter(c=>c.error).map(c=>({state:c.state,eventId:c.terminalEventId,error:c.error})),
    limitations:['External hashes are owner inputs, not authenticated origin','No actual lifecycle can pass the current literal-false guard','Not a SOURCE9 CLI/STScaller/nonce receipt','No service/runtime/G1 acceptance']};
}
