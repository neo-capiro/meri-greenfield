/** MG05 compact client context assembly over the existing authorized 0.3.0 source.
 * Source-only until the runner's trusted context/proof input is explicitly extended.
 * Never modifies an initial/continuation request, its UUID, prompt or signed bytes. */
import {createHash} from 'node:crypto';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertAuthorityContextReceipt} from '../../../packages/contracts/action-authority-0.2/validate.mjs';
import {conversationScopeMatches} from '../../../packages/contracts/conversation-scope.mjs';
import {readContext,assertClientEvidenceResult} from '../../gateway/sources/client-evidence/request-context.mjs';
const SECTIONS=Object.freeze(['capabilities','people','facilities','submissionHistory','advocacyMatters','advocacyRecords']);
export const AUTOMATIC_CLIENT_CONTEXT_LIMIT=3;
export const AUTOMATIC_CLIENT_CONTEXT_MAX_BYTES=65536;
const operation=Object.freeze({id:'get_client_context',version:'0.3.0'}),packets=new WeakMap();
const hashBytes=value=>createHash('sha256').update(value,'utf8').digest('hex');
const fail=()=>{throw Error('AUTOMATIC_CLIENT_CONTEXT_REFUSED');};
/** Only this fixed compact summary request is suitable for automatic context. */
export function automaticClientContextRequest(clientId){
 if(typeof clientId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(clientId))fail();
 return Object.freeze({clientId,limit:AUTOMATIC_CLIENT_CONTEXT_LIMIT,representation:'summary'});
}
function authority(receipt,binding,clientId,at){
 const current=assertAuthorityContextReceipt(receipt);
 if(current.principal.tenantId!==binding.tenantId||current.principal.actorId!==binding.actorId||current.conversationId!==binding.conversationId||current.selectedClientId!==clientId||clientId===null||current.checkedAtMs>at||current.expiresAtMs<=at)fail();
 return current;
}
/** Inputs are supplied by trusted composition after the canonical source adapter has run.
 * The existing source result validator enforces source identity, all coverage/cursors,
 * row/source-reference correlation, tenant/client wall and bounded summary semantics. */
export function assembleAutomaticClientContext(raw,now=Date.now){
 const {call,result,contextReceipt}=own(raw,['call','result','contextReceipt']),context=readContext(call,now),at=context.active();
 if(canonicalSha256(context.operation)!==canonicalSha256(operation)||canonicalSha256(context.request)!==canonicalSha256(automaticClientContextRequest(context.input.clientId))||context.input.section!==null||context.input.afterId!==null)fail();
 const {binding,policyRevision,subject}=context.authority;
 if(!conversationScopeMatches(subject.scopes,binding,context.input.clientId,policyRevision))fail();
 const current=authority(contextReceipt,binding,context.input.clientId,at),page=data(assertClientEvidenceResult(result,context,{receivedAtMs:at}));
 const engagement=page.context,samples={};
 for(const name of ['recentActivity','keyStakeholders','openThreads','openTasks'])samples[name]={records:engagement[name].slice(0,AUTOMATIC_CLIENT_CONTEXT_LIMIT),sourceReturned:engagement[name].length,packetReturned:Math.min(engagement[name].length,AUTOMATIC_CLIENT_CONTEXT_LIMIT),omittedFromPacket:engagement[name].length>AUTOMATIC_CLIENT_CONTEXT_LIMIT};
 const value={version:'meri.automatic-client-context.v1',binding,selectedClientId:context.input.clientId,contextRevision:current.contextRevision,policyRevision,
  trust:'external_untrusted',source:{operation,argumentsSha256:context.argumentsSha256,resultSha256:canonicalSha256(page),subject,sourceIds:context.authority.sourceIds,readWindow:page.readWindow,generatedAt:page.generatedAt},
  client:engagement.client,sections:Object.fromEntries(SECTIONS.map(section=>[section,{coverage:page.profileSections[section],records:page.profile[section],sources:page.profileSources[section]}])),
  engagement:{coverage:'recent-only',sourceSummary:engagement.summary,samples},coverageNote:page.coverageNote};
 const packetJson=JSON.stringify(value);if(Buffer.byteLength(packetJson,'utf8')>AUTOMATIC_CLIENT_CONTEXT_MAX_BYTES)fail();
 const packet=Object.freeze({packetJson,packetSha256:hashBytes(packetJson)});
 packets.set(packet,{binding,clientId:context.input.clientId,contextRevision:current.contextRevision,identityRevision:current.identityRevision,assembledAtMs:at,deadlineMs:context.deadlineMs});return packet;
}
/** A later, freshly obtained receipt is required immediately before any model-facing
 * release. A cloned or changed packet cannot reuse the private assembly correlation. */
export function releaseAutomaticClientContext(packet,contextReceipt,now=Date.now){
 const pin=packets.get(packet),at=now();if(!pin||!Number.isSafeInteger(at)||at>=pin.deadlineMs||hashBytes(packet.packetJson)!==packet.packetSha256)fail();
 const current=authority(contextReceipt,pin.binding,pin.clientId,at);
 if(current.checkedAtMs<pin.assembledAtMs||current.contextRevision!==pin.contextRevision||current.identityRevision!==pin.identityRevision)fail();
 return packet;
}
