/** Synthetic native transport for the report's source port: real Core DTOs crossing the actual gateway
 * handlers and the selected-runtime request shape. No provider, backend, SDK, credential or renderer call.
 * The three refusals here are the ones selected-runtime itself performs (saved context, allowed operation,
 * unavailable installation) so the recipe is exercised against the boundary it will really be given. */
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase,readContext} from '../../../../gateway/sources/bill-text/test/fixture.mjs';
import {uuid} from '../../../../gateway/sources/test/read-fixture.mjs';
import {createBillTextHandlers} from '../../../../gateway/sources/bill-text/handler.mjs';
import {storedCase} from '../../../../gateway/sources/federal-legislation/test/fixture.mjs';
import {createFederalLegislationHandlers} from '../../../../gateway/sources/federal-legislation/handler.mjs';
export const NOW=Date.parse('2026-10-13T12:00:00.000Z');
export const REVISION=uuid('a');
export const sha=value=>createHash('sha256').update(value,'utf8').digest('hex');
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const fault=code=>Object.assign(Error(code),{code});
export const noBillNote=billId=>`No bill ${billId} on record in the Capiro database. Say so explicitly — do not describe its status from memory.`;
/** @param saved the canonical selected subject/window of the run, exactly as the caller holds it.
 *  @param bill the report's own congressional subject, i.e. the bill identity the recipe may address. */
export function nativeReportPort({saved,bill,text,maxPage=9000,installed={read_bill_text:true,get_bill_status:true},edit}){
  const billText=billTextCase('read_bill_text',{defaultCongress:bill.congress,request:{billId:bill.billId}});
  // One pinned revision served in real pages: page text is the exact document slice, the pin is the whole.
  billText.state.total=text.length;
  // The cursor carries the lineage, so it must name the same revision and text hash the pages do.
  const encodeCursor=offset=>Buffer.from(JSON.stringify([bill.billId,bill.billVersion,REVISION,sha(text),offset])).toString('base64url');
  billText.state.resultMutator=value=>{
    if(value.currentStatus!=='available')return;
    const {offset,endOffset}=value.coverage.locator;
    value.text=text.slice(offset,endOffset);value.textHash=sha(text);
    value.versionCode=bill.billVersion;value.revisionId=REVISION;
    if(value.coverage.nextCursor!==null)value.coverage.nextCursor=encodeCursor(endOffset);
  };
  const federal=storedCase('get_bill_status',{defaultCongress:bill.congress,request:{billId:bill.billId}});
  const contexts={read_bill_text:{defaultCongress:bill.congress},get_bill_status:{defaultCongress:bill.congress}};
  const handlers=new Map([[billText,createBillTextHandlers({...billText.transport,now:billText.now},[billText.operation])[0]],
    [federal,createFederalLegislationHandlers({...federal.transport,now:federal.now},[federal.operation])[0]]]);
  const byOperation=new Map([...handlers].map(([scene,handler])=>[scene.operation.id,{scene,handler}]));
  const calls=[],receipts=[];
  /** The exact selected-runtime request shape; nothing else is accepted or inferred. */
  async function readSource(call){
    calls.push(call);
    if(!same(call.binding,saved.binding)||!same(call.subject,saved.subject)||!same(call.window,saved.window))throw fault('SKILL_COMPILER_CONTEXT_REFUSED');
    const entry=byOperation.get(call.operation.id);
    if(!entry||!same(call.operation,entry.scene.operation))throw fault('SKILL_OPERATION_REFUSED');
    if(!installed[call.operation.id])throw fault('UNAVAILABLE');
    const normalizationContext=contexts[call.operation.id],contract=resolveOperationContract(call.operation);
    const normalized=contract.normalizeInput(call.request,normalizationContext);
    // The gateway re-normalizes and re-validates the native DTO itself; this port never edits a read.
    // The run's own binding and selection subject are what the gateway admits and echoes back.
    const authority={...readContext(entry.scene.authority),binding:call.binding,subject:saved.subject,
      policyRevision:saved.subject.policyRevision,scopes:saved.subject.scopes};
    const wire=await entry.handler.execute({input:normalized.input,request:call.request,authority,
      argumentsSha256:normalized.argumentsSha256,normalizationContext,...(call.signal===undefined?{}:{signal:call.signal})});
    // selected-runtime hands the compiler the parsed native reply, not the wire bytes.
    const wrapper=JSON.parse(wire);
    edit?.(wrapper,call);
    // The receipts selected-runtime keeps: exactly what the compiler's mirror has to match.
    receipts.push({operation:call.operation,request:call.request,resultSha256:canonicalSha256(wrapper)});
    return wrapper;
  }
  return {readSource,calls,receipts,billText,federal,handlers,wire:()=>[...billText.wire,...federal.wire],
    setPageLength(value){billText.state.total=value;}};
}

