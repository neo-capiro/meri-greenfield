"""Offline exact-freeze evidence audit. No target imports or network requests."""
from pathlib import Path
import hashlib,json,re,subprocess,sys

ROOT=Path(sys.argv[1]).resolve();COMMIT=sys.argv[2]
BASE='6cfb1f9a4d8acd66c5bd8d38d892d656fa3cd89e'
HERE=Path(__file__).resolve().parent
AUTHOR=ROOT/'docs/qualification/candidates/native-prefix-20261012/author'
checks=[]
def git(*args):return subprocess.check_output(['git','-C',str(ROOT),*args],text=True).strip()
def load(path):return json.loads(Path(path).read_text())
def ck(name,value):checks.append({'name':name,'passed':bool(value)})
def sha(raw):return hashlib.sha256(raw).hexdigest()

ck('exact clean author HEAD',git('rev-parse','HEAD')==COMMIT and git('status','--porcelain')=='')
paths=git('diff','--name-only',BASE,COMMIT).splitlines()
allowed={'docs/coordination/tasks/MERI-NATIVE-PREFIX-20261012.md','docs/coordination/reports/MERI-NATIVE-PREFIX-20261012.md'}
ck('only allocated new author paths',all(p in allowed or p.startswith('docs/qualification/candidates/native-prefix-20261012/author/') for p in paths))
ck('no preexisting file modified',all(line.startswith('A\t') for line in git('diff','--name-status',BASE,COMMIT).splitlines()))
manifest=load(AUTHOR/'manifest.json');members=[]
for row in manifest['files']:
    p=ROOT/row['path'];raw=p.read_bytes()
    ck('manifest '+row['path'],len(raw)==row['bytes'] and sha(raw)==row['sha256']);members.append(row['path'])
ck('manifest members unique',len(members)==len(set(members)))
retrievals=load(AUTHOR/'retrievals.json');successes=[];failures=[]
for row in retrievals:
    raw=(AUTHOR/row['path']).read_bytes()
    ck('retrieval bytes '+row['name'],len(raw)==row['bytes'] and sha(raw)==row['sha256'])
    ck('metadata/source only '+row['name'],row['kind']=='PUBLIC_METADATA_NOT_TARGET_PAYLOAD' and not re.search(r'\.(deb|whl|tar\.(gz|xz|bz2))($|[?])',row['url']))
    if row.get('status')==200:
        successes.append(row['name']);ck('HTTPS exact origin '+row['name'],row['url'].startswith('https://') and row['finalUrl']==row['url'])
    else:failures.append(row['name']);ck('failure explicitly recorded '+row['name'],bool(row.get('error')))
pypi=load(AUTHOR/'raw/psycopg333-pypi.json')
ck('psycopg exact metadata version',pypi['info']['version']=='3.3.3' and pypi['info']['requires_python']=='>=3.10')
ck('Python3.12 typing-extension requirement retained',any(r.startswith('typing-extensions>=4.6') and '3.13' in r for r in pypi['info']['requires_dist']))
wheel=next(r for r in pypi['urls'] if r['filename']=='psycopg-3.3.3-py3-none-any.whl')
ck('wheel metadata identity not acquired',wheel['size']==212768 and wheel['digests']['sha256']=='f96525a72bcfade6584ab17e89de415ff360748c766f0106959144dcbb38c698' and not any(r['url']==wheel['url'] for r in retrievals))
ck('pinned pure Python libpq condition',(AUTHOR/'raw/psycopg333-install.rst').read_text().find('dynamically via `ctypes`')>=0)
ck('upstream conditional relocation fallback retained','goto no_match' in (AUTHOR/'raw/postgres17-path.c').read_text() and 'strlcpy(ret_path, target_path' in (AUTHOR/'raw/postgres17-path.c').read_text())
assessment=load(AUTHOR/'assessment.json')
ck('exact research base and no setup recipe',assessment['sourceBase']==BASE and assessment['executionStatus']=='NOT_EXECUTABLE' and assessment['authority']['setupCommand'] is None)
ck('no target action or approval inferred',all(assessment[key] is False for key in ['targetPayloadAcquired','targetPayloadExtracted','targetRuntimeExecuted','qualificationExecuted']) and not assessment['authority']['setupApprovalRequested'] and not assessment['authority']['l1ApprovalRequested'])
ck('PGDG listing leads not authenticated pins',all(row['sha256'] is None and row['status']=='POOL_LISTING_ONLY_NOT_AUTHENTICATED' for row in assessment['packageLeads']) and not assessment['subtotalIsClosureOrDownloadApproval'])
ck('listed subtotal arithmetically correct',sum(row['listedBytes'] for row in assessment['packageLeads'])==assessment['twoPackageListedBytesSubtotal']==18737216)
ck('exact signature trust not claimed',not assessment['metadataPrerequisites']['InRelease']['exactBytesAvailable'] and not assessment['metadataPrerequisites']['publicKey']['trustedFingerprintVerified'] and assessment['metadataPrerequisites']['renderedHashesAreNotAuthenticated'])
ck('prefix support unresolved not impossibility',assessment['relocation']['status']=='NOT_SUBSTANTIATED_NOT_PROVEN_IMPOSSIBLE' and 'not authenticated/mapped' in assessment['relocation']['packagingRef'])
ck('driver native and payload boundaries',assessment['pythonDriver']['pureBackendStillLoadsNativeLibraries'] and not assessment['pythonDriver']['payloadHashesVerified'] and not assessment['nodeDriver']['payloadIntegrityVerified'] and not assessment['nodeDriver']['registrySignaturesVerified'])
lock=load(ROOT/assessment['nodeDriver']['canonicalLock'])['packages']
nodeRows=assessment['nodeDriver']['packages']
ck('complete exact canonical Node lock metadata scope',len(nodeRows)==14 and {r['canonicalLockPath'] for r in nodeRows}=={p for p in lock if p})
for row in nodeRows:
    pinned=lock[row['canonicalLockPath']];metadata=load(AUTHOR/row['registryMetadata'])
    ck('Node registry versus existing lock '+row['name'],row['version']==pinned['version']==metadata['version'] and row['integrity']==pinned['integrity']==metadata['dist']['integrity'] and row['tarballUrl']==pinned['resolved']==metadata['dist']['tarball'] and not row['payloadAcquired'])
for row in assessment['pythonDriver']['wheels']:
    metadata=load(AUTHOR/row['metadata']);record=next(r for r in metadata['urls'] if r['filename']==row['file'])
    ck('Python wheel metadata '+row['name'],row['version']==metadata['info']['version'] and row['bytes']==record['size'] and row['sha256']==record['digests']['sha256'] and not row['payloadAcquired'])
host=load(AUTHOR/'host-dependency-query.json')
for name,row in host['streams'].items():
    raw=(AUTHOR/row['path']).read_bytes();ck('host metadata '+name,len(raw)==row['bytes'] and sha(raw)==row['sha256'])
ck('host query negative retained',host['exitCode']==1 and set(assessment['installedDependencyMetadata']['missingNames'])=={'postgresql-common','postgresql-client-common','ssl-cert'})
for row in assessment['sourceBindings']:
    raw=(ROOT/row['path']).read_bytes();ck('canonical source binding '+row['path'],len(raw)==row['bytes'] and sha(raw)==row['sha256'])
own=load(HERE/'official-metadata-fetch.json')
ck('independent exact PGDG retrieval failures retained',len(own['requests'])==2 and all(not r['complete'] and r['bytes']==0 and '403 Forbidden' in r['error'] for r in own['requests']))
report=(ROOT/'docs/coordination/reports/MERI-NATIVE-PREFIX-20261012.md').read_text()
ck('report explicitly holds setup','HOLD' in report and 'not' in report.lower())
rows=[]
for path in paths:
    raw=(ROOT/path).read_bytes();rows.append({'path':path,'bytes':len(raw),'sha256':sha(raw),'gitBlob':git('rev-parse',COMMIT+':'+path)})
out={'authorCommit':COMMIT,'authorTree':git('rev-parse',COMMIT+'^{tree}'),'baseCommit':BASE,'checks':checks,'passed':sum(r['passed'] for r in checks),'failed':[r['name'] for r in checks if not r['passed']],'authorFiles':rows,'successfulMetadataReads':successes,'failedMetadataReads':failures,'targetPayloadActions':0,'signatureVerification':'UNRUN: exact key/Release/index bytes unavailable','scope':'Evidence integrity and metadata consistency only; source and setup disposition require accompanying review report.'}
(HERE/'audit-author-result.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:out[k] for k in ['authorCommit','authorTree','passed','failed','signatureVerification']}))
raise SystemExit(0 if not out['failed'] else 1)
