import json,hashlib,subprocess,pathlib
root=pathlib.Path(__file__).resolve().parents[5]
out=pathlib.Path(__file__).parent
checks=[]
def check(name,condition):
 checks.append({'name':name,'passed':bool(condition)})
def git(*args):return subprocess.check_output(['git','-C',str(root),*args])
def sha(b):return hashlib.sha256(b).hexdigest()
def tree(ref):
 return {entry.split(b'\t',1)[1].decode():entry.split(b'\t',1)[0].decode() for entry in git('ls-tree','-rz',ref).split(b'\0') if entry}
base='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8';source='c78a4dff30f825441da5c32015d90647be107b3a';initial='87ee0f35edb510c981eb816fcccb70d27d2de875';shared='37f84fcb3bf2d34ae59673b1644fac64f1ef798c'
a=tree(base);b=tree(source)
unchanged=sum(b.get(p)==v for p,v in a.items());check('Every preexisting base tree entry preserved',unchanged==len(a))
paths=['apps/control/schedules/temporal-inspection.mjs','apps/control/test/temporal-inspection.test.mjs','packages/contracts/schedules-0.2/inspection.schema.json','packages/contracts/schedules-0.2/inspection-validation.mjs','packages/runtime/operation-lifetime.mjs']
source_rows=[]
for p in paths:
 data=git('show',source+':'+p);check('Exact reviewed source bytes '+p,(root/p).read_bytes()==data);source_rows.append({'path':p,'bytes':len(data),'sha256':sha(data),'blob':b[p].split()[-1]})
check('Shared lifecycle exact root dependency',git('show',source+':packages/runtime/operation-lifetime.mjs')==git('show',shared+':packages/runtime/operation-lifetime.mjs'))
oldtests=git('show',initial+':apps/control/test/temporal-inspection.test.mjs');newtests=git('show',source+':apps/control/test/temporal-inspection.test.mjs')
check('All original22 author test bytes unchanged prefix',newtests.startswith(oldtests))
for p in paths[2:]:check('Repair preserves schema/validator/shared dependency '+p,git('show',source+':'+p)==git('show',initial+':'+p))
check('Repair source-only existing delta adapter/test',set(git('diff','--name-only',initial,source,'--','apps','packages').decode().splitlines())==set(paths[:2]))
module=(root/paths[0]).read_text();validator=(root/paths[3]).read_text()
check('Single canonical lifetime use and no adapter timer race','createOperationLifetime' in module and not any(t in module for t in ['setTimeout(', 'Promise.race(', 'new AbortController(']))
check('Borrowed client not closed','connection.close(' not in module and 'scheduleClient.close(' not in module)
check('Only exact describe path; no schedule mutation/list',all(t not in module for t in ['.create(','.update(','.delete(','.pause(','.unpause(','.trigger(','.backfill(','.list(']))
check('Public canonical snapshot/hash reused',"snapshotOperationData" in validator and "canonicalSha256" in validator and "../meri.schema.json" in validator)
check('No app-private dependency in contract validator',"apps/" not in validator and "../../../apps" not in validator)
check('No connection/service initialization',all(t not in module+validator for t in ['Connection.connect','new ScheduleClient','WorkflowClient','process.env','new Worker']))
meta=json.loads((root/'docs/qualification/candidates/backend-execution-20261012/schedule-inspection/sdk-metadata.json').read_text());sdk=[]
for f in meta['installed']:
 data=pathlib.Path(f['path']).read_bytes();check('Pinned installed SDK bytes '+pathlib.Path(f['path']).name,len(data)==f['bytes'] and sha(data)==f['sha256']);sdk.append({**f,'independentlyMatched':len(data)==f['bytes'] and sha(data)==f['sha256']})
lib=pathlib.Path(meta['installed'][0]['path']).parent;pkg=json.loads((lib.parent/'package.json').read_text());check('Installed SDK declared version1.24.0',pkg['version']=='1.24.0')
client=(lib/'schedule-client.js').read_text();types=(lib/'schedule-types.d.ts').read_text();connection=(lib/'connection.js').read_text()
check('SDK getHandle returns own scheduleId/describe method','getHandle(scheduleId)' in client and 'async describe()' in client and 'scheduleId,' in client)
check('SDK describes using pinned handle and configured namespace','this.client._describeSchedule(this.scheduleId)' in client and 'namespace: this.options.namespace' in client)
check('SDK decodes action/memo before returned projection','decodeScheduleAction' in client and 'decodeMapFromPayloads' in client)
check('SDK external-storage inbound work disclosed','walkDescribeScheduleResponse' in client and 'extstoreInboundOptions' in client)
check('SDK withDeadline and AbortSignal scoped contexts','callContextStorage.run({ ...cc, deadline }, fn)' in connection and 'callContextStorage.run({ ...cc, abortSignal }, fn)' in connection)
check('SDK original run explicitly differs after retry/continue/reset','firstExecutionRunId: string' in types and 'Continue-As-New' in types)
check('SDK recent oldest-to-newest order','sorted from older start time to newer' in types)
receipts=[]
for label in ['initial-candidate','expanded-initial','repaired-candidate']:
 data=json.loads((out/(label+'.json')).read_text());check('Owned group absent '+label,data['ownedProcessGroupAbsent'] and not data['timedOut']);
 for s in data['streams']:check('Raw receipt bytes '+s['path'],sha((root/s['path']).read_bytes())==s['sha256'])
 receipts.append({'label':label,'exitCode':data['exitCode'],'group':data['ownedPidAndPgid'],'absent':data['ownedProcessGroupAbsent']})
report={'base':base,'source':source,'sharedDependency':shared,'checks':checks,'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'originalEntries':len(a),'preservedOriginalEntries':unchanged,'sourceFiles':source_rows,'sdkFiles':sdk,'officialReferences':meta['officialReferences'],'officialRead':'Independent read of three exact pinned official source URLs; no SDK module import/execution','captureReceipts':receipts,'runtimeAccepted':False}
(out/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['source','passed','failed','originalEntries','preservedOriginalEntries']}));raise SystemExit(bool(report['failed']))
