/** Minimal strict PDF object syntax (ISO 32000-2 §7.2–7.5) over a latin1 string, sufficient to read cross-reference
 * sections, trailers, object streams and the document catalog. Values: numbers, booleans, null, `Map` dictionaries
 * (keys without the slash), arrays, `{kind:'name',value}`, `{kind:'ref',num,gen}` and `{kind:'string'}` (contents not
 * kept). Anything else, an unterminated construct, a duplicate dictionary key or nesting deeper than MAX_DEPTH
 * refuses. Streams are decoded only for FlateDecode (bounded inflate) with optional PNG predictors. */
import {inflateSync} from 'node:zlib';
import {refuse} from './refusal.mjs';
const MAX_DEPTH=32;
const WHITE='\0\t\n\f\r ',DELIMITERS='()<>[]{}/%';
const REF_TAIL=/[\0\t\n\f\r ]+(\d{1,10})[\0\t\n\f\r ]+R(?![^\0\t\n\f\r ()<>[\]{}/%])/y;
const HEADER=/(\d{1,10})[\0\t\n\f\r ]+(\d{1,5})[\0\t\n\f\r ]+obj(?![^\0\t\n\f\r ()<>[\]{}/%])/y;
const END_STREAM=/(?:\r\n|\r|\n)?[\0\t\f ]*endstream(?![^\0\t\n\f\r ()<>[\]{}/%])/y;
export const isName=(value,name)=>value?.kind==='name'&&value.value===name;
export const isRef=value=>value?.kind==='ref';
export const isCount=value=>Number.isSafeInteger(value)&&value>=0;
/** Index after whitespace and comments. */
export function skipSpace(src,i){
 for(;;){
  while(i<src.length&&WHITE.includes(src[i]))i++;
  if(src[i]!=='%')return i;
  while(i<src.length&&src[i]!=='\n'&&src[i]!=='\r')i++;
 }
}
const regularEnd=(src,i)=>{while(i<src.length&&!WHITE.includes(src[i])&&!DELIMITERS.includes(src[i]))i++;return i;};
/** Parses one direct object at `i`; returns [value, index after it]. */
export function parseValue(src,i,depth=0){
 if(depth>MAX_DEPTH)refuse('PDF_LIMIT');
 i=skipSpace(src,i);const c=src[i];
 if(c===undefined)refuse('PDF_OBJECT');
 if(c==='<'&&src[i+1]==='<'){
  const map=new Map();i+=2;
  for(;;){
   i=skipSpace(src,i);if(src.startsWith('>>',i))return [map,i+2];
   const [key,k]=parseValue(src,i,depth+1);if(key?.kind!=='name'||map.has(key.value))refuse('PDF_OBJECT');
   const [value,v]=parseValue(src,k,depth+1);map.set(key.value,value);i=v;
  }
 }
 if(c==='<'){const end=src.indexOf('>',i);if(end<0||!/^[0-9A-Fa-f\0\t\n\f\r ]*$/u.test(src.slice(i+1,end)))refuse('PDF_OBJECT');return [{kind:'string'},end+1];}
 if(c==='['){
  const items=[];i++;
  for(;;){i=skipSpace(src,i);if(src[i]===']')return [items,i+1];const [v,e]=parseValue(src,i,depth+1);items.push(v);i=e;}
 }
 if(c==='('){
  let level=0;
  for(let j=i;j<src.length;j++){const ch=src[j];if(ch==='\\'){j++;continue;}if(ch==='(')level++;else if(ch===')'&&--level===0)return [{kind:'string'},j+1];}
  refuse('PDF_OBJECT');
 }
 if(c==='/'){const end=regularEnd(src,i+1);return [{kind:'name',value:src.slice(i+1,end)},end];}
 const end=regularEnd(src,i),token=src.slice(i,end);
 if(/^\d{1,10}$/u.test(token)){REF_TAIL.lastIndex=end;const m=REF_TAIL.exec(src);if(m)return [{kind:'ref',num:Number(token),gen:Number(m[1])},REF_TAIL.lastIndex];}
 if(/^[+-]?(?:\d+\.?\d*|\.\d+)$/u.test(token))return [Number(token),end];
 if(token==='true'||token==='false')return [token==='true',end];
 if(token==='null')return [null,end];
 return refuse('PDF_OBJECT');
}
/** `{num,gen,end}` when an indirect-object header `N G obj` starts exactly at `offset`, otherwise null. */
export function objectHeaderAt(src,offset){
 HEADER.lastIndex=offset;const m=HEADER.exec(src);
 return m?{num:Number(m[1]),gen:Number(m[2]),end:HEADER.lastIndex}:null;
}
/** Reads the indirect object at `offset`, which must be `expected` when given. A stream's `/Length` must be direct
 * unless `lengthOf(ref)` resolves it. Returns `{num,gen,value,stream?:{start,length}}`. */
export function readIndirectObject(src,offset,expected,lengthOf){
 const h=objectHeaderAt(src,offset);
 if(!h||expected&&(h.num!==expected.num||h.gen!==expected.gen))refuse('PDF_OBJECT');
 const [value,end]=parseValue(src,h.end);let i=skipSpace(src,end),stream;
 if(value instanceof Map&&src.startsWith('stream',i)){
  i+=6;if(src.startsWith('\r\n',i))i+=2;else if(src[i]==='\n')i++;else refuse('PDF_OBJECT');
  const declared=value.get('Length'),length=isRef(declared)&&lengthOf?lengthOf(declared):declared;
  if(!isCount(length)||i+length>src.length)refuse('PDF_OBJECT');
  stream={start:i,length};END_STREAM.lastIndex=i+length;if(!END_STREAM.exec(src))refuse('PDF_OBJECT');
  i=skipSpace(src,END_STREAM.lastIndex);
 }
 if(!src.startsWith('endobj',i))refuse('PDF_OBJECT');
 return {num:h.num,gen:h.gen,value,...(stream?{stream}:{})};
}
const single=v=>Array.isArray(v)?(v.length<=1?v[0]:refuse('PDF_OBJECT')):v;
/** Reverses a PNG predictor (Predictor 10–15, one 8-bit colour component per sample). */
function unpredict(data,parms,reason){
 if(parms===undefined||parms===null)return data;
 if(!(parms instanceof Map))refuse(reason);
 const predictor=parms.get('Predictor')??1;if(predictor===1)return data;
 const columns=parms.get('Columns')??1;
 if(!(predictor>=10&&predictor<=15)||(parms.get('Colors')??1)!==1||(parms.get('BitsPerComponent')??8)!==8||!Number.isSafeInteger(columns)||columns<1)refuse(reason);
 const row=columns+1;if(data.length%row)refuse(reason);
 const rows=data.length/row,out=Buffer.alloc(rows*columns);let prev=Buffer.alloc(columns);
 for(let r=0;r<rows;r++){
  const type=data[r*row],line=data.subarray(r*row+1,(r+1)*row),cur=out.subarray(r*columns,(r+1)*columns);
  for(let x=0;x<columns;x++){
   const a=x?cur[x-1]:0,b=prev[x],c=x?prev[x-1]:0;let v=line[x];
   if(type===1)v+=a;else if(type===2)v+=b;else if(type===3)v+=(a+b)>>1;
   else if(type===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
   else if(type!==0)refuse(reason);
   cur[x]=v&0xff;
  }
  prev=cur;
 }
 return out;
}
/** Decoded stream bytes: no filter or FlateDecode only, inflate bounded by `maxBytes`. */
export function decodeStream(src,dict,stream,maxBytes,reason){
 const raw=Buffer.from(src.slice(stream.start,stream.start+stream.length),'latin1');
 const filter=single(dict.get('Filter')),parms=single(dict.get('DecodeParms'));
 if(filter===undefined)return unpredict(raw,parms,reason);
 if(!isName(filter,'FlateDecode'))refuse(reason);
 let data;try{data=inflateSync(raw,{maxOutputLength:maxBytes});}catch{refuse(reason);}
 return unpredict(data,parms,reason);
}
