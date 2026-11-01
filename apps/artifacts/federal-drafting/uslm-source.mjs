/** USLM section identity read from the exact XML text through the strict upstream `saxes` parser (the same
 * parser the artifact structure reader already uses). Identity comes only from declared `identifier` attributes on
 * USLM-namespace elements; nothing is inferred from headings, numbering or text. Each scope is the raw lexical
 * element span (UTF-16 offsets from the start tag's `<` through the end tag's `>`), so an edit keeps every byte
 * outside the edited span and the compiled result is re-read as XML before any output exists. This is not an XSD
 * or DTD validation of USLM; it establishes well-formedness, the declared namespace and element identity only. */
import {createHash} from 'node:crypto';
import {SaxesParser} from 'saxes';
import {FEDERAL_USLM_XML_PARSER} from '../../../packages/contracts/federal-workbench/source-layout.mjs';
export {FEDERAL_USLM_XML_PARSER};
const USLM_NAMESPACES=Object.freeze(['http://xml.house.gov/schemas/uslm/1.0','http://schemas.gpo.gov/xml/uslm']);
export const USLM_ROOT_SCOPE='document';
const ID=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u;
const fault=code=>{throw Object.assign(Error(code),{code,operationId:null});};
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
/** The same markup signature the browser-safe layout guard uses; a plain-text baseline must not start with it. */
export const looksLikeMarkup=text=>/^[\s﻿]*(?:<\?xml\b|<!DOCTYPE\b|<!--|<[A-Za-z_][\w.:-]*(?=[\s/>]|$))/iu.test(text);
/** A USLM identifier such as `/us/bill/119/hr/1/s2/a` becomes the scope id `us:bill:119:hr:1:s2:a`. */
const uslmScopeId=identifier=>identifier.replace(/^\//u,'').replaceAll('/',':');

function parse(text,visit){
 const bom=text.startsWith('﻿')?1:0,body=bom?text.slice(1):text,parser=new SaxesParser({xmlns:true,position:true});
 const open=[];let depth=0,root=null;
 parser.on('xmldecl',declaration=>{if(declaration.encoding!==undefined&&!/^utf-8$/iu.test(declaration.encoding))fault('DRAFT_XML_ENCODING_UNSUPPORTED');});
 parser.on('doctype',()=>fault('DRAFT_XML_DOCTYPE_UNSUPPORTED'));
 // The start tag's `<` precedes the name that just completed; no `<` may occur inside a tag name.
 parser.on('opentagstart',()=>open.push(body.lastIndexOf('<',parser.position-1)+bom));
 parser.on('opentag',tag=>{depth++;const start=open.pop();if(depth===1)root={uri:tag.uri,local:tag.local};open.push({tag,start,depth});});
 parser.on('closetag',()=>{const entry=open.pop();visit(entry.tag,entry.start,parser.position+bom,entry.depth);depth--;});
 try{parser.write(body).close();}catch(error){if(typeof error?.code==='string'&&error.code.startsWith('DRAFT_'))throw error;fault('DRAFT_XML_MALFORMED');}
 if(!root||depth!==0)fault('DRAFT_XML_MALFORMED');
 return root;
}

/** Preorder scopes: the root element as `document`, then every USLM-namespace element with an `identifier`. */
export function deriveUslmScopes(text){
 const closed=[];
 const root=parse(text,(tag,start,end,depth)=>closed.push({tag,start,end,depth}));
 if(!USLM_NAMESPACES.includes(root.uri))fault('DRAFT_USLM_NAMESPACE_UNSUPPORTED');
 // Elements close in document order of their end tags; sorting by start restores preorder.
 closed.sort((a,b)=>a.start-b.start);
 const scopes=[],stack=[],seen=new Set();
 for(const {tag,start,end,depth} of closed){
  while(stack.length&&start>=stack.at(-1).end)stack.pop();
  const identifier=tag.attributes.identifier,named=identifier!==undefined&&identifier.uri===''&&USLM_NAMESPACES.includes(tag.uri);
  if(depth!==1&&!named)continue;
  const id=depth===1?USLM_ROOT_SCOPE:uslmScopeId(identifier.value);
  if(depth!==1&&!ID.test(id))fault('DRAFT_USLM_IDENTIFIER_INVALID');
  if(seen.has(id))fault('DRAFT_USLM_IDENTIFIER_DUPLICATE');
  seen.add(id);
  const label=depth===1?`${tag.local}${identifier?.uri===''?' '+identifier.value:''}`:`${tag.local} ${identifier.value}`;
  const scope={id,label:label.slice(0,512),start,end,sha256:sha(text.slice(start,end)),ancestorPath:stack.map(s=>s.id)};
  scopes.push(scope);stack.push(scope);
 }
 return Object.freeze({root:Object.freeze(root),scopes:Object.freeze(scopes.map(s=>Object.freeze({...s,ancestorPath:Object.freeze(s.ancestorPath)})))});
}

/** A compiled result must still be one well-formed document with the original root; otherwise no output exists. */
export function assertUslmResult(text,expectedRoot){
 let root;
 try{root=parse(text,()=>{});}catch(error){fault(error?.code==='DRAFT_XML_DOCTYPE_UNSUPPORTED'?error.code:'DRAFT_XML_RESULT_MALFORMED');}
 if(root.uri!==expectedRoot.uri||root.local!==expectedRoot.local)fault('DRAFT_XML_RESULT_MALFORMED');
 return true;
}
