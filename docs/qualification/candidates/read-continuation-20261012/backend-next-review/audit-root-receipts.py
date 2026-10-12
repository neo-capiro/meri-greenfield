"""Review retained root captures from an immutable receipt head; no suite execution."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[5]
PREFIX='docs/qualification/candidates/read-continuation-20261012/backend-next-integration/'
SOURCE='fecf97a4a8b742c6c09b781d3b799816e8b548e4'
TEST_SOURCE='46b0ec6ce52cd7acc8405a9b8d2d0e33e082f806'
TEST='packages/contracts/test/retrieval-backend-next-independent.test.mjs'

def git(*args):
    return subprocess.check_output(['git',*args],cwd=ROOT,timeout=30)
def blob(ref,path):
    return git('show',ref+':'+path)
def main(head):
    checks=[];receipts=[]
    def check(name,passed): checks.append({'check':name,'pass':bool(passed)})
    expected={'focused':1,'public-contracts':1,'public-contracts-launchers-repaired':0,'corrected-independent':0,'expanded':0,'source-audit-corrected':0,'accepted-packets-corrected':0}
    for label,exitcode in expected.items():
        r=json.loads(blob(head,PREFIX+label+'.json'))
        check(label+' expected retained exit',r['exitCode']==exitcode)
        check(label+' physical owned cleanup',r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'] and all(x['status']==0 for x in r['reapedDescendants']))
        check(label+' clean measured source',r['sourceDiffBytes']==0)
        check(label+' capture helper identity',hashlib.sha256(blob(r['sourceHead'],PREFIX+'capture-reaped.py')).hexdigest()==r['captureSha256'])
        texts={}
        for stream in r['streams']:
            raw=blob(head,stream['path']);check(label+' exact stream '+stream['path'],len(raw)==stream['bytes'] and hashlib.sha256(raw).hexdigest()==stream['sha256']);texts['stdout' if '.stdout.' in stream['path'] else 'stderr']=raw.decode(errors='replace')
        counts={k:int(m.group(1)) for k in ['tests','pass','fail','skipped','cancelled'] if (m:=re.search(r'(?:ℹ |# )'+k+r' (\d+)',texts['stdout']))}
        if label in ['expanded','corrected-independent','public-contracts-launchers-repaired']:
            check(label+' complete positive test summary',counts.get('tests',0)>0 and counts.get('pass')==counts.get('tests') and all(counts.get(k)==0 for k in ['fail','skipped','cancelled']))
        if label=='focused':check('retained focused1022/7',counts.get('tests')==1029 and counts.get('pass')==1022 and counts.get('fail')==7)
        if label=='corrected-independent':check('corrected unchanged29',counts.get('tests')==29)
        if label=='expanded':check('expanded source/test identity',r['sourceHead']==TEST_SOURCE and blob(r['sourceHead'],TEST)==(ROOT/TEST).read_bytes())
        if label=='public-contracts':check('retained missing launcher failure','MODULE_NOT_FOUND' in texts['stdout']+texts['stderr'])
        if label=='public-contracts-launchers-repaired':check('public generation and types actually included','generate.mjs --check' in texts['stdout'] and 'tsc' in texts['stdout'])
        receipts.append({'label':label,'sourceHead':r['sourceHead'],'exitCode':r['exitCode'],'counts':counts,'ownedPidAndPgid':r['ownedPidAndPgid'],'ownedProcessGroupAbsent':r['ownedProcessGroupAbsent'],'reapedDescendants':r['reapedDescendants']})
    protected=[]
    for line in git('ls-tree','-rz',SOURCE).split(b'\0'):
        if not line:continue
        meta,path=line.split(b'\t');path=path.decode()
        if path.startswith(('packages/','apps/','scripts/')) and '/test/' not in path and '/test.' not in path:
            protected.append((path,meta))
    final={line.split(b'\t')[1].decode():line.split(b'\t')[0] for line in git('ls-tree','-rz',head).split(b'\0') if line}
    check('all product/runtime bytes unchanged after canonical freeze',all(final.get(p)==m for p,m in protected))
    check('final reviewer controls exact',blob(head,TEST)==(ROOT/TEST).read_bytes())
    report={'receiptHead':head,'canonicalSource':SOURCE,'testedSource':TEST_SOURCE,'passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks),'receipts':receipts,'checks':checks,'limits':'Read-only verification of retained source test receipts; no rerun, native/SQL/provider/runtime acceptance or physical task teardown claim.'}
    print(json.dumps(report,indent=2));return bool(report['failed'])
if __name__=='__main__':raise SystemExit(main(sys.argv[1]))
