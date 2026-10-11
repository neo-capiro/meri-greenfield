// SOURCE-only managed evidence decoding. No clients, filesystem, clocks or CLI.
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { scanJsonKeys } from '../../scripts/sdk-capture/json-records.mjs';
import { FIXTURE as F, fixtureTags, fixtureMachineName, fixtureExecutionName, validateFixtureBinding } from './fixture-volume-binding.mjs';
import { compileFixtureWorkflow } from './fixture-volume-workflow.mjs';

const fail = reason => { throw new Error(`Managed fixture history refused: ${reason}`); };
const hash = raw => createHash('sha256').update(raw).digest('hex');
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x)===Object.prototype;
const exact = (x, keys) => object(x) && Reflect.ownKeys(x).length===keys.length && keys.every(k=>Object.hasOwn(x,k)&&Object.hasOwn(Object.getOwnPropertyDescriptor(x,k),'value'));
const integer = x => Number.isSafeInteger(x);
const id = x => typeof x === 'string' && x.length===21 && /^vol-[0-9a-f]{17}$/.test(x);
const digest = x => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x);
function json(raw, limit = 262144) {
  if (!Buffer.isBuffer(raw) || raw.length === 0 || raw.length > limit) fail('raw byte bounds');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  scanJsonKeys(text);
  const value = JSON.parse(text);
  const finite = v => { if (typeof v === 'number' && !Number.isFinite(v)) fail('nonfinite JSON'); if (v && typeof v === 'object') Object.values(v).forEach(finite); };
  finite(value); return value;
}
function pinned(raw, sha, limit) {
  if (!digest(sha) || !Buffer.isBuffer(raw) || raw.length > limit || hash(raw) !== sha) fail('raw hash binding');
  return json(raw, limit);
}
function timestamp(value) {
  // Explicit API numeric-seconds / CLI canonical ISO profile; neither coerces.
  if (typeof value === 'number' && Number.isFinite(value) && integer(Math.round(value * 1000))) return Math.round(value * 1000);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    const ms = Date.parse(value); if (Number.isFinite(ms) && new Date(ms).toISOString() === value) return ms;
  }
  return fail('timestamp profile');
}
function noTruncation(value) {
  if (!object(value) && !Array.isArray(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (key === 'truncated' && item !== false) fail('truncated history data');
    noTruncation(item);
  }
}
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

/**
 * pins are EXTERNAL owner capture inputs, not proof of origin or authorization.
 * Exact raw Buffers only. No capture adapter/import, mutations or admission.
 */
export function decodeFixtureVolumeHistory(options) {
  if(!exact(options,['binding','pins','definitionRaw','inputRaw','pages']))fail('exact decoder options');
  const { binding, pins, definitionRaw, inputRaw, pages }=options;
  const b = validateFixtureBinding(binding), graph = compileFixtureWorkflow(binding);
  const machine = `arn:aws:states:${F.region}:${F.account}:stateMachine:${fixtureMachineName()}`;
  const execution = `arn:aws:states:${F.region}:${F.account}:execution:${fixtureMachineName()}:${fixtureExecutionName()}`;
  if (!exact(pins, ['sourceCommit','definitionSha256','inputSha256','versionArn','executionArn','roleArn','pages']) ||
      typeof pins.sourceCommit!=='string'||pins.sourceCommit.length!==40||!/^[0-9a-f]{40}$/.test(pins.sourceCommit) || typeof pins.versionArn!=='string'||pins.versionArn.length>256||pins.versionArn.includes('\n')||!new RegExp(`^${machine}:[1-9][0-9]*$`).test(pins.versionArn) ||
      pins.executionArn !== execution || typeof pins.roleArn!=='string'||pins.roleArn.length>2048||pins.roleArn.includes('\n')||!new RegExp(`^arn:aws:iam::${F.account}:role/[A-Za-z0-9+=,.@_/-]+$`).test(pins.roleArn)) fail('external source/execution/version pins');
  const definition = pinned(definitionRaw, pins.definitionSha256, 1048576);
  if (!isDeepStrictEqual(definition, graph)) fail('canonical immutable definition');
  const input = pinned(inputRaw, pins.inputSha256, 4096);
  if (!isDeepStrictEqual(input, { runUuid:F.runUuid, t0Ms:b.t0Ms, createNotAfterMs:b.createNotAfterMs, ownerBindingId:b.ownerBindingId })) fail('original input/run/clock');
  if (!Array.isArray(pages) || pages.length < 1 || pages.length > 32 || !Array.isArray(pins.pages) || pins.pages.length !== pages.length) fail('page inventory bounds');
  const events = [], rawHashes = [], tokens = new Set(); let next, bytes = 0;
  pages.forEach((page, index) => {
    if (!exact(page,['requestRaw','responseRaw']) || !exact(pins.pages[index],['requestSha256','responseSha256'])) fail('page record shape');
    if(!Buffer.isBuffer(page.requestRaw)||!Buffer.isBuffer(page.responseRaw))fail('page raw Buffer boundary');
    bytes += page.requestRaw.length + page.responseRaw.length; if (bytes > 64*1024*1024) fail('aggregate capture bounds');
    const request = pinned(page.requestRaw,pins.pages[index].requestSha256,4096);
    const expected = { executionArn:execution, includeExecutionData:true, reverseOrder:false, maxResults:1000, ...(next === undefined ? {} : {nextToken:next}) };
    if (!isDeepStrictEqual(request,expected)) fail('history request/order/token');
    const response = pinned(page.responseRaw,pins.pages[index].responseSha256,8*1024*1024);
    if (!object(response) || !Array.isArray(response.events) || response.events.length < 1 || response.events.length > 1000 ||
        !Object.keys(response).every(k=>['events','nextToken'].includes(k))) fail('history envelope');
    if (Object.hasOwn(response,'nextToken')) {
      next=response.nextToken;
      if (typeof next !== 'string' || !next.length || next.length>1024 || tokens.has(next) || index===pages.length-1) fail('history incomplete/token');
      tokens.add(next);
    } else { next=undefined; if(index!==pages.length-1) fail('extra history page'); }
    events.push(...response.events); if(events.length>25000) fail('event cap');
    rawHashes.push({...pins.pages[index]});
  });
  let previousTime=b.t0Ms;
  for(let i=0;i<events.length;i++) {
    const ev=events[i]; if(!object(ev)||ev.id!==i+1||!integer(ev.previousEventId)||ev.previousEventId<0||ev.previousEventId>=ev.id) fail('contiguous events/ancestry');
    if(typeof ev.type!=='string')fail('event type');
    const detail=ev.type.endsWith('StateEntered')?'stateEnteredEventDetails':ev.type.endsWith('StateExited')?'stateExitedEventDetails':ev.type[0].toLowerCase()+ev.type.slice(1)+'EventDetails';
    if(!exact(ev,['id','previousEventId','timestamp','type',detail])||!object(ev[detail]))fail('contradictory event detail/envelope');
    const d=ev[detail];
    for(const field of ['input','output'])if(Object.hasOwn(d,field)&&(typeof d[field]!=='string'||!exact(d[field+'Details'],['truncated'])||d[field+'Details'].truncated!==false))fail('missing/truncated execution data evidence');
    const ms=timestamp(ev.timestamp); if(ms<previousTime||ms>b.C) fail('event clock/order/ceiling'); previousTime=ms;
    noTruncation(ev);
    if(ev.type==='ExecutionRedriven'||ev.type==='MapRunRedriven'||ev.type==='EvaluationFailed') fail('redrive/evaluation failure');
  }
  const start=events[0], finish=events.at(-1);
  if(start.type!=='ExecutionStarted'||events.filter(e=>e.type==='ExecutionStarted').length!==1||
      !['ExecutionSucceeded','ExecutionFailed','ExecutionTimedOut','ExecutionAborted'].includes(finish.type)||
      events.slice(0,-1).some(e=>/^Execution(Succeeded|Failed|TimedOut|Aborted)$/.test(e.type))) fail('complete single STANDARD execution');
  const started=start.executionStartedEventDetails;
  if(!object(started)||started.stateMachineVersionArn!==pins.versionArn||started.roleArn!==pins.roleArn||Object.hasOwn(started,'stateMachineAliasArn')||
      typeof started.input!=='string'||hash(Buffer.from(started.input,'utf8'))!==pins.inputSha256||timestamp(start.timestamp)>b.createNotAfterMs) fail('execution start/version/input');

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
      const args=json(Buffer.from(d.parameters??'', 'utf8'));
      pendingTask=false;
      active={state:name, scheduledEventId:ev.id, scheduledAtMs:timestamp(ev.timestamp),parameters:args,parametersSha256:hash(Buffer.from(d.parameters,'utf8')),startedEventId:null};
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
      calls.push({...active,terminalEventId:ev.id,completedAtMs:timestamp(ev.timestamp),outcome:ev.type,
        ...(ev.type==='TaskSucceeded'?{output:json(Buffer.from(d.output??'', 'utf8')),outputSha256:hash(Buffer.from(d.output??'','utf8'))}:{error:{...d}})});active=null;
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
