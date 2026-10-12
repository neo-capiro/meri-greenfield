"""Offline immutable-source audit; private Git bodies are hashed in memory only."""
from pathlib import Path
import hashlib,json,subprocess,sys
root=Path(__file__).resolve().parents[5]; evidence=Path(__file__).resolve().parent
base='c1c9bfde7dd466a0474589a224a99b44277adbc9'
source=sys.argv[1]
checks=[]
def check(name,value):
    checks.append({'check':name,'passed':bool(value)})
def git(*args,cwd=root): return subprocess.check_output(['git',*args],cwd=cwd)
def tree(commit):
    return {line.split('\t',1)[1]:line.split('\t',1)[0].split()[2] for line in git('ls-tree','-r',commit).decode().splitlines()}
original=tree(base); candidate=tree(source)
changed=[p for p,oid in original.items() if candidate.get(p)!=oid]
check('all original base tracked files byte-preserved',not changed)
source_paths=['packages/contracts/retrieval-0.2/florida-budget-validation.mjs','packages/contracts/retrieval-0.2/florida-budget.schema.json','packages/contracts/test/retrieval-florida-budget.test.mjs']
check('only three additive family files in source candidate',set(candidate)-set(original)==set(source_paths))
source_files=[]
for path in source_paths:
    data=git('show',f'{source}:{path}')
    check('review checkout exact '+path,(root/path).read_bytes()==data)
    source_files.append({'path':path,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'blob':candidate[path]})
refs=json.loads((evidence/'reference-identities.json').read_text())['references']
for ref in refs:
    for label in ['frozen','observed']:
        pin=ref[label];data=git('show',pin['commit']+':'+ref['path'],cwd='/workspace/capirov2')
        check(label+' identity '+ref['path'],len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256'] and git('rev-parse',pin['commit']+':'+ref['path'],cwd='/workspace/capirov2').decode().strip()==pin['blob'])
    check('unchanged private reference '+ref['path'],ref['frozen']['sha256']==ref['observed']['sha256'])
receipts=[]
for path in sorted(evidence.glob('*.json')):
    value=json.loads(path.read_text())
    if not isinstance(value,dict) or 'ownedPidAndPgid' not in value: continue
    check(path.name+' owned group absent',value['ownedProcessGroupAbsent'] and not value['timedOut'] and not value['ownedGroupKillRequired'])
    for record in value['streams']:
        data=(root/record['path']).read_bytes()
        check(path.name+' raw '+record['path'].split('.')[-2],len(data)==record['bytes'] and hashlib.sha256(data).hexdigest()==record['sha256'])
    receipts.append({'path':path.name,'exitCode':value['exitCode'],'ownedPidAndPgid':value['ownedPidAndPgid'],'ownedProcessGroupAbsent':value['ownedProcessGroupAbsent']})
first=json.loads((evidence/'initial-control-identities.json').read_text())
check('initial 29 pass 1 fail preserved',first['passed']==29 and first['failed']==1)
initial=(evidence/'initial-controls.test.mjs').read_text()
final=(root/'packages/contracts/test/retrieval-florida-budget-independent.test.mjs').read_text()
check('independent controls unchanged except explicit canonical Input definition decision',final==initial.replace("closed exact operation and raw input definition","closed exact operation and normalized input definition").replace("v.inputDefinition(ID),'FloridaBudgetRequest'","v.inputDefinition(ID),'FloridaBudgetInput'"))
result={'base':base,'source':source,'sourceTree':git('rev-parse',source+'^{tree}').decode().strip(),'originalCount':len(original),'originalUnchanged':len(original)-len(changed),'originalChanged':changed,'sourceFiles':source_files,'referencePairs':len(refs),'receipts':receipts,'checks':checks,'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'scope':'OFFLINE_SOURCE_ONLY_NO_PRIVATE_BODIES_PUBLISHED_NO_RUNTIME_ACCEPTANCE'}
(evidence/'audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['source','originalCount','originalUnchanged','referencePairs','passed','failed']}))
raise SystemExit(1 if result['failed'] else 0)
