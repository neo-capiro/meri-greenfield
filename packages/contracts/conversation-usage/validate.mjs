import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import {data} from '../commands-0.2/execution-boundary.mjs';
import {conversationUsageSchema} from './schema.mjs';
import {assertUsageResponseSemantics,fail} from './semantics.mjs';
const schema=conversationUsageSchema(),ajv=new Ajv({strict:true,allErrors:false});formats(ajv);ajv.addSchema(schema);
const request=ajv.compile({$ref:schema.$id+'#/$defs/ConversationUsageRequest'}),response=ajv.compile({$ref:schema.$id+'#/$defs/ConversationUsageResponse'});
export function assertConversationUsageRequest(raw){const value=data(raw);if(!request(value))fail('USAGE_REQUEST_INVALID');return value;}
export function assertConversationUsageResponse(raw,expected){const value=data(raw);if(!response(value))fail('INVALID_USAGE_RESPONSE');return assertUsageResponseSemantics(value,expected);}
