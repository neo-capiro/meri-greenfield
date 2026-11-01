/** Dedicated retained-workbench negotiation; the frozen SDK source wire is unchanged. */
import {createHash} from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import schema from './raw-source.schema.json' with {type:'json'};
import {own,data} from '../commands-0.2/execution-boundary.mjs';
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';
export const FEDERAL_RAW_REPRESENTATION='retained-raw-utf8/1';
const legacy=resolveOperationContract({id:'read_federal_draft_source',version:'0.2.0'});
const ajv=new Ajv({strict:true});ajv.addSchema(schema);
const validate=ajv.compile({$ref:schema.$id+'#/$defs/FederalRawSource'});
const fail=()=>{throw Error('FEDERAL_RAW_SOURCE_INVALID');};
export function normalizeFederalRawRequest(raw){
 const request=data(own(raw,['billId','versionCode','revisionId','versionHash','textHash','representation']));
 if(request.representation!==FEDERAL_RAW_REPRESENTATION)fail();
 const {representation,...selection}=request;legacy.normalizeInput(selection);
 return request;
}
export function assertFederalRawSource(value,rawRequest){
 const {representation,...selection}=normalizeFederalRawRequest(rawRequest);
 const out=data(value);
 if(out.representation!==representation)fail();
 const {representation:omitted,raw,...original}=out;
 if(original.currentStatus==='unavailable'){
  if(raw!==undefined)fail();
  const reasons=['raw_capture_unreported','raw_capture_unsupported','raw_capture_unverified'];
  legacy.assertOutput({...original,reason:reasons.includes(original.reason)?'source_integrity_unverified':original.reason},{request:selection});
  return value;
 }
 legacy.assertOutput(original,{request:selection});
 if(!validate(raw)||raw.text!==original.source.text||raw.sha256!==selection.versionHash||raw.sha256!==selection.textHash||
  !original.source.evidenceParserVersion.endsWith('+federal-source-capture/1'))fail();
 const bytes=Buffer.from(raw.text,'utf8'),capture=raw.capture;
 if(bytes.toString('utf8')!==raw.text||raw.text.includes('\0')||bytes.length!==raw.byteLength||
  createHash('sha256').update(bytes).digest('hex')!==raw.sha256||capture.sha256!==raw.sha256||capture.byteLength!==raw.byteLength||capture.format!==raw.format)fail();
 const charset=capture.mediaType?.match(/(?:^|;)\s*charset\s*=\s*["']?([^\s;"']+)/iu)?.[1];
 const markup=/^[\s\uFEFF]*(?:<\?xml\b|<!DOCTYPE\b|<!--|<[A-Za-z_][\w.:-]*(?=[\s/>]|$))/iu.test(raw.text);
 const declaration=raw.format==='xml'?raw.text.match(/^\uFEFF?\s*<\?xml\s[^?]*\bencoding\s*=\s*['"]([^'"]+)['"]/iu)?.[1]:undefined;
 if(charset!==undefined&&!/^utf-8$/iu.test(charset)||declaration!==undefined&&!/^utf-8$/iu.test(declaration)||markup!==(raw.format==='xml'))fail();
 return value;
}
