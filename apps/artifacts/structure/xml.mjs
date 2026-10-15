/** Strict, namespace-aware reading of one XML part through the upstream `saxes` parser, which throws on any
 * well-formedness or namespace error (unterminated or mismatched elements, unbound prefixes, duplicate attributes,
 * undefined entities, text outside the root). Only real elements count: comments, CDATA, processing instructions and
 * markup quoted inside them never become elements. A document type declaration is refused (OPC, ECMA-376 Part 2,
 * forbids DTDs). Parts must be UTF-8; an XML declaration naming another encoding is refused. */
import {SaxesParser} from 'saxes';
import {refuse,StructureInvalid} from './refusal.mjs';
const strict=new TextDecoder('utf-8',{fatal:true});
/** @typedef {{uri:string,local:string,attributes:Record<string,string>}} XmlElement
 * `attributes` holds only attributes without a namespace (the OPC attributes), keyed by local name. */
const element=tag=>{
 const attributes=Object.create(null);
 for(const a of Object.values(tag.attributes))if(!a.uri)attributes[a.local]=a.value;
 return Object.freeze({uri:tag.uri,local:tag.local,attributes:Object.freeze(attributes)});
};
/** Parses `bytes` completely and returns the root element and its direct child elements.
 * Non-whitespace text directly under the root is refused when `elementOnlyRoot` (OPC relationship and content-type
 * parts have element-only content). @returns {{root:XmlElement,children:XmlElement[]}} */
export function readXmlPart(bytes,{elementOnlyRoot=false}={}){
 let text;try{text=strict.decode(bytes);}catch{refuse('XML_ENCODING');}
 const parser=new SaxesParser({xmlns:true,position:false});
 let root=null,depth=0;const children=[];
 parser.on('xmldecl',decl=>{if(decl.encoding!==undefined&&!/^utf-8$/iu.test(decl.encoding))refuse('XML_ENCODING');});
 parser.on('doctype',()=>refuse('XML_DOCTYPE'));
 parser.on('opentag',tag=>{depth++;if(depth===1)root=element(tag);else if(depth===2)children.push(element(tag));});
 parser.on('closetag',()=>{depth--;});
 parser.on('text',t=>{if(elementOnlyRoot&&depth===1&&/\S/u.test(t))refuse('XML_MALFORMED');});
 parser.on('cdata',()=>{if(elementOnlyRoot&&depth===1)refuse('XML_MALFORMED');});
 try{parser.write(text.replace(/^﻿/u,'')).close();}
 catch(error){if(error instanceof StructureInvalid)throw error;refuse('XML_MALFORMED');}
 if(!root||depth!==0)refuse('XML_MALFORMED');
 return {root,children};
}
