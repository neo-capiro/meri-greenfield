import hashlib,json,os,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5]
out=Path(__file__).resolve().parent
base='61ffc8f2487a010c9baba0c8e18088b42569d90a'
source='8a3643e3564f676b66edc6b4cc220fb1c4193098'
def tree(ref):
    result={}
    for raw in subprocess.check_output(['git','ls-tree','-rz',ref],cwd=root).split(b'\0'):
        if raw:
            meta,path=raw.split(b'\t',1);result[path.decode()]=meta.decode()
    return result
old=tree(base);new=tree(source)
allowed={'apps/control/action-host/local/fixture.mjs','apps/control/action-host/local/recovery.mjs','scripts/local-followthrough/host-run.mjs'}
changed=[p for p,v in old.items() if new.get(p)!=v]
assert set(changed)==allowed,changed
diff=subprocess.check_output(['git','diff','8fccbd9da01444b60e3298dc7d72807fd10e3e0f',source,'--','apps','packages','scripts','package.json','package-lock.json'],cwd=root)
captured=json.loads((out/'missing-approval-fact.json').read_text())
assert len(diff)==captured['sourceDiffBytes'] and hashlib.sha256(diff).hexdigest()==captured['sourceDiffSha256']
checks=[]
for label in ['initial-direct','missing-approval-fact','repaired-cli']:
    r=json.loads((out/(label+'.json')).read_text())
    for stream in r['streams']:
        data=(root/stream['path']).read_bytes()
        assert len(data)==stream['bytes'] and hashlib.sha256(data).hexdigest()==stream['sha256']
    assert r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired']
    try: os.killpg(r['ownedPidAndPgid'],0)
    except ProcessLookupError: absent=True
    else: absent=False
    assert absent,r['ownedPidAndPgid']
    checks.append({'label':label,'exitCode':r['exitCode'],'group':r['ownedPidAndPgid'],'freshAbsent':absent})
assert checks[0]['exitCode']==1 and all(x['exitCode']==0 for x in checks[1:])
cli=json.loads((out/'repaired-cli.stdout.bin').read_text())
assert cli['status']=='PASS' and cli['fixtureClosed'] is True
assert cli['result']['stats']['taskEffects']==1 and cli['result']['stats']['sourceReads']==1
assert cli['result']['stats']['commandChargeMicroUsd']=='10'
assert cli['result']['stats']['lookupChargeMicroUsd']=='10'
assert cli['result']['cleanup']['listeners']==[{'closed':True,'listening':False,'activeSockets':0}]*3
receipt={'base':base,'source':source,'originalEntries':len(old),'unchangedOriginalEntries':len(old)-len(changed),'changedOriginals':sorted(changed),'captures':checks,'status':'PASS','scope':'Synthetic local source/HTTP only; native persistence unrun'}
(out/'audit.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
