/** Private proxy-host observation for one guarded native send. No HTTP route or
 * CountTokens client is constructed here. The Python send guard owns the one
 * actual CountTokens call on the final LiteLLM HTTPX bytes.
 */
import {createHash,timingSafeEqual} from 'node:crypto';
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {parseAdmittedGrantSet} from '../budget/admitted-run-binding.mjs';
import {createProductModelReservation} from '../budget/product-model-budget.mjs';
import {same,digest} from '../budget/tool-budget-binding.mjs';
import {refuse} from '../budget/postgres-budget-store.mjs';

const modelId='anthropic.claude-sonnet-4-6';
const profileId='us.anthropic.claude-sonnet-4-6';
const host='bedrock-runtime.us-east-1.amazonaws.com';
const urls=new Set(['invoke','invoke-with-response-stream'].map(s=>`https://${host}/model/${profileId}/${s}`));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const deny=()=>refuse('PRODUCT_PROXY_OBSERVATION_REFUSED');
function bytes(value){if(!Buffer.isBuffer(value)||value.length<1||value.length>4*1024*1024)deny();return value;}
function equalDigest(a,b){digest(a);digest(b);return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));}

export function observeProductProxyRequest(source,selected,pricing,requestId,now){
 const observed=own(source,['requestId','peer','proxyCredential','rawRequestBody','nativeRequest','count']);
 const peer=own(observed.peer,['binding','taskArn','grantId','observedAtMs']);
 const native=own(observed.nativeRequest,['method','url','host','contentType','body','headers']);
 const count=own(observed.count,['inputTokens','nativeBodySha256','modelId','origin']);
 const at=now();
 if(observed.requestId!==requestId||!same(peer.binding,selected.binding)||peer.taskArn!==selected.qualificationBinding.workerArn||peer.grantId!==selected.grantId||!Number.isSafeInteger(at)||!Number.isSafeInteger(peer.observedAtMs)||peer.observedAtMs>at||at-peer.observedAtMs>=30_000)deny();
 if(typeof observed.proxyCredential!=='string'||!/^[!-~]{32,256}$/u.test(observed.proxyCredential)||!equalDigest(sha(Buffer.from(observed.proxyCredential)),selected.capabilitySha256))deny();
 if(native.method!=='POST'||!urls.has(native.url)||native.host!==host||native.contentType!=='application/json'||!Array.isArray(native.headers)||native.headers.length>64)deny();
 const names=new Map();
 for(const item of native.headers){
  if(!Array.isArray(item)||item.length!==2||typeof item[0]!=='string'||typeof item[1]!=='string')deny();
  const name=item[0].toLowerCase();
  if(names.has(name)||name==='content-encoding'||name==='anthropic-beta'||name.startsWith('x-amzn-bedrock-'))deny();
  names.set(name,item[1]);
 }
 if(names.get('host')!==host||names.get('content-type')!=='application/json')deny();
 const nativeBody=bytes(native.body),rawBody=bytes(observed.rawRequestBody),nativeBodySha256=sha(nativeBody);
 let parsed;
 try{parsed=JSON.parse(nativeBody.toString('utf8'));}catch{deny();}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||parsed.anthropic_version!=='bedrock-2023-05-31'||!Array.isArray(parsed.messages)||parsed.messages.length<1||!Number.isSafeInteger(parsed.max_tokens)||parsed.max_tokens<1||parsed.max_tokens>pricing.maxOutputTokens)deny();
 if(count.origin!=='aws-counttokens'||count.modelId!==modelId||count.nativeBodySha256!==nativeBodySha256||!Number.isSafeInteger(count.inputTokens)||count.inputTokens<1||count.inputTokens>pricing.maxInputTokens)deny();
 return {binding:selected.binding,taskArn:peer.taskArn,capabilitySha256:selected.capabilitySha256,nativeBodySha256,rawRequestSha256:sha(rawBody),modelId,profileId,maxOutputTokens:parsed.max_tokens,count:{nativeBodySha256,modelId,inputTokens:count.inputTokens}};
}

/** `observeProxy` must be captured from an authenticated proxy host, not an
 * HTTP body, worker claim, or caller-provided task ARN. It must report the
 * actual direct peer and bearer plus original and final native bytes from one
 * guarded request. Missing host authentication makes this port unmountable.
 */
export function createProductProxyRequestOwner(configuration){
 const c=own(configuration,['pool','allocationJson','grantFactsJsons','modelGrantId','pricing','observeProxy','now','limits']);
 if(typeof c.observeProxy!=='function'||typeof c.now!=='function'||c.pricing?.modelId!==modelId||c.pricing?.profileId!==profileId)deny();
 const {facts}=parseAdmittedGrantSet(c),selected=facts.find(f=>f.grantId===c.modelGrantId);
 if(!selected)deny();
 return Object.freeze({async reserve(value){
  const v=own(value,['requestId','binding','deadlineMs'],['signal']);nativeSignal(v.signal);
  if(!same(v.binding,selected.binding))deny();
  const owner=createProductModelReservation({pool:c.pool,allocationJson:c.allocationJson,grantFactsJsons:c.grantFactsJsons,modelGrantId:c.modelGrantId,pricing:c.pricing,now:c.now,limits:c.limits,
   observe:async request=>observeProductProxyRequest(await c.observeProxy(request),selected,c.pricing,v.requestId,c.now)});
  return owner.reserve(v);
 }});
}
