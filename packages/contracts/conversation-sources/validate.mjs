/** Explicit additive source shape; the frozen SourceEvidence/UIEvent validators stay unchanged. */
import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import original from '../meri.schema.json' with {type:'json'};
import schema from '../native-bill-text-source.schema.json' with {type:'json'};
import {data} from '../commands-0.2/execution-boundary.mjs';
import {validateShape} from '../validate.mjs';
import {BILL_TEXT_SOURCE_EVENT} from './protocol.mjs';
import {assertNativeSourceEventSemantics,assertSourceReadSemantics,fail} from './semantics.mjs';
const ajv=new Ajv({strict:true,allErrors:false});formats(ajv);ajv.addSchema(original);ajv.addSchema(schema);
const validators=new Map();
export function assertSourceShape(name,raw){const value=data(raw);let validate=validators.get(name);
 if(!Object.hasOwn(schema.$defs,name))fail('INVALID_SOURCE_SHAPE');
 if(!validate){validate=ajv.compile({$ref:schema.$id+'#/$defs/'+name});validators.set(name,validate);}
 if(!validate(value))fail('INVALID_SOURCE_SHAPE');return value;
}
export function assertNativeSourceEvent(raw){return assertNativeSourceEventSemantics(assertSourceShape('NativeBillTextSourceEvent',raw));}
export function assertConversationEvent(raw){return raw?.type===BILL_TEXT_SOURCE_EVENT?assertNativeSourceEvent(raw):validateShape('UIEvent',raw);}
export function assertSourceReadRequest(raw){return assertSourceShape('BillTextSourceReadRequest',raw);}
export function assertSourceReadResponse(raw,request){return assertSourceReadSemantics(assertSourceShape('BillTextSourceReadResponse',raw),request);}
