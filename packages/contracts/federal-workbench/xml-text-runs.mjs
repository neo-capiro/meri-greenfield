/** Browser-safe XML 1.0 character-data mapping. Offsets are UTF-16 within one raw text run. */
const fault=()=>{throw Object.assign(Error('DRAFT_XML_TEXT_MAPPING_INVALID'),{code:'DRAFT_XML_TEXT_MAPPING_INVALID'});};
const scalar=code=>code===9||code===10||code===13||code>=0x20&&code<=0xd7ff||code>=0xe000&&code<=0xfffd||code>=0x10000&&code<=0x10ffff;
const boundary=(text,at)=>at===0||at===text.length||!(text.charCodeAt(at-1)>=0xd800&&text.charCodeAt(at-1)<=0xdbff&&text.charCodeAt(at)>=0xdc00&&text.charCodeAt(at)<=0xdfff);
const kinds=new Set(['text','cdata']);
const entities=Object.freeze({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"});
function entity(raw){
 const name=raw.slice(1,-1);if(Object.hasOwn(entities,name))return entities[name];
 if(!/^#(?:[0-9]+|x[0-9a-fA-F]+)$/u.test(name))fault();
 const code=name[1]==='x'?Number.parseInt(name.slice(2),16):Number.parseInt(name.slice(1),10);
 if(!Number.isSafeInteger(code)||!scalar(code))fault();return String.fromCodePoint(code);
}

/** Compact, contiguous literal spans; entities and XML newline normalization stay indivisible. */
export function decodeXmlTextRun(raw,kind='text',expectedDecoded){
 if(typeof raw!=='string'||!kinds.has(kind)||raw.includes(']]>'))fault();
 const spans=[];let decoded='',at=0;
 const append=(spanKind,end,value)=>{const start=at,decodedStart=decoded.length;decoded+=value;
  const prior=spans.at(-1);if(spanKind==='literal'&&prior?.kind==='literal'){prior.rawEnd=end;prior.decodedEnd=decoded.length;}
  else spans.push({kind:spanKind,rawStart:start,rawEnd:end,decodedStart,decodedEnd:decoded.length});at=end;};
 while(at<raw.length){
  const code=raw.codePointAt(at);if(!scalar(code))fault();
  if(raw[at]==='\r'){append('newline',at+(raw[at+1]==='\n'?2:1),'\n');continue;}
  if(kind==='text'&&raw[at]==='&'){
   const end=raw.indexOf(';',at+1);if(end<0)fault();append('entity',end+1,entity(raw.slice(at,end+1)));continue;
  }
  if(kind==='text'&&raw[at]==='<')fault();
  const end=at+(code>0xffff?2:1);append('literal',end,raw.slice(at,end));
 }
 if(expectedDecoded!==undefined&&expectedDecoded!==decoded)fault();
 return Object.freeze({kind,decoded,spans:Object.freeze(spans.map(span=>Object.freeze(span)))});
}

/** Maps a scalar-aligned decoded range to exact raw UTF-16 offsets, never a partial entity. */
export function mapDecodedRange(raw,kind,start,end){
 const run=decodeXmlTextRun(raw,kind);
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||end>run.decoded.length||!boundary(run.decoded,start)||!boundary(run.decoded,end))fault();
 const offset=position=>{
  if(position===run.decoded.length)return raw.length;
  for(const span of run.spans){
   if(position===span.decodedStart)return span.rawStart;
   if(position===span.decodedEnd)return span.rawEnd;
   if(position>span.decodedStart&&position<span.decodedEnd){if(span.kind!=='literal')fault();return span.rawStart+position-span.decodedStart;}
  }
  fault();
 };
 return Object.freeze({start:offset(start),end:offset(end)});
}

/** Encode one decoded replacement without creating markup or changing CDATA boundaries. */
export function encodeDecodedText(text,kind='text'){
 if(typeof text!=='string'||!kinds.has(kind))fault();
 for(const char of text)if(!scalar(char.codePointAt(0)))fault();
 if(kind==='cdata'){
  // A literal CR would normalize to LF in CDATA, where a character reference cannot preserve it.
  if(text.includes(']]>')||text.includes('\r'))fault();return text;
 }
 return text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\r','&#13;');
}

/** Apply one decoded anchor edit to the CURRENT raw run; callers retain operation hashes and dependency custody. */
export function applyDecodedXmlEdit(raw,kind,op){
 if(!kinds.has(kind))fault();
 const refuse=code=>{throw Object.assign(Error(code),{code});};
 const invalid=()=>refuse('DRAFT_OPERATION_INVALID');
 if(!op||typeof op!=='object'||Array.isArray(op))invalid();
 const field=name=>{const descriptor=Object.getOwnPropertyDescriptor(op,name);if(descriptor&&!Object.hasOwn(descriptor,'value'))invalid();return descriptor?.value;};
 const operation=field('kind'),expected=field('expectedText'),requested=field('text'),position=field('position');
 const validText=value=>typeof value==='string'&&value.length>0&&[...value].every(char=>scalar(char.codePointAt(0)));
 if(!['replace','insert','delete'].includes(operation)||!validText(expected))invalid();
 if(operation==='delete'){
  if(Object.hasOwn(op,'text')||Object.hasOwn(op,'position'))invalid();
 }else{
  if(!validText(requested))invalid();
  if(operation==='replace'&&(Object.hasOwn(op,'position')||requested===expected))invalid();
  if(operation==='insert'&&!['before','after'].includes(position))invalid();
 }
 const run=decodeXmlTextRun(raw,kind),at=run.decoded.indexOf(expected);
 if(at<0)refuse('DRAFT_TARGET_MISSING');
 if(run.decoded.indexOf(expected,at+1)>=0)refuse('DRAFT_TARGET_AMBIGUOUS');
 let decodedStart=at,decodedEnd=at+expected.length;
 if(operation==='insert')decodedStart=decodedEnd=position==='before'?at:decodedEnd;
 const {start,end}=mapDecodedRange(raw,kind,decodedStart,decodedEnd),replacement=operation==='delete'?'':encodeDecodedText(requested,kind);
 const text=raw.slice(0,start)+replacement+raw.slice(end),textRun=decodeXmlTextRun(text,kind);
 const intended=run.decoded.slice(0,decodedStart)+(operation==='delete'?'':requested)+run.decoded.slice(decodedEnd);
 // Joining raw boundaries can normalize a CR/LF pair or form a CDATA terminator. Never silently alter the requested edit.
 if(textRun.decoded!==intended)fault();
 return Object.freeze({text,start,end,replacement,textRun});
}
