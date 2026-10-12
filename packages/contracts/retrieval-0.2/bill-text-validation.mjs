// Stored congressional metadata and current-evidence text projections only.
import {snapshotOperationData} from './operation-contracts.mjs';
import {resolveCongressionalBillId} from './congressional-identity.mjs';
import {decodeBillTextCursor,assertBillTextCursor} from './bill-text-cursor.mjs';
const fail=message=>{throw new Error(message);};
export const BILL_TEXT_OPERATION_IDS=Object.freeze(['search_congress_bills','read_bill_text']);
const [SEARCH,READ]=BILL_TEXT_OPERATION_IDS;
const stems=new Map([[SEARCH,'CongressBillSearch'],[READ,'BillTextRead']]);
const sequentialNote='This is exact bill-version text from the current federal evidence owner. It is not amendment text or bill status.';
const locatorNotes=['No exact match for these words in this bill version. Try other wording or a shorter phrase before concluding the bill does not address the topic.','Excerpts of the exact bill-version text that match the query, best first by section order. Read on from a passage with read_bill_text and its readCursor before relying on surrounding context.'];
function instant(value,date=false){if(value===null)return;const at=typeof value==='string'?Date.parse(value):NaN;if(!Number.isFinite(at)||new Date(at).toISOString()!==value||date&&!value.endsWith('T00:00:00.000Z'))fail('Bill-text canonical date required');return at;}
const text=(value,cap)=>typeof value==='string'?(value.trim().slice(0,cap)||null):null;
function unique(rows,key){if(new Set(rows.map(row=>row[key])).size!==rows.length)fail('Duplicate bill-text identity');}
export function createBillTextValidators({validateShape,schema}){
 if(typeof validateShape!=='function'||!schema?.$defs)fail('Bill-text validator configuration');
 const definitions=new Set(Object.keys(schema.$defs));
 function billTextInputDefinition(id){if(!stems.has(id))fail('Unknown bill-text operation');return stems.get(id)+'Input';}
 function billTextOutputDefinition(id){billTextInputDefinition(id);return stems.get(id)+'Output';}
 function validateBillTextShape(definition,value){if(!definitions.has(definition))fail('Unknown bill-text definition');validateShape(definition,snapshotOperationData(value));return value;}
 function normalizeBillTextInput(id,request,context={}){
  const input=snapshotOperationData(request),trusted=snapshotOperationData(context);validateBillTextShape('BillTextContext',trusted);validateBillTextShape(billTextInputDefinition(id),input);
  let directBillId=null,continuation=null;
  if(id===SEARCH){
   const query=text(input.query,240)??text(input.search,240);delete input.query;delete input.search;if(query!==null)input.query=query;
   for(const [key,cap] of [['policyArea',120],['activeSince',30],['textQuery',300]]){const value=text(input[key],cap);delete input[key];if(value!==null)input[key]=value;}
   if(input.congress===0||input.congress===null)delete input.congress;
   input.page??=1;input.limit=input.textQuery?Math.min(input.limit??8,10):input.limit??20;
   if(!input.textQuery)directBillId=resolveCongressionalBillId(query,trusted.defaultCongress);
  }else{
   const billId=resolveCongressionalBillId(text(input.billId,60),trusted.defaultCongress);if(!billId)fail('Exact bill selector required');input.billId=billId;
   for(const [key,cap] of [['versionCode',32],['query',300]]){const value=text(input[key],cap);delete input[key];if(value!==null)input[key]=value;}
   if(input.query&&Object.hasOwn(input,'cursor'))fail('Bill locator and continuation conflict');
   if(Object.hasOwn(input,'cursor'))continuation=assertBillTextCursor(input.cursor,{billId,...(input.versionCode?{versionCode:input.versionCode}:{})});
  }
  return Object.freeze({input:Object.freeze(input),metadata:Object.freeze({authoritative:false,sourceConnected:false,producerQualified:false,absenceEvidence:false,currentPointerQualified:false,directBillId,continuation,
   mode:id===SEARCH?(input.textQuery?'bill_text':'metadata'):(input.query?'locator':'sequential')})});
 }
 function assertSearch(data,input,metadata){
  instant(data.generatedAt);
  if(input.textQuery){
   if(data.mode!=='bill_text'||data.textQuery!==input.textQuery||data.page!==input.page||data.perPage!==input.limit)fail('Bill text-search selection mismatch');
   if(JSON.stringify(data).length>10500)fail('Bill text-search JSON-character ceiling');
   const listed=data.results.length+(data.omittedBills??0);
   if(data.total!==data.results.length||listed>input.limit||data.omittedBills&&data.results.length<1)fail('Bill text-search returned/omitted count');
   if(data.results.length===0&&data.totalBills!==(input.page===1?0:null))fail('Empty bill text-search count scope');
   const shown=(input.page-1)*input.limit+listed;
   if(data.results.length&&data.totalBills!==null&&data.totalBills<shown)fail('Bill text-search total window mismatch');
   const more=data.totalBills!==null&&shown<data.totalBills;
   if(data.hasMore!==more||Object.hasOwn(data,'nextPage')!==more||more&&data.nextPage!==input.page+1)fail('Bill text-search paging claim');
   const base=data.results.length?'Bills whose stored text matches, best first, with matching passages (« » marks the match). Read a passage in context with read_bill_text and its readCursor. Stored text covers 119th-Congress bills.':input.page>1?'No more matching bills on this page.':'No stored bill text matches. Stored text covers 119th-Congress bills; try other wording before concluding no bill addresses the topic.';
   const count=data.totalBills!==null&&data.totalBills>0?`${data.totalBills} bill${data.totalBills===1?'':'s'} match in all.${more?` Ask for page ${input.page+1} for more.`:''}`:null;
   const omitted=data.omittedBills?`${data.omittedBills} lower-ranked bill${data.omittedBills===1?' on this page was':'s on this page were'} left out to fit; narrow the query or ask with a smaller limit to see ${data.omittedBills===1?'it':'them'}.`:null;
   const shortened='Only the best passage is shown for some bills; read_bill_text with the bill and query finds the rest.';
   const notes=[false,true].filter(flag=>!flag||data.results.some(result=>result.passages.length===1)).map(flag=>[base,count,flag?shortened:null,omitted].filter(part=>part!==null).join(' '));
   if(!notes.includes(data.note)||data.omittedBills&&data.results.some(result=>result.passages.length!==1))fail('Bill text-search omission disclosure');
   unique(data.results,'billId');
   for(const result of data.results)for(const passage of result.passages){
    if(passage.snippet!==passage.snippet.replace(/\s+/g,' ').trim())fail('Bill text-search snippet whitespace');
    if(passage.startOffset===0){if(passage.readCursor!==null)fail('Zero-offset passage cursor');}
    else assertBillTextCursor(passage.readCursor,{billId:result.billId,offset:passage.startOffset});
    // Group version is the first row's version. Another selected passage can
    // legitimately refer to a different version of this same bill.
   }
  }else{
   if(Object.hasOwn(data,'mode')||data.limit!==input.limit||data.data.length>input.limit)fail('Congress metadata selection mismatch');
   unique(data.data,'id');
   if(data.resolvedBy){if(!metadata.directBillId||data.data.length!==1||data.total!==1||data.page!==1||data.data[0].id!==metadata.directBillId)fail('Congress direct designation substitution');}
   else if(data.page!==input.page)fail('Congress metadata page substitution');
   let prior=Infinity;
   for(const row of data.data){
    for(const key of ['introducedDate','latestActionDate'])instant(row[key],true);
    for(const key of ['updateDateIncludingText','statusAt','lastSyncedAt'])instant(row[key]);
    const at=instant(row.updateDate);if(!data.resolvedBy&&at!==undefined){if(at>prior)fail('Congress metadata ordering');prior=at;}
    if(!data.resolvedBy&&input.congress!==undefined&&row.congress!==input.congress)fail('Congress metadata congress substitution');
   }
  }
 }
 function assertRead(data,input,metadata){
  if(data.billId!==input.billId)fail('Bill read identity substitution');
  if(!data.found){
   if(data.requestedVersionCode!==(input.versionCode??null))fail('Unavailable bill version mismatch');
   const expected=input.versionCode?`No current complete bill-text revision ${input.versionCode} is available for ${input.billId}.`:`No current complete bill-text revision is available for ${input.billId}.`;
   if(data.note!==expected)fail('Unavailable bill disclosure mismatch');return;
  }
  for(const key of ['sourceModifiedAt','publishedAt','fetchedAt'])instant(data[key]);
  if(input.versionCode!==undefined&&data.versionCode!==input.versionCode)fail('Bill read version substitution');
  if(metadata.continuation)for(const key of ['billId','versionCode','revisionId','textHash'])if(data[key]!==metadata.continuation[key])fail('Bill continuation lineage changed');
  const coverage=data.coverage,total=coverage.totalCharacters;
  if(input.query){
   if(data.query!==input.query||coverage.locator.query!==input.query||coverage.complete||coverage.contentComplete||coverage.paginationComplete||!coverage.truncated||coverage.nextCursor!==null)fail('Bill locator coverage substitution');
   if(data.note!==locatorNotes[Number(data.passages.length>0)]||data.totalHits<data.passages.length||(data.totalHits===0)!==(data.passages.length===0)||data.queryParts.length===0&&data.totalHits!==0)fail('Bill locator no-match/count disclosure');
   if(data.queryParts.some(part=>!part||part!==part.toLowerCase().replace(/\s+/g,' ').trim()))fail('Bill locator reported query parts');
   let prior=0,renderOffset=0;
   for(const passage of data.passages){
    const {startOffset:start,endOffset:end}=passage;
    if(start<prior||end>total||end-start!==Math.min(1000,total)||end<=start||passage.matchedTerms.some(term=>!data.queryParts.includes(term)))fail('Bill locator passage bounds');
    prior=end;
    if(start===0){if(passage.readCursor!==null)fail('Zero-offset locator cursor');}
    else assertBillTextCursor(passage.readCursor,{billId:data.billId,versionCode:data.versionCode,revisionId:data.revisionId,textHash:data.textHash,offset:start});
    const header=`[${passage.heading??'Text'} | characters ${start}-${end}]\n`;
    if(!data.text.startsWith(header,renderOffset))fail('Bill locator text framing');renderOffset+=header.length+(end-start);
    if(renderOffset>data.text.length)fail('Bill locator text length');
    if(passage!==data.passages.at(-1)){const separator='\n\n…\n\n';if(!data.text.startsWith(separator,renderOffset))fail('Bill locator passage separator');renderOffset+=separator.length;}
   }
   if(renderOffset!==data.text.length)fail('Bill locator unbound text');
  }else{
   if(Object.hasOwn(data,'query'))fail('Unexpected bill locator result');
   const offset=metadata.continuation?.offset??0,{endOffset:end}=coverage.locator;
   if(coverage.locator.offset!==offset||end<offset||end>total||data.text.length!==end-offset||data.text.length>9000)fail('Bill sequential range substitution');
   const maximum=Math.min(total,offset+9000),more=end<total;
   if(end!==maximum&&!(maximum<total&&end===maximum-1))fail('Bill sequential page length');
   if(more&&/[\uD800-\uDBFF]/.test(data.text.at(-1)??''))fail('Bill sequential surrogate boundary');
   if(!coverage.complete||coverage.paginationComplete!==!more||coverage.contentComplete!==(!more&&offset===0)||coverage.truncated!==(more||offset>0)||data.note!==sequentialNote)fail('Bill sequential coverage substitution');
   if(more)assertBillTextCursor(coverage.nextCursor,{billId:data.billId,versionCode:data.versionCode,revisionId:data.revisionId,textHash:data.textHash,offset:end});
   else if(coverage.nextCursor!==null)fail('Completed bill text cursor');
  }
 }
 function assertBillTextOutput(id,value,request,context={}){
  const normalized=normalizeBillTextInput(id,request,context),data=snapshotOperationData(value);validateBillTextShape(billTextOutputDefinition(id),data);
  if(id===SEARCH)assertSearch(data,normalized.input,normalized.metadata);else assertRead(data,normalized.input,normalized.metadata);
  return value;
 }
 return Object.freeze({billTextSchemaId:schema.$id,BILL_TEXT_OPERATION_IDS,billTextInputDefinition,billTextOutputDefinition,normalizeBillTextInput,validateBillTextShape,assertBillTextOutput});
}
