import {createScheduleToolValidators as createLegacy} from '../schedules-0.2/tool-interface-validation.mjs';
import {assertScheduleIntent,snapshotScheduleCall} from './lifecycle-validation.mjs';
export {SCHEDULE_TOOL_OPERATIONS,SCHEDULE_TOOL_CONTEXT_KEYS} from '../schedules-0.2/tool-interface-validation.mjs';
export const SCHEDULE_TOOL_SCHEMA_ID='urn:meri:schedules:tool-interface:0.3.0';
export function createScheduleToolValidators({validateShape,schema}) {
 return createLegacy({validateShape,schema,schemaId:SCHEDULE_TOOL_SCHEMA_ID,lifecycle:{assertScheduleIntent,snapshotScheduleCall}});
}
