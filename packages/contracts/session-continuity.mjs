/** Which runtime versions a conversation's SDK session depends on. A run's image and skills digests are properties of that run, so a
 * deploy that changes them alone leaves a checkpoint resumable by the next turn. The session's own formats are not: the Agent SDK and CLI
 * that read and write the transcript, and the contract and checkpoint formats that carry it. Shared by control's next-run journal, the
 * runtime and the worker's next-turn options so the three never disagree. */
export const SESSION_CONTINUITY_VERSIONS=Object.freeze(['sdk','cli','contracts','checkpointFormat']);
/** True when a run under `targetVersions` can resume the SDK session a checkpoint captured under `checkpointVersions`. */
export const continuesSession=(checkpointVersions,targetVersions)=>
 SESSION_CONTINUITY_VERSIONS.every(key=>typeof checkpointVersions?.[key]==='string'&&checkpointVersions[key]===targetVersions?.[key]);
