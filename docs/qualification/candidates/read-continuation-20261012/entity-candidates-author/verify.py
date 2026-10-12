"""Offline immutable source/receipt checks; no producer imports or runtime work."""
import hashlib
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
BASE = 'a3e946c1fa264ae7b33205f5b87804ee1ef75773'
PREREQ = 'e721b6f815e68df80d598f9ff1d8127a190ae62a'
INITIAL = '49db57c9259f0180fad4f619bf745e541d935db9'
SOURCE = '788c0419c9489dfdd4906a50b59661595a072713'
FILES = ['packages/contracts/retrieval-0.2/entity-candidates.schema.json',
         'packages/contracts/retrieval-0.2/entity-candidates-validation.mjs',
         'packages/contracts/test/retrieval-entity-candidates.test.mjs']
HELPER = 'packages/contracts/retrieval-0.2/state-bill-identity.mjs'
checks = []
def check(name, value): checks.append({'name': name, 'passed': bool(value)})
def sha(data): return hashlib.sha256(data).hexdigest()
def git(*args, cwd=ROOT):
    return subprocess.run(['git','-C',str(cwd),*args],check=True,capture_output=True,timeout=20).stdout
source_rows=[]
for path in FILES+[HELPER]:
    data=(ROOT/path).read_bytes();check('source:'+path,data==git('show',SOURCE+':'+path));source_rows.append({'path':path,'bytes':len(data),'sha256':sha(data)})
check('only-three-family-additions',sorted(git('diff','--name-status',PREREQ,SOURCE).decode().splitlines())==sorted('A\t'+f for f in FILES))
check('only-exact-prerequisite-addition',git('diff','--name-status',BASE,PREREQ).decode().strip()=='A\t'+HELPER)
check('accepted-state-helper-unchanged',(ROOT/HELPER).read_bytes()==git('show','a25516ae8d2c44638800e492e439e212098dc750:'+HELPER))
for path in ['packages/contracts/retrieval-0.2/congressional-identity.mjs','packages/contracts/retrieval-0.2/operation-contracts.mjs']:
    check('canonical-dependency-unchanged:'+path,(ROOT/path).read_bytes()==git('show',BASE+':'+path))
check('all-originals-preserved',not git('diff',BASE,'--',*[':(exclude)'+x for x in FILES+[HELPER]],':(exclude)docs/coordination/reports/CODEX-ENTITY-CANDIDATES-AUTHOR-20261012.md',':(exclude)docs/qualification/candidates/read-continuation-20261012/entity-candidates-author'))
original_count=len(git('ls-tree','-r','--name-only',BASE).decode().splitlines())
refs=json.loads((HERE/'reference-identities.json').read_text())
for row in refs['references']:
    for label in ['frozen','observed']:
        ref=row[label];loc=ref['commit']+':'+row['path'];data=git('show',loc,cwd='/workspace/capirov2')
        check('reference:'+label+':'+row['path'],len(data)==ref['bytes'] and sha(data)==ref['sha256'] and git('rev-parse',loc,cwd='/workspace/capirov2').decode().strip()==ref['blob'])
    check('unchanged-reference:'+row['path'],row['unchanged'] and row['frozen']['blob']==row['observed']['blob'])
check('no-private-bodies',not refs['privateBodiesRetained'] and not refs['executed'])
original_test=git('show',INITIAL+':'+FILES[2]);check('initial-test-retained',(HERE/'initial-author-test.mjs').read_bytes()==original_test)
expected_prefix=original_test.decode().replace("check(page([member(), {...member(), isCurrent: false}, committee()]));","check(page([member(), {...member(), canonicalId: 'B000001', isCurrent: false}, committee()]));")
check('only-approved-fixture-change-before-appended-test',(ROOT/FILES[2]).read_text().startswith(expected_prefix))
check('one-additive-author-test',(ROOT/FILES[2]).read_text().count("\ntest(")==original_test.decode().count("\ntest(")+1)
receipts=[]
for label,start,end in [('focused-initial',PREREQ,INITIAL),('focused-name-uniqueness-repair',INITIAL,SOURCE)]:
    r=json.loads((HERE/(label+'.json')).read_text());receipts.append(r)
    check('completed:'+label,r['exitCode']==0 and not r['timedOut'] and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'])
    check('source-diff:'+label,r['sourceHead']==start and r['sourceDiffSha256']==sha(git('diff',start,end,'--','apps','packages','scripts','package.json','package-lock.json')))
    check('capture-helper:'+label,r['captureSha256']==sha((HERE/'capture-reaped.py').read_bytes()))
    for stream in r['streams']:
        data=(ROOT/stream['path']).read_bytes();check('raw:'+stream['path'],len(data)==stream['bytes'] and sha(data)==stream['sha256'])
deps=json.loads((HERE/'dependencies.json').read_text())
check('seven-small-dependency-packages',len(deps['packages'])==7)
for item in deps['packages']:
    path=ROOT/'node_modules'/item['name']/'package.json';check('copied-dependency:'+item['name'],not path.parent.is_symlink() and sha(path.read_bytes())==item['packageJsonSha256'])
failed=[c['name'] for c in checks if not c['passed']]
print(json.dumps({'scope':'OFFLINE_PRESERVATION_ONLY','sourceCommit':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'originalFilesPreserved':original_count,'sourceFiles':source_rows,'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks,'actualChecks':{'initialAuthor':'26/26PASS','repairedAuthor':'27/27PASS','independentOriginal':'29PASS/3FAIL of32 preserved in reviewer93eca51e','broadPublic':'NOT RUN; combined verification root-owned','nativeProviderSQL':'UNRUN'},'ownedProcessGroups':[{'pgid':r['ownedPidAndPgid'],'absent':r['ownedProcessGroupAbsent'],'reapedDescendants':r['reapedDescendants']} for r in receipts]},indent=2))
raise SystemExit(bool(failed))
