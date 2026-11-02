/** Span-exact reading and surgical rewriting of one OOXML part. The part is parsed once with the same strict
 * namespace-aware `saxes` parser the structure readers use; every element the caller asks for is reported
 * with its exact character span in the decoded text, so a bounded edit replaces only those spans and copies
 * every other character of the part unchanged. The re-encoded bytes of an untouched span are the original
 * bytes: the decoder is fatal UTF-8 and the encoder is UTF-8, which round-trip exactly. A UTF-8 BOM is kept. */
import {SaxesParser} from 'saxes';
import {refuse,StructureInvalid} from '../structure/refusal.mjs';
const strict=new TextDecoder('utf-8',{fatal:true});
const BOM='﻿';
/** @typedef {{uri:string,local:string,attributes:Record<string,string>,start:number,end:number,depth:number,selfClosing:boolean,text:string,parent:XmlSpan|null,children:XmlSpan[]}} XmlSpan */
/** Parses `bytes` and returns the decoded text plus the element tree with exact spans. `text` of an element
 * is the concatenation of the character data of every descendant element whose (uri,local) the caller lists
 * in `textElements`, in document order; other character data is ignored (OOXML keeps document text in
 * dedicated leaf elements such as `w:t`, `a:t` and `v`). */
export function readXmlSpans(bytes,{textElements=[]}={}){
 let decoded;try{decoded=strict.decode(bytes);}catch{refuse('XML_ENCODING');}
 const bom=decoded.startsWith(BOM),text=bom?decoded.slice(1):decoded,collect=new Set(textElements.map(([uri,local])=>uri+' '+local));
 const parser=new SaxesParser({xmlns:true,position:true});
 const stack=[],roots=[];let pending=null,root=null;
 parser.on('xmldecl',decl=>{if(decl.encoding!==undefined&&!/^utf-8$/iu.test(decl.encoding))refuse('XML_ENCODING');});
 parser.on('doctype',()=>refuse('XML_DOCTYPE'));
 // `position` at opentagstart is just past the name and the one character that ended it.
 parser.on('opentagstart',tag=>{pending=parser.position-tag.name.length-2;});
 parser.on('opentag',tag=>{
  const attributes=Object.create(null);for(const a of Object.values(tag.attributes))if(!a.uri)attributes[a.local]=a.value;
  const parent=stack.at(-1)??null;
  const element={uri:tag.uri,local:tag.local,attributes:Object.freeze(attributes),start:pending,end:-1,depth:stack.length,selfClosing:tag.isSelfClosing,text:'',parent,children:[]};
  if(parent)parent.children.push(element);else{roots.push(element);root??=element;}
  stack.push(element);pending=null;
 });
 parser.on('closetag',()=>{const element=stack.pop();element.end=parser.position;});
 const characters=value=>{
  for(let i=stack.length-1;i>=0;i--){const element=stack[i];if(collect.has(element.uri+' '+element.local)){for(let j=i;j>=0;j--)stack[j].text+=value;break;}}
 };
 parser.on('text',characters);parser.on('cdata',characters);
 try{parser.write(text).close();}catch(error){if(error instanceof StructureInvalid)throw error;refuse('XML_MALFORMED');}
 if(roots.length!==1||stack.length)refuse('XML_MALFORMED');
 return {text,bom,root};
}
/** Replaces the given spans (non-overlapping, any order) in `text` and re-encodes the part. */
export function rewriteXmlSpans({text,bom},replacements){
 const ordered=[...replacements].sort((a,b)=>a.start-b.start);
 let out=bom?BOM:'',at=0;
 for(const r of ordered){if(r.start<at||r.end<r.start||r.end>text.length)refuse('XML_MALFORMED');out+=text.slice(at,r.start)+r.value;at=r.end;}
 return Buffer.from(out+text.slice(at),'utf8');
}
/** XML character-data escaping for text content and attribute values. Control characters OOXML text may not
 * carry are refused rather than silently dropped. */
export function escapeXml(value){
 // eslint-disable-next-line no-control-regex
 if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/u.test(value)||!value.isWellFormed())refuse('XML_MALFORMED');
 return value.replace(/&/gu,'&amp;').replace(/</gu,'&lt;').replace(/>/gu,'&gt;').replace(/"/gu,'&quot;');
}
/** The serialized prefix for a namespace URI as declared in scope of `element` (walking up through parents).
 * Returns '' for the default namespace and null when the URI is not declared, so a caller can refuse rather
 * than invent a declaration. */
export function prefixFor(text,element,uri){
 for(let e=element;e;e=e.parent){
  const open=text.slice(e.start,text.indexOf('>',e.start)+1);
  for(const m of open.matchAll(/\sxmlns(?::([A-Za-z_][\w.-]*))?\s*=\s*(?:"([^"]*)"|'([^']*)')/gu))if((m[2]??m[3])===uri)return m[1]??'';
 }
 return null;
}
