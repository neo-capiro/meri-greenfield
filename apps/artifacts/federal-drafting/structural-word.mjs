/** Explicit USLM 2.1 subset into typed Word blocks. No CSS, inferred hierarchy, truncation or native tracked changes. */
import {deriveUslmStructure} from './uslm-source.mjs';
import {mapDecodedRange} from '../../../packages/contracts/federal-workbench/xml-text-runs.mjs';
const USLM='http://schemas.gpo.gov/xml/uslm',HTML='http://www.w3.org/1999/xhtml',DC='http://purl.org/dc/elements/1.1/';
const XML='http://www.w3.org/XML/1998/namespace',XMLNS='http://www.w3.org/2000/xmlns/',XSI='http://www.w3.org/2001/XMLSchema-instance';
const fail=()=>{throw Object.assign(Error('DRAFT_STRUCTURAL_UNSUPPORTED'),{code:'DRAFT_STRUCTURAL_UNSUPPORTED',operationId:null});};
const levels=new Set(['level','preliminary','title','subtitle','part','subpart','division','subdivision','chapter','subchapter','article','subarticle',
 'compiledAct','courtRules','courtRule','reorganizationPlans','reorganizationPlan',
 'section','subsection','paragraph','subparagraph','clause','subclause','item','subitem','subsubitem']);
const containers=new Set(['preface','main','signatures','block',...levels]);
const paragraphs=new Set(['content','p','statement','heading','subheading','num','coverTitle','coverText','slugLine','distributionCode','congress','session','docNumber',
 'docPart','docStage','docPublicationName','currentChamber','enrolledDateline','purpose','subject','resolvingClause','enactingFormula','action','signature']);
const inline=new Set(['b','i','em','strong','ref','term','span','quotedText','headingText','shortTitle','date','notation','name','role','affiliation','signatureDate']);
const htmlInline=new Set(['b','i','em','strong','span']);
const dcFields=new Set(['title','type','creator','publisher','date','description','subject','identifier','language','rights']);
const plainAttributes=new Set(['id','identifier','value','href','idref','type','date']);
const whitespace=text=>/^[\t\r\n ]*$/u.test(text);
const intersects=(a,b)=>a.start<b.end&&b.start<a.end;
const scalarBoundary=(text,at)=>at===0||at===text.length||!(text.charCodeAt(at-1)>=0xd800&&text.charCodeAt(at-1)<=0xdbff&&text.charCodeAt(at)>=0xdc00&&text.charCodeAt(at)<=0xdfff);
const chars=text=>[...text].length;
function frozen(value){const pending=[value];while(pending.length){const item=pending.pop();if(item&&typeof item==='object'&&!Object.isFrozen(item)){pending.push(...Object.values(item));Object.freeze(item);}}return value;}

export function projectUslmWord(text,{blockOffset=0,changes=[],mark=null}={}){
 if(typeof text!=='string'||Buffer.byteLength(text)>131072||!Number.isSafeInteger(blockOffset)||blockOffset<0||blockOffset>1000||
  ![null,'strike','underline'].includes(mark)||!Array.isArray(changes)||changes.length>1024)fail();
 const intervals=[];
 for(const value of changes){if(!value||!Number.isSafeInteger(value.start)||!Number.isSafeInteger(value.end)||value.start<0||value.end<value.start||value.end>text.length)fail();
  if(value.end>value.start)intervals.push({start:value.start,end:value.end});}
 intervals.sort((a,b)=>a.start-b.start);const merged=[];
 for(const value of intervals){const last=merged.at(-1);if(last&&value.start<=last.end)last.end=Math.max(last.end,value.end);else merged.push({...value});}
 let root;try{root=deriveUslmStructure(text).root;}catch{fail();}
 if(root.uri!==USLM||!['bill','resolution'].includes(root.local))fail();
 // Bound recursive rendering before entering it; hostile nesting cannot reach the JS stack limit.
 const pending=[{node:root,depth:1}];while(pending.length){const {node,depth}=pending.pop();if(depth>128)fail();if(node.children)for(const child of node.children)pending.push({node:child,depth:depth+1});}
 const blocks=[],mapping=[],omissions=[];
 const omit=(node,reason)=>omissions.push({rawStart:node.start,rawEnd:node.end,reason});
 if(root.start>0)omissions.push({rawStart:0,rawEnd:root.start,reason:'prolog'});
 if(root.end<text.length)omissions.push({rawStart:root.end,rawEnd:text.length,reason:'trailing-trivia'});
 function attributes(node,{table=false}={}){
  let hidden=false,preserve=false;
  for(const attribute of node.attributes){const {uri,local,value}=attribute;
   if(uri===XMLNS)continue;
   if(uri===XML&&local==='lang')continue;
   if(uri===XML&&local==='space'&&['default','preserve'].includes(value)){preserve=value==='preserve';if(table&&preserve)fail();continue;}
   if(node===root&&uri===XSI&&local==='schemaLocation')continue;
   if(uri!=='')fail();
   if(plainAttributes.has(local))continue;
   if(local==='display'&&['yes','no'].includes(value)){if(table&&value==='no')fail();hidden=value==='no';continue;}
   // These official-file tokens do not select CSS or alter tag-based paragraph boundaries.
   if(!table&&local==='class'&&value==='inline')continue;
   if(!table&&node.uri===USLM&&node.local==='main'&&local==='styleType'&&value==='multiple-resolved-clause')continue;
   fail();
  }return {hidden,preserve};
 }
 function push(block,entries){if(blockOffset+blocks.length>=1000)fail();const blockIndex=blockOffset+blocks.length;
  blocks.push(block);for(const entry of entries)mapping.push({blockIndex,...entry});}
 function mappedParts(node){
  if(mark===null)return [{start:0,end:node.decoded.length,marked:false}];
  const ranges=[];
  for(const span of node.spans)for(const change of merged){
   const raw={start:node.start+span.rawStart,end:node.start+span.rawEnd};if(!intersects(raw,change))continue;
   let start=span.decodedStart,end=span.decodedEnd;
   if(span.kind==='literal'){start+=Math.max(raw.start,change.start)-raw.start;end=span.decodedStart+Math.min(raw.end,change.end)-raw.start;
    if(!scalarBoundary(node.decoded,start))start--;if(!scalarBoundary(node.decoded,end))end++;}
   ranges.push({start,end});
  }
  const points=[...new Set([0,node.decoded.length,...ranges.flatMap(range=>[range.start,range.end])])].sort((a,b)=>a-b),parts=[];
  for(let index=1;index<points.length;index++){const start=points[index-1],end=points[index],marked=ranges.some(range=>range.start<end&&range.end>start),last=parts.at(-1);
   if(last&&last.marked===marked)last.end=end;else parts.push({start,end,marked});}
  return parts;
 }
 const isInline=node=>node.uri===USLM&&inline.has(node.local)||node.uri===HTML&&htmlInline.has(node.local);
 function flow(node,context){
  let runs=[],entries=[];
  const flush=()=>{if(!runs.length)return;push({kind:'paragraph',style:context.style??'Normal',...(context.quoteDepth?{quoteDepth:context.quoteDepth}:{}),runs},entries);runs=[];entries=[];};
  function append(child,format){
   const raw=text.slice(child.start,child.end);
   for(const part of mappedParts(child)){if(part.end===part.start)continue;
    const value=child.decoded.slice(part.start,part.end);if(chars(value)>100000||runs.length>=100)fail();
    const range=mapDecodedRange(raw,child.kind,part.start,part.end),runIndex=runs.length;
    runs.push({text:value,...format,...(part.marked?{[mark]:true}:{})});
    entries.push({kind:'run',runIndex,sourceStart:child.start,sourceEnd:child.end,rawStart:child.start+range.start,rawEnd:child.start+range.end,
     decodedStart:part.start,decodedEnd:part.end,textKind:child.kind});
   }
  }
  function inlineChildren(element,format){
   const attr=attributes(element);if(attr.hidden){omit(element,'display-no');return;}
   const next={...format,...(['b','strong'].includes(element.local)?{bold:true}:{}),...(['i','em'].includes(element.local)?{italic:true}:{})};
   for(const child of element.children){if(child.type==='text')append(child,next);else if(isInline(child))inlineChildren(child,next);else fail();}
  }
  for(const child of node.children){if(child.type==='text')append(child,{});else if(isInline(child))inlineChildren(child,{});
   else{flush();element(child,{...context,style:'Normal'},node.local);}}
  flush();
 }
 function table(node,context){
  if(context.quoteDepth||mark!==null&&merged.some(change=>intersects(change,{start:node.start,end:node.end})))fail();
  const rows=[],entries=[];
  const children=parent=>parent.children.filter(child=>{if(child.type==='text'){if(!whitespace(child.decoded))fail();omit(child,'indentation-whitespace');return false;}return true;});
  const rowNodes=[];
  for(const child of children(node)){
   if(child.uri!==HTML)fail();attributes(child,{table:true});
   if(child.local==='tr')rowNodes.push(child);
   else if(child.local==='tbody'){for(const row of children(child)){if(row.uri!==HTML||row.local!=='tr')fail();attributes(row,{table:true});rowNodes.push(row);}}
   else fail();
  }
  if(!rowNodes.length||rowNodes.length>1000)fail();let width=null;
  for(const row of rowNodes){const cells=children(row);if(!cells.length||cells.length>40||width!==null&&cells.length!==width)fail();width=cells.length;
   const values=[];for(const cell of cells){if(cell.uri!==HTML||cell.local!=='td')fail();attributes(cell,{table:true});
    let value='';const segments=[];
    for(const child of cell.children){if(child.type!=='text')fail();const start=value.length;value+=child.decoded;
     segments.push({sourceStart:child.start,sourceEnd:child.end,rawStart:child.start,rawEnd:child.end,decodedStart:start,decodedEnd:value.length,textKind:child.kind});}
    if(chars(value)>100000)fail();
    entries.push({kind:'cell',rowIndex:rows.length,columnIndex:values.length,rawStart:cell.start,rawEnd:cell.end,decodedStart:0,decodedEnd:value.length,segments});values.push(value);
   }rows.push(values);
  }
  push({kind:'table',rows},entries);
 }
 function element(node,context,parent){
  const uslm=node.uri===USLM,isTable=node.uri===HTML&&node.local==='table',dc=node.uri===DC&&parent==='preface'&&dcFields.has(node.local);
  const known=node===root||uslm&&(node.local==='meta'&&parent===root.local||containers.has(node.local)||paragraphs.has(node.local)||node.local==='quotedContent')||isTable||dc;
  if(!known)fail();const attr=attributes(node);if(attr.hidden){omit(node,'display-no');return;}
  if(uslm&&node.local==='meta'){omit(node,'metadata');return;}
  if(isTable){attributes(node,{table:true});table(node,context);return;}
  if(uslm&&node.local==='quotedContent'){
   const quoteDepth=context.quoteDepth+1;if(quoteDepth>8)fail();
   const nested={quoteDepth,style:'Normal',preserve:context.preserve||attr.preserve};
   if(node.children.some(child=>child.type==='text'?!whitespace(child.decoded):isInline(child)))flow(node,nested);
   else container(node,nested);return;
  }
  if(dc||uslm&&paragraphs.has(node.local)){
   const style=node.local==='coverTitle'||dc&&node.local==='title'?'Title':node.local==='heading'?'Heading 1':node.local==='subheading'?'Heading 2':'Normal';
   flow(node,{...context,style,preserve:context.preserve||attr.preserve});return;
  }
  container(node,{...context,preserve:context.preserve||attr.preserve});
 }
 function container(node,context){for(const child of node.children){
  if(child.type==='text'){if(!whitespace(child.decoded)||context.preserve)fail();omit(child,'indentation-whitespace');}
  else element(child,context,node.local);
 }}
 element(root,{quoteDepth:0,style:'Normal',preserve:false},null);
 omissions.sort((a,b)=>a.rawStart-b.rawStart||a.rawEnd-b.rawEnd);
 return frozen({blocks,mapping,omissions});
}
