"""Offline immutable Git/file audit; no project imports or host/runtime queries."""
from pathlib import Path
import hashlib,json,re,subprocess

ROOT=Path(__file__).resolve().parents[5]
HERE=Path(__file__).resolve().parent
BASE='263d0d174f9924a6030bb1c20100ff1115ffcda0'
TARGET='159a7dd3b5fbd9ed2cc05dc96c450ed5c7b4585e'
PLAN='docs/plans/MERI-G1-SOURCE-TO-NATIVE.md'
checks=[]
def git(*args):return subprocess.check_output(['git','-C',str(ROOT),*args])
def text(path):return (ROOT/path).read_text()
def data(path):return json.loads(text(path))
def ck(name,value):checks.append({'name':name,'passed':bool(value)})
def blob(commit,path):return git('show',commit+':'+path)
def sha(raw):return hashlib.sha256(raw).hexdigest()

old=blob(BASE,PLAN).decode();plan=blob(TARGET,PLAN).decode()
ck('reviewed worktree plan equals exact target',text(PLAN)==plan)
ck('base is ancestor of target',subprocess.run(['git','-C',str(ROOT),'merge-base','--is-ancestor',BASE,TARGET]).returncode==0)
links=[]
for label,target in re.findall(r'\[([^]]+)\]\(([^)]+)\)',plan):
    if target.startswith('https://'):continue
    path=(ROOT/PLAN).parent.joinpath(target.split('#')[0]).resolve().relative_to(ROOT).as_posix()
    try:raw=blob(TARGET,path);exists=True
    except subprocess.CalledProcessError:raw=b'';exists=False
    ck('local link '+label,exists);links.append({'label':label,'path':path,'sha256':sha(raw),'bytes':len(raw)})
freezes={
 'budget-author':'028b1134e373734caea036ee5c38d35b20428d8b',
 'budget-review':'5657a16b8589f587fab5a979bcdac973a9e2f221',
 'native-author':'74f9692047be50beb8c59a0b0d7833f0cb682c76',
 'native-review':'f2d581323ec4a926f3ea2dabbca2fb77c15772f4',
 'host-author':'20f51409673a0bdae1a5a3de99e2cda41d5b549b',
 'host-review':'ea0efc5a37f8148cfb4db674d4a6dcc61bc7ab12'}
preserved=[]
for lane,commit in freezes.items():
    ck(lane+' named in plan',commit in plan)
    ck(lane+' retained in ancestry',subprocess.run(['git','-C',str(ROOT),'merge-base','--is-ancestor',commit,TARGET]).returncode==0)
    paths=git('diff','--name-only',BASE,commit).decode().splitlines()
    for path in paths:
        a=blob(commit,path);b=blob(TARGET,path)
        ck(lane+' bytes '+path,a==b)
        preserved.append({'lane':lane,'commit':commit,'path':path,'bytes':len(b),'sha256':sha(b)})
frozen=['docs/qualification/candidates/g1-execution-options-20261012','docs/qualification/candidates/ubuntu-source-assessment-20261012','docs/plans/MERI-DEPLOYMENT.md','apps/worker/qualification','scripts/qualification','packages/contracts','package.json','package-lock.json']
for path in frozen:ck('original frozen source/packet '+path,git('diff','--name-only',BASE,TARGET,'--',path)==b'')
heading='## Image decision: component choice is distinct from security admission'
end='## First bounded native proposal: local disposable PostgreSQL only'
ck('image decision text unchanged',old.split(heading)[1].split(end)[0]==plan.split(heading)[1].split(end)[0])
ck('139-capability and architecture scope paragraph unchanged',old.splitlines()[4]==plan.splitlines()[4])
stack=data('docs/qualification/candidates/g1-owner-continuation-20261012/integration/pr-stack-observation.json')['prs']
ancestry=data('docs/qualification/candidates/g1-owner-continuation-20261012/integration/pr-stack-ancestry.json')
ck('recorded stack has PR7 and PR10 through17',[r['number'] for r in stack]==[7,*range(10,18)])
previous=None
for row in stack:
    name='PR'+str(row['number']);head=row['head_sha'];base=row['base_sha']
    ck(name+' dated recorded OPEN/DRAFT/unmerged',row['state']=='open' and row['draft'] and not row['merged'])
    ck(name+' exact head and link in plan',head in plan and row['url'] in plan)
    ck(name+' base ancestor',subprocess.run(['git','-C',str(ROOT),'merge-base','--is-ancestor',base,head]).returncode==0)
    if previous:ck(name+' adjacent base equals prior head',base==previous)
    expected=next(r for r in ancestry['branches'] if r['pr']==row['number'])
    ck(name+' tree observation exact',git('rev-parse',head+'^{tree}').decode().strip()==expected['headTree'])
    previous=head
ck('stack aggregate counts',ancestry['ancestryChecksPassed']==9 and ancestry['adjacencyChecksPassed']==8)
for phrase in ['G1 OPEN','G2–G7 unentered','All source connectivity stays disabled','NOT_EXECUTABLE and not authorized','No localhost authentication exception','all admission flags false','nativePublicationQualified','hardTotalProven','evidencePublicationVerified','trusted durable invocation producer','explicit reconciliation workflow','current authorized paid calls/spend remain zero']:
    ck('explicit continuing boundary '+phrase,phrase.casefold() in plan.casefold())
gateway=text('apps/gateway/index.mjs');owner=text('apps/gateway/budget/postgres-tool-budget.mjs');facade=text('apps/gateway/budget/durable-tool-dispatch.mjs');outcome=text('apps/gateway/budget/tool-budget-outcome.mjs')
ck('actual durable facade exposes owner read', 'readInvocationOutcome: owner.readInvocationOutcome' in facade and '...dispatcher, sourceEnabled: false' in gateway)
read=owner.split('async function readInvocationOutcome')[1].split('function forInvocation')[0]
ck('historical read locks and validates exact facts',all(s in read for s in ['store.transact','store.lock','storedAllocation','assertHistoricalGrant','outcomeSnapshot']))
ck('historical read issues no INSERT UPDATE DELETE','INSERT' not in read and 'UPDATE' not in read and 'DELETE' not in read)
ck('actual retained states and no source result',all(s in outcome for s in ["state: 'ABSENT'","row.state === 'UNKNOWN'","row.state === 'SETTLED'",'Object.freeze',"same(row.facts, invocation)"]))
wrapper=text('docs/qualification/candidates/native-supervisor-20261012/author/run-supervised.py');writer=text('docs/qualification/candidates/native-bindings-20261012/author/evidence-writer.py')
ck('actual wrapper composes writer', 'publication = evidence_writer.write_reserved(' in wrapper and 'receipt["publicationObservation"] = publication' in wrapper)
ck('missing exact preservation and Git pins remain None',all(name+' = None' in wrapper for name in ['SOURCE_VERIFICATION_SHA256','PRIOR_MANIFEST_SHA256','GIT_EXECUTABLE','GIT_EXECUTABLE_SHA256','GIT_EXECUTABLE_BYTES']))
ck('native success flags remain false',all('"'+name+'": False' in wrapper+writer for name in ['runtimeAccepted','buildAccepted','g1Accepted','hardTotalProven','evidencePublicationVerified','nativePublicationQualified']))
ck('Git hardening actual source matches plan',all(s in wrapper for s in ['--no-optional-locks','core.fsmonitor=false','core.untrackedCache=false','--untracked-files=all']))
accept=data('docs/qualification/candidates/native-bindings-20261012/review/acceptance-receipt.json')
ck('native exact accepted source and counts',accept['authorFreeze']==freezes['native-author'] and accept['passed']['independentWriter']==156 and accept['passed']['authorReplay']==47 and accept['historicalCurrentPlacementCheck']['exitCode']==1)
relay=data('docs/qualification/candidates/g1-owner-continuation-20261012/integration/private-relay-intake.json')
ck('private relay hashes and sizes accurately linked',all(row['sha256'] in plan and str(row['bytes']) in plan for row in relay['verifiedMembers']))
ck('private intake retains unavailable predicates',relay['manifestRelayOriginalByteIdentityEstablished'] is False and relay['candidateHashRelayTruncated'] is True and relay['comparisonSourceReceived'] is False)
ck('sanitized intake no body/path fields',set(relay)=={'source','verifiedMembers','manifestRelayOriginalByteIdentityEstablished','candidateHashRelayTruncated','comparisonSourceReceived'} and all(set(r)=={'member','bytes','sha256','reconstruction'} for r in relay['verifiedMembers']))
added='\n'.join(line[1:] for line in git('diff','--unified=0',BASE,TARGET,'--',PLAN).decode().splitlines() if line.startswith('+') and not line.startswith('+++'))
ck('plan added text no private absolute paths or body fences',not re.search(r'(?<![A-Za-z])[A-Za-z]:[\\/]|/Users/|/home/|```',added))
result={'targetCommit':TARGET,'targetTree':git('rev-parse',TARGET+'^{tree}').decode().strip(),'baseCommit':BASE,'planSha256':sha(plan.encode()),'checks':checks,'passed':sum(r['passed'] for r in checks),'failed':[r['name'] for r in checks if not r['passed']],'links':links,'preservedFreezeFiles':preserved,'remoteObservationScope':'Verifies retained dated connector observations and actual local Git ancestry; no fresh remote/API query.','nativeAndHostQueries':0,'verdict':'ACCEPT_SOURCE' if all(r['passed'] for r in checks) else 'HOLD'}
(HERE/'audit-result.json').write_text(json.dumps(result,indent=2)+'\n')
(HERE/'reviewed-plan.diff').write_bytes(git('diff','--unified=3',BASE,TARGET,'--',PLAN))
print(json.dumps({k:result[k] for k in ['targetCommit','targetTree','planSha256','passed','failed','verdict']}))
raise SystemExit(0 if not result['failed'] else 1)
