"""Bounded source-only test capture; no database/native/provider execution."""
import subprocess,os,signal,time,json,pathlib,hashlib,sys
p=pathlib.Path(__file__).resolve().parent;tag=sys.argv[1]
if not tag.replace('-','').isalnum() or any((p/(tag+'.'+s)).exists() for s in ['json','stdout.txt','stderr.txt']):raise SystemExit('new alphanumeric capture tag required')
argv=['node','--test','--test-concurrency=1',*sorted(str(x) for x in pathlib.Path('evals/task-lookup/execution/test').glob('*.test.mjs') if 'independent' not in x.name)]
head=subprocess.check_output(['git','rev-parse','HEAD']).decode().strip();start=time.time();child=subprocess.Popen(argv,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True);timedout=False
try:out,err=child.communicate(timeout=240)
except subprocess.TimeoutExpired:timedout=True;os.killpg(child.pid,signal.SIGKILL);out,err=child.communicate()
try:os.killpg(child.pid,0);absent=False
except ProcessLookupError:absent=True
for suffix,data in [('stdout.txt',out),('stderr.txt',err)]: (p/(tag+'.'+suffix)).write_bytes(data)
receipt={'source':head,'argv':argv,'exitCode':child.returncode,'timeout':timedout,'durationSeconds':round(time.time()-start,3),'group':child.pid,'groupAbsent':absent,'stdoutSha256':hashlib.sha256(out).hexdigest(),'stderrSha256':hashlib.sha256(err).hexdigest(),'sourceDiff':subprocess.check_output(['git','diff','--','evals/task-lookup/execution']).decode()}
(p/(tag+'.json')).write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({k:v for k,v in receipt.items() if k!='sourceDiff'}));print(out.decode()[-10000:]);print(err.decode()[-2000:]);raise SystemExit(child.returncode)
