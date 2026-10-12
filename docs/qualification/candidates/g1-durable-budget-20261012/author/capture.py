"""Bounded local command capture; retain exact streams, command and exit."""
import hashlib,json,os,signal,subprocess,sys,time
from pathlib import Path
name=sys.argv[1];command=sys.argv[2:];out=Path(__file__).parent
start=time.time();process=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
timed_out=False
try: stdout,stderr=process.communicate(timeout=90)
except subprocess.TimeoutExpired:
    timed_out=True;os.killpg(process.pid,signal.SIGKILL);stdout,stderr=process.communicate(timeout=5)
for suffix,data in [('stdout.bin',stdout),('stderr.bin',stderr)]: (out/f'{name}.{suffix}').write_bytes(data)
result={'command':command,'cwd':os.getcwd(),'exit':process.returncode,'seconds':time.time()-start,'timedOut':timed_out,'pid':process.pid,'reaped':process.poll() is not None,'stdoutSha256':hashlib.sha256(stdout).hexdigest(),'stderrSha256':hashlib.sha256(stderr).hexdigest()}
(out/f'{name}.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));print(stdout.decode(errors='replace')[-1800:]);print(stderr.decode(errors='replace')[-1800:]);sys.exit(process.returncode)
