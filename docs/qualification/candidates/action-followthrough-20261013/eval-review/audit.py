"""Offline exact-source and local-receipt audit; no imported product code."""
import hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5]
evidence=Path(__file__).resolve().parent
base='b23a2cd027d43740bd99f937366e9be2df1be3ad'
source='33a0d21b005d32d9c27de5f3a7939b77588921db'
initial='e215f1b45d7fe179f7c63c9b607c7f75e91c7748'
def git(*a):return subprocess.check_output(['git',*a],cwd=root)
def blob(ref,path):return git('show',ref+':'+path)
def sha(b):return hashlib.sha256(b).hexdigest()
checks=[]
def check(name,condition):
 checks.append({'check':name,'passed':bool(condition)})
 if not condition:raise AssertionError(name)
paths=['evals/task-lookup/execution/'+p for p in ['admission.mjs','execute.mjs','test/execution.test.mjs','test/fixtures.mjs']]
source_rows=[]
for p in paths:
 b=blob(source,p);check('exact candidate bytes '+p,(root/p).read_bytes()==b)
 source_rows.append({'path':p,'bytes':len(b),'sha256':sha(b),'gitBlob':git('rev-parse',source+':'+p).decode().strip()})
changes=[r.split('\t') for r in git('diff','--name-status',base,source).decode().splitlines()]
check('every candidate delta is an addition',all(r[0]=='A' for r in changes))
check('only four new implementation/test paths',sorted(r[1] for r in changes if r[1].startswith('evals/'))==sorted(paths))
check('candidate additions confined to allocated lane',all(r[1] in paths or r[1]=='docs/coordination/tasks/CODEX-ACTION-FOLLOWTHROUGH-EVAL-20261013.md' or r[1].startswith('docs/qualification/candidates/action-followthrough-20261013/eval-author/') for r in changes))
canonical=['apps/control/task-lookup/index.mjs','apps/control/task-lookup/delivery.mjs','apps/control/task-lookup/binding.mjs','evals/task-lookup/corpus.mjs','evals/task-lookup/contracts.mjs','evals/task-lookup/score.mjs','packages/runtime/operation-lifetime.mjs','packages/contracts/retrieval-0.2/catalog.json','packages/contracts/meri.schema.json','packages/contracts/validate.mjs']
tracked=set(git('ls-tree','-r','--name-only',base).decode().splitlines())
for p in canonical:check('canonical baseline unchanged '+p,blob(base,p)==blob(source,p))
check('all original tracked entries preserved',not git('diff','--name-status','--diff-filter=CDMRTUXB',base,source))
check('retained exact failing source',(evidence/'hostile-before.execute.mjs.txt').read_bytes()==blob(initial,'evals/task-lookup/execution/execute.mjs'))
check('repair preserves original author test prefix',blob(source,paths[2]).startswith(blob(initial,paths[2])))
for label,passed,failed in [('first',64,0),('hostile-before',40,1),('final',68,0)]:
 r=json.loads((evidence/(label+'.json')).read_text());out=(evidence/(label+'.stdout.bin')).read_text()
 check(label+' exact raw summary',f'pass {passed}\n' in out and f'fail {failed}\n' in out)
 check(label+' source diff empty',r['sourceDiffBytes']==0 and r['sourceDiffSha256']==sha(b''))
 check(label+' owned group absent',r['ownedProcessGroupAbsent'] and not r['timedOut'] and r['durationSeconds']<240)
 for s in r['streams']:check(label+' stream '+Path(s['path']).name,sha((root/s['path']).read_bytes())==s['sha256'] and (root/s['path']).stat().st_size==s['bytes'])
result={'source':source,'tree':git('rev-parse',source+'^{tree}').decode().strip(),'base':base,'sourceRows':source_rows,'canonicalReferences':canonical,'baselineEntryCount':len(tracked),'checks':checks,'passed':len(checks),'failed':0,'scope':'LOCAL_SOURCE_ONLY_NO_RUNTIME_REAL_CORPUS_QUALIFICATION'}
(evidence/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passed':len(checks),'failed':0,'source':source,'baseEntriesUnchanged':len(tracked)}))
