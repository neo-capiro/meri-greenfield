import Ajv from 'ajv/dist/2020.js';import formats from 'ajv-formats';
import {data} from '../commands-0.2/execution-boundary.mjs';
import {runIndexSchema} from './run-schema.mjs';
import {assertRunIndexSemantics,runIndexFail} from './run-semantics.mjs';
const schema=runIndexSchema(),ajv=new Ajv({strict:true,allErrors:false});formats(ajv);ajv.addSchema(schema);
const validators=Object.fromEntries(['list','detail'].map(route=>[route,Object.fromEntries(['Request','Response'].map(kind=>[kind,ajv.compile({$ref:schema.$id+'#/$defs/RunIndex'+(route==='list'?'List':'Detail')+kind})]))]));
export function assertRunIndexRequest(route,raw){const value=data(raw);if(!validators[route]?.Request(value))runIndexFail('RUN_INDEX_REQUEST_INVALID');return value;}
export function assertRunIndexResponse(route,raw,request){const value=data(raw);if(!validators[route]?.Response(value))runIndexFail('INVALID_RESPONSE');return assertRunIndexSemantics(route,assertRunIndexRequest(route,request),value);}
