/** Per-request native owner resolution -> unchanged canonical document application. */
import {types} from 'node:util';
import {own,data,CommandError} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createDocumentApplication} from '../../control/document-application/index.mjs';
import {documentLimits} from '../../control/document-application/current.mjs';
import {requestInfo,jsonBody,errorResponse} from '../../control/document-application/http.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
/** Asset identifiers an immutable spec references. Identification only; the canonical context
 * validation admits the exact asset objects and their scopes, and the owner refuses a foreign one. */
function referencedAssetIds(value){
 const found=[],walk=node=>{
  if(node===null||typeof node!=='object')return;
  if(Object.hasOwn(node,'assetId')){found.push(node.assetId);return;}
  for(const child of Object.values(node))walk(child);
 };
 walk(value);return found;
}
/** The retained-evidence admission the canonical artifact owner requires, bound to the exact pinned facts. */
const admissionFor=(evidenceSha256,assetsSha256)=>context=>hash(context.evidence)===evidenceSha256&&hash(context.assets)===assetsSha256?undefined:1;
/** Both a composed admission and this request's retained admission must admit; either refusal keeps the write refused. */
const chainedAdmission=(composed,retained)=>composed===undefined?retained:context=>{const refused=composed(context);return refused===undefined?retained(context):refused;};
/** Trusted in-process retained revision capability: the immutable parent's stored evidence and asset objects,
 * bound to the exact base version the request revises. Never read from the request or its JSON: only trusted
 * composition calls `handle` with it, the public mount never supplies it, and a mismatch is a refusal. */
function retainedPin(value,intent,body){
 if(value===undefined)return null;
 if(intent!=='revise'||body?.baseVersionId===undefined)fail('ACCESS_DENIED');
 const pin=data(own(value,['baseVersionId','evidence','assets','evidenceSha256']));
 if(typeof pin.baseVersionId!=='string'||pin.baseVersionId!==body.baseVersionId||!Array.isArray(pin.evidence)||!Array.isArray(pin.assets)||
  typeof pin.evidenceSha256!=='string'||hash(pin.evidence)!==pin.evidenceSha256)fail('ACCESS_DENIED');
 const retained=new Set();for(const asset of pin.assets)if(asset&&typeof asset==='object'&&!types.isProxy(asset)&&typeof asset.id==='string')retained.add(asset.id);
 for(const id of referencedAssetIds(body.request))if(!retained.has(id))fail('ACCESS_DENIED');
 return {evidence:pin.evidence,assets:pin.assets,admission:admissionFor(pin.evidenceSha256,hash(pin.assets))};
}
/** The immutable parent's own retained provenance decides: without a trusted owner able to re-present it, the
 * replacement is refused before dispatch rather than silently dropping the parent's evidence or assets. */
async function refuseUnprovenancedReplacement(life,readVersion,baseVersionId){
 let stored;
 try{stored=await life.run(signal=>readVersion(baseVersionId,signal));}catch{return;}   // the canonical owner reports an unreadable base
 const version=stored?.version;
 if(version===null||typeof version!=='object'||types.isProxy(version))return;
 if((Array.isArray(version.evidence)?version.evidence:[]).length>0||referencedAssetIds(stored.spec).length>0)fail('UNAVAILABLE');
}
function method(port,name){if(!port||typeof port!=='object'||types.isProxy(port))fail('ARTIFACT_RUNTIME_CONFIGURATION');const d=Object.getOwnPropertyDescriptor(port,name);
 if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function'||types.isProxy(d.value))fail('ARTIFACT_RUNTIME_CONFIGURATION');const fn=d.value;return (...args)=>Reflect.apply(fn,port,args);}
export function createRuntimeArtifactApplication(configuration){const c=own(configuration,['sessions','now','limits'],['optionsOwner','retention']),limits=data(own(c.limits,['maxRequestMs','maxRequestBytes','maxResponseBytes']));
 if(typeof c.now!=='function'||Object.values(limits).some(n=>!Number.isSafeInteger(n)||n<1)||limits.maxRequestMs>60000||limits.maxRequestBytes>2097152||limits.maxResponseBytes>16777216||c.retention!==undefined&&typeof c.retention?.assertServable!=='function')fail('ARTIFACT_RUNTIME_CONFIGURATION');
 const resolve=c.optionsOwner===undefined?undefined:method(c.optionsOwner,'resolve');
 return Object.freeze({async handle(request,callerOptions={}){let life;const state={};try{const info=requestInfo(request);if(!resolve)fail('UNAVAILABLE');
  const caller=own(callerOptions,[],['deadlineMs','retained']);if(caller.deadlineMs!==undefined&&!Number.isSafeInteger(caller.deadlineMs))fail('ACCESS_DENIED');
  const requestStarted=c.now(),deadlineMs=Math.min(requestStarted+limits.maxRequestMs,caller.deadlineMs??Infinity);life=createOperationLifetime({deadlineMs,now:c.now,signal:info.signal,errorFactory:code=>new CommandError(code)});
  const body=data(await jsonBody(info,limits.maxRequestBytes,life,life.check)),requestSha256=hash({intent:info.intent,body});
  const rawResolved=await life.run(signal=>resolve({credential:info.credential,intent:info.intent,body,requestSha256,deadlineMs,signal}));if(rawResolved===null||rawResolved===undefined)fail('UNAVAILABLE');
  const resolved=own(rawResolved,['documentOptions','recheck']),recheck=method(rawResolved,'recheck');
  // Additive optional facet: the composed document options may carry the native-result discovery port beside the
  // existing nativeFiles port. It is metadata-only and remains optional, so a mount without it is unchanged.
  const options=own(resolved.documentOptions,['sessions','selectedClientId','artifactOptions','now','limits'],['enabled','admitPdf','previewOptions','nativeFiles','nativeResults','federalSource']);if(options.sessions!==c.sessions||options.now!==c.now)fail('ACCESS_DENIED');
  const innerLimits=documentLimits(options.limits),effectiveLimits=Object.fromEntries(Object.keys(limits).map(key=>[key,Math.min(limits[key],innerLimits[key])]));
  const effectiveDeadlineMs=Math.min(deadlineMs,requestStarted+effectiveLimits.maxRequestMs);life.limitDeadline(effectiveDeadlineMs);
  const o=own(options.artifactOptions,['pool','context','validators','authorize','versions','objects','executor','now','ids'],['retention','authorizeOrigin','admitRetainedEvidence','retainedAssetMapWrites']);
  if(o.admitRetainedEvidence!==undefined&&(typeof o.admitRetainedEvidence!=='function'||types.isProxy(o.admitRetainedEvidence)))fail('ARTIFACT_RUNTIME_CONFIGURATION');
  // The composed write activation is the declared `artifacts.retainedAssetMapWrites` forwarded by the product
  // port; a request can never carry it, and with it absent/false the artifact service emits no new asset map.
  if(o.retainedAssetMapWrites!==undefined&&typeof o.retainedAssetMapWrites!=='boolean')fail('ARTIFACT_RUNTIME_CONFIGURATION');
  if(c.retention!==undefined)o.retention=c.retention;
  // The canonical composer and artifact owner already carry `admitRetainedEvidence` for a write context that
  // keeps an earlier run's evidence. Trusted in-process composition supplies the retained parent facts; the
  // public mount supplies none, so an HTTP request can never reach a retained write.
  const retained=retainedPin(caller.retained,info.intent,body);
  o.context=v.context(retained===null?o.context:{...o.context,evidence:retained.evidence,assets:retained.assets});
  if(retained!==null)o.admitRetainedEvidence=chainedAdmission(o.admitRetainedEvidence,retained.admission);
  life.limitDeadline(o.context.deadlineMs);
  // A source-backed parent is only replaced through the trusted retained capability above: a caller that cannot
  // re-present the parent's evidence must not silently replace it with an uncited version. A parent with no
  // retained provenance, and every unreadable base, keep the existing behaviour of the canonical owner.
  if(['revise','federal-publish'].includes(info.intent)&&retained===null&&typeof body.baseVersionId==='string')await refuseUnprovenancedReplacement(life,method(o.versions,'read'),body.baseVersionId);
  const pinned=hash({intent:info.intent,body});
  async function fresh(phase){life.check();if(hash({intent:info.intent,body})!==pinned)fail('ACCESS_DENIED');
   await life.run(signal=>recheck({phase,intent:info.intent,requestSha256,resource:null,signal,deadlineMs:Math.min(o.context.deadlineMs,effectiveDeadlineMs)}));life.check();}
  // Current session checks remain in the document owner. Core is observed at admission and release,
  // never multiplied around every local immutable storage operation.
  const app=createDocumentApplication({...options,limits:effectiveLimits,artifactOptions:o});
  await fresh('admission');const serialized=JSON.stringify(body),headers=new Headers(info.headers);headers.set('content-length',String(Buffer.byteLength(serialized)));
  state.writeStarted=['create','revise','preview-publish','federal-publish','federal-import','federal-approve'].includes(info.intent);state.readStarted=!state.writeStarted;
  const response=await life.run(signal=>app.handle(new Request(info.url,{method:info.method,headers,body:serialized,signal})));if(response.status!==200)return response;state.completed=true;
  await fresh('release');life.check();return response;
 }catch(error){return errorResponse(error,state);}finally{life?.close();}}});
}
