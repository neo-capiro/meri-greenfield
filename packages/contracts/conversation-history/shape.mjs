/** Node schema owner. Import is IO-read-only; compile only a requested shape. */
import Ajv from 'ajv/dist/2020.js';import formats from 'ajv-formats';import {readFileSync} from 'node:fs';
import {historySchema} from './schema.mjs';import {fail} from './semantics.mjs';
const schema=historySchema(),ajv=new Ajv({strict:true,allErrors:false});formats(ajv);
for(const path of ['../meri.schema.json','../dist/conversation-application.schema.json'])ajv.addSchema(JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8')));
ajv.addSchema(schema);const validators=new Map();
export function assertHistoryShape(name,value){if(!Object.hasOwn(schema.$defs,name))fail('INVALID_ROUTE');let validate=validators.get(name);if(!validate){validate=ajv.compile({$ref:schema.$id+'#/$defs/'+name});validators.set(name,validate);}if(!validate(value))fail('INVALID_RESPONSE');return value;}
