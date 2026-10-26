/** Node boundary over the same public schema; no authorization is supplied. */
import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import {data} from '../commands-0.2/execution-boundary.mjs';
import {feedbackDefinitions} from './feedback-schema.mjs';
const ajv=new Ajv({strict:true,allErrors:false});formats(ajv);
const schema={$id:'urn:meri:feedback-shapes:1',$defs:feedbackDefinitions};ajv.addSchema(schema);
const validators=new Map();
export function assertFeedbackShape(name,raw){
 const value=data(raw);let validate=validators.get(name);
 if(!Object.hasOwn(feedbackDefinitions,name))throw Error('INVALID_ROUTE');
 if(!validate){validate=ajv.compile({$ref:schema.$id+'#/$defs/'+name});validators.set(name,validate);}
 if(!validate(value))throw Object.assign(new Error('INVALID_REQUEST'),{code:'INVALID_REQUEST'});
 return value;
}
