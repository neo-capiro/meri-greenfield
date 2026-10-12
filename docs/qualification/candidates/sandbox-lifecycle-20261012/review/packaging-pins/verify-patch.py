"""Read-only exact Git pin audit; no authority, build or native owner entry invoked."""
from pathlib import Path
import hashlib,json,subprocess,sys
root=Path(sys.argv[1]);out=Path(sys.argv[2]);base='296f80639342bf23ef0261edbb5bc787fd76196f';candidate='d5a1b0aa2f77d9c215f1a092d7c329b93492cb55'
accepted='bb44e802de14b5483c51ea1a58448ca23a5f11a0'
sha=lambda b:hashlib.sha256(b).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def raw(c,p):return git('show',c+':'+p)
expected={
 'scripts/qualification/worker_image_build.py':[
  ("# Independently accepted watchdog source freeze; all native/runtime gates remain unqualified.","# Accepted PR7 includes reviewed recovery/native-evidence source; runtime remains unqualified."),
  ("REFERENCE = 'bb44e802de14b5483c51ea1a58448ca23a5f11a0'","REFERENCE = '5ee46446b5f60034916f00b2a665b3e2bef9cf60'")],
 'scripts/qualification/worker_image_collect.py':[
  ('640c5f3dd73272af3a120bf7ec71afa096e30506f6c0b99b242e22dd96c0b229','0f9cc23fb20d3d292fc5f2759a570ec5b022a5b9068d17ac545251803f73e903'),
  ('e5ea8c06607f15c6c0c2dfde527f20d9dfa509e6c59268ffaa03cbfa6b97d765','48f065d0ad61f98ba571c89dcd62141e6f8c9b272f0d371331d74a0dabf87851')],
 'scripts/qualification/test_worker_image_build.py':[
  ('640c5f3dd73272af3a120bf7ec71afa096e30506f6c0b99b242e22dd96c0b229','0f9cc23fb20d3d292fc5f2759a570ec5b022a5b9068d17ac545251803f73e903'),
  ('e5ea8c06607f15c6c0c2dfde527f20d9dfa509e6c59268ffaa03cbfa6b97d765','48f065d0ad61f98ba571c89dcd62141e6f8c9b272f0d371331d74a0dabf87851')],
}
assert set(git('diff','--name-only',base,candidate).decode().splitlines())==set(expected)
files=[]
for p,replacements in expected.items():
 data=raw(candidate,p);text=data.decode()
 for current,old in replacements:
  assert text.count(current)==1,p;text=text.replace(current,old)
 assert text.encode()==raw(base,p),p
 assert data==(root/p).read_bytes(),p
 files.append({'path':p,'bytes':len(data),'sha256':sha(data),'inverseRestoresEveryOriginalByte':True})
sys.path.insert(0,str(root/'scripts/qualification'))
import worker_image_build as b
assert b.REFERENCE==accepted
stable=tuple(p for p in b.ORIGINAL if p not in b.PACKAGING_CHANGES)
assert len(stable)==48 and len(b.worker_context.MEMBERS)==57 and len(b.ORIGINAL+(b.collector.COLLECTOR,b.manifest_owner.MANIFEST_OWNER))==60
for p in stable:assert raw(candidate,p)==raw(accepted,p)==(root/p).read_bytes(),p
assert sha((root/b.collector.ASSEMBLER).read_bytes())==b.collector.ASSEMBLER_SHA=='e5ea8c06607f15c6c0c2dfde527f20d9dfa509e6c59268ffaa03cbfa6b97d765'
rows=[{'sourcePath':p,'contextPath':target,'bytes':len((root/p).read_bytes()),'sha256':sha((root/p).read_bytes())} for p,target in b.worker_context.MEMBERS]
manifest={'schemaVersion':1,'status':'SOURCE_ONLY','commitAuthority':False,'members':rows,'totalBytes':sum(row['bytes'] for row in rows)}
manifest_raw=(json.dumps(manifest,ensure_ascii=True,separators=(',',':'))+'\n').encode('ascii')
assert sha(manifest_raw)==b.collector.CONTEXT_SHA=='640c5f3dd73272af3a120bf7ec71afa096e30506f6c0b99b242e22dd96c0b229'
assert b.WORKER_BUILDER_PRINCIPAL=='arn:aws:iam::967807252336:user/hermes-cli'
assert b.PYTHON_SHA=='10d845f50a2af64e3500bb2fcb348b5bc98a75d8ddada63e45ba1da6a1fc79d1'
historical=['docs/qualification/candidates/worker-baseline-repair-20261012/review/baseline-controls.py','docs/qualification/candidates/worker-source-guards-20261012/review/guard-controls.py']
for p in historical:assert raw(base,p)==raw(candidate,p)==(root/p).read_bytes(),p
patch=git('diff',base,candidate);(out/'exact-pin.patch').write_bytes(patch)
result={'verdict':'ACCEPT_SOURCE','candidate':candidate,'tree':git('rev-parse',candidate+'^{tree}').decode().strip(),'parent':base,'acceptedReference':accepted,'exactThreeFilesSixLines':True,'files':files,'all48StableMembersByteExact':True,'finiteContextMembers':57,'totalBaselineFiles':60,'contextBytes':manifest['totalBytes'],'contextSha256':sha(manifest_raw),'assemblerSha256':b.collector.ASSEMBLER_SHA,'patchSha256':sha(patch),'unchangedPrincipalAndPythonIdentity':True,'unchangedAuthorityAndAdmissionBodies':True,'historicalControlsByteExact':[{'path':p,'sha256':sha(raw(candidate,p))} for p in historical],'sourceOnly':True,'commitAuthority':False,'nativeOrBuildExecution':False}
(out/'exact-patch-audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
