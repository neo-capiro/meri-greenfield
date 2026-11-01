/** USLM section identity read from the exact XML text through the strict upstream `saxes` parser (the same
 * parser the artifact structure reader already uses). Element identity comes from declared `identifier` attributes,
 * or `id` for profiles2/3, on USLM elements; nothing is inferred from headings or numbering. Profiles1/2 retain
 * exact raw element scopes. Profile3 adds reversible decoded text-run leaves through the same parse. All raw
 * spans use UTF-16 offsets, so an edit keeps every byte
 * outside the edited span and the compiled result is re-read as XML before any output exists. This is not an XSD
 * or DTD validation of USLM; it establishes well-formedness, the declared namespace and element identity only. */
import {createHash} from 'node:crypto';
import {SaxesParser} from 'saxes';
import {FEDERAL_USLM_XML_PARSER,FEDERAL_USLM_SCHEMA_PARSER} from '../../../packages/contracts/federal-workbench/source-layout.mjs';
import {decodeXmlTextRun} from '../../../packages/contracts/federal-workbench/xml-text-runs.mjs';
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

function parse(text,visit,structure=false){
 const bom=text.startsWith('﻿')?1:0,body=bom?text.slice(1):text,parser=new SaxesParser({xmlns:true,position:true});
 const open=[];let depth=0,root=null,tree=null,cursor=bom;
 parser.on('xmldecl',declaration=>{if(declaration.encoding!==undefined&&!/^utf-8$/iu.test(declaration.encoding))fault('DRAFT_XML_ENCODING_UNSUPPORTED');
  if(structure&&declaration.version!=='1.0')fault('DRAFT_XML_VERSION_UNSUPPORTED');});
 parser.on('doctype',()=>fault('DRAFT_XML_DOCTYPE_UNSUPPORTED'));
 // The start tag's `<` precedes the name that just completed; no `<` may occur inside a tag name.
 parser.on('opentagstart',()=>open.push(body.lastIndexOf('<',parser.position-1)+bom));
 parser.on('opentag',tag=>{depth++;const start=open.pop();if(depth===1)root={uri:tag.uri,local:tag.local};
  let node;if(structure){node={type:'element',uri:tag.uri,local:tag.local,
   attributes:Object.values(tag.attributes).map(({name,uri,local,value})=>({name,uri,local,value})),start,end:null,children:[]};
   if(depth===1)tree=node;else open.at(-1).node.children.push(node);cursor=parser.position+bom;}
  open.push({tag,start,depth,node});});
 parser.on('closetag',()=>{const entry=open.pop(),end=parser.position+bom;if(structure){entry.node.end=end;cursor=end;}
  visit(entry.tag,entry.start,end,entry.depth);depth--;});
 if(structure){
  const run=(kind,start,end,decoded)=>{if(open.length&&end>start){const mapped=decodeXmlTextRun(text.slice(start,end),kind,decoded);
   open.at(-1).node.children.push({type:'text',start,end,...mapped});}};
  parser.on('text',decoded=>{const end=parser.position-1+bom;run('text',cursor,end,decoded);cursor=end;});
  parser.on('cdata',decoded=>{const end=parser.position-3+bom;
   if(text.slice(cursor,cursor+9)!=='<![CDATA[')fault('DRAFT_XML_TEXT_MAPPING_INVALID');
   run('cdata',cursor+9,end,decoded);cursor=parser.position+bom;});
  // Saxes emits comment after the second closing dash, before consuming its final >.
  parser.on('comment',()=>{cursor=parser.position+1+bom;});
  parser.on('processinginstruction',()=>{cursor=parser.position+bom;});
 }
 try{parser.write(body).close();}catch(error){if(typeof error?.code==='string'&&error.code.startsWith('DRAFT_'))throw error;fault('DRAFT_XML_MALFORMED');}
 if(!root||depth!==0)fault('DRAFT_XML_MALFORMED');
 return structure?{root,tree}:root;
}

/** Renderable structure from the same SAX parse. Comments/PIs split runs but remain in the untouched raw XML. */
export function deriveUslmStructure(text){
 const {root,tree}=parse(text,()=>{},true);if(!USLM_NAMESPACES.includes(root.uri))fault('DRAFT_USLM_NAMESPACE_UNSUPPORTED');
 return Object.freeze({root:freezeStructure(tree)});
}
function freezeStructure(root){
 const pending=[root];while(pending.length){const node=pending.pop();if(node.type==='element'){
  pending.push(...node.children);node.attributes.forEach(Object.freeze);Object.freeze(node.attributes);Object.freeze(node.children);}
  Object.freeze(node);
 }return root;
}

/** Preorder scopes: root `document`, declared USLM element identities, and profile3 text-run leaves. */
export function deriveUslmScopes(text,parserVersion=FEDERAL_USLM_XML_PARSER){
 const closed=[],structural=parserVersion==='federal-uslm-xml/3';
 const parsed=parse(text,(tag,start,end,depth)=>closed.push({tag,start,end,depth}),structural),root=structural?parsed.root:parsed;
 if(!USLM_NAMESPACES.includes(root.uri))fault('DRAFT_USLM_NAMESPACE_UNSUPPORTED');
 // Elements close in document order of their end tags; sorting by start restores preorder.
 closed.sort((a,b)=>a.start-b.start);
 const scopes=[],stack=[],seen=new Set();
 for(const {tag,start,end,depth} of closed){
  while(stack.length&&start>=stack.at(-1).end)stack.pop();
  const identifier=tag.attributes.identifier??(parserVersion===FEDERAL_USLM_SCHEMA_PARSER||structural?tag.attributes.id:undefined),named=identifier!==undefined&&identifier.uri===''&&USLM_NAMESPACES.includes(tag.uri);
  if(depth!==1&&!named)continue;
  const id=depth===1?USLM_ROOT_SCOPE:(identifier.local==='id'?'xml:'+identifier.value:uslmScopeId(identifier.value));
  if(depth!==1&&!ID.test(id))fault('DRAFT_USLM_IDENTIFIER_INVALID');
  if(seen.has(id))fault('DRAFT_USLM_IDENTIFIER_DUPLICATE');
  seen.add(id);
  const label=depth===1?`${tag.local}${identifier?.uri===''?' '+identifier.value:''}`:`${tag.local} ${identifier.value}`;
  const scope={id,label:label.slice(0,512),start,end,sha256:sha(text.slice(start,end)),ancestorPath:stack.map(s=>s.id)};
  scopes.push(scope);stack.push(scope);
 }
 let result=scopes;
 if(structural){
  const elements=new Map(scopes.map(scope=>[scope.start,scope])),pending=[{node:parsed.tree,path:[]}];result=[];let ordinal=0;
  while(pending.length){const {node,path}=pending.pop();if(node.type==='element'){
   const scope=elements.get(node.start),ancestors=scope?[...path,scope.id]:path;if(scope)result.push(scope);
   for(let index=node.children.length-1;index>=0;index--)pending.push({node:node.children[index],path:ancestors});
  }else{
   const id=`run:${++ordinal}`;if(seen.has(id))fault('DRAFT_USLM_IDENTIFIER_DUPLICATE');seen.add(id);
   result.push({id,label:`text run ${ordinal}`,start:node.start,end:node.end,sha256:sha(text.slice(node.start,node.end)),ancestorPath:path,
    textRun:Object.freeze({kind:node.kind,decoded:node.decoded,spans:node.spans})});
  }}
 }
 return Object.freeze({root:Object.freeze(root),scopes:Object.freeze(result.map(s=>Object.freeze({...s,ancestorPath:Object.freeze(s.ancestorPath)})))});
}

/** A compiled result retains the original root and an importable declared-identifier tree. */
export function assertUslmResult(text,expectedRoot,maxScopes=Infinity,parserVersion=FEDERAL_USLM_XML_PARSER){
 let derived;
 try{derived=deriveUslmScopes(text,parserVersion);}catch(error){
  fault(['DRAFT_XML_DOCTYPE_UNSUPPORTED','DRAFT_USLM_IDENTIFIER_INVALID','DRAFT_USLM_IDENTIFIER_DUPLICATE'].includes(error?.code)?error.code:'DRAFT_XML_RESULT_MALFORMED');
 }
 if(derived.root.uri!==expectedRoot.uri||derived.root.local!==expectedRoot.local)fault('DRAFT_XML_RESULT_MALFORMED');
 if(derived.scopes.length>maxScopes)fault('DRAFT_OUTPUT_LIMIT');
 return true;
}
