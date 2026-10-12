"""Read-only exact source/reference audit; never imports or executes private source."""
from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[5]
evidence=Path(__file__).resolve().parent
base='77cedb126d57a0223d2df42ad2f3fe988eb51759'
source='926c3cfe250f6e2cb3a171e194f087e1444b9f44'
checks=[]
def check(name,condition):
 checks.append({'name':name,'pass':bool(condition)})
 if not condition: raise AssertionError(name)
def git(*args,cwd=root):return subprocess.check_output(['git',*args],cwd=cwd)
def tree(rev):
 return {x.split(b'\t',1)[1].decode():x.split(b'\t',1)[0].decode() for x in git('ls-tree','-r',rev).splitlines()}
a,b=tree(base),tree(source)
shared=['apps/gateway/dispatch/operation-context.mjs','apps/gateway/dispatch/read-result-envelope.mjs','packages/contracts/retrieval-0.2/catalog-validation.mjs']
check('all original files preserved except exact root profile allocation',all(b.get(k)==v for k,v in a.items() if k not in shared))
for path in shared+['apps/gateway/dispatch/action-read-context.mjs']:
 check('root dependency exact '+path,git('show',f'{source}:{path}')==git('show',f'84a93137:{path}'))
for ref in json.loads((evidence/'reference-identities.json').read_text())['references']:
 for mode in ['pinned','observed']:
  record=ref[mode];data=git('show',f"{record['commit']}:{ref['path']}",cwd='/workspace/capirov2')
  check(mode+' identity '+ref['path'],hashlib.sha256(data).hexdigest()==record['sha256'] and len(data)==record['bytes'] and git('rev-parse',f"{record['commit']}:{ref['path']}",cwd='/workspace/capirov2').decode().strip()==record['blob'])
 check('no drift '+ref['path'],ref['pinned']['sha256']==ref['observed']['sha256'])
for p in (root/'apps/gateway/sources/action-items').glob('*.mjs'):
 data=p.read_bytes();check('working source matches freeze '+p.name,data==git('show',f'{source}:{p.relative_to(root)}'))
 check('no legacy source imports '+p.name,b'apps/api' not in data and b'capirov2' not in data)
initial=json.loads((evidence/'initial.json').read_text());exact=json.loads((evidence/'final-source.json').read_text())
check('initial failure retained',initial['exitCode']==1 and initial['ownedProcessGroupAbsent'])
check('exact focused pass sourcebound',exact['sourceHead']==source and exact['exitCode']==0 and exact['sourceDiffBytes']==0 and exact['ownedProcessGroupAbsent'])
check('22 exact assertions no skipped tests',b'pass 22' in (evidence/'final-source.stdout.bin').read_bytes() and b'skipped 0' in (evidence/'final-source.stdout.bin').read_bytes())
report={'source':source,'base':base,'originalEntries':len(a),'unchangedOriginalEntries':len(a)-len(shared),'checks':checks,'passed':len(checks),'scope':'SOURCE_ONLY_NO_NATIVE_OR_SOURCE_SERVICE_EXECUTION'}
(evidence/'final-audit-checks.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='checks'}))
