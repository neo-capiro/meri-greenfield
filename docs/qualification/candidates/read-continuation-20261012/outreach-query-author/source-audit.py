"""Data/Git-only author audit. No private producer import or execution."""
from pathlib import Path
import hashlib, json, subprocess
ROOT=Path(__file__).resolve().parents[5]
E=Path(__file__).resolve().parent
BASE='4c40fb4c35d716dcd1e3b09ec29647ccca5a1326'
SOURCE='51a296e7d4a1f3ecc2f2f844e3baeeb11f70962f'
checks=[]
def check(name, condition): checks.append({'name':name,'pass':bool(condition)})
def git(*args): return subprocess.check_output(['git','-C',str(ROOT),*args])
def tree(ref):
 return {x.split(b'\t',1)[1].decode():x.split(b'\t',1)[0].decode() for x in git('ls-tree','-rz',ref).split(b'\0') if x}
base=tree(BASE);source=tree(SOURCE)
for path,identity in base.items(): check('original:'+path,source.get(path)==identity)
paths=['packages/contracts/retrieval-0.2/outreach-query.schema.json','packages/contracts/retrieval-0.2/outreach-query-validation.mjs','packages/contracts/test/retrieval-outreach-query.test.mjs']
source_rows=[]
for path in paths:
 body=(ROOT/path).read_bytes();check('frozen:'+path,body==git('show',SOURCE+':'+path));source_rows.append({'path':path,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()})
refs=json.loads((E/'reference-identities.json').read_text())['references']
check('eleven paired owners',len(refs)==11)
for row in refs:
 for version in row['versions']:
  body=subprocess.check_output(['git','-C','/workspace/capirov2','show',version['commit']+':'+row['path']])
  check('private metadata hash:'+row['path']+':'+version['commit'],len(body)==version['bytes'] and hashlib.sha256(body).hexdigest()==version['sha256'])
 check('no reference drift:'+row['path'],row['versions'][0]['sha256']==row['versions'][1]['sha256'])
schema=json.loads((ROOT/paths[0]).read_text());defs=schema['$defs']
check('canonical URN',schema['$id']=='urn:meri:retrieval:outreach-query:0.2.0')
counts={'Record':24,'Campaign':11,'Client':6,'User':4,'Meeting':13,'Attendee':4,'Prep':20,'Debrief':13}
for name,count in counts.items():
 d=defs['OutreachQuery'+name];check('closed selected fields:'+name,len(d['properties'])==count and set(d['required'])==set(d['properties']) and d['additionalProperties'] is False)
check('record schema enums',defs['OutreachQueryRecord']['properties']['type']['enum']==['campaign','follow_up','prep','outbound_campaign'] and defs['OutreachQueryRecord']['properties']['status']['enum']==['draft','sent','opened_in_email','failed'])
check('latest nested rows',defs['OutreachQueryMeeting']['properties']['preps']['maxItems']==defs['OutreachQueryMeeting']['properties']['debriefs']['maxItems']==1)
check('attendees uncapped','maxItems' not in defs['OutreachQueryMeeting']['properties']['attendees'])
check('debrief encrypted fields excluded',not {'body','ciphertext','iv','authTag','tenantId'} & set(defs['OutreachQueryDebrief']['properties']))
module=(ROOT/paths[1]).read_text();check('canonical snapshot import only',module.count('import ')==1 and "import {snapshotOperationData} from './operation-contracts.mjs';" in module)
check('no ambient clock/provider invocation',all(x not in module for x in ['Date.now(', 'fetch(', 'process.', 'setTimeout(', 'withTenant', 'findMany(']))
for name in ['focused-first','focused-corrected','focused-freeze']:
 receipt=json.loads((E/(name+'.json')).read_text());check('owned group absent:'+name,receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'] and not receipt['ownedGroupKillRequired'])
 for stream in receipt['streams']:
  data=(ROOT/stream['path']).read_bytes();check('raw stream:'+stream['path'],len(data)==stream['bytes'] and hashlib.sha256(data).hexdigest()==stream['sha256'])
check('exact frozen tests pass',json.loads((E/'focused-freeze.json').read_text())['exitCode']==0)
for row in json.loads((E/'first-source-identities.json').read_text()):
 old=(E/'initial-source'/Path(row['path']).name).read_bytes();check('initial source preserved:'+row['path'],len(old)==row['bytes'] and hashlib.sha256(old).hexdigest()==row['sha256'])
 if not row['path'].endswith('.test.mjs'):check('fixture-only correction:'+row['path'],old==(ROOT/row['path']).read_bytes())
check('raw initial failures retained',json.loads((E/'focused-first.json').read_text())['exitCode']==1)
result={'base':BASE,'source':SOURCE,'originalEntries':len(base),'originalEntriesPreserved':sum(source.get(k)==v for k,v in base.items()),'sourceFiles':source_rows,'passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks),'checks':checks,'scope':'LOCAL_SOURCE_ONLY; no runtime or database proof'}
(E/'source-audit-data.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='checks'},indent=2))
raise SystemExit(bool(result['failed']))
