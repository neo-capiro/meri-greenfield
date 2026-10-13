"""Read-only local source, render artifact, and owned-process audit."""
import pathlib,subprocess,json,hashlib,os,sys
root=pathlib.Path(__file__).resolve().parents[5];packet=pathlib.Path(__file__).resolve().parent
base='3fb65433ff50cdc7bb48afcc4d437d290e24da3e';source=sys.argv[1]
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def entries(ref):return {r.split(b'\t',1)[1].decode():r.split(b'\t',1)[0].decode() for r in git('ls-tree','-r','-z',ref).split(b'\0') if r}
a,b=entries(base),entries('HEAD');assert not(set(a)-set(b));changed=sorted(p for p in a if a[p]!=b[p]);assert changed==['apps/artifacts/python/office.py'],changed
path=changed[0];raw=git('show',source+':'+path);assert raw==(root/path).read_bytes()
assert git('show','1c3cfb9c97681415286236edd21a829e51b565eb:apps/artifacts/office-transform.mjs')==(root/'apps/artifacts/office-transform.mjs').read_bytes()
groups=[];captures=[]
for label in ['baseline','final']:
 receipt=json.loads((packet/(label+'.json')).read_text());assert receipt['sourceDiffBytes']==0 and not receipt['timedOut'] and receipt['ownedProcessGroupAbsent'] and not receipt['ownedGroupKillRequired'];groups.append(receipt['ownedPidAndPgid'])
 for item in receipt['streams']:
  data=(root/item['path']).read_bytes();assert len(data)==item['bytes'] and hashlib.sha256(data).hexdigest()==item['sha256']
 for file in packet.glob(label+'-processes-*.json'):
  for process in json.loads(file.read_text()):
   assert process['groupAbsent'];groups.append(process['pid'])
 captures.append({'label':label,'exitCode':receipt['exitCode'],'seconds':receipt['durationSeconds']})
for pg in groups:
 try:os.killpg(pg,0)
 except ProcessLookupError:pass
 else:raise AssertionError('owned group remains')
result={'base':base,'source':git('rev-parse',source).decode().strip(),'originalEntries':len(a),'unchangedOriginalEntries':len(a)-1,'approvedOriginalChanges':changed,'sourceSha256':hashlib.sha256(raw).hexdigest(),'officeRecalculationSourceUnchanged':True,'allOriginalTestsPublicContractsAndOtherSourceUnchanged':True,'captures':captures,'ownedProcessGroupsFreshlyAbsent':groups,'nativeQualification':False,'dependenciesCreated':False}
(packet/'audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
