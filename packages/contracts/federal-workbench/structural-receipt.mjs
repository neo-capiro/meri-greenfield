/** Browser-safe semantic checks for the source-bound structural ledger. No XML parser or rendering authority. */
import {decodeXmlTextRun,mapDecodedRange} from './xml-text-runs.mjs';
const fault=()=>{throw Object.assign(Error('STRUCTURAL_MISMATCH'),{code:'STRUCTURAL_MISMATCH'});};
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,names)=>{if(!record(value)||Object.keys(value).sort().join(',')!==[...names].sort().join(','))fault();};
const boundary=(text,at)=>at===0||at===text.length||!(text.charCodeAt(at-1)>=0xd800&&text.charCodeAt(at-1)<=0xdbff&&text.charCodeAt(at)>=0xdc00&&text.charCodeAt(at)<=0xdfff);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const range=(raw,start,end)=>{if(!integer(start)||!integer(end)||end<=start||end>raw.length||!boundary(raw,start)||!boundary(raw,end))fault();};
const intersects=(a,b)=>a.start<b.end&&b.start<a.end;
const text=value=>{if(typeof value!=='string'||[...value].length>100000)fault();};
const runKeys=['kind','blockIndex','runIndex','sourceStart','sourceEnd','rawStart','rawEnd','decodedStart','decodedEnd','textKind'];
const segmentKeys=['sourceStart','sourceEnd','rawStart','rawEnd','decodedStart','decodedEnd','textKind'];
const reasons=new Set(['metadata','display-no','indentation-whitespace','prolog','trailing-trivia']);
function source(raw){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>131072)fault();}

function changedRanges(node,start,changes){
 const ranges=[];
 for(const span of node.spans)for(const change of changes){
  const raw={start:start+span.rawStart,end:start+span.rawEnd};if(!intersects(raw,change))continue;
  let from=span.decodedStart,to=span.decodedEnd;
  if(span.kind==='literal'){from+=Math.max(raw.start,change.start)-raw.start;to=span.decodedStart+Math.min(raw.end,change.end)-raw.start;
   if(!boundary(node.decoded,from))from--;if(!boundary(node.decoded,to))to++;}
  ranges.push({start:from,end:to});
 }
 ranges.sort((a,b)=>a.start-b.start);const merged=[];
 for(const item of ranges){const previous=merged.at(-1);if(previous&&item.start<=previous.end)previous.end=Math.max(previous.end,item.end);else merged.push({...item});}
 return merged;
}

function validatePart(part,raw,changes,mark){
 exact(part,['blocks','mapping','omissions']);
 if(!Array.isArray(part.blocks)||part.blocks.length>1000||!Array.isArray(part.mapping)||part.mapping.length>131072||!Array.isArray(part.omissions)||part.omissions.length>131072)fault();
 const targets=[],layout=[];
 for(let blockIndex=0;blockIndex<part.blocks.length;blockIndex++){
  const block=part.blocks[blockIndex];if(!record(block))fault();
  if(block.kind==='paragraph'){
   exact(block,['kind','style','runs',...(Object.hasOwn(block,'quoteDepth')?['quoteDepth']:[])]);
   if(!['Normal','Title','Heading 1','Heading 2'].includes(block.style)||!Array.isArray(block.runs)||block.runs.length<1||block.runs.length>100||
    Object.hasOwn(block,'quoteDepth')&&(!Number.isSafeInteger(block.quoteDepth)||block.quoteDepth<1||block.quoteDepth>8))fault();
   layout.push({kind:'paragraph',style:block.style,quoteDepth:block.quoteDepth??0,pieces:[]});
   block.runs.forEach((run,runIndex)=>{
    if(!record(run)||Object.keys(run).some(key=>!['text','bold','italic','strike','underline'].includes(key)))fault();text(run.text);if(!run.text.length)fault();
    for(const key of ['bold','italic','strike','underline'])if(Object.hasOwn(run,key)&&run[key]!==true)fault();
    if(mark===null&&(run.strike||run.underline)||mark==='strike'&&run.underline||mark==='underline'&&run.strike)fault();
    targets.push({kind:'run',blockIndex,runIndex,run});
   });
  }else if(block.kind==='table'){
   exact(block,['kind','rows']);if(!Array.isArray(block.rows)||!block.rows.length||block.rows.length>1000)fault();
   let width=null;layout.push({kind:'table',rows:block.rows,cells:[]});
   block.rows.forEach((row,rowIndex)=>{if(!Array.isArray(row)||!row.length||row.length>40||width!==null&&width!==row.length)fault();width=row.length;
    row.forEach((cell,columnIndex)=>{text(cell);targets.push({kind:'cell',blockIndex,rowIndex,columnIndex,cell});});});
  }else fault();
 }
 if(part.mapping.length!==targets.length)fault();
 const cache=new Map(),rawSpans=[];let previousEnd=0;
 for(let index=0;index<targets.length;index++){
  const target=targets[index],entry=part.mapping[index];if(!record(entry)||entry.kind!==target.kind||entry.blockIndex!==target.blockIndex)fault();
  range(raw,entry.rawStart,entry.rawEnd);if(entry.rawStart<previousEnd)fault();previousEnd=entry.rawEnd;rawSpans.push({start:entry.rawStart,end:entry.rawEnd});
  if(entry.kind==='run'){
   exact(entry,runKeys);if(entry.runIndex!==target.runIndex||!['text','cdata'].includes(entry.textKind))fault();
   range(raw,entry.sourceStart,entry.sourceEnd);if(entry.rawStart<entry.sourceStart||entry.rawEnd>entry.sourceEnd)fault();
   const key=`${entry.sourceStart}:${entry.sourceEnd}:${entry.textKind}`;
   let mapped=cache.get(key);if(!mapped){const original=raw.slice(entry.sourceStart,entry.sourceEnd),run=decodeXmlTextRun(original,entry.textKind);
    mapped={original,run,marked:mark===null?[]:changedRanges(run,entry.sourceStart,changes)};cache.set(key,mapped);}
   if(!integer(entry.decodedStart)||!integer(entry.decodedEnd)||entry.decodedEnd<=entry.decodedStart||entry.decodedEnd>mapped.run.decoded.length)fault();
   const expected=mapDecodedRange(mapped.original,entry.textKind,entry.decodedStart,entry.decodedEnd);
   if(entry.sourceStart+expected.start!==entry.rawStart||entry.sourceStart+expected.end!==entry.rawEnd||
    mapped.run.decoded.slice(entry.decodedStart,entry.decodedEnd)!==target.run.text)fault();
   const covered=mapped.marked.reduce((n,item)=>n+Math.max(0,Math.min(item.end,entry.decodedEnd)-Math.max(item.start,entry.decodedStart)),0);
   if(covered!==(mark!==null&&target.run[mark]===true?entry.decodedEnd-entry.decodedStart:0))fault();
   const piece={sourceStart:entry.sourceStart,sourceEnd:entry.sourceEnd,rawStart:entry.rawStart,rawEnd:entry.rawEnd,
    decodedStart:entry.decodedStart,decodedEnd:entry.decodedEnd,textKind:entry.textKind,bold:target.run.bold===true,italic:target.run.italic===true};
   const pieces=layout[entry.blockIndex].pieces,last=pieces.at(-1);
   if(last&&last.sourceStart===piece.sourceStart&&last.sourceEnd===piece.sourceEnd&&last.rawEnd===piece.rawStart&&last.decodedEnd===piece.decodedStart&&
    last.textKind===piece.textKind&&last.bold===piece.bold&&last.italic===piece.italic){last.rawEnd=piece.rawEnd;last.decodedEnd=piece.decodedEnd;}
   else pieces.push(piece);
  }else{
   exact(entry,['kind','blockIndex','rowIndex','columnIndex','rawStart','rawEnd','decodedStart','decodedEnd','segments']);
   if(entry.rowIndex!==target.rowIndex||entry.columnIndex!==target.columnIndex||entry.decodedStart!==0||entry.decodedEnd!==target.cell.length||
    !Array.isArray(entry.segments)||entry.segments.length>131072||mark!==null&&changes.some(change=>intersects(change,{start:entry.rawStart,end:entry.rawEnd})))fault();
   let decoded='',end=entry.rawStart;const segments=[];
   for(const segment of entry.segments){exact(segment,segmentKeys);range(raw,segment.rawStart,segment.rawEnd);
    if(!['text','cdata'].includes(segment.textKind)||segment.sourceStart!==segment.rawStart||segment.sourceEnd!==segment.rawEnd||
     segment.rawStart<end||segment.rawStart<entry.rawStart||segment.rawEnd>entry.rawEnd||segment.decodedStart!==decoded.length)fault();
    const original=raw.slice(segment.rawStart,segment.rawEnd),run=decodeXmlTextRun(original,segment.textKind),whole=mapDecodedRange(original,segment.textKind,0,run.decoded.length);
    if(!run.decoded.length||whole.start!==0||whole.end!==original.length)fault();decoded+=run.decoded;
    if(segment.decodedEnd!==decoded.length)fault();end=segment.rawEnd;
    segments.push(Object.fromEntries(segmentKeys.map(key=>[key,segment[key]])));
   }
   if(decoded!==target.cell)fault();layout[entry.blockIndex].cells.push({rawStart:entry.rawStart,rawEnd:entry.rawEnd,segments});
  }
 }
 let omissionEnd=0;
 for(const omission of part.omissions){exact(omission,['rawStart','rawEnd','reason']);range(raw,omission.rawStart,omission.rawEnd);
  if(!reasons.has(omission.reason)||omission.rawStart<omissionEnd||rawSpans.some(span=>intersects(span,{start:omission.rawStart,end:omission.rawEnd})))fault();omissionEnd=omission.rawEnd;}
 // Styles/paragraph boundaries cannot be inferred without the XML owner. The two revised-byte views must agree.
 return {layout,omissions:part.omissions.map(({rawStart,rawEnd,reason})=>({rawStart,rawEnd,reason}))};
}

function validate(draft){
 if(!record(draft)||!record(draft.source)||typeof draft.parserVersion!=='string'||draft.parserVersion!==draft.source.parserVersion)fault();
 if(draft.parserVersion!=='federal-uslm-xml/3'){if(Object.hasOwn(draft,'structuralProjection'))fault();return;}
 const projection=draft.structuralProjection;if(!record(projection)||projection.profile!=='uslm-word/1')fault();
 source(draft.source.text);if(!record(draft.outputs)||!Array.isArray(draft.outputs.segments)||draft.outputs.segments.length>4096)fault();source(draft.outputs.consolidated);
 let before='',after='';const deletes=[],inserts=[];
 for(const segment of draft.outputs.segments){if(!record(segment)||!['unchanged','delete','insert'].includes(segment.kind)||typeof segment.text!=='string'||!segment.text.length)fault();
  if(segment.kind==='delete')deletes.push({start:before.length,end:before.length+segment.text.length});
  if(segment.kind==='insert')inserts.push({start:after.length,end:after.length+segment.text.length});
  if(segment.kind!=='insert')before+=segment.text;if(segment.kind!=='delete')after+=segment.text;
 }
 if(before!==draft.source.text||after!==draft.outputs.consolidated)fault();
 for(const span of deletes)range(before,span.start,span.end);for(const span of inserts)range(after,span.start,span.end);
 const removed=draft.resultKind==='source-text-removed';if(removed&&after!=='')fault();
 if(projection.status==='unsupported'){
  exact(projection,['profile','status','code']);if(!['DRAFT_STRUCTURAL_UNSUPPORTED','DRAFT_OUTPUT_LIMIT'].includes(projection.code))fault();return;
 }
 exact(projection,['profile','status','consolidated','original','revised']);if(projection.status!=='supported')fault();
 validatePart(projection.original,before,deletes,'strike');
 if(removed){if(projection.consolidated!==null||projection.revised!==null)fault();}
 else{
  if(!after.length)fault();const plain=validatePart(projection.consolidated,after,[],null),marked=validatePart(projection.revised,after,inserts,'underline');
  if(JSON.stringify(plain)!==JSON.stringify(marked))fault();
 }
}

export function assertStructuralProjection(draft){try{validate(draft);}catch{fault();}}
