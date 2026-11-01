/** Upload inspection pipeline. Only trusted scanner/parser ports produce observations; no model invocation. */
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {uploadOriginalIdentity,uploadStructureRefusal,uploadDeclaration,uploadError,UPLOAD_LIMITS,UPLOAD_POLICY_VERSION} from './policy.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
const fail=()=>{throw uploadError('UPLOAD_TOOL_RECEIPT');};
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const code=v=>typeof v==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/u.test(v);
function tool(raw){
 const t=own(data(raw),['name','version','binarySha256']);
 if(!/^[a-z][a-z0-9_.-]{0,63}$/u.test(t.name)||typeof t.version!=='string'||!t.version||t.version.length>128||!hash(t.binarySha256))fail();
 return t;
}
function observed(raw,file,began,at){
 const r=data(raw);
 if(r.sourceSha256!==file.sha256||r.sourceBytes!==file.bytes||!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<began||r.checkedAtMs>at)fail();
 return r;
}
function scanReceipt(raw,file,began,at){
 const r=own(observed(raw,file,began,at),['sourceSha256','sourceBytes','checkedAtMs','status','tool','definitionsSha256','reason']);
 if(!['clean','infected','unavailable'].includes(r.status)||r.reason!==null&&!code(r.reason)||
  r.status!=='unavailable'&&(r.tool===null||!hash(r.definitionsSha256))||r.status!=='clean'&&r.reason===null||r.status==='clean'&&r.reason!==null)fail();
 if(r.tool!==null)tool(r.tool);
 if(r.definitionsSha256!==null&&!hash(r.definitionsSha256))fail();
 return r;
}
function segments(raw,file,retained){
 if(!Array.isArray(raw)||raw.length>UPLOAD_LIMITS.pdfPages+UPLOAD_LIMITS.slides+UPLOAD_LIMITS.sheets+1)fail();
 let characters=0,lowConfidence=false;const ids=new Set();
 return {segments:raw.map(value=>{
  const s=own(data(value),['ordinal','text','method','confidence','location',...(retained?['sourceSha256','trust']:[])]);
  if(retained&&(s.sourceSha256!==file.sha256||s.trust!=='external_untrusted'))fail();
  if(!Number.isSafeInteger(s.ordinal)||s.ordinal<0||ids.has(s.ordinal)||typeof s.text!=='string'||!s.text.isWellFormed()||
   !['native','ocr'].includes(s.method)||s.confidence!==null&&(!Number.isFinite(s.confidence)||s.confidence<0||s.confidence>1))fail();
  ids.add(s.ordinal);characters+=s.text.length;if(characters>UPLOAD_LIMITS.textCharacters)fail();
  const p=own(data(s.location),['page','slide','sheet','rowStart','rowEnd']);
  for(const [name,maximum] of [['page',UPLOAD_LIMITS.pdfPages],['slide',UPLOAD_LIMITS.slides],['sheet',UPLOAD_LIMITS.sheets],['rowStart',UPLOAD_LIMITS.rows],['rowEnd',UPLOAD_LIMITS.rows]])
   if(p[name]!==null&&(!Number.isSafeInteger(p[name])||p[name]<1||p[name]>maximum))fail();
  if((p.rowStart===null)!==(p.rowEnd===null)||p.rowStart!==null&&p.rowEnd<p.rowStart||s.method==='ocr'&&(s.confidence===null||p.page!==null&&p.page>UPLOAD_LIMITS.ocrPages))fail();
  if(s.method==='ocr'&&s.confidence<UPLOAD_LIMITS.lowConfidence)lowConfidence=true;
  return {...s,sourceSha256:file.sha256,trust:'external_untrusted'};
 }),lowConfidence:()=>lowConfidence};
}
function extractionReceipt(raw,file,began,at,retained=false){
 const r=own(observed(raw,file,began,at),['sourceSha256','sourceBytes','checkedAtMs','status','tool','segments','limitations']);
 if(!['available','partial','unavailable','blocked'].includes(r.status)||!Array.isArray(r.limitations)||r.limitations.length>16||r.limitations.some(v=>!code(v))||
  new Set(r.limitations).size!==r.limitations.length||r.status!=='available'&&!r.limitations.length)fail();
 if(r.tool!==null)tool(r.tool);else if(['available','partial'].includes(r.status))fail();
 const result=segments(r.segments,file,retained);
 if(['unavailable','blocked'].includes(r.status)&&result.segments.length||r.status==='available'&&r.limitations.length)fail();
 const limitations=[...r.limitations];
 if(result.lowConfidence()&&!limitations.includes('OCR_LOW_CONFIDENCE'))limitations.push('OCR_LOW_CONFIDENCE');
 return {...r,segments:result.segments,status:result.lowConfidence()?'partial':r.status,limitations};
}
/** Dependencies are captured server ports, never accepted from an upload body. Each operation has its own physical-stop owner. */
export function createUploadInspection({scanner=null,extractor=null,now=Date.now}){
 if(typeof now!=='function')throw uploadError('UPLOAD_CONFIGURATION');
 scanner=scanner===null?null:{scan:storageMethod(scanner,'scan')};extractor=extractor===null?null:{extract:storageMethod(extractor,'extract')};
 async function call(port,method,file,bytes,maximum,deadlineMs,signal){
  const began=now(),life=createOperationLifetime({now,deadlineMs:Math.min(deadlineMs,began+maximum),signal,errorFactory:uploadError});
  try{const value=await life.run(signal=>port[method]({file,bytes:Buffer.from(bytes),limits:UPLOAD_LIMITS,deadlineMs:life.deadline(),signal}));life.check();return {value,began,at:now()};}
  finally{life.close();}
 }
 return Object.freeze({async inspect(declaration,bytes,{deadlineMs,signal}={}){
  if(!Number.isSafeInteger(deadlineMs)||deadlineMs<=now()||signal?.aborted)throw uploadError('UPLOAD_EXPIRED');
  // Only identity is a precondition: mismatched bytes were never this original. Structure is judged AFTER a clean scan
  // and retained on the stored record as a blocked extraction, so a refusal of an already-stored original is reported
  // as "stored, then refused" rather than thrown away as an effect-free failure.
  const file=Object.freeze({...uploadOriginalIdentity(declaration,bytes),policyVersion:UPLOAD_POLICY_VERSION}),base={sourceSha256:file.sha256,sourceBytes:file.bytes};
  const unavailable=(name,reason,status='unavailable')=>({...base,checkedAtMs:now(),status,tool:null,...(name==='scan'?{definitionsSha256:null,reason}:{segments:[],limitations:[reason]})});
  let scan;
  if(scanner===null)scan=unavailable('scan','SCANNER_UNAVAILABLE');
  else{const out=await call(scanner,'scan',file,bytes,UPLOAD_LIMITS.scanMs,deadlineMs,signal);scan=scanReceipt(out.value,file,out.began,out.at);}
  if(scan.status!=='clean')return {file,scan,extraction:unavailable('extraction',scan.status==='infected'?'MALWARE_DETECTED':'SCAN_UNAVAILABLE')};
  const refusal=uploadStructureRefusal(file,bytes);
  let extraction;
  if(refusal!==null)extraction=unavailable('extraction',refusal,'blocked');
  else if(extractor===null)extraction=unavailable('extraction','EXTRACTOR_UNAVAILABLE');
  else{const out=await call(extractor,'extract',file,bytes,UPLOAD_LIMITS.parseMs+UPLOAD_LIMITS.ocrMs,deadlineMs,signal);extraction=extractionReceipt(out.value,file,out.began,out.at);}
  if(signal?.aborted||now()>=deadlineMs)throw uploadError('UPLOAD_EXPIRED');
  return {file,scan,extraction};
 }});
}
/** Revalidate retained observations without calling a tool. Current access and original byte integrity remain separate gates. */
export function validateUploadInspection(raw,declaration,{fromMs,toMs}){
 const r=own(data(raw),['file','scan','extraction']),file={...uploadDeclaration(declaration),policyVersion:UPLOAD_POLICY_VERSION};
 own(r.file,Object.keys(file));for(const key of Object.keys(file))if(r.file[key]!==file[key])fail();
 const scan=scanReceipt(r.scan,file,fromMs,toMs),extraction=extractionReceipt(r.extraction,file,fromMs,toMs,true);
 if(scan.status!=='clean'&&extraction.segments.length)fail();
 return {file,scan,extraction};
}
