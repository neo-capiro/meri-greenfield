"""Read and bind existing root receipts; never rerun broad/public/native checks."""
from pathlib import Path
import json,hashlib,re,subprocess
root=Path(__file__).resolve().parents[5];ev=Path(__file__).resolve().parent
head='4c40fb4c35d716dcd1e3b09ec29647ccca5a1326';source='753566baf2d230ed241941dcdeca41625277cb1d';tests='005cb30d7e8c1be28792e4c722c62005e728862f';prefix='docs/qualification/candidates/read-continuation-20261012/observed-reads-integration/'
checks=[]
def check(label,value):checks.append({'check':label,'passed':bool(value)})
def git(*a):return subprocess.check_output(['git',*a],cwd=root)
def body(path,ref=head):return git('show',ref+':'+path)
def sha(b):return hashlib.sha256(b).hexdigest()
addedTest='packages/contracts/test/retrieval-observed-integration-independent.test.mjs'
productChanges=git('diff','--name-only',source,head,'--','apps','packages','scripts','package.json','package-lock.json').decode().splitlines()
check('final root production unchanged; only exact independent test added',productChanges==[addedTest])
check('root includes exact frozen independent assertions',body(addedTest)==(root/addedTest).read_bytes() and body(addedTest,tests)==(root/addedTest).read_bytes())
receipts=[]
for label in ['focused','source-audit','family-packets','public-contracts','expanded']:
    value=json.loads(body(prefix+label+'.json'));expected=tests if label=='expanded' else source
    check('root '+label+' exact source clean',value['sourceHead']==expected and value['sourceDiffBytes']==0)
    check('root '+label+' exit and owned cleanup',value['exitCode']==0 and value['ownedProcessGroupAbsent'] and not value['timedOut'] and not value['ownedGroupKillRequired'] and all(x['status']==0 for x in value['reapedDescendants']))
    for stream in value['streams']:
        raw=body(stream['path']);check('root '+label+' raw '+stream['path'].split('.')[-2],len(raw)==stream['bytes'] and sha(raw)==stream['sha256'])
    receipts.append({'label':label,'source':value['sourceHead'],'group':value['ownedPidAndPgid'],'absent':value['ownedProcessGroupAbsent'],'reapedDescendants':value['reapedDescendants'],'durationSeconds':value['durationSeconds']})
for label,count in [('focused',755),('public-contracts',7),('expanded',2817)]:
    text=body(prefix+label+'.stdout.bin').decode();check('root '+label+' exact passed/skipped count',re.search(r'(?:#|ℹ) pass '+str(count)+r'\b',text) and re.search(r'(?:#|ℹ) fail 0\b',text) and re.search(r'(?:#|ℹ) skipped 0\b',text))
public=body(prefix+'public-contracts.stdout.bin');check('public generated and type steps included',b'check:generated' in public and b'typecheck' in public and b'tsc --noEmit --strict' in public)
for name,count in [('audit-results.json',7415),('family-packet-integrity.json',171)]:
    result=json.loads(body(prefix+name));check('root exact '+name,result['passed']==count and result['failed']==0)
for p in sorted(ev.glob('*.json')):
    v=json.loads(p.read_text())
    if not isinstance(v,dict) or 'ownedPidAndPgid' not in v:continue
    check('review '+p.stem+' cleanup',v['ownedProcessGroupAbsent'] and not v['timedOut'] and not v['ownedGroupKillRequired'])
    for stream in v['streams']:
        b=(root/stream['path']).read_bytes();check('review '+p.stem+' raw hash',len(b)==stream['bytes'] and sha(b)==stream['sha256'])
result={'rootHead':head,'rootTree':git('rev-parse',head+'^{tree}').decode().strip(),'productionSource':source,'fullTestSource':tests,'rootReceipts':receipts,'checks':checks,'passed':sum(x['passed']for x in checks),'failed':sum(not x['passed']for x in checks),'scope':'READ_ONLY_EXISTING_ROOT_RECEIPTS_NOT_RUNTIME_ACCEPTANCE'}
(ev/'receipt-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k]for k in ['rootHead','passed','failed']}));raise SystemExit(bool(result['failed']))
