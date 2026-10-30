import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const error=code=>Object.assign(new Error(code),{code});
// A killed or already-exited member stays in its process group as a zombie until its parent (or init, after
// reparenting) reaps it, and SIGKILL delivery is asynchronous, so after the single group kill absence is polled
// (signal 0 only) for a bounded time. A group still present at the bound stays ARTIFACT_CLEANUP_FAILED.
const GROUP_DRAIN_MS=5000,GROUP_POLL_MS=10;
async function killGroup(pid,kill=process.kill){
  try{kill(-pid,'SIGKILL');}catch(e){return e.code==='ESRCH'?'absent':'error';}
  for(const until=Date.now()+GROUP_DRAIN_MS;;){
    try{kill(-pid,0);}catch(e){return e.code==='ESRCH'?'absent':'error';}
    if(Date.now()>=until)return 'present';
    await new Promise(resolve=>setTimeout(resolve,GROUP_POLL_MS));
  }
}
// Only callers in this module select commands. Output limits stop owned children;
// they cannot qualify a filesystem quota, network containment or a native host.
export async function runArtifactProcess(executable,args,{cwd,input,signal,deadlineMs,maxOutput=262144,settlementMs=GROUP_DRAIN_MS},ports={}){
  if(signal?.aborted||Date.now()>=deadlineMs)throw error('ARTIFACT_CANCELLED');
  const spawnChild=ports.spawn??spawn,groupKill=ports.kill??process.kill;
  let child,reason,stdout=[],stderr=[],outBytes=0,errBytes=0,timer,settleTimer=null,resolveClose=null,settled=false,exitInfo=null,spawnError=null,stdoutEnded=false,stderrEnded=false;
  const streamErrors=[],noop=()=>{};
  // Terminal settlement ends this owner's callback/stdio custody. Action callbacks are detached before the owned
  // endpoints are destroyed; no-op error listeners remain so a late error event is handled rather than uncaught.
  // Local disposal is not evidence that a descendant or the namespace is absent.
  const dispose=stream=>{if(stream===null||stream===undefined)return;try{if(typeof stream.destroy==='function')stream.destroy();}catch{}};
  const detach=()=>{
    child?.removeListener('exit',onExit);child?.removeListener('error',onSpawnError);child?.removeListener('close',onClose);
    child?.stdout?.removeListener('data',onStdoutData);child?.stdout?.removeListener('end',onStdoutEnd);child?.stdout?.removeListener('error',onStdoutError);
    child?.stderr?.removeListener('data',onStderrData);child?.stderr?.removeListener('end',onStderrEnd);child?.stderr?.removeListener('error',onStderrError);
    signal?.removeEventListener('abort',onAbort);
  };
  const settle=()=>{if(settled)return;settled=true;clearTimeout(settleTimer);settleTimer=null;clearTimeout(timer);timer=null;detach();
    dispose(child?.stdin);dispose(child?.stdout);dispose(child?.stderr);};
  const finish=value=>{if(settled)return;settle();resolveClose(value);};
  const armSettlement=()=>{if(settleTimer!==null||settled)return;settleTimer=setTimeout(()=>finish({code:exitInfo?.code??null,
   signal:exitInfo?.signal??null,settlement:'timeout'}),Math.max(1,settlementMs));};
  const stop=code=>{if(settled)return;reason??=code;if(child?.pid)try{groupKill(-child.pid,'SIGKILL');}catch(e){if(e.code!=='ESRCH')reason='ARTIFACT_CLEANUP_FAILED';}armSettlement();};
  const onAbort=()=>stop('ARTIFACT_CANCELLED');
  const onStdoutData=chunk=>{if(settled)return;outBytes+=chunk.length;if(outBytes>maxOutput)stop('ARTIFACT_OUTPUT_LIMIT');else stdout.push(chunk);};
  const onStderrData=chunk=>{if(settled)return;errBytes+=chunk.length;if(errBytes>65536)stop('ARTIFACT_OUTPUT_LIMIT');else stderr.push(chunk);};
  const onStdoutEnd=()=>{if(!settled)stdoutEnded=true;};
  const onStderrEnd=()=>{if(!settled)stderrEnded=true;};
  const onStdoutError=()=>{if(settled)return;streamErrors.push('stdout');stop('ARTIFACT_STREAM_ERROR');};
  const onStderrError=()=>{if(settled)return;streamErrors.push('stderr');stop('ARTIFACT_STREAM_ERROR');};
  const onExit=(code,sig)=>{if(settled)return;exitInfo={code:code??null,signal:sig??null};armSettlement();};
  const onSpawnError=e=>{if(settled)return;spawnError=e.code;armSettlement();};
  const onClose=(code,sig)=>{if(settled)return;if(exitInfo===null)exitInfo={code:code??null,signal:sig??null};
   finish({code:exitInfo.code??null,signal:exitInfo.signal??null,settlement:'closed'});};
  try{
    child=spawnChild(executable,args,{cwd,detached:true,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',HOME:cwd,TMPDIR:cwd,MPLCONFIGDIR:join(cwd,'mpl'),OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1',PYTHONDONTWRITEBYTECODE:'1'}});
    const closed=new Promise(resolve=>{resolveClose=resolve;});
    // Keep no-op error listeners beyond settlement so late errors from owned endpoints are handled, not uncaught.
    child.on?.('error',noop);child.stdout?.on?.('error',noop);child.stderr?.on?.('error',noop);child.stdin?.on?.('error',noop);
    signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)onAbort();
    timer=setTimeout(()=>stop('ARTIFACT_DEADLINE'),Math.max(1,deadlineMs-Date.now()));
    child.stdout.on('data',onStdoutData);child.stdout.once('end',onStdoutEnd);child.stdout.on('error',onStdoutError);
    child.stderr.on('data',onStderrData);child.stderr.once('end',onStderrEnd);child.stderr.on('error',onStderrError);
    child.once('exit',onExit);child.once('error',onSpawnError);child.once('close',onClose);
    try{child.stdin.end(input);}catch{}
    const result=await closed;
    if(result.settlement==='timeout')reason??='ARTIFACT_CLEANUP_FAILED';
    // Fixed product programs do not intentionally spawn descendants. Kill any
    // remaining members even after leader exit; do not claim namespace absence.
    const group=child.pid?await killGroup(child.pid,groupKill):'absent';if(group==='error')reason='ARTIFACT_CLEANUP_FAILED';
    const groupAbsent=group==='absent';
    const retainedOut=Buffer.concat(stdout),retainedErr=Buffer.concat(stderr);
    const receipt=Object.freeze({pid:child.pid??null,exitCode:result.code??null,signal:result.signal??null,settlement:result.settlement,spawnError,
     stdoutBytes:outBytes,stderrBytes:errBytes,stdoutRetainedBytes:retainedOut.length,stderrRetainedBytes:retainedErr.length,
     hashScope:'retained bytes',stdoutSha256:sha(retainedOut),stderrSha256:sha(retainedErr),stdoutEnded,stderrEnded,
     streamErrors:Object.freeze([...streamErrors]),leaderClosed:result.settlement==='closed',groupKillAttempted:Boolean(child.pid),groupAbsent,sandboxQualified:false});
    if(reason||spawnError||result.code!==0||!stdoutEnded||!stderrEnded||!groupAbsent)throw Object.assign(error(reason??(!groupAbsent?'ARTIFACT_CLEANUP_FAILED':'ARTIFACT_PROCESS_FAILED')),{receipt,stdout:retainedOut,stderr:retainedErr});
    return {stdout:Buffer.concat(stdout),receipt};
  }finally{settle();}
}
