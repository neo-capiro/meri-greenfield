/** Node-only shape owner. Imports read immutable schema artifacts; validators compile lazily. */
import Ajv from 'ajv/dist/2020.js';import formats from 'ajv-formats';import {readFileSync} from 'node:fs';
import {inputSchema} from './schema.mjs';import {fail} from './semantics.mjs';
const schema=inputSchema(),ajv=new Ajv({strict:true,allErrors:false});formats(ajv);
for(const path of ['../meri.schema.json','../dist/conversation-application.schema.json'])ajv.addSchema(JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8')));
ajv.addSchema(schema);const validators=new Map();
export function assertInputShape(name,value){if(!Object.hasOwn(schema.$defs,name))fail('INVALID_INPUT_SHAPE');let validate=validators.get(name);if(!validate){validate=ajv.compile({$ref:schema.$id+'#/$defs/'+name});validators.set(name,validate);}if(!validate(value))fail('INVALID_RESPONSE');return value;}
