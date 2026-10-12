"""Offline packet integrity only. No discovery/runtime/module/tool execution."""
from pathlib import Path
import ast
import hashlib
import json
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
checks=[]
def ck(name,value):checks.append({'name':name,'passed':bool(value)})
def data(name):return json.loads((HERE/name).read_text())
h=data('host-metadata.json');s=data('setup-packet.json');c=data('metadata-commands.json');m=data('manifest.json')
for row in m['files']:
 p=ROOT/row['path'];raw=p.read_bytes();ck('hash:'+row['path'],len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'])
for row in data('source-requirements.json')['files']:
 raw=(ROOT/row['path']).read_bytes();ck('canonical-source:'+row['path'],len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'])
for row in c['commands']:
 for stream in ['stdout','stderr']:
  b=(HERE/'raw'/(row['name']+'.'+stream+'.bin')).read_bytes();ck('raw:'+row['name']+':'+stream,len(b)==row[stream]['bytes'] and hashlib.sha256(b).hexdigest()==row[stream]['sha256'])
 ck('metadata-command-completed:'+row['name'],row['exitCode']==0 and not row['timeout'] and not row['outputLimitExceeded'])
ck('known-server-binaries-absent',all(next(x for x in h['binaries'] if x['name']==name)['path'] is None for name in ['postgres','initdb','pg_ctl','pg_controldata','psql','pg_config']))
ck('required-psycopg-absent',h['pythonDistributions']['psycopg']['installedDistributionVersion'] is None)
ck('host-is-derived-not-producer-attestation',data('collection-notes.json')['hostMetadataClassification']=='DERIVED_FROM_INITIAL_METADATA_READS')
i=json.loads((HERE/'raw/docker-info.stdout.bin').read_text());ck('docker-empty-cache',i['images']==0 and i['containers']==0 and (HERE/'raw/docker-images.stdout.bin').read_bytes()==b'')
ck('docker-metadata-not-support-proof',not s['observations']['dockerRootlessOrExclusiveIsolationProven'] and not s['observations']['namespaceBehaviorProbed'])
for row in c['commands']:
 if row['name'].startswith('docker-'):
  argv=row['argv'];ck('explicit-local-socket:'+row['name'],argv[argv.index('--host')+1]=='unix:///var/run/docker.sock' and 'docker-client-config-empty' in argv[argv.index('--config')+1])
config=HERE/'docker-client-config-empty'
ck('no-retained-docker-credential-files',not config.exists() or not list(config.iterdir()))
ck('not-executable-no-launcher',s['executionAdmission']=='HOLD_NOT_EXECUTABLE' and not s['launcherCreated'] and not s['relocationProposed'] and s['supportedRoute']['installerCommand'] is None)
ck('no-unsupported-pin',s['supportedRoute']['serverVersionSelected'] is None and s['supportedRoute']['serverArtifactSha256'] is None and not s['supportedRoute']['historicalWindowsArtifactsReusable'])
ck('three-separate-authorities',[x['id'] for x in s['separateFutureApprovals']]==['SETUP_ONLY','ISOLATION_AUTH_AND_LIFECYCLE','L1_EXECUTION'])
ck('no-new-cloud-provider-aurora',s['separateFutureApprovals'][2]['providerCalls']==0 and s['separateFutureApprovals'][2]['newCloudResources']==0 and not s['separateFutureApprovals'][2]['auroraConnectionAllowed'])
ck('postinstall-not-admitted',any('postinstall' in x and 'no automatic service start' in x for x in s['separateFutureApprovals'][0]['needs']))
ck('no-cost-cap-invention',s['resourceAndCostBindingsRequiredBeforeSetup']['archiveDownloadBytes'] is None and s['resourceAndCostBindingsRequiredBeforeSetup']['networkAcquisitionCostUsd'] is None and not data('resource-metadata.json')['reservationOrCapacityApproval'])
a=data('cached-package-policy.json');ck('apt-warning-preserved',(HERE/'raw/apt-cached-policy.stdout.bin').read_bytes()==b'' and b'Permission denied' in (HERE/'raw/apt-cached-policy.stderr.bin').read_bytes() and not s['observations']['aptCandidateMetadataResolved'])
for stream in ['stdout','stderr']:
 b=(HERE/'raw'/('apt-cached-policy.'+stream+'.bin')).read_bytes();ck('apt-raw:'+stream,len(b)==a[stream]['bytes'] and hashlib.sha256(b).hexdigest()==a[stream]['sha256'])
ck('node-resolution-metadata-absent',all(not x['exists'] for x in data('node-driver-resolution-metadata.json')['candidates']))
ast.parse((HERE/'discover-host.py').read_text());ck('metadata-helper-parses',True)
report=(ROOT/'docs/coordination/reports/MERI-G1-L1-HOST-20261012.md').read_text();ck('no-localhost-trust-assumed','No localhost-trust exception is selected' in report)
result={'status':'PASS' if all(x['passed'] for x in checks) else 'FAIL','checks':len(checks),'passed':sum(x['passed'] for x in checks),'failed':[x['name'] for x in checks if not x['passed']],'scope':'Offline file/AST/data only; no discovery rerun, native binary, DB, namespace, container, cloud or provider execution','runtimeAdmission':'HOLD_NOT_EXECUTABLE','checksDetail':checks}
print(json.dumps(result,indent=2));raise SystemExit(0 if result['status']=='PASS' else 1)
