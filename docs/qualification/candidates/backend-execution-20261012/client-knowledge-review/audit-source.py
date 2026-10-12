"""Independent read-only Git/schema audit; never imports private producers."""
import hashlib,json,pathlib,re,subprocess,sys,os
root=pathlib.Path(__file__).resolve().parents[5]; out=pathlib.Path(__file__).resolve().parent
private=pathlib.Path('/workspace/capirov2'); pins=['fd8765ec01d292013758606204f2c9d886cd31c1','4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace']; checks=[]
def git(*a,cwd=root):return subprocess.check_output(['git',*a],cwd=cwd)
def check(name,ok):checks.append({'check':name,'pass':bool(ok)})
def sha(b):return hashlib.sha256(b).hexdigest()
refs=json.loads((out/'reference-identities.json').read_text())['references']; paths=[x['path']for x in refs]
paths+=['apps/api/src/meri/meri-attachment-document.ts','apps/api/src/meri/meri-attachment-extract.ts','apps/api/src/meri/meri-attachment.helpers.ts','apps/api/src/meri/meri-artifact-integrity.ts','apps/api/src/meri/meri-tool-request-control.ts','apps/api/src/engagement/pptx-extract.ts','apps/api/src/retrieval/adapters/governed-memory-eligibility.helpers.ts','apps/api/src/retrieval/adapters/institutional-knowledge-retrieval.adapter.ts','apps/api/src/memory/memory-recall-content.helpers.ts','packages/meriv2-core/src/memory/governance.ts','apps/api/src/clients/client-capabilities.service.ts','apps/api/src/clients/client-people.service.ts','apps/api/src/clients/client-facilities.service.ts','apps/api/src/clients/client-advocacy-matter.service.ts','apps/api/src/clients/client-hierarchy.helpers.ts','apps/api/src/engagement/engagement.service.ts','apps/api/src/retrieval/adapters/monday-board-scope.ts']
paired=[]
for p in dict.fromkeys(paths):
 row={'path':p,'versions':[]}
 for pin in pins:
  b=git('show',f'{pin}:{p}',cwd=private);oid=git('rev-parse',f'{pin}:{p}',cwd=private).decode().strip();row['versions'].append({'commit':pin,'blob':oid,'bytes':len(b),'sha256':sha(b)})
 row['unchanged']=row['versions'][0]['blob']==row['versions'][1]['blob'];check('reference no drift '+p,row['unchanged']);paired.append(row)
(out/'complete-reference-identities.json').write_text(json.dumps({'references':paired,'scope':'Referenced source contracts/policies read as source data only, no producer execution.'},indent=2)+'\n')
prisma=git('show',f'{pins[0]}:apps/api/prisma/schema.prisma',cwd=private).decode();profile=json.loads((root/'packages/contracts/retrieval-0.2/client-knowledge-profile.schema.json').read_text());model_names=['Client','MailThread','EngagementTask','ClientCapability','ClientPerson','ClientFacility','ClientSubmissionHistory'];scalar={'String','Int','Float','Decimal','Boolean','DateTime','Json','Bytes'};enums=set(re.findall(r'^enum (\w+)\s*\{',prisma,re.M)); inventory=[]
for model in model_names:
 match=re.search(r'^model '+model+r'\s*\{(.*?)^\}',prisma,re.M|re.S);assert match,model
 fields=[]
 for line in match.group(1).splitlines():
  m=re.match(r'\s*(\w+)\s+(\w+)(\[\]|\?)?(.*)',line)
  if not m or m[2] not in scalar|enums:continue
  fields.append({'model':model,'field':m[1],'type':m[2]+(m[3]or''),'uuid':'@db.Uuid'in m[4],'decimal43':'@db.Decimal(4, 3)'in m[4]})
 inventory.extend(fields);definition=profile['$defs']['Profile'+model];check('complete model '+model,{f['field']for f in fields}==set(definition['properties'])==set(definition['required']))
 for field in fields:
  d=definition['properties'][field['field']];branches=d.get('anyOf',[d]); nullable=any(x.get('type')=='null'for x in branches)
  if field['type'].endswith('?') and field['type']!='Json?':check('nullable '+model+'.'+field['field'],nullable)
  if field['type']=='Int':check('int32 '+model+'.'+field['field'],d.get('minimum')==-2147483648 and d.get('maximum')==2147483647)
check('150 scalar columns',len(inventory)==150);(out/'independent-profile-scalars.json').write_text(json.dumps({'count':len(inventory),'fields':inventory},indent=2)+'\n')
base='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8'
def tree(ref):return {line.split('\t',1)[1]:line.split('\t',1)[0]for line in git('ls-tree','-r',ref).decode().splitlines()}
a,b=tree(base),tree('HEAD');changed=[p for p,o in a.items()if b.get(p)!=o];check('all '+str(len(a))+' original tree entries preserved',not changed)
for family in ['search','monday','attachments','memory','profile']:
 stem='packages/contracts/retrieval-0.2/client-knowledge-'+family;s=json.loads((root/(stem+'.schema.json')).read_text());code=(root/(stem+'-validation.mjs')).read_text();check('canonical inert data '+family,'snapshotOperationData'in code);check('no private/runtime imports '+family,not re.search(r"from ['\"](?:@capiro|[^'\"]*apps/api|node:(?:fs|child_process|net|https?))",code));check('URN '+family,s['$id']=='urn:meri:retrieval:client-knowledge-'+family+':0.2.0')
 for name,d in s['$defs'].items():
  if name.endswith('Request'):
   check('closed caller '+name,d.get('additionalProperties')is False);check('caller excludes trusted context '+name,not set(d.get('properties',{}))&{'asOf','scope','tenantId','userId','clientResolution','binding','actorRole'})
for receipt in out.glob('*.json'):
 data=json.loads(receipt.read_text())
 if not isinstance(data,dict)or'ownedPidAndPgid'not in data:continue
 check('captured cleanup '+receipt.name,data['ownedProcessGroupAbsent']and not data['timedOut'])
 for stream in data['streams']:
  blob=(root/stream['path']).read_bytes();check('raw '+stream['path'],len(blob)==stream['bytes']and sha(blob)==stream['sha256'])
 try:os.killpg(data['ownedPidAndPgid'],0);absent=False
 except ProcessLookupError:absent=True
 except PermissionError:absent=False
 check('owned group absent '+str(data['ownedPidAndPgid']),absent)
result={'head':git('rev-parse','HEAD').decode().strip(),'base':base,'originalEntries':len(a),'originalChanges':changed,'passed':sum(c['pass']for c in checks),'total':len(checks),'checks':checks,'scope':'SOURCE_ONLY_NO_RUNTIME_ADMISSION'}
label=sys.argv[1];dest=out/(label+'.json');assert not dest.exists();dest.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k]for k in ['head','passed','total','originalEntries','originalChanges']}));sys.exit(0 if all(c['pass']for c in checks)else 1)
