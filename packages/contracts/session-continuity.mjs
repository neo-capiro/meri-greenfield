/** Which runtime versions a conversation's SDK session depends on. A run's image and skills digests are properties of that run, so a
 * deploy that changes them alone leaves a checkpoint resumable by the next turn. The session's own formats are not: the Agent SDK and CLI
 * that read and write the transcript, and the contract and checkpoint formats that carry it. Shared by control's next-run journal, the
 * runtime and the worker's next-turn options so the three never disagree.
 * An SDK/CLI change is refused (NEXT_TURN_SDK_CHANGED, ruling O103), never resumed and never seeded: seeding a fresh session from the
 * checkpoint's transcript is a prerequisite of any release that bumps the pinned pair, with its own design. */
const SDK=Object.freeze(['sdk','cli']),FORMATS=Object.freeze(['contracts','checkpointFormat']);
export const SESSION_CONTINUITY_VERSIONS=Object.freeze([...SDK,...FORMATS]);
const differs=(keys,a,b)=>keys.some(key=>typeof a?.[key]!=='string'||a[key]!==b?.[key]);
/** Null when a run under `targetVersions` can resume the SDK session a checkpoint captured under `checkpointVersions`, else why not. */
export function sessionDiscontinuity(checkpointVersions,targetVersions){
 if(differs(SDK,checkpointVersions,targetVersions))return 'NEXT_TURN_SDK_CHANGED';
 if(differs(FORMATS,checkpointVersions,targetVersions))return 'NEXT_TURN_FORMAT_CHANGED';
 return null;
}
export const continuesSession=(checkpointVersions,targetVersions)=>sessionDiscontinuity(checkpointVersions,targetVersions)===null;
