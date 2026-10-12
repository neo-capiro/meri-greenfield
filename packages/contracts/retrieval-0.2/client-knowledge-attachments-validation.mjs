// Typed source projection only. Decoding a cursor does NOT verify its HMAC.
import {snapshotOperationData} from './operation-contracts.mjs';
import {canonicalSha256} from '../validate.mjs';
const fail = message => { throw new Error(message); };
const operation = 'read_chat_attachments';
function instant(value) {
  const ms = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== value) fail('Attachment canonical observation required');
}
const same = (a,b) => canonicalSha256(a) === canonicalSha256(b);
export function createClientKnowledgeAttachmentValidators({validateShape,schema}) {
  if (typeof validateShape !== 'function' || !schema?.$defs) fail('Attachment contract configuration');
  const check = id => { if (id !== operation) fail('Unknown attachment operation'); };
  const inputDefinition = id => { check(id); return 'ClientKnowledgeAttachmentInput'; };
  const outputDefinition = id => { check(id); return 'ClientKnowledgeAttachmentOutput'; };
  function decode(value) {
    if (typeof value !== 'string' || value.length > 4096 || !value.startsWith('chat-attachment:v1:')) fail('Invalid attachment cursor');
    const parts = value.slice('chat-attachment:v1:'.length).split('.');
    if (parts.length !== 2 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) fail('Invalid attachment cursor encoding');
    const bytes = parts.map(p=>Buffer.from(p,'base64url'));
    if (bytes.some((b,i)=>b.toString('base64url') !== parts[i]) || bytes[1].length !== 32) fail('Invalid attachment cursor encoding');
    let payload;
    try { payload = snapshotOperationData(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes[0]))); }
    catch { fail('Invalid attachment cursor JSON'); }
    validateShape('AttachmentCursorPayload',payload);
    return payload;
  }
  function bindCursor(cursor,input,scope,emitted=false) {
    for (const key of ['tenantId','userId','conversationId','clientId','conversationVersion'])
      if (cursor[key] !== scope[key]) fail('Attachment cursor scope changed');
    if (cursor.query !== input.query || cursor.conversationId !== input.conversationId ||
        (cursor.mode === 'read' ? (emitted ? cursor.attachmentId.toLowerCase() !== input.attachmentId?.toLowerCase() : cursor.attachmentId !== input.attachmentId) : input.attachmentId !== null))
      fail('Attachment cursor selector substitution');
  }
  function contextData(context) {
    const ctx=snapshotOperationData(context);validateShape('ClientKnowledgeAttachmentContext',ctx);
    instant(ctx.asOf);instant(ctx.scope.conversationVersion);return ctx;
  }
  function normalizeInput(id,request,context) {
    check(id); const raw=snapshotOperationData(request),ctx=contextData(context);
    validateShape('ClientKnowledgeAttachmentRequest',raw);
    const text=(key,max,required=false)=>{
      if(raw[key]===undefined&&!required)return null;
      if(typeof raw[key]!=='string'||!raw[key].trim()||raw[key].length>max)fail(`Invalid attachment ${key}`);
      return raw[key].trim();
    };
    const conversationId=text('conversationId',80,true),attachmentId=text('attachmentId',80);
    const query=raw.query===undefined?'':text('query',240);
    const locator={section:raw.section??1,rowStart:raw.rowStart??1,offset:raw.characterOffset??0};
    if(locator.section>500||locator.rowStart>1000000||locator.offset>2000000)fail('Explicit attachment locator exceeds bounds');
    const explicit=['section','rowStart','characterOffset'].some(k=>raw[k]!==undefined);
    if(explicit&&(!attachmentId||raw.cursor!==undefined))fail('Attachment locator/cursor conflict');
    const cursor=raw.cursor===undefined?null:decode(raw.cursor);
    const input={conversationId,attachmentId,query,limit:raw.limit??(attachmentId?5000:10),locator:cursor?.mode==='read'?cursor.locator:locator,cursor};
    if(input.limit>(attachmentId?6000:20))fail('Attachment page limit exceeded');
    validateShape(inputDefinition(id),input);
    if(conversationId!==ctx.scope.conversationId)fail('Attachment conversation scope substitution');
    if(cursor)bindCursor(cursor,input,ctx.scope);
    return Object.freeze({input,metadata:Object.freeze({sourceConnected:false,authoritative:false,
      cursorAuthenticated:false,currentPolicyQualified:false,absenceEvidence:false})});
  }
  function assertResult(id,value,request,context) {
    const ctx=contextData(context),{input}=normalizeInput(id,request,ctx),page=snapshotOperationData(value);
    validateShape(outputDefinition(id),page);instant(page.generatedAt);
    if(page.generatedAt!==ctx.asOf||page.conversationId!==input.conversationId||page.clientId!==ctx.scope.clientId)fail('Attachment wrapper scope/observation substitution');
    const c=page.coverage,next=c.nextCursor===null?null:decode(c.nextCursor);
    if(next)bindCursor(next,input,ctx.scope,true);
    if(c.query!==(input.query||null)||c.paginationComplete!==(next===null))fail('Attachment coverage selector/continuation mismatch');
    if(!input.attachmentId){
      if(c.mode!=='manifest'||c.returned!==page.records.length||c.returned+c.unavailableInPage>input.limit||c.complete!==(next===null))fail('Attachment manifest count/branch mismatch');
      for(const row of page.records){instant(row.uploadedAt);if(row.originalBytesAvailable!==(row.originalBytesHash!==null))fail('Attachment byte availability mismatch');}
    }else{
      if(c.mode!=='section'||page.source.attachmentId.toLowerCase()!==input.attachmentId.toLowerCase()||!same(c.locator,input.locator))fail('Attachment section selector mismatch');
      const source=page.source;
      if(input.cursor&&(input.cursor.messageId!==source.sourceMessageId||input.cursor.originalBytesHash!==source.originalBytesHash))fail('Attachment source changed since cursor');
      if(next&&(next.mode!=='read'||next.messageId!==source.sourceMessageId||next.originalBytesHash!==source.originalBytesHash))fail('Attachment continuation source mismatch');
      if(c.characterStart>c.characterEnd||c.characterEnd>c.sectionCharacters||c.characterStart<input.locator.offset)fail('Attachment character range mismatch');
      if(!input.query&&c.characterEnd-c.characterStart>input.limit)fail('Attachment no-query span exceeds requested limit');
      if(input.query&&c.matched===false&&c.characterStart!==c.characterEnd)fail('Unmatched attachment section has a character span');
      const sectionComplete=c.characterStart===0&&c.characterEnd===c.sectionCharacters&&c.extractionStatus==='complete';
      const complete=sectionComplete&&c.locator.section===1&&next===null;
      if(c.sectionComplete!==sectionComplete||c.contentComplete!==complete||c.complete!==complete||c.truncated!==(next!==null||c.extractionStatus!=='complete'))fail('Attachment completion projection mismatch');
      if(c.matched!==(input.query?c.matched:null)||input.query&&typeof c.matched!=='boolean')fail('Attachment match projection mismatch');
      if(input.query&&c.matched===false&&page.records.length)fail('Unmatched attachment section contains a result');
      const expectedKind=source.sourceKind==='pdf'?'page':source.sourceKind==='pptx'?'slide_with_notes':source.sourceKind==='xlsx'?'sheet_rows':'text_section';
      if(['image','unsupported'].includes(source.sourceKind)||c.sectionKind!==expectedKind)fail('Attachment reader kind mismatch');
      const coordinateKey={page:'page',slide_with_notes:'slide',sheet_rows:'sheet',text_section:'section'}[c.sectionKind];
      if(c.locator.section>c.sectionCount||c.coordinates===null||c.coordinates[coordinateKey]!==c.locator.section)fail('Attachment section coordinate/count mismatch');
      if(c.sectionKind==='page'&&(c.coordinates.selectedCharacterStart>c.coordinates.selectedCharacterEnd||c.coordinates.selectedCharacterEnd>c.coordinates.nativeCharacters||c.sectionCharacters!==c.coordinates.nativeCharacters||c.characterStart<c.coordinates.selectedCharacterStart||c.characterEnd>c.coordinates.selectedCharacterEnd))fail('Attachment PDF window coordinate mismatch');
      const label=c.sectionKind==='page'?`PDF page ${c.locator.section}`:c.sectionKind==='slide_with_notes'?`PowerPoint slide ${c.locator.section} with speaker notes`:c.sectionKind==='sheet_rows'?`Worksheet ${c.coordinates.sheet}: ${c.coordinates.sheetName}, rows ${c.coordinates.rowStart}-${c.coordinates.rowEnd}`:`Text section ${c.locator.section}`;
      if(c.sectionLabel!==label)fail('Attachment section label mismatch');

      for(const row of page.records){
        const p=row.payload,proof=row.provenance;
        const reference=`${source.attachmentId}:${source.originalBytesHash.slice(0,16)}:${c.sectionKind}:${c.locator.section}:${c.characterStart}-${c.characterEnd}`;
        if(row.recordId!==reference||p.id!==reference||p.attachmentId!==source.attachmentId||p.title!==source.filename||p.sourceKind!==source.sourceKind||p.sectionKind!==c.sectionKind||p.sectionLabel!==c.sectionLabel||!same(p.coordinates,c.coordinates)||p.characterStart!==c.characterStart||p.characterEnd!==c.characterEnd)fail('Attachment content projection mismatch');
        if(!p.text.trim()||p.text.length!==c.characterEnd-c.characterStart||JSON.stringify(p.text).length>6500)fail('Attachment text window mismatch');
        if(proof.sourceRecordId!==source.attachmentId||proof.sourceMessageId!==source.sourceMessageId||proof.conversationId!==page.conversationId||proof.clientId!==page.clientId||proof.originalBytesHash!==source.originalBytesHash||!same(proof.locator,c.locator))fail('Attachment evidence projection mismatch');
      }
    }
    return page;
  }
  return Object.freeze({schemaId:schema.$id,operationIds:Object.freeze([operation]),inputDefinition,outputDefinition,normalizeInput,assertResult});
}
