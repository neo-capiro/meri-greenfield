/** Explicit additive source shape; the frozen SourceEvidence/UIEvent validators stay unchanged. */
import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import original from '../meri.schema.json' with {type:'json'};
import schema from '../native-bill-text-source.schema.json' with {type:'json'};
import hearing from '../native-hearing-source.schema.json' with {type:'json'};
import hearingResult from '../retrieval-0.2/public-domain-hearings.schema.json' with {type:'json'};
import hearingRecords from '../retrieval-0.2/public-domain-hearing-records.schema.json' with {type:'json'};
import outreach from '../retrieval-0.2/outreach-query.schema.json' with {type:'json'};
import {data} from '../commands-0.2/execution-boundary.mjs';
import {validateShape} from '../validate.mjs';
import {BILL_TEXT_SOURCE_EVENT,HEARING_SOURCE_EVENT,HEARING_SOURCE_READ_SCHEMA} from './protocol.mjs';
import {assertHearingSourceEventSemantics,assertHearingSourceReadSemantics} from './hearing-semantics.mjs';
import {assertNativeSourceEventSemantics,assertSourceReadSemantics,fail} from './semantics.mjs';
const ajv=new Ajv({strict:true,allErrors:false});formats(ajv);ajv.addSchema(original);ajv.addSchema(schema);
for(const s of [outreach,hearingRecords,hearingResult,hearing])ajv.addSchema(s);
const validators=new Map();
export function assertSourceShape(name,raw){const value=data(raw);let validate=validators.get(name);
 const owner=[schema,hearing].find(s=>Object.hasOwn(s.$defs,name));if(!owner)fail('INVALID_SOURCE_SHAPE');
 if(!validate){validate=ajv.compile({$ref:owner.$id+'#/$defs/'+name});validators.set(name,validate);}
 if(!validate(value))fail('INVALID_SOURCE_SHAPE');return value;
}
export const isNativeSourceEventType=type=>type===BILL_TEXT_SOURCE_EVENT||type===HEARING_SOURCE_EVENT;
export function assertNativeSourceEvent(raw){return raw?.type===HEARING_SOURCE_EVENT?assertHearingSourceEventSemantics(assertSourceShape('NativeHearingSourceEvent',raw)):assertNativeSourceEventSemantics(assertSourceShape('NativeBillTextSourceEvent',raw));}
export function assertConversationEvent(raw){return isNativeSourceEventType(raw?.type)?assertNativeSourceEvent(raw):validateShape('UIEvent',raw);}
export function assertSourceReadRequest(raw){return assertSourceShape(raw?.schemaVersion===HEARING_SOURCE_READ_SCHEMA?'HearingSourceReadRequest':'BillTextSourceReadRequest',raw);}
export function assertSourceReadResponse(raw,request){return request.schemaVersion===HEARING_SOURCE_READ_SCHEMA?assertHearingSourceReadSemantics(assertSourceShape('HearingSourceReadResponse',raw),request):assertSourceReadSemantics(assertSourceShape('BillTextSourceReadResponse',raw),request);}
