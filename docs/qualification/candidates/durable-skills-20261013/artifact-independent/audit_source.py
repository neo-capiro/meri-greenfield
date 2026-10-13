"""Bind reviewed components and prior fresh renders to the exact frozen source."""
from pathlib import Path
import subprocess,json,hashlib,sys
root=Path(sys.argv[1]);out=Path(sys.argv[2]);pin='14f2e2eaff45e520727ba2b0eb7398daf0cf3a38';base='a337ef93e386f5eb646e85f89f26b425546b1222'
def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
def blobs(ref,paths):
 if not paths:return {}
 return {line.split('\t')[1]:line.split('\t')[0].split()[2] for line in git('ls-tree','-r',ref,'--',*paths).splitlines() if line}
protected=['apps/artifacts','packages/skills/originals','packages/skills/assets.json','packages/skills/index.mjs','packages/contracts/dist','packages/contracts/package.json','packages/contracts/meri.schema.json','packages/contracts/retrieval-0.2/catalog.json','packages/runtime/operation-lifetime.mjs','apps/control/document-application/index.mjs','apps/control/document-application/current.mjs','apps/control/document-application/http.mjs','apps/control/document-application/format-admission.mjs','apps/control/action-host/session','packages/ui-stream','packages/window-resolution','docs/qualification/candidates/local-application-20261013/native-seam']
original=blobs(base,protected);current=blobs(pin,protected);assert original==current
native_sql=[p for p in git('ls-tree','-r','--name-only',base,'docs/qualification').splitlines() if p.endswith('.sql')]
assert blobs(base,native_sql)==blobs(pin,native_sql)
owned=['apps/control/document-application/commitments-audit','apps/control/document-application/relationship-brief','packages/skills/evidence','packages/skills/commitments/evidence.mjs']
scope=blobs(pin,owned); bindings=[]
for path,blob in scope.items():
 if path.endswith('.mjs') and '/test/' not in path:
  data=(root/path).read_bytes();assert git('hash-object',path)==blob
  bindings.append({'path':path,'gitBlob':blob,'sha256':hashlib.sha256(data).hexdigest()})
retained='6fdd5041e90dc9c8913db90a4ae7f15e0630bed5'
stable=['apps/artifacts','apps/control/document-application/commitments-audit/compose.mjs','apps/control/document-application/commitments-audit/rendering.mjs','apps/control/document-application/commitments-audit/binding.mjs','apps/control/document-application/commitments-audit/local','apps/control/document-application/local','packages/skills/evidence','packages/skills/commitments']
# The earlier Commitments flow used the same emitter, semantic/evidence owners,
# private guard and artifact lifecycle. Its source collector alone was repaired.
old=blobs(retained,stable);new=blobs(pin,stable)
for path,blob in old.items():assert new[path]==blob
changes=git('diff','--name-only',retained,pin,'--','apps/control/document-application/commitments-audit').splitlines()
assert changes==['apps/control/document-application/commitments-audit/source.mjs','apps/control/document-application/commitments-audit/test/compiler.test.mjs']
relationship='9b068f81a7945a883f05fc85a9314578f733cab1'
assert blobs(relationship,['apps/control/document-application/relationship-brief'])==blobs(pin,['apps/control/document-application/relationship-brief'])
composition='e0cc78711e741c80bfb2d6459a622a9ed7560586'
assert blobs(pin,owned+protected)==blobs(composition,owned+protected)
report={'status':'PASS','sourceCommit':pin,'sourceTree':git('rev-parse',pin+'^{tree}'),'finalCompositionCommit':composition,'finalCompositionTree':git('rev-parse',composition+'^{tree}'),'compositionComponentAndProtectedBlobsByteIdentical':True,'base':base,'protectedBlobCount':len(current),'protectedBlobs':current,'nativeQualificationSqlPins':blobs(pin,native_sql),'nativeQualificationSqlFilesPresent':len(native_sql),'componentBindings':bindings,'retainedCommitmentsFlowSource':retained,'retainedCommitmentsEmitterAndEvidenceBytesUnchanged':True,'onlyCommitmentsChangesAfterFreshRender':changes,'relationshipComponent':relationship,'relationshipBlobsByteIdentical':True,'publicVersion':json.loads((root/'packages/contracts/package.json').read_text())['version'],'nativeQualified':False}
out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['status','sourceCommit','sourceTree','protectedBlobCount','publicVersion']}))
