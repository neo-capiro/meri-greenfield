/** Explicit additive source shape; the frozen SourceEvidence/UIEvent validators stay unchanged. */
import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import original from '../meri.schema.json' with {type:'json'};
import schema from '../native-bill-text-source.schema.json' with {type:'json'};
import hearing from '../native-hearing-source.schema.json' with {type:'json'};
import media from '../native-hearing-media.schema.json' with {type:'json'};
import upload from '../native-upload-source.schema.json' with {type:'json'};
import userQuestion from '../native-user-question-event.schema.json' with {type:'json'};
import hearingResult from '../retrieval-0.2/public-domain-hearings.schema.json' with {type:'json'};
import hearingRecords from '../retrieval-0.2/public-domain-hearing-records.schema.json' with {type:'json'};
import outreach from '../retrieval-0.2/outreach-query.schema.json' with {type:'json'};
import {data} from '../commands-0.2/execution-boundary.mjs';
import {validateShape} from '../validate.mjs';
import {BILL_TEXT_SOURCE_EVENT,HEARING_SOURCE_EVENT,HEARING_SOURCE_READ_SCHEMA,HEARING_MEDIA_READ_SCHEMA,UPLOAD_SOURCE_EVENT,USER_QUESTION_PENDING_EVENT,USER_QUESTION_ANSWERED_EVENT} from './protocol.mjs';
import {assertHearingMediaReadSemantics} from './hearing-media-semantics.mjs';
import {assertHearingSourceEventSemantics,assertHearingSourceReadSemantics} from './hearing-semantics.mjs';
import {assertNativeSourceEventSemantics,assertSourceReadSemantics,fail} from './semantics.mjs';
import {assertUploadSourceEventSemantics} from './upload-semantics.mjs';
const ajv=new Ajv({strict:true,allErrors:false});formats(ajv);ajv.addSchema(original);ajv.addSchema(schema);
for(const s of [outreach,hearingRecords,hearingResult,hearing,media,upload,userQuestion])ajv.addSchema(s);
const validators=new Map();
export function assertSourceShape(name,raw){const value=data(raw);let validate=validators.get(name);
 const owner=[schema,hearing,media,upload,userQuestion].find(s=>Object.hasOwn(s.$defs,name));if(!owner)fail('INVALID_SOURCE_SHAPE');
 if(!validate){validate=ajv.compile({$ref:owner.$id+'#/$defs/'+name});validators.set(name,validate);}
 if(!validate(value))fail('INVALID_SOURCE_SHAPE');return value;
}
export const isNativeSourceEventType=type=>type===BILL_TEXT_SOURCE_EVENT||type===HEARING_SOURCE_EVENT||type===UPLOAD_SOURCE_EVENT;
export function assertNativeSourceEvent(raw){
 if(raw?.type===HEARING_SOURCE_EVENT)return assertHearingSourceEventSemantics(assertSourceShape('NativeHearingSourceEvent',raw));
 if(raw?.type===UPLOAD_SOURCE_EVENT)return assertUploadSourceEventSemantics(assertSourceShape('NativeUploadSourceEvent',raw));
 return assertNativeSourceEventSemantics(assertSourceShape('NativeBillTextSourceEvent',raw));
}
export const isUserQuestionEventType=type=>type===USER_QUESTION_PENDING_EVENT||type===USER_QUESTION_ANSWERED_EVENT;
/** The pending question and its outcome are additive run events: the frozen UIEvent validator is unchanged, and the same
 * duplicate/shape rules the worker applies are enforced here before the row is stored. */
export function assertUserQuestionEvent(raw){
 if(raw?.type===USER_QUESTION_ANSWERED_EVENT){const value=assertSourceShape('NativeUserQuestionAnsweredEvent',raw);
  if(value.data.outcome==='answered'&&value.data.reasonCode!==null||value.data.outcome==='cancelled'&&value.data.reasonCode===null)fail('INVALID_USER_QUESTION_EVENT');
  return value;}
 const value=assertSourceShape('NativeUserQuestionEvent',raw),questions=value.data.questions;
 const texts=new Set();
 for(const question of questions){if(texts.has(question.question))fail('INVALID_USER_QUESTION_EVENT');texts.add(question.question);
  if(new Set(question.options.map(option=>option.label)).size!==question.options.length)fail('INVALID_USER_QUESTION_EVENT');}
 return value;
}
export function assertConversationEvent(raw){
 if(isUserQuestionEventType(raw?.type))return assertUserQuestionEvent(raw);
 return isNativeSourceEventType(raw?.type)?assertNativeSourceEvent(raw):validateShape('UIEvent',raw);}
export function assertSourceReadRequest(raw){return assertSourceShape(raw?.schemaVersion===HEARING_MEDIA_READ_SCHEMA?'HearingMediaReadRequest':raw?.schemaVersion===HEARING_SOURCE_READ_SCHEMA?'HearingSourceReadRequest':'BillTextSourceReadRequest',raw);}
export function assertSourceReadResponse(raw,request){return request.schemaVersion===HEARING_MEDIA_READ_SCHEMA?assertHearingMediaReadSemantics(assertSourceShape('HearingMediaReadResponse',raw),request):request.schemaVersion===HEARING_SOURCE_READ_SCHEMA?assertHearingSourceReadSemantics(assertSourceShape('HearingSourceReadResponse',raw),request):assertSourceReadSemantics(assertSourceShape('BillTextSourceReadResponse',raw),request);}
