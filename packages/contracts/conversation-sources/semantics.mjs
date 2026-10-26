export const BILL_TEXT_SOURCE_EVENT='source.native-bill-text';
export class BillTextSourceResponseError extends Error{constructor(code){super(code);this.code=code;}}
export const fail=code=>{throw new BillTextSourceResponseError(code);};
/** Source-controlled strings remain inert unless this exact URL check succeeds. */
export function safeSourceLocator(value){
 if(typeof value!=='string'||value.length>4096||/[\u0000-\u0020\u007f\\]/u.test(value))return null;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&url.hostname&&url.href.length<=4096?url.href:null;}catch{return null;}
}
export function assertNativeSourceEventSemantics(event){
 if(event.type!==BILL_TEXT_SOURCE_EVENT)fail('INVALID_SOURCE_EVENT');
 const {page,policyRevision}=event.data,{offset,endOffset,totalCharacters}=page;
 if(event.scopes.some(s=>s.tenantId!==event.binding.tenantId||s.policyRevision!==policyRevision)||offset>endOffset||endOffset>totalCharacters||endOffset-offset>9000||
  page.contentComplete!==(offset===0&&endOffset===totalCharacters)||page.paginationComplete!==(endOffset===totalCharacters)||page.truncated!==(offset>0||endOffset<totalCharacters))fail('INVALID_SOURCE_EVENT');
 return event;
}
export function assertSourceReadSemantics(response,request){
 const event=assertNativeSourceEventSemantics(response.event),page=event.data.page,current=response.current,c=current.coverage;
 if(event.eventId!==request.referenceId||event.binding.conversationId!==request.conversationId||event.binding.runId!==request.runId)fail('SOURCE_REQUEST_MISMATCH');
 if(c.locator.offset!==page.offset||c.locator.endOffset!==page.endOffset||c.totalCharacters!==page.totalCharacters||current.text.length!==page.endOffset-page.offset||
  ['pageComplete','contentComplete','paginationComplete','truncated'].some(k=>c[k]!==page[k])||c.complete!==true)fail('SOURCE_PAGE_MISMATCH');
 if(current.linkStatus==='available'?current.sourceLocator===null||safeSourceLocator(current.sourceLocator)!==current.sourceLocator:current.sourceLocator!==null)fail('UNSAFE_SOURCE_URL');
 return response;
}
