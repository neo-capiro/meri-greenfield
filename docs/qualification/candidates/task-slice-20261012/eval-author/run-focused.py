"""Bounded local evaluation source tests; no native/provider execution."""
import subprocess,os,signal,time,json,pathlib,hashlib,sys
if len(sys.argv)!=2 or not sys.argv[1].replace('-','').isalnum():raise SystemExit('capture tag required')
p=pathlib.Path(__file__).resolve().parent;tag=sys.argv[1]
for suffix in ['stdout.txt','stderr.txt','json']:
 if (p/(tag+'.'+suffix)).exists():raise SystemExit('capture already exists')
argv=['node','--test','--test-concurrency=1',*sorted(str(x) for x in pathlib.Path('evals/task-lookup/test').glob('*.test.mjs') if 'independent' not in x.name)]
source=subprocess.check_output(['git','rev-parse','HEAD']).decode().strip();start=time.time();r=subprocess.Popen(argv,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
timeout=False
try:out,err=r.communicate(timeout=240)
except subprocess.TimeoutExpired:timeout=True;os.killpg(r.pid,signal.SIGKILL);out,err=r.communicate()
absent=False
try:os.killpg(r.pid,0)
except ProcessLookupError:absent=True
(p/(tag+'.stdout.txt')).write_bytes(out);(p/(tag+'.stderr.txt')).write_bytes(err)
receipt={'source':source,'argv':argv,'exitCode':r.returncode,'timeout':timeout,'durationSeconds':round(time.time()-start,3),'group':r.pid,'groupAbsent':absent,'stdoutSha256':hashlib.sha256(out).hexdigest(),'stderrSha256':hashlib.sha256(err).hexdigest(),'sourceDiff':subprocess.check_output(['git','diff','--','evals/task-lookup']).decode()}
(p/(tag+'.json')).write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt));print(out.decode()[-18000:]);print(err.decode()[-3000:]);raise SystemExit(r.returncode)
