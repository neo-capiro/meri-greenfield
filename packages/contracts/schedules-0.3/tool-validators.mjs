/** The current (0.3) schedule tool family's own validator composition: the frozen 0.3 factory over the frozen 0.3
 * schemas, with the canonical Work selection shape registered BY REFERENCE.
 *
 * One owner, shared by every consumer (the schedule app's join, the worker's prepared-result admission), so a request,
 * an intent or a receipt is never checked against a different family than the one that produced it, no second parser
 * exists, and no authority is copied. The 0.3 family is the one that admits an approved `configuration.task.work`
 * definition and a source-only `policy.sourceTrigger`; the frozen 0.2 owners keep refusing both.
 */
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createScheduleToolValidators} from './tool-interface-validation.mjs';
import {denySchedule,workSelectionSchema} from '../schedules-0.2/lifecycle-validation.mjs';

const load=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});
addFormats(ajv);
for(const path of ['../meri.schema.json','./lifecycle.schema.json','./inspection.schema.json'])ajv.addSchema(load(path));
// The canonical Work selection shape the 0.3 lifecycle/task definitions resolve by reference.
ajv.addSchema(workSelectionSchema());
export const scheduleSchema=load('./tool-interface.schema.json');
ajv.addSchema(scheduleSchema);

/** 0.3 tool validators over the frozen 0.3 schemas — the current routines/schedule family. */
export const scheduleToolValidators=createScheduleToolValidators({schema:scheduleSchema,
 validateShape:(name,value)=>ajv.getSchema(`${scheduleSchema.$id}#/$defs/${name}`)(value)===true});
/** 0.3 tool-schema `$defs` validator — one owner with the 0.3 tool validators above. */
export const validateToolShape=(name,value)=>{
 const check=ajv.getSchema(`${scheduleSchema.$id}#/$defs/${name}`);
 if(!check||check(value)!==true)denySchedule('SCHEDULE_TOOL_DATA');
 return value;
};
export {SCHEDULE_TOOL_SCHEMA_ID} from './tool-interface-validation.mjs';
