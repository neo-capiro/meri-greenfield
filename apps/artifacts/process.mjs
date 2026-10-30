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
  let child,reason,stdout=[],stderr=[],outBytes=0,errBytes=0,timer,settleTimer=null,resolveClose=null,closeSettled=false,exitInfo=null,spawnError=null,stdoutEnded=false,stderrEnded=false;const streamErrors=[];
  // A close event is not guaranteed when a descendant that escaped the owned group keeps an inherited pipe open. After
  // stop or leader exit, a finite settlement timer resolves the wait without claiming the streams ended or that the
  // group is absent; the later bounded group poll still decides absence. A timeout stays an honest failure.
  const armSettlement=()=>{if(settleTimer!==null||closeSettled)return;settleTimer=setTimeout(()=>{if(closeSettled)return;closeSettled=true;
   resolveClose({code:exitInfo?.code??null,signal:exitInfo?.signal??null,settlement:'timeout'});},Math.max(1,settlementMs));};
  const stop=code=>{reason??=code;if(child?.pid)try{groupKill(-child.pid,'SIGKILL');}catch(e){if(e.code!=='ESRCH')reason='ARTIFACT_CLEANUP_FAILED';}armSettlement();};
  const abort=()=>stop('ARTIFACT_CANCELLED');
  try{
    child=spawnChild(executable,args,{cwd,detached:true,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',HOME:cwd,TMPDIR:cwd,MPLCONFIGDIR:join(cwd,'mpl'),OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1',PYTHONDONTWRITEBYTECODE:'1'}});
    const closed=new Promise(resolve=>{resolveClose=resolve;});
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    timer=setTimeout(()=>stop('ARTIFACT_DEADLINE'),Math.max(1,deadlineMs-Date.now()));
    child.stdout.on('data',chunk=>{outBytes+=chunk.length;if(outBytes>maxOutput)stop('ARTIFACT_OUTPUT_LIMIT');else stdout.push(chunk);});
    child.stderr.on('data',chunk=>{errBytes+=chunk.length;if(errBytes>65536)stop('ARTIFACT_OUTPUT_LIMIT');else stderr.push(chunk);});
    child.stdout.once('end',()=>{stdoutEnded=true;});child.stderr.once('end',()=>{stderrEnded=true;});
    child.stdout.once('error',()=>{streamErrors.push('stdout');stop('ARTIFACT_STREAM_ERROR');});child.stderr.once('error',()=>{streamErrors.push('stderr');stop('ARTIFACT_STREAM_ERROR');});
    child.once('exit',(code,sig)=>{exitInfo={code:code??null,signal:sig??null};armSettlement();});
    child.once('error',e=>{spawnError=e.code;armSettlement();});
    child.once('close',(code,sig)=>{if(exitInfo===null)exitInfo={code:code??null,signal:sig??null};if(closeSettled)return;closeSettled=true;
     clearTimeout(settleTimer);settleTimer=null;resolveClose({code:exitInfo.code??null,signal:exitInfo.signal??null,settlement:'closed'});});
    child.stdin.on('error',()=>{});child.stdin.end(input);
    const result=await closed;
    if(result.settlement==='timeout')reason??='ARTIFACT_CLEANUP_FAILED';
    // Fixed product programs do not intentionally spawn descendants. Kill any
    // remaining members even after leader exit; do not claim namespace absence.
    const group=child.pid?await killGroup(child.pid,groupKill):'absent';if(group==='error')reason='ARTIFACT_CLEANUP_FAILED';
    const groupAbsent=group==='absent';
    const retainedOut=Buffer.concat(stdout),retainedErr=Buffer.concat(stderr);
    const receipt={pid:child.pid??null,exitCode:result.code??null,signal:result.signal??null,settlement:result.settlement,spawnError,stdoutBytes:outBytes,stderrBytes:errBytes,stdoutRetainedBytes:retainedOut.length,stderrRetainedBytes:retainedErr.length,hashScope:'retained bytes',stdoutSha256:sha(retainedOut),stderrSha256:sha(retainedErr),stdoutEnded,stderrEnded,streamErrors,leaderClosed:result.settlement==='closed',groupKillAttempted:Boolean(child.pid),groupAbsent,sandboxQualified:false};
    if(reason||spawnError||result.code!==0||!stdoutEnded||!stderrEnded||!groupAbsent)throw Object.assign(error(reason??(!groupAbsent?'ARTIFACT_CLEANUP_FAILED':'ARTIFACT_PROCESS_FAILED')),{receipt,stdout:retainedOut,stderr:retainedErr});
    return {stdout:Buffer.concat(stdout),receipt};
  }finally{clearTimeout(timer);clearTimeout(settleTimer);signal?.removeEventListener('abort',abort);}
}
