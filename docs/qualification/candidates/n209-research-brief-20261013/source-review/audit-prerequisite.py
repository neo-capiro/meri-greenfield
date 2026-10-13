"""Exact published object and composition preservation audit; Git source only."""
import hashlib
import json
import pathlib
import subprocess

ROOT = pathlib.Path('/workspace/meri-n209-source-review')
HERE = pathlib.Path(__file__).resolve().parent
PR54 = '70516e5c9681917ce493bbc50e3023494f2e1209'
PR56 = '25e0d29d6f0b6c3de284d13e86bc5f1aa0c00d21'
PR55 = '980c71b7941b7f13f3e1831009076f283aedbe71'
CANDIDATE = '45c2de24f41402ae3a938a7df09eff78db90d94c'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def text(*args):
    return git(*args).decode().strip()

common = text('merge-base', PR55, PR56)
paths = lambda a,b: set(text('diff', '--name-only', a,b).splitlines())
changed56 = paths(common,PR56)
changed55 = paths(common,PR55)
overlap = sorted(changed56 & changed55)
preserved = {}
for label,commit,changed in [('PR56',PR56,changed56),('PR55',PR55,changed55)]:
    preserved[label] = []
    for path in sorted(changed-set(overlap)):
        before = text('rev-parse', f'{commit}:{path}')
        after = text('rev-parse', f'{CANDIDATE}:{path}')
        assert before == after, (label,path)
        preserved[label].append({'path':path,'blob':after})

record = {
    'reviewedCommit':CANDIDATE, 'tree':text('rev-parse',f'{CANDIDATE}^{{tree}}'),
    'parents':text('show','-s','--format=%P',CANDIDATE).split(),
    'PR54':{'commit':PR54,'includedByPR56':subprocess.run(
        ['git','merge-base','--is-ancestor',PR54,PR56],cwd=ROOT).returncode == 0},
    'PR56':{'commit':PR56,'tree':text('rev-parse',f'{PR56}^{{tree}}')},
    'PR55':{'commit':PR55,'tree':text('rev-parse',f'{PR55}^{{tree}}')},
    'mergeBase':common, 'changedPathOverlap':overlap,
    'parentChangedPathsPreserved':preserved,
    'publicDocumentContracts':{}, 'nativeDatabaseAccess':False,
}
assert record['parents'] == [PR56, PR55]
assert record['PR56']['tree'] == 'c0dc04ab385a69de7cbf2a376634e77097b254ec'
assert record['PR55']['tree'] == 'c47fc3ccd4e5517073a68e90a9e47798b73495a0'
assert record['PR54']['includedByPR56']
for prefix in ['packages/contracts/dist','packages/contracts/document-application','apps/control/document-application']:
    original = text('rev-parse',f'{PR56}:{prefix}')
    composed = text('rev-parse',f'{CANDIDATE}:{prefix}')
    assert original == composed,prefix
    record['publicDocumentContracts'][prefix] = {'PR56':original,'composition':composed}
record['sharedDecoder'] = {
    'path':'packages/contracts/retrieval-0.2/operation-contracts.mjs',
    'PR55Blob':text('rev-parse',f'{PR55}:packages/contracts/retrieval-0.2/operation-contracts.mjs'),
    'compositionBlob':text('rev-parse',f'{CANDIDATE}:packages/contracts/retrieval-0.2/operation-contracts.mjs'),
}
assert record['sharedDecoder']['PR55Blob'] == record['sharedDecoder']['compositionBlob']
(HERE/'prerequisite-audit.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'commit':CANDIDATE,'tree':record['tree'],'overlap':overlap,
                  'preservedPathCounts':{k:len(v) for k,v in preserved.items()}}))
