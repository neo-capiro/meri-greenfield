"""Independent exact-object audit; local Git and receipt reads only."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
BASE = '77cedb126d57a0223d2df42ad2f3fe988eb51759'
SHARED = ['apps/gateway/dispatch/action-read-context.mjs',
          'apps/gateway/dispatch/operation-context.mjs',
          'apps/gateway/dispatch/read-result-envelope.mjs',
          'packages/contracts/retrieval-0.2/catalog-validation.mjs']
PINS = {
    '84a9313735ec9fb079e35a92adb074f6afaf32e7': SHARED,
    'eaa00fd0ea8ec98bc77b050caaa6526a2738405e': [
        'apps/gateway/sources/action-items/'+p for p in
        ['handler.mjs', 'http-adapter.mjs', 'projection.mjs', 'request-context.mjs']],
    '6f14d780a40e878fa62bc928c4d520286313f56c': [
        'apps/control/task-lookup/'+p for p in
        ['binding.mjs', 'delivery.mjs', 'index.mjs', 'postgres-results.mjs', 'migrations/0001_task_lookup.sql']],
    'a57f5cf0e2345975ec11a3c2f43157c6e6769a73': [
        'evals/task-lookup/'+p for p in ['cli.mjs', 'contracts.mjs', 'corpus.mjs', 'score.mjs']],
}
def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)
def body(ref, path):
    if ref=='WORKTREE':
        return (ROOT/path).read_bytes()
    return git('show', ref+':'+path)
def tree(ref):
    return {r.split(b'\t', 1)[1].decode(): r.split(b'\t', 1)[0]
            for r in git('ls-tree', '-rz', ref).split(b'\0') if r}
def sha(data):
    return hashlib.sha256(data).hexdigest()
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('candidate')
    p.add_argument('--receipts', nargs='*', default=[])
    p.add_argument('--preserved-failures', nargs='*', default=[])
    args=p.parse_args()
    candidate=git('rev-parse', args.candidate).decode().strip()
    before, after=tree(BASE), tree(candidate)
    assert before.keys() <= after.keys(), 'Original file removed'
    changes={path for path in before if before[path] != after[path]}
    production_changes=set(SHARED[1:])
    test_path='packages/contracts/test/vertical-source-expectations.mjs'
    assert changes - production_changes <= {test_path}, changes
    assert production_changes <= changes, changes
    test_inverse=None
    if test_path in changes:
        old, new=body(BASE,test_path),body(candidate,test_path)
        # Only the newly accepted action profile expectation may be added.
        line=b" ['actions.query','actions-complete/1'],\n"
        assert new.count(line)==1 and new.replace(line,b'',1)==old, 'Historical assertion changed beyond one exact profile row'
        test_inverse={'path':test_path,'beforeSha256':sha(old),'afterSha256':sha(new),'removeExactly':line.decode()}
    pins=[]
    for ref, paths in PINS.items():
        for path in paths:
            raw=body(candidate,path)
            assert raw==body(ref,path), ('Accepted source drift',path)
            pins.append({'path':path,'acceptedRef':ref,'sha256':sha(raw)})
    catalog=json.loads(body(candidate,'packages/contracts/retrieval-0.2/catalog.json'))
    assert len(catalog['originals'])==139
    assert sum(x['disposition']=='selected' for x in catalog['originals'])==96
    assert sum(x['disposition']=='deferred' for x in catalog['originals'])==43
    assert len(catalog['operations'])==97
    assert all(x['handler'] is None and x['qualification']=='pending' and x['availability']=='unimplemented' and x['retry']['maxRetries']==0 for x in catalog['operations'])
    requirement_path='docs/qualification/candidates/vertical-source-20261012/integration/requirements-continuation.json'
    assert body(candidate,requirement_path)==body(BASE,requirement_path)
    counts=json.loads(body(candidate,requirement_path))['counts']
    assert counts=={'requirements':53,'completedSourceDiscovery':2,'wholePending':51,'wholeRuntimeQualified':0}
    protected=['apps/worker','apps/proxy','packages/runtime','apps/control/qualification-sdk-fixture']
    for path in protected:
        assert git('rev-parse',BASE+':'+path)==git('rev-parse',candidate+':'+path),path
    receipts=[]
    for spec in args.receipts+args.preserved_failures:
        ref,path=spec.split(':',1)
        raw=body(ref,path);r=json.loads(raw)
        preserved=spec in args.preserved_failures
        assert r['exitCode']==(1 if preserved else 0) and not r['timedOut'] and r['ownedProcessGroupAbsent'] and not r['ownedGroupKillRequired'],path
        assert r['sourceDiffBytes']==0,path
        counts={}
        for stream in r['streams']:
            data=body(ref,stream['path'])
            assert len(data)==stream['bytes'] and sha(data)==stream['sha256'],stream['path']
            if 'stdout' in stream['path']:
                counts={k:int(v) for k,v in re.findall(r'^ℹ (tests|pass|fail|cancelled|skipped) (\d+)$',data.decode(),re.M)}
        assert counts and counts['tests']==counts['pass']+counts['fail'] and counts['cancelled']==counts['skipped']==0,path
        assert counts['fail']>0 if preserved else counts['fail']==0,path
        # Check bytes used in the receipt against the final accepted composition.
        for paths in PINS.values():
            for source in paths:
                assert body(r['sourceHead'],source)==body(candidate,source),(path,source)
        receipts.append({'receipt':spec,'sha256':sha(raw),'sourceHead':r['sourceHead'],
                         'exitCode':r['exitCode'],'ownedPidAndPgid':r['ownedPidAndPgid'],
                         'ownedProcessGroupAbsent':r['ownedProcessGroupAbsent'],
                         'counts':counts,'preservedFailure':preserved})
    print(json.dumps({'verdict':'PASS','base':BASE,'candidate':candidate,
        'originalEntries':len(before),'unchangedOriginals':len(before)-len(changes),
        'changedOriginals':sorted(changes),'testInverse':test_inverse,
        'acceptedSourceFiles':pins,'protectedTrees':protected,
        'scope':{'original':139,'selected':96,'deferred':43,'unavailable':97},
        'wholeRequirements':counts,'receipts':receipts,'runtimeQualified':False},indent=2))
if __name__=='__main__':
    main()
