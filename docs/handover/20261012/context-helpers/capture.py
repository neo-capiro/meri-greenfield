import hashlib, json, os, signal, subprocess, sys, time
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=root/'docs/qualification/candidates/rel02-catalog-bindings-20261012'; out.mkdir(parents=True,exist_ok=True)
temp=root/'.task-inputs/check-tmp'; temp.mkdir(exist_ok=True)
label=sys.argv[1]; argv=sys.argv[2:]
env={key:value for key,value in os.environ.items() if key in ['PATH','LANG','LC_ALL']}
env['TMPDIR']=str(temp)
stdout=out/(label+'.stdout.bin'); stderr=out/(label+'.stderr.bin'); started=time.time(); timed=False
with stdout.open('xb') as a, stderr.open('xb') as b:
    process=subprocess.Popen(argv,cwd=root,env=env,stdout=a,stderr=b,start_new_session=True)
    try: code=process.wait(timeout=120)
    except subprocess.TimeoutExpired:
        timed=True; os.killpg(process.pid,signal.SIGKILL); code=process.wait(timeout=10)
try: os.killpg(process.pid,0); absent=False
except ProcessLookupError: absent=True
record={'argv':argv,'cwd':str(root),'startedAtEpochSeconds':started,'endedAtEpochSeconds':time.time(),
        'exitCode':code,'timeoutSeconds':120,'timedOut':timed,'ownedProcessGroupAbsent':absent,
        'environment':'replacement PATH/LANG/LC_ALL/TMPDIR only; not OS network sandbox',
        'stdout':{'bytes':stdout.stat().st_size,'sha256':hashlib.sha256(stdout.read_bytes()).hexdigest()},
        'stderr':{'bytes':stderr.stat().st_size,'sha256':hashlib.sha256(stderr.read_bytes()).hexdigest()}}
(out/(label+'.json')).write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'label':label,'exitCode':code,'groupAbsent':absent})); sys.exit(code if absent and not timed else 2)
