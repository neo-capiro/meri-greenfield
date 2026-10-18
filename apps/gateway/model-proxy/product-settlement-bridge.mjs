/** Private shape adapter for NativeSettlementTransport's completion callbacks.
 * A Python UsageResult is a claim, not evidence of response provenance. The
 * constructor-captured host must authenticate the original send, reservation,
 * complete native response and EOF independently of the supplied claim.
 * There is no listener, provider client, or readiness change in this module.
 */
import {createHash} from 'node:crypto';
import {isDeepStrictEqual,types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {parseAdmittedGrantSet} from '../budget/admitted-run-binding.mjs';
import {digest,same} from '../budget/tool-budget-binding.mjs';
import {refuse} from '../budget/postgres-budget-store.mjs';
import {createProductModelSettlement} from '../budget/product-model-settlement.mjs';
import {PRODUCT_MAX_INPUT_TOKENS,PRODUCT_MAX_OUTPUT_TOKENS} from './product-envelope.mjs';

const slot=/^[A-Za-z0-9_-]{1,128}$/u;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const deny=()=>refuse('PRODUCT_SETTLEMENT_BRIDGE_REFUSED');
function bytes(value){
 if(!Buffer.isBuffer(value)||types.isProxy(value)||value.length<1||value.length>4*1024*1024)deny();
 return Buffer.from(value);
}
function usage(value,id){
 const v=data(own(value,['status','binding','evidence_sha256','input_tokens','output_tokens','reason','origin']));
 const b=own(v.binding,['request_id','native_body_sha256','raw_request_sha256','pricing_revision','counted_input_tokens','max_output_tokens','allowed_tool_names']);
 if(v.status!=='COMPLETE'||v.origin!=='native-usage-data'||!['COMPLETE_NATIVE_MESSAGE','COMPLETE_NATIVE_STREAM'].includes(v.reason)||b.request_id!==id)deny();
 for(const value of [v.evidence_sha256,b.native_body_sha256,b.raw_request_sha256,b.pricing_revision])digest(value);
 for(const n of [v.input_tokens,v.output_tokens,b.counted_input_tokens,b.max_output_tokens]){
  if(!Number.isSafeInteger(n)||n<0)deny();
 }
 if(b.counted_input_tokens<1||b.counted_input_tokens>PRODUCT_MAX_INPUT_TOKENS||b.max_output_tokens<1||b.max_output_tokens>PRODUCT_MAX_OUTPUT_TOKENS||v.input_tokens!==b.counted_input_tokens||v.output_tokens>b.max_output_tokens)deny();
 if(!Array.isArray(b.allowed_tool_names)||b.allowed_tool_names.length>8||new Set(b.allowed_tool_names).size!==b.allowed_tool_names.length||b.allowed_tool_names.some(x=>typeof x!=='string'||!slot.test(x)))deny();
 return {...v,binding:{...b,allowed_tool_names:[...b.allowed_tool_names].sort()}};
}
function captured(value,id,selected,claim){
 const v=own(value,['reservation','rawRequestBody','nativeRequestBody','completion','usageResult']);
 const receipt=own(v.reservation,['requestId','nativeBodySha256','state']);
 const raw=bytes(v.rawRequestBody),native=bytes(v.nativeRequestBody);
 const nativeBodySha256=sha(native),rawRequestSha256=sha(raw);
 if(receipt.requestId!==id||receipt.state!=='UNKNOWN'||receipt.nativeBodySha256!==nativeBodySha256)deny();
 const observed=usage(v.usageResult,id);
 if(!isDeepStrictEqual(observed,claim)||observed.binding.native_body_sha256!==nativeBodySha256||observed.binding.raw_request_sha256!==rawRequestSha256)deny();
 const completion=data(own(v.completion,['requestId','binding','taskArn','capabilitySha256','nativeBodySha256','rawRequestSha256','modelId','profileId','pricingRevision','evidenceSha256','httpStatus','complete','eof','usage']));
 const tokens=own(completion.usage,['inputTokens','outputTokens']);
 if(completion.requestId!==id||!same(completion.binding,selected.binding)||completion.taskArn!==selected.qualificationBinding.workerArn||completion.capabilitySha256!==selected.capabilitySha256||completion.nativeBodySha256!==nativeBodySha256||completion.rawRequestSha256!==rawRequestSha256||completion.pricingRevision!==observed.binding.pricing_revision||completion.evidenceSha256!==observed.evidence_sha256||completion.httpStatus!==200||completion.complete!==true||completion.eof!==true||tokens.inputTokens!==observed.input_tokens||tokens.outputTokens!==observed.output_tokens)deny();
 digest(completion.capabilitySha256);
 return completion;
}

/** Install for one authenticated send lifetime and its original request ID.
 * `captureAuthenticatedComplete` receives only that ID and the configured
 * binding/grant. It must never derive its answer from the Python argument;
 * it must own the direct peer, reserved request bytes, response bytes, native
 * usage parser, final EOF, and original reservation receipt. The canonical
 * owner then verifies that observation against the historical SQL slot.
 */
export function createProductProxySettlementBridge(configuration){
 const c=own(configuration,['pool','allocationJson','grantFactsJsons','modelGrantId','pricing','requestId','captureAuthenticatedComplete']);
 if(typeof c.captureAuthenticatedComplete!=='function'||typeof c.requestId!=='string'||!slot.test(c.requestId))deny();
 const {facts}=parseAdmittedGrantSet(c),selected=facts.find(f=>f.grantId===c.modelGrantId);
 if(!selected)deny();
 let entered=false;
 const owner=observeComplete=>createProductModelSettlement({pool:c.pool,allocationJson:c.allocationJson,
  grantFactsJsons:c.grantFactsJsons,modelGrantId:c.modelGrantId,pricing:c.pricing,observeComplete});
 return Object.freeze({
  async settleComplete(requestId,claimedUsage){
   if(entered||requestId!==c.requestId)deny();entered=true;
   const claim=usage(claimedUsage,requestId);
   const request=Object.freeze({requestId,binding:selected.binding,grantId:selected.grantId});
   const completion=captured(await c.captureAuthenticatedComplete(request),requestId,selected,claim);
   return owner(async observedRequest=>{
    if(!isDeepStrictEqual(observedRequest,request))deny();
    return completion;
   }).settle({requestId});
  },
  async readOutcome(requestId){
   if(requestId!==c.requestId)deny();
   return owner(async()=>deny()).readOutcome({requestId});
  },
 });
}
