#!/usr/bin/env python3
import hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[5]
out=Path(__file__).resolve().parent
def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
head=git('rev-parse','HEAD');base='1c79a912b6589ccd1004c12a9981bc146d79e8bc'
protected=['apps/artifacts','packages/skills','packages/contracts/dist','packages/contracts/package.json','packages/contracts/meri.schema.json','packages/contracts/retrieval-0.2/catalog.json','packages/contracts/retrieval-0.2/mail.schema.json','packages/runtime/operation-lifetime.mjs','apps/control/document-application/index.mjs','apps/control/document-application/current.mjs','apps/control/document-application/http.mjs','apps/control/document-application/format-admission.mjs','apps/control/action-host/session','apps/worker/conversation','apps/control/conversations','packages/ui-stream','packages/window-resolution']
def blobs(ref,paths):
 rows={}
 for line in git('ls-tree','-r',ref,'--',*paths).splitlines():
  attributes,path=line.split('\t');rows[path]=attributes.split()[2]
 return rows
original=blobs(base,protected);current=blobs(head,protected);assert original==current
fixture='apps/control/document-application/local/fixture.mjs'
assert git('rev-parse',head+':'+fixture)==git('rev-parse','3403858b:'+fixture)
paths=['apps/control/document-application/mail-history/compose.mjs','apps/control/document-application/mail-history/bodies.mjs','apps/control/document-application/mail-history/source.mjs','apps/control/document-application/mail-history/binding.mjs','packages/contracts/retrieval-0.2/mail-utf16.mjs','packages/contracts/retrieval-0.2/mail-validation.mjs','apps/gateway/test/mail-history-gateway-flow.test.mjs','apps/gateway/test/mail-history-source-fixture.mjs',fixture]
bindings=[]
for path in paths:bindings.append({'path':path,'gitBlob':git('rev-parse',head+':'+path),'sha256':hashlib.sha256((root/path).read_bytes()).hexdigest()})
old=subprocess.check_output(['git','show','5e673db8:apps/control/document-application/mail-history/compose.mjs'],cwd=root,text=True)
new=(root/'apps/control/document-application/mail-history/compose.mjs').read_text()
block=lambda text:text[text.index('function blocks('):text.index('export function createMailHistoryCompiler')]
assert block(old)==block(new)
receipt={'status':'PASS','sourceHead':head,'sourceTree':git('rev-parse','HEAD^{tree}'),'protectedBase':base,'protectedBlobCount':len(current),'protectedBlobs':current,'sourceBindings':bindings,'fixtureOwnedCommit':'3403858b','publicPackageVersion':json.loads((root/'packages/contracts/package.json').read_text())['version'],'blocksByteIdenticalToGatewayArtifactSource':'5e673db81bd8eda7b0a4b27972a948981429a7b6','nativeQualified':False}
(out/'source-binding.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({key:receipt[key] for key in ['status','sourceHead','sourceTree','protectedBlobCount','publicPackageVersion']}))
