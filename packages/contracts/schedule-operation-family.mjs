/** The exact operation-version pins of the supported schedule contract families, and the family each pin selects.
 *
 * An operation reference is `{id,version}` and its version IS a family pin, never a range, a shape or "the current
 * family": a pin is the family owner's own `SCHEDULE_TOOL_SCHEMA_ID` version segment, so a family can only be
 * selected by the exact string its own owner declares. An unsupported pin resolves to no family and is refused by
 * every consumer below.
 *
 *   - the legacy pin keeps the frozen 0.2 family, which refuses a Work definition and a source-only trigger;
 *   - the current pin is the 0.3 family, the only one that admits them.
 *
 * The pin is a TRUSTED, CARRIED fact: whichever exact pin a trusted producer approved, prepared, recorded and
 * delivered is the pin every consumer below validates against. It is never reconstructed from the content, never
 * downgraded to the legacy family because the legacy family could also express the content, and never widened to "the
 * current family". Ordinary timed content is expressible by BOTH families — the canonical current catalog keeps the
 * four 0.2.0 schedule descriptors beside the four explicit 0.3.0 successors — so the content decides nothing here: the
 * pin decides, and each family validates the content against its own frozen owner. What the families differ in is what
 * they ADMIT: the legacy family refuses a Work definition and a source-only trigger, and only the current family
 * admits them.
 *
 * This module owns no authority, no store and no scheduler; it only selects an existing family owner by its exact pin.
 */
import {SCHEDULE_TOOL_SCHEMA_ID as LEGACY_TOOL_SCHEMA_ID} from './schedules-0.2/tool-interface-validation.mjs';
import {assertScheduleIntent as assertLegacyIntent} from './schedules-0.2/lifecycle-validation.mjs';
import {scheduleToolValidators as legacyToolValidators,validateShape as legacyToolShape} from './retrieval-0.2/validate.mjs';
import {SCHEDULE_TOOL_SCHEMA_ID as CURRENT_TOOL_SCHEMA_ID} from './schedules-0.3/tool-interface-validation.mjs';
import {assertScheduleIntent as assertCurrentIntent} from './schedules-0.3/lifecycle-validation.mjs';
import {scheduleToolValidators as currentToolValidators,validateToolShape as currentToolShape} from './schedules-0.3/tool-validators.mjs';

const pinOf=schemaId=>schemaId.slice(schemaId.lastIndexOf(':')+1);
/** The supported families, in historical order: each record is the frozen owner's own validators and intent assert. */
export const SCHEDULE_OPERATION_FAMILIES=Object.freeze([
 Object.freeze({schemaId:LEGACY_TOOL_SCHEMA_ID,validators:legacyToolValidators,toolShape:legacyToolShape,assertIntent:assertLegacyIntent}),
 Object.freeze({schemaId:CURRENT_TOOL_SCHEMA_ID,validators:currentToolValidators,toolShape:currentToolShape,assertIntent:assertCurrentIntent}),
].map(family=>Object.freeze({...family,version:pinOf(family.schemaId)})));
export const SCHEDULE_OPERATION_VERSIONS=Object.freeze(SCHEDULE_OPERATION_FAMILIES.map(family=>family.version));
export const LEGACY_SCHEDULE_OPERATION_VERSION=SCHEDULE_OPERATION_FAMILIES[0].version;
export const CURRENT_SCHEDULE_OPERATION_VERSION=SCHEDULE_OPERATION_FAMILIES[1].version;
/** @param {unknown} version @returns {{version:string,schemaId:string,validators:any,toolShape:Function,assertIntent:Function}|null} */
export function scheduleOperationFamily(version){return SCHEDULE_OPERATION_FAMILIES.find(family=>family.version===version)??null;}
/** True only for an exact pin one of the frozen families declares: the schedule owner kind's own declaration rule, so
 * a declaration is admitted by the exact operation version it names and never by a version shape. @param {unknown} version */
export function scheduleOperationDeclared(version){return scheduleOperationFamily(version)!==null;}
