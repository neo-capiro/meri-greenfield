"""Pinned metadata/source preservation audit; never imports or executes Capiro."""
from pathlib import Path
import subprocess,hashlib,json,re
root=Path(__file__).resolve().parents[5];e=Path(__file__).resolve().parent
base='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8';pin='fd8765ec01d292013758606204f2c9d886cd31c1';observed='4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace'
def git(*args,cwd=root):return subprocess.check_output(['git','-C',str(cwd),*args],stderr=subprocess.PIPE)
def source(path,ref=pin):return git('show',ref+':'+path,cwd='/workspace/capirov2')
old=json.loads(git('show',base+':docs/qualification/candidates/memory-independent-resume-20261012/private-source-verification.json'))
paths={x['path'] for x in old['files']}|{'apps/api/src/meri/meri.controller.ts','apps/api/src/meri/tool-service-secret.guard.ts','apps/api/src/tenant/tenant-context.middleware.ts','apps/api/src/tenant/current-tenant.decorator.ts','apps/api/src/auth/roles.guard.ts','apps/api/src/meri/tool-service-secret.guard.spec.ts','apps/api/src/memory/memory-proposal.controller.ts'}
refs=[];checks=[]
def check(label,value):checks.append({'name':label,'passed':bool(value)})
for path in sorted(paths):
 entry={'path':path}
 for name,rev in [('pinned',pin),('observed',observed)]:
  b=source(path,rev);entry[name]={'commit':rev,'gitBlob':git('rev-parse',rev+':'+path,cwd='/workspace/capirov2').decode().strip(),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
 check(path+':unchanged',entry['pinned']['gitBlob']==entry['observed']['gitBlob']);refs.append(entry)
(e/'reference-identities.json').write_text(json.dumps({'privateBodiesPublished':False,'references':refs},indent=2)+'\n')
controller=source('apps/api/src/meri/meri.controller.ts').decode();guard=source('apps/api/src/meri/tool-service-secret.guard.ts').decode();tenant=source('apps/api/src/tenant/tenant-context.middleware.ts').decode();wrapper=source('apps/api/src/meri/meri-tools.service.ts').decode();reader=source('apps/api/src/meri/meri-memory-proposal-read.ts').decode();owner=source('apps/api/src/memory/governed-memory-candidate.service.ts').decode()
for label,value in {
 'fixed controller and POST path':"@Controller('clio')" in controller and "@Post('tools/:name')" in controller,
 'ordinary role and service guard':"@Roles('standard_user')" in controller and '@UseGuards(ToolServiceSecretGuard)' in controller,
 'user JWT remains tenant identity':"req.headers.authorization" in tenant and 'verifySessionToken(token)' in tenant,
 'fixed host service header':"request.headers['x-internal-service-secret']" in guard,
 'exact selected tool routes to existing producer':"case 'list_memory_proposals':" in wrapper and 'readOwnPendingMemoryProposals(ctx, input, this.governedMemoryCandidates)' in wrapper,
 'producer forces pending':"status: 'pending'" in reader,
 'producer captures actual tenant/actor': 'tenantId: ctx.tenantId' in reader and 'userId: ctx.userId' in reader,
 'producer returns proposal-only claims':'claimsAreApprovedFacts: false' in reader and 'approvedFact: false' in reader,
 'backend filters own proposer':'proposedBy: ctx.userId' in owner,
 'backend pending page uses lookahead':bool(re.search(r'take:\s*\w+\s*\?\s*limit\s*\+\s*1\s*:\s*limit',owner)),
 'backend cursor uses scope hash': 'cursor does not match the current proposal scope.' in owner,
 'backend middleware is not globally read only': 'provision' in tenant.lower() and 'meri.api.tool.started' in controller,
}.items():check(label,value)
allowed=['apps/gateway/sources/memory-proposals/handler.mjs','apps/gateway/sources/memory-proposals/http-adapter.mjs','apps/gateway/sources/memory-proposals/request-context.mjs','apps/gateway/test/memory-proposal-source.test.mjs']
oldtree={x.split('\t')[1]:x.split('\t')[0] for x in git('ls-tree','-r',base).decode().splitlines()};newtree={x.split('\t')[1]:x.split('\t')[0] for x in git('ls-tree','-r','HEAD').decode().splitlines()}
check('all original source entries exact',all(newtree.get(k)==v for k,v in oldtree.items()));check('no original worktree changes',not git('diff',base,'--',*oldtree.keys()));check('only allocated product additions',set(git('diff','--name-only',base,'--','apps','packages').decode().splitlines())==set(allowed))
code='\n'.join((root/p).read_text() for p in allowed[:3]);check('no ambient credentials', 'process.env' not in code);check('no SQL or private import','@capiro/' not in code and '.query(' not in code);check('canonical snapshot/lifetime reuse','snapshotOperationData' in code and 'createDispatchLifetime' in code)
record={'base':base,'sourceHead':git('rev-parse','HEAD').decode().strip(),'originalEntries':len(oldtree),'scope':'SOURCE_METADATA_ONLY_NO_SOURCE_EXECUTION','checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'sourceIdentities':[{'path':p,'bytes':len((root/p).read_bytes()),'sha256':hashlib.sha256((root/p).read_bytes()).hexdigest()} for p in allowed]}
(e/'source-audit.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({k:record[k] for k in ['sourceHead','originalEntries','passed','failed']}));print('\n'.join(x['name'] for x in checks if not x['passed']));raise SystemExit(bool(record['failed']))
