"""Local source tests only; no target services, native harnesses or network actions."""
import argparse,datetime,hashlib,json,os,pathlib,signal,subprocess
parser=argparse.ArgumentParser();parser.add_argument('name');parser.add_argument('families',nargs='+',choices=['candidates','legislation','news','global','hearings']);args=parser.parse_args()
if not args.name.replace('-','').isalnum():parser.error('simple receipt name required')
root=pathlib.Path(subprocess.check_output(['git','rev-parse','--show-toplevel'],cwd=pathlib.Path(__file__).resolve().parent,text=True).strip())
source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
source_diff=subprocess.check_output(['git','diff','HEAD','--','packages/contracts'],cwd=root,text=True)
paths={'candidates':'retrieval-research-legal-candidates.test.mjs','legislation':'retrieval-research-legal-legislation.test.mjs','news':'retrieval-research-legal-news.test.mjs','global':'retrieval-public-domain-query.test.mjs','hearings':'retrieval-public-domain-hearings.test.mjs'}
out=pathlib.Path(__file__).resolve().parent/args.name;out.mkdir()
cmd=['node','--test','--test-concurrency=1']+['packages/contracts/test/'+paths[x] for x in args.families]
start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.Popen(cmd,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True);timeout=False
try:o,e=p.communicate(timeout=45)
except subprocess.TimeoutExpired:timeout=True;os.killpg(p.pid,signal.SIGKILL);o,e=p.communicate()
(out/'stdout.txt').write_bytes(o);(out/'stderr.txt').write_bytes(e)
try:os.killpg(p.pid,0);absent=False
except ProcessLookupError:absent=True
r={'argv':cmd,'source':source,'sourceDiff':source_diff,'producerSha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),'startedAt':start,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':p.returncode,'timeout':timeout,'processGroup':p.pid,'groupAbsent':absent,'stdoutSha256':hashlib.sha256(o).hexdigest(),'stderrSha256':hashlib.sha256(e).hexdigest()}
(out/'receipt.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r));print(o.decode()[-4500:]);print(e.decode())
