"""Read-only metadata audit: immutable Git bytes stay in memory, never published."""
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]
E=Path(__file__).resolve().parent
PIN='fd8765ec01d292013758606204f2c9d886cd31c1'
OBS='4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace'
BASE='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8'
REPO='/workspace/capirov2'
def git(*args,repo=ROOT):return subprocess.check_output(['git','-C',str(repo),*args])
refs=[
('apps/api/src/meri/meri-tools.service.ts','saveMemory2908-2976; selector intent, pending versus auto-committed projection'),
('apps/api/src/meri/meri-memory.helpers.ts','buildSavedMemoryRecord60-103; scope fallback, logical key transformation, TTL duration/ambient expiry'),
('apps/api/src/meri/meri-memory.helpers.spec.ts','source characterization of scope, key, content and TTL'),
('apps/api/src/memory/memory-candidate.service.ts','proposeSaveMemory224 onward; actual pending versus personal commit producer'),
('apps/api/src/memory/memory-candidate-rules.ts','explicit personal flow versus shared pending policy'),
('apps/api/src/memory/memory-candidate-rules.spec.ts','candidate policy negative and positive controls'),
('apps/api/src/memory/memory-candidate.atomicity.spec.ts','source commit/pending transaction characterization'),
('apps/api/src/memory/memory-review-admin-policy.ts','exact approved administrator roles; no policy change'),
('apps/api/src/memory/memory-authorization.helpers.ts','current action-specific authorization remains source owner'),
('apps/api/src/memory/memory-wall.helpers.ts','current client wall owner'),
('apps/api/prisma/schema.prisma','stored model scalar source metadata; no migration or execution')]
identities=[];checks=[]
def check(name,condition):
 checks.append({'name':name,'passed':bool(condition)})
 if not condition:raise AssertionError(name)
for path,purpose in refs:
 a=git('show',f'{PIN}:{path}',repo=REPO);b=git('show',f'{OBS}:{path}',repo=REPO)
 identities.append({'path':path,'purpose':purpose,'pinnedCommit':PIN,'pinnedBlob':git('rev-parse',f'{PIN}:{path}',repo=REPO).decode().strip(),'observedCommit':OBS,'observedBlob':git('rev-parse',f'{OBS}:{path}',repo=REPO).decode().strip(),'sha256':hashlib.sha256(a).hexdigest(),'bytes':len(a),'unchanged':a==b})
 check('unchanged pair '+path,a==b)
# Static facts are deliberately source locators/literals, not copied implementation.
wrapper=git('show',f'{PIN}:apps/api/src/meri/meri-tools.service.ts',repo=REPO).decode().splitlines()
helper=git('show',f'{PIN}:apps/api/src/meri/meri-memory.helpers.ts',repo=REPO).decode().splitlines()
check('wrapper content4000',all(x in wrapper[2908] for x in ['content','4000']))
check('wrapper key120',all(x in wrapper[2909] for x in ['key','120']))
check('wrapper TTL finite admission',all(x in wrapper[2915] for x in ['Number.isFinite','number']))
check('helper positive fractional duration capped365',all(x in helper[89] for x in ['ttlDays','> 0']) and all(x in helper[90] for x in ['Math.min','365']))
check('legacy expiry uses ambient clock',all(x in helper[100] for x in ['expiresAt','Date.now']))
check('legacy calls actual save producer',any('memoryCandidates.proposeSaveMemory' in x for x in wrapper[2907:2976]))
# Base preservation is Git-object based, so sparse absence is not source deletion.
base=git('ls-tree','-r',BASE).splitlines();current=git('ls-tree','-r','HEAD').splitlines()
a={x.split(b'\t',1)[1]:x.split(b'\t',1)[0] for x in base};b={x.split(b'\t',1)[1]:x.split(b'\t',1)[0] for x in current}
check('all original source entries unchanged',all(b.get(k)==v for k,v in a.items()))
check('no tracked base changes pending',git('diff','--name-only',BASE,'--',*map(lambda k:k.decode(),a)).strip()==b'')
module=(ROOT/'packages/contracts/commands-0.2/memory-propose-validation.mjs').read_text()
check('canonical inert helper reused',"import {snapshotOperationData} from '../retrieval-0.2/operation-contracts.mjs'" in module)
check('no IO/legacy implementation imports',module.count('import ')==1)
check('no ambient expiry clock','Date.now' not in module and 'expiresAt' not in module)
check('no admin-policy ownership','user_admin' not in module and 'capiro_admin' not in module)
check('detached result return','return result;' in module and 'result=snapshotOperationData(value)' in module)
(E/'reference-identities.json').write_text(json.dumps(identities,indent=2)+'\n')
(E/'source-audit.json').write_text(json.dumps({'base':BASE,'sourceHead':git('rev-parse','HEAD').decode().strip(),'originalEntries':len(a),'checks':checks,'passed':len(checks),'privateBodiesPublished':False,'runtimeQualified':False},indent=2)+'\n')
print(json.dumps({'checks':len(checks),'passed':len(checks),'originalEntriesPreserved':len(a),'pairedReferences':len(refs)}))
