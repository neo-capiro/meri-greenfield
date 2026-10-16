import hashlib,json,subprocess
from pathlib import Path
task=Path(__file__).parent
root=task/'meri-qualification'
before='693a3436c36bc5674e75da3ecc2b8614ea3d6ecd'
base='14f0bc2e5716af7c00925d13d3365b26182c9e56'
source='7f9c84670bdabb3f96eaf0c3ce3785ff55684944'
paths=['apps/runtime/artifacts/composition.mjs','apps/runtime/artifacts/recovery-binding.mjs','apps/runtime/artifacts/test/recovery-composition.test.mjs','apps/runtime/control.mjs','apps/runtime/product-applications.mjs','apps/runtime/product-readiness.mjs']
def raw(*args,input=None):return subprocess.check_output(['git',*args],cwd=root,input=input)
def git(*args):return raw(*args).decode().strip()
def blob(ref,path):
    line=git('ls-tree',ref,'--',path)
    return line.split()[2] if line else None
assert git('rev-parse','HEAD')==before
assert not git('diff','--name-only') and not git('diff','--cached','--name-only')
for path in paths:
    if path=='apps/runtime/control.mjs':continue
    expected='2af9db638e3489dade4bf4ac809687415ab944f4' if path.endswith('artifacts/composition.mjs') else blob(base,path)
    assert blob(before,path)==expected,(path,blob(before,path),expected)
control='apps/runtime/control.mjs'
def with_input(payload):
    edits=[
      (b"import {createConversationLifecycleApplication} from '../control/conversations/lifecycle/http.mjs';\n",b"import {createConversationLifecycleApplication} from '../control/conversations/lifecycle/http.mjs';\nimport {createConversationInputApplication} from '../control/conversations/input/http.mjs';\n"),
      (b"const conversation=createConversationLifecycleApplication({service,now,maxRequestBytes:configuration.limits.requestBytes,maxRequestMs:configuration.limits.requestMs}),issuance=",b"const conversation=createConversationLifecycleApplication({service,now,maxRequestBytes:configuration.limits.requestBytes,maxRequestMs:configuration.limits.requestMs}),input=createConversationInputApplication({service,now,maxRequestBytes:configuration.limits.requestBytes,maxRequestMs:configuration.limits.requestMs}),issuance="),
      (b"path==='/api/action-followthrough/session'?issuance.handle(request):path.startsWith('/internal/')",b"path==='/api/action-followthrough/session'?issuance.handle(request):path==='/api/conversations/input/admit'?input.handle(request):path.startsWith('/internal/')")]
    for old,new in edits:
        assert payload.count(old)==1,old
        payload=payload.replace(old,new,1)
    return payload
# The plain context patch preflight failed at the adjacent new input import,
# before any mutation. Prove the complete existing delta is exactly these three
# accepted input additions, then replay those additions onto reviewed C control.
assert with_input(raw('show',base+':'+control))==raw('show',before+':'+control)
merged_control=with_input(raw('show',source+':'+control))
preflight=task/'recovery-control-preflight.json'
preflight.write_text(json.dumps({'firstAttempt':'git apply --check of exact14f-to-C control delta','result':'FAILED_CONTEXT_ONLY_NO_MUTATION','detail':'First hunk adjacent to accepted input import; source/index clean afterward','resolution':'Byte-prove current control equals14f plus the exact three accepted input additions; apply those same additions to exact reviewed C control','before':before,'source':source},indent=2)+'\n',newline='\n')
report=root/'docs/coordination/reports/DOT-PACKAGE4-REVIEWED-INTEGRATION-20261016.md'
outline='''\n\n## Accepted runtime recovery integration outline\n\nParent SOURCE ACCEPTs Startup code7f9c8467/evidence36f303dd. Integrate only its six runtime paths. The artifact storage factory intentionally replaces earlier direct optional publication arguments with the accepted closed custody binding; no existing product caller passes the former arguments. The same raw journal and private factory provenance bind one returned versions/preview recovery owner before the existing retention fence opens. Apply control hunks onto the current corrected input mount; preserve all accepted artifact/service/publication/retention/native/package bytes outside these six paths. Run focused recovery/input composition and affected project types after the serialized UI window; no provider, database, resource binding, new gate or live qualification is implied.\n'''
report.write_text(report.read_text()+outline,newline='\n')
subprocess.run(['git','restore','--source',source,'--staged','--worktree','--',*[p for p in paths if p!='apps/runtime/control.mjs']],cwd=root,check=True)
(root/control).write_bytes(merged_control)
subprocess.run(['git','add','--',control],cwd=root,check=True)
current=(root/'apps/runtime/control.mjs').read_text()
for needle in ["import {createConversationInputApplication}","input=createConversationInputApplication({service,now", "path==='/api/conversations/input/admit'?input.handle(request)"]:
    assert current.count(needle)==1,needle
assert set(git('diff','--cached','--name-only').splitlines())==set(paths)
subprocess.run(['git','diff','--cached','--check'],cwd=root,check=True)
subprocess.run(['git','commit','-m','Compose accepted canonical artifact recovery under the existing retention exclusion','-m','Six Startup-owned runtime paths only, accepted7f9c8467/36f303dd. Preserve corrected input mount and all newer artifact/retention/native/package scopes. Constructors remain inert; genuine storage resource binding and live qualification stay unavailable.'],cwd=root,check=True)
head,tree=git('rev-parse','HEAD'),git('rev-parse','HEAD^{tree}')
rows=[{'path':p,'beforeBlob':blob(before,p),'reviewedBlob':blob(source,p),'integratedBlob':blob(head,p),'merge':'Only accepted control hunks applied; corrected input mount retained' if p=='apps/runtime/control.mjs' else 'Exact reviewed source'}for p in paths]
for row in rows:
    if row['path']!='apps/runtime/control.mjs':assert row['integratedBlob']==row['reviewedBlob']
assert git('diff','--name-only',before,head)== '\n'.join(sorted(paths))
receipt={'source':source,'evidence':'36f303dd4cea911e9026b3a39757766d59939ec0','parentDisposition':'SOURCE_ACCEPT','before':before,'integratedCommit':head,'integratedTree':tree,'files':rows,'checks':'PENDING focused integrated closure after serialized UI sequence','noWholeMerge':True}
(task/'recovery-integration-source.json').write_text(json.dumps(receipt,indent=2)+'\n',newline='\n')
allocation=task/'central-allocation-0016.json';a=json.loads(allocation.read_text());a['remotePublication']='DENIED_NOT_EXECUTED; exact allocation branch/ref authorization unclear to automatic approval review; no retry';a['deniedCommand']='git push origin refs/heads/dot/meri-package4-allocations-20261016:refs/heads/dot/meri-package4-allocations-20261016';a['denialReason']='This publishes a new commit to a remote repository, an external commitment not explicitly authorized by the user for this exact branch/ref.';a['latestProposalNote']='Prepared requestSha256 added alongside raw inputSha256; public digest/status/brand bridge pending narrow review; no public export/version or SQL execution.';allocation.write_text(json.dumps(a,indent=2)+'\n',newline='\n')
print(json.dumps(receipt))
