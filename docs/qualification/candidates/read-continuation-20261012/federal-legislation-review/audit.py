"""Offline exact-source audit; immutable private Git objects are read as data only."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5];E=Path(__file__).resolve().parent
BASE='bcf36777b6f3fab94bec144c129e9143c18c8857';SOURCE,AUTHOR=sys.argv[1:3];checks=[]
def check(name,ok):
    checks.append({'name':name,'pass':bool(ok)})
    if not ok:raise AssertionError(name)
def git(*a,repo=ROOT):return subprocess.check_output(['git','-C',str(repo),*a])
def blob(ref,p,repo=ROOT):return git('show',ref+':'+p,repo=repo)
def entries(ref):
    rows={}
    for x in git('ls-tree','-r',ref).decode().splitlines():m,p=x.split('\t',1);rows[p]=m.split()[2]
    return rows
old,source,author,review=map(entries,[BASE,SOURCE,AUTHOR,'HEAD'])
for title,tree in [('source',source),('author',author),('review',review)]:check('originals exact '+title,all(tree.get(p)==h for p,h in old.items()))
paths=['packages/contracts/retrieval-0.2/federal-legislation-validation.mjs','packages/contracts/retrieval-0.2/federal-legislation.schema.json','packages/contracts/retrieval-0.2/congressional-identity.mjs','packages/contracts/test/retrieval-federal-legislation.test.mjs'];identities=[]
for p in paths:
    b=blob(SOURCE,p);check('exact source bytes '+p,b==blob(AUTHOR,p)==(ROOT/p).read_bytes());identities.append({'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':source[p]})
report='docs/coordination/reports/CODEX-READ-CONTINUATION-FEDERAL-LEGISLATION-AUTHOR-20261012.md'
new=set(source)-set(old)
check('source adds only allocated files',all(p in {*paths,report} or p.startswith('docs/qualification/candidates/read-continuation-20261012/federal-legislation-author/') for p in new) and {*paths,report}<=new)
check('metadata only after freeze',all(p==report or p.startswith('docs/qualification/candidates/read-continuation-20261012/federal-legislation-author/') for p in set(author)|set(source) if author.get(p)!=source.get(p)))
refs=json.loads((E/'reference-identities.json').read_text());private={}
for r in refs['references']:
    p=r['path'];b=blob(refs['sourceCommit'],p,Path('/workspace/capirov2'));private[p]=b
    check('pinned reference '+p,len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'] and git('rev-parse',refs['sourceCommit']+':'+p,repo=Path('/workspace/capirov2')).decode().strip()==r['blob'])
    check('observed reference unchanged '+p,b==blob(refs['observedCommit'],p,Path('/workspace/capirov2')))
module=(ROOT/paths[0]).read_text();helper=(ROOT/paths[2]).read_text();defs=json.loads((ROOT/paths[1]).read_text())['$defs']
check('family only approved helper imports',set(re.findall(r"import .* from '([^']+)'",module))=={'./operation-contracts.mjs','./congressional-identity.mjs'})
check('helper no imports',not re.search(r'\bimport\b',helper))
check('family only factory export',re.findall(r'export function (\w+)',module)==['createFederalLegislationValidators'])
check('identity helper only declared export',re.findall(r'export function (\w+)',helper)==['resolveCongressionalBillId'])
check('no ambient clock or source effects',all(x not in module+helper for x in ['Date.now','getFullYear','fetch(','setTimeout(','process.','PrismaClient','node:','@temporal']))
check('trusted explicit default congress context',set(defs['FederalLegislationContext']['properties'])=={'defaultCongress'} and defs['FederalLegislationContext']['required']==['defaultCongress'])
check('grammar no longer duplicated in schema','FederalBillTypes' not in defs and 'FederalDesignationTokens' not in defs)
check('three bill branches',len(defs['FederalBillStatusOutput']['oneOf'])==3)
for name,found in [('FederalBillInvalidOutput',False),('FederalBillUnavailableOutput',False),('FederalBillAvailableOutput',True)]:
    props=defs[name]['properties'];check('bill branch found marker '+name,props['found']['const'] is found);check('bill branch owner '+name,props['authoritativeOwner']['const']=='congress_bill_status')
props=defs['FederalBillAvailableOutput']['properties']
check('fifteen action/vote windows',props['recentActions']['maxItems']==15 and props['floorVotes']['maxItems']==15)
check('rule links use declared transport cap',props['governingRules']['maxItems']==10000)
check('no invented bill totals/coverage',not {'total','complete','hasMore','cursor'}&set(props))
check('floor returned count at most25',defs['FederalFloorVotesOutput']['properties']['votesFound']['maximum']==25)
check('bounded ambiguity2..8',defs['FederalFloorVotesOutput']['properties']['ambiguousMember']['minItems']==2 and defs['FederalFloorVotesOutput']['properties']['ambiguousMember']['maxItems']==8)
prisma=private['apps/api/prisma/schema.prisma'].decode();shared=private['packages/shared/src/index.ts'].decode();meri=private['apps/api/src/meri/meri-tools.service.ts'].decode()
models={n:re.search(r'model '+n+r'\s*\{([\s\S]*?)\n\}',prisma).group(1) for n in ['CongressBill','CongressBillAction','RollCallVote','BillRuleLink','MemberVote','CongressMember']}
check('bill stored congress independent Int',bool(re.search(r'^\s*congress\s+Int\b',models['CongressBill'],re.M)))
check('latest action native date-only',bool(re.search(r'^\s*latestActionDate\s+DateTime\?[^\n]*@db.Date\b',models['CongressBill'],re.M)))
check('bill actions general timestamp',bool(re.search(r'^\s*date\s+DateTime\s*$',models['CongressBillAction'],re.M)))
check('rule unique given target',bool(re.search(r'@@unique\(\[ruleBillId,\s*targetBillId\]',models['BillRuleLink'])))
check('member relation unique by memberKey not projected identity',bool(re.search(r'@@unique\(\[voteId,\s*memberKey\]',models['MemberVote'])))
check('party totals opaque JSON',bool(re.search(r'^\s*partyTotals\s+Json\b',models['RollCallVote'],re.M)))
check('status stored nullable unconstrained string',bool(re.search(r'^\s*status\s+String\?',models['CongressBill'],re.M)))
start=shared.index('export function billStatusLabel');end=shared.index('\n}',start)+2;label=shared[start:end]
check('pinned label in-operator semantics',bool(re.search(r'status\s+in\s+BILL_STATUS_META',label)) and 'hasOwn' not in label)
check('pinned label metadata ordinary object',bool(re.search(r'const BILL_STATUS_META[\s\S]*?=\s*\{',shared)))
check('pinned local-year congress source helper','now.getFullYear()' in shared)
for name in ['getBillStatus','searchFloorVotes']:
    start=re.search(r'async\s+'+name+r'\(',meri).start();nxt=re.search(r'\n\s*(?:private\s+)?async\s+\w+\(',meri[start+10:]);chunk=meri[start:start+10+nxt.start()] if nxt else meri[start:]
    check('global input-only owner '+name,'actorId' not in chunk and 'tenantId' not in chunk)
    check('no producer mutation/provider call '+name,not re.search(r'\.(?:create|update|delete|upsert|fetch|send)\(',chunk))
    if name=='getBillStatus':check('exact15/15/3 producer query caps',list(map(int,re.findall(r'take:\s*(\d+)',chunk)))==[15,15,3])
    else:check('votesFound is returned length',bool(re.search(r'votesFound:\s*votes\.length',chunk)))
check('controller role declaration',all(x in private['apps/api/src/meri/meri.controller.ts'].decode() for x in ['RolesGuard','standard_user']))
for label in ['prefreeze-independent','corrected-prefreeze-independent','prototype-label','exact-source-tests']:
    r=json.loads((E/(label+'.json')).read_text());check('owned group absent '+label,r['ownedProcessGroupAbsent'] and not r['timedOut'] and not r['ownedGroupKillRequired'])
    for f in r['streams']:
        b=(ROOT/f['path']).read_bytes();check('raw stream '+f['path'],len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256'])
    check('stderr empty '+label,not (E/(label+'.stderr.bin')).read_bytes())
for f in json.loads((E/'prototype-label-source.json').read_text())['files']:
    b=(E/'prototype-label-source'/f['path']).read_bytes();check('negative source retained '+f['path'],len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256'])
check('no entire private bodies copied',all(b not in (ROOT/p).read_bytes() for b in private.values() for p in set(review)-set(old) if (ROOT/p).is_file()))
check('source whitespace',subprocess.run(['git','diff','--check',BASE,SOURCE],cwd=ROOT,capture_output=True).returncode==0)
r={'base':BASE,'source':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'author':AUTHOR,'authorTree':git('rev-parse',AUTHOR+'^{tree}').decode().strip(),'reviewHeadAtAudit':git('rev-parse','HEAD').decode().strip(),'originalsPreserved':len(old),'checks':checks,'sourceIdentities':identities,'privateBodiesPublished':False,'sourceExecuted':False,'runtime':'UNRUN_UNAVAILABLE'}
(E/'audit.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'checks':len(checks),'passed':sum(x['pass'] for x in checks),'originalsPreserved':len(old),'source':SOURCE}))
