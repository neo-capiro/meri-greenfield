import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const error=code=>Object.assign(new Error(code),{code});
// Only callers in this module select commands. Output limits stop owned children;
// they cannot qualify a filesystem quota, network containment or a native host.
export async function runArtifactProcess(executable,args,{cwd,input,signal,deadlineMs,maxOutput=262144}){
  if(signal?.aborted||Date.now()>=deadlineMs)throw error('ARTIFACT_CANCELLED');
  let child,reason,stdout=[],stderr=[],outBytes=0,errBytes=0,timer,stdoutEnded=false,stderrEnded=false,spawnError=null;const streamErrors=[];
  const stop=code=>{reason??=code;if(child?.pid)try{process.kill(-child.pid,'SIGKILL');}catch(e){if(e.code!=='ESRCH')reason='ARTIFACT_CLEANUP_FAILED';}};
  const abort=()=>stop('ARTIFACT_CANCELLED');
  try{
    child=spawn(executable,args,{cwd,detached:true,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',HOME:cwd,TMPDIR:cwd,MPLCONFIGDIR:join(cwd,'mpl'),OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1',PYTHONDONTWRITEBYTECODE:'1'}});
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    timer=setTimeout(()=>stop('ARTIFACT_DEADLINE'),Math.max(1,deadlineMs-Date.now()));
    child.stdout.on('data',chunk=>{outBytes+=chunk.length;if(outBytes>maxOutput)stop('ARTIFACT_OUTPUT_LIMIT');else stdout.push(chunk);});
    child.stderr.on('data',chunk=>{errBytes+=chunk.length;if(errBytes>65536)stop('ARTIFACT_OUTPUT_LIMIT');else stderr.push(chunk);});
    child.stdout.once('end',()=>{stdoutEnded=true;});child.stderr.once('end',()=>{stderrEnded=true;});
    child.stdout.once('error',()=>{streamErrors.push('stdout');stop('ARTIFACT_STREAM_ERROR');});child.stderr.once('error',()=>{streamErrors.push('stderr');stop('ARTIFACT_STREAM_ERROR');});
    child.stdin.on('error',()=>{});child.stdin.end(input);
    const result=await new Promise(resolve=>{child.once('error',e=>{spawnError=e.code;});child.once('close',(code,signal)=>resolve({code,signal}));});
    // Fixed product programs do not intentionally spawn descendants. Kill any
    // remaining members even after leader exit; do not claim namespace absence.
    if(child.pid)try{process.kill(-child.pid,'SIGKILL');}catch(e){if(e.code!=='ESRCH')reason='ARTIFACT_CLEANUP_FAILED';}
    let groupAbsent=child.pid===undefined;if(child.pid)try{process.kill(-child.pid,0);}catch(e){if(e.code==='ESRCH')groupAbsent=true;}
    const retainedOut=Buffer.concat(stdout),retainedErr=Buffer.concat(stderr);
    const receipt={pid:child.pid??null,exitCode:result.code??null,signal:result.signal??null,spawnError,stdoutBytes:outBytes,stderrBytes:errBytes,stdoutRetainedBytes:retainedOut.length,stderrRetainedBytes:retainedErr.length,hashScope:'retained bytes',stdoutSha256:sha(retainedOut),stderrSha256:sha(retainedErr),stdoutEnded,stderrEnded,streamErrors,leaderClosed:true,groupKillAttempted:Boolean(child.pid),groupAbsent,sandboxQualified:false};
    if(reason||spawnError||result.code!==0||!stdoutEnded||!stderrEnded||!groupAbsent)throw Object.assign(error(reason??(!groupAbsent?'ARTIFACT_CLEANUP_FAILED':'ARTIFACT_PROCESS_FAILED')),{receipt,stdout:retainedOut,stderr:retainedErr});
    return {stdout:Buffer.concat(stdout),receipt};
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

