/** A resumed turn's SDK (resume + sessionStore) materializes the session into join(os.tmpdir(),'claude-resume-*') and launches the CLI
 * with that directory as CLAUDE_CONFIG_DIR (claude-agent-sdk sdk.mjs). The task receiver's descriptor policy (remote-task-http.mjs) and
 * control's preparation authority (preparation-intent.mjs) admit only a configuration directory directly under the run's
 * configParentDirectory, so while a run's worker lives the process's temporary root is that private parent. Shared by the remote worker
 * (remote-composition.mjs) and the in-image launch measurement's resumed probe (apps/runtime/build/first-chat-launch-measurement.mjs).
 * Returns the release, which restores the previous root unless something else replaced it since. */
export function holdRunTemporaryRoot(configParentDirectory){
 const previous=process.env.TMPDIR;process.env.TMPDIR=configParentDirectory;
 return ()=>{if(process.env.TMPDIR!==configParentDirectory)return;if(previous===undefined)delete process.env.TMPDIR;else process.env.TMPDIR=previous;};
}
