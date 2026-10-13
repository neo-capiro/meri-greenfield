/** Shared DTO owner; semantic/current authority remains with existing services. */
import Ajv from 'ajv/dist/2020.js';import formats from 'ajv-formats';import {readFileSync} from 'node:fs';
import {lifecycleSchema} from './schema.mjs';
const schema=lifecycleSchema(),ajv=new Ajv({strict:true,allErrors:false});formats(ajv);ajv.addSchema(JSON.parse(readFileSync(new URL('../meri.schema.json',import.meta.url),'utf8')));ajv.addSchema(schema);
const validators=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:schema.$id+'#/$defs/'+name})]));
export function assertLifecycleShape(name,value){if(!validators.get(name)?.(value))throw Object.assign(new Error('LIFECYCLE_INPUT_REFUSED'),{code:'LIFECYCLE_INPUT_REFUSED'});return value;}
