// Bounded raw managed-history wire/capture validation; no IO or clients.
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { scanJsonKeys } from '../../scripts/sdk-capture/json-records.mjs';
import { FIXTURE as F, fixtureMachineName, fixtureExecutionName, validateFixtureBinding } from './fixture-volume-binding.mjs';
import { compileFixtureWorkflow } from './fixture-volume-workflow.mjs';

const fail = reason => { throw new Error(`Managed fixture history refused: ${reason}`); };
const hash = raw => createHash('sha256').update(raw).digest('hex');
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x)===Object.prototype;
const exact = (x, keys) => object(x) && Reflect.ownKeys(x).length===keys.length && keys.every(k=>Object.hasOwn(x,k)&&Object.hasOwn(Object.getOwnPropertyDescriptor(x,k),'value'));
const integer = x => Number.isSafeInteger(x);
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
export function decodeFixtureHistoryCapture(options) {
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

  return { binding:b, graph, events, execution, rawHashes, pins, terminalAtMs:previousTime };
}

// Native Task data and timestamp profile used only by this fixture decoder.
export function decodeFixtureTaskPayload(raw) {
  const bytes=Buffer.from(raw,'utf8');return {data:json(bytes),sha256:hash(bytes)};
}
export const fixtureHistoryTimestamp = timestamp;
