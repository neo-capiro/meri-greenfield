"""Offline packet/source audit only. No discovery, database or runtime execution."""
from pathlib import Path
import hashlib,json,subprocess,sys
repo=Path(sys.argv[1]).resolve(); expected=sys.argv[2]; base='263d0d174f9924a6030bb1c20100ff1115ffcda0'
review=Path(__file__).resolve().parent; author=repo/'docs/qualification/candidates/g1-l1-host-20261012/author'
checks=[]
def check(label,truth):
    checks.append({'check':label,'pass':bool(truth)})
    if not truth:raise AssertionError(label)
def load(path):return json.loads(Path(path).read_text())
def git(*args):return subprocess.check_output(['git','-C',str(repo),*args],text=True).strip()
check('exact author head',git('rev-parse','HEAD')==expected)
check('author worktree clean',git('status','--porcelain')=='')
changed=git('diff','--name-only',base,expected).splitlines();allowed={'docs/coordination/tasks/MERI-G1-L1-HOST-20261012.md','docs/coordination/reports/MERI-G1-L1-HOST-20261012.md'}
check('exclusive documentation/evidence paths only',all(p in allowed or p.startswith('docs/qualification/candidates/g1-l1-host-20261012/author/') for p in changed))
check('production source and locks preserved',git('diff',base,expected,'--','apps','scripts','packages','infra','package.json','package-lock.json')=='')
manifest=load(author/'manifest.json'); seen=set()
for row in manifest['files']:
    name=row['path'];check('manifest entry unique and allocated '+name,name not in seen and name in changed);seen.add(name)
    raw=(repo/name).read_bytes();check('manifest hash '+name,len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'])
excluded={str(author.relative_to(repo)/name) for name in ['manifest.json','verify.stdout.json','verify.stderr.txt','verification-receipt.json']}
check('manifest covers all changed files except explicit receipt/self exclusions',set(changed)==seen|excluded)
check('manifest remains source only',manifest['baseCommit']==base and manifest['runtimeAdmission']=='HOLD_NOT_EXECUTABLE')
verification=load(author/'verification-receipt.json')
for name,row in verification['files'].items():
    raw=(author/name).read_bytes();check('verification receipt hash '+name,len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'])
notes=load(author/'collection-notes.json')
check('metadata derivative and producer limitation explicit',notes['hostMetadataClassification']=='DERIVED_FROM_INITIAL_METADATA_READS' and 'not claimed as hash-pinned original producer' in notes['producerBinding'])
for row in load(author/'source-requirements.json')['files']:
    raw=(repo/row['path']).read_bytes();check('canonical source hash '+row['path'],len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'])
metadata=load(author/'host-metadata.json'); independent=load(review/'independent-host.stdout.json'); packet=load(author/'setup-packet.json')
check('selected environment metadata agrees',metadata['platform']==independent['host']['os'] and metadata['kernel']==independent['host']['release'] and metadata['machine']==independent['host']['machine'] and metadata['uid']==independent['host']['uid'])
for name in ['postgres','initdb','pg_ctl','psql','pg_config']:
    check('independent PATH absence '+name,next(r for r in metadata['binaries'] if r['name']==name)['path'] is None and independent['commands'][name]['onPath'] is False)
check('no target runtime or namespace probe claim',metadata.get('targetRuntimeBinariesExecuted',metadata.get('targetBinariesExecuted')) is False and metadata['namespaceProbesExecuted'] is False)
check('no current psycopg3',metadata['pythonDistributions']['psycopg']['installedDistributionVersion'] is None and independent['pythonDistributions']['psycopg']['installedMetadata'] is False)
check('httpx exact metadata agreement',metadata['pythonDistributions']['httpx']['installedDistributionVersion']==independent['pythonDistributions']['httpx']['version']=='0.28.1')
commands=load(author/'metadata-commands.json')['commands'];check('exact primary metadata command count',len(commands)==5)
for command in commands:
    check(command['name']+' completed read only',command['exitCode']==0 and not command['timeout'] and command['metadataOnly'] and not command['outputLimitExceeded'])
    for stream in ['stdout','stderr']:
        raw=(author/'raw'/(command['name']+'.'+stream+'.bin')).read_bytes();expectedStream=command[stream]
        check(command['name']+' '+stream+' raw hash',len(raw)==expectedStream['bytes'] and hashlib.sha256(raw).hexdigest()==expectedStream['sha256'])
    argv=command['argv']
    if command['name'].startswith('docker'):
        check(command['name']+' explicit local endpoint and private empty config',argv[:2]==['/usr/local/bin/docker','--config'] and argv[2].startswith(str(author)+'/') and argv[3:5]==['--host','unix:///var/run/docker.sock'])
        check(command['name']+' read-only verb',argv[5:7] in [['version','--format'],['info','--format'],['image','ls'],['context','ls']])
    else:check('dpkg metadata only',argv[:2]==['/usr/bin/dpkg-query','-W'])
info=load(author/'raw/docker-info.stdout.bin');ownInfo=load(review/'docker-info.stdout.bin')
check('independent Docker counter/version agreement',all(info[k]==ownInfo[k] for k in ['serverVersion','images','containers','containersRunning','cpus','memoryTotal']))
check('daemon has no cached images/container targets',info['images']==info['containers']==info['containersRunning']==0 and (author/'raw/docker-images.stdout.bin').read_bytes()==b'' and (review/'docker-images.stdout.bin').read_bytes()==b'')
policy=load(author/'cached-package-policy.json')
for stream in ['stdout','stderr']:
    raw=(author/'raw'/('apt-cached-policy.'+stream+'.bin')).read_bytes();check('apt '+stream+' hash',len(raw)==policy[stream]['bytes'] and hashlib.sha256(raw).hexdigest()==policy[stream]['sha256'])
check('empty apt candidates and warning preserved',policy['stdout']['bytes']==0 and policy['stderr']['bytes']>0)
check('L1 remains non-executable without relocation/launcher',packet['executionAdmission']=='HOLD_NOT_EXECUTABLE' and packet['launcherCreated'] is False and packet['relocationProposed'] is False)
check('no invented server artifact or installer',packet['supportedRoute']['serverVersionSelected'] is None and packet['supportedRoute']['serverArtifactSha256'] is None and packet['supportedRoute']['installerCommand'] is None and packet['supportedRoute']['sourceRecipeReady'] is False)
check('local peer containment unproven',packet['observations']['dockerRootlessOrExclusiveIsolationProven'] is False and packet['observations']['namespaceBehaviorProbed'] is False)
phases={r['id']:r for r in packet['separateFutureApprovals']};check('setup separate from later L1',set(phases)=={'SETUP_ONLY','ISOLATION_AUTH_AND_LIFECYCLE','L1_EXECUTION'})
l1=phases['L1_EXECUTION'];check('L1 no provider/cloud/Aurora/newRDS authority',l1['status']=='NOT_AUTHORIZED' and l1['providerCalls']==l1['providerUsd']==l1['newCloudResources']==l1['cloudInfrastructureActions']==0 and not l1['newRdsAllowed'] and not l1['auroraConnectionAllowed'])
text=json.dumps(packet)
for required in ['work720s/cleanup900s','stdout8MiB/stderr1MiB','two synthetic databases','bootstrap','No database initialization/start/SQL','no trust exception']:
    check('packet preserves '+required,required.lower() in text.lower())
check('installer side effects explicitly outside setup authority',any('postinstall' in value and 'no automatic service start' in value and 'HBA/security mutation' in value for value in phases['SETUP_ONLY']['needs']))
check('exact setup resource/cost caps unresolved rather than invented',all(packet['resourceAndCostBindingsRequiredBeforeSetup'][key] is None for key in ['archiveDownloadBytes','expandedRuntimeBytes','temporaryExtractionBytes','persistentPrefixBytes','diskHeadroomBytes','setupSeconds','peakMemoryBytes','cpuQuota','stdoutStderrBytes','networkAcquisitionCostUsd']))
rows=[]
for name in changed:
    p=repo/name
    if p.is_file():
        raw=p.read_bytes();rows.append({'path':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'gitBlob':git('rev-parse',expected+':'+name)})
receipt={'authorCommit':expected,'authorTree':git('rev-parse',expected+'^{tree}'),'base':base,'criteriaCommit':'8495d7e17c6f16984b11723b89b4d2da4acfc34f','checks':checks,'checkCount':len(checks),'sourceDisposition':'ACCEPT_SOURCE_EVIDENCE_ONLY','runtimeAdmission':'HOLD_NOT_EXECUTABLE','authorFiles':rows,'notNativeQualification':True}
(review/'author-packet-audit.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'checksPassed':len(checks),'authorCommit':expected,'runtimeAdmission':'HOLD_NOT_EXECUTABLE'}))
