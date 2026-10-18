// @ts-check
/** Deliberately retain the existing source-only refusal until actual AWS wire and physical absence are qualified. */
import {refusalDefinition} from '../browser-enforcement/workflow.mjs';
export function proposeBrowserHostWatchdog(){
 const definition=refusalDefinition();
 Object.freeze(definition.States.SourceOnlyRefusal);Object.freeze(definition.States);Object.freeze(definition);
 return Object.freeze({
  source:'infra/browser-enforcement/workflow.mjs',
  definition,
  mustArmBeforeHostCreate:true,guestDeadlineIndependentOfController:true,
  positiveRootVolumeAbsenceQualified:false,managedSurvivalMeasured:false,
  terminationAckIsAbsence:false,unknownCleanupBlocksNewAdmission:true,
  launchAdmitted:false,
 });
}
