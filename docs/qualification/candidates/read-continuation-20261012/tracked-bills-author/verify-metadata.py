"""Offline identities/type facts/source preservation; never execute private source."""
import hashlib,json,pathlib,re,subprocess
root=pathlib.Path(__file__).resolve().parents[5];ev=pathlib.Path(__file__).resolve().parent;base='a3e946c1fa264ae7b33205f5b87804ee1ef75773';checks=[]
def check(label,ok):
 checks.append({'label':label,'pass':bool(ok)})
 if not ok:raise AssertionError(label)
refs=json.loads((ev/'reference-identities.json').read_text())
for r in refs['references']:
 for side in ['pinned','observed']:
  i=r[side];data=subprocess.check_output(['git','-C','/workspace/capirov2','show',i['commit']+':'+r['path']]);blob=subprocess.check_output(['git','-C','/workspace/capirov2','rev-parse',i['commit']+':'+r['path']],text=True).strip();check(side+':'+r['path'],len(data)==i['bytes'] and hashlib.sha256(data).hexdigest()==i['sha256'] and blob==i['blob'])
 check('no drift:'+r['path'],r['unchanged'] and r['pinned']['blob']==r['observed']['blob'])
source=subprocess.check_output(['git','-C','/workspace/capirov2','show',refs['pinnedCommit']+':apps/api/prisma/schema.prisma'],text=True)
meta=json.loads((ev/'projection-metadata.json').read_text());models=dict(re.findall(r'\bmodel\s+(\w+)\s*\{([\s\S]*?)\n\}',source))
for model,fields in meta['sourceFields'].items():
 actual=dict(re.findall(r'^\s*(\w+)\s+(\S+)',models[model],re.M))
 for field,type in fields.items():check(model+'.'+field,actual.get(field)==type)
check('tracking unique client bill',bool(re.search(r'@@unique\(\[clientId, billId\]\)',models['TrackedBill'])))
check('tracking primary UUID',bool(re.search(r'^\s*id\s+String\s+[^\n]*@id[^\n]*@db.Uuid',models['TrackedBill'],re.M)))
check('tracking timestamp',bool(re.search(r'^\s*createdAt\s+DateTime\s+[^\n]*@db.Timestamptz\(6\)',models['TrackedBill'],re.M)))
check('bill latest SQL date',bool(re.search(r'^\s*latestActionDate\s+DateTime\?\s+[^\n]*@db.Date\b',models['CongressBill'],re.M)))
schema=json.loads((root/'packages/contracts/retrieval-0.2/tracked-bills.schema.json').read_text());defs=schema['$defs']
check('canonical allocated URN',schema['$id']=='urn:meri:retrieval:tracked-bills:0.2.0')
for name,key in [('TrackedBillsData','bills'),('TrackedBillsBill','actionTexts'),('TrackedBillsBill','subjectNames')]:check('no invented cap:'+key,'maxItems' not in defs[name]['properties'][key])
check('all nested keys required',set(defs['TrackedBillsBill']['required'])==set(meta['projection']['bill']))
check('all row keys required',set(defs['TrackedBillsRow']['required'])==set(meta['projection']['tracking']))
check('closed new context',set(defs['TrackedBillsContext']['required'])=={'binding','subject','clientReference'} and defs['TrackedBillsContext']['additionalProperties'] is False)
catalog=json.loads((root/'packages/contracts/retrieval-0.2/catalog.json').read_text());entry=next(x for x in catalog['originals'] if x['id']=='search_tracked_bills');check('selected pending null unchanged',entry['state']=='pending' and entry['replacement'] is None and entry['disposition']=='selected')
files=subprocess.check_output(['git','ls-tree','-r','--name-only',base],cwd=root,text=True).splitlines()
for p in files:
 if (root/p).read_bytes()!=subprocess.check_output(['git','show',base+':'+p],cwd=root):raise AssertionError('changed original '+p)
check('all originals unchanged',True)
result={'scope':'OFFLINE_SOURCE_METADATA_ONLY','checks':len(checks),'passed':len(checks),'failed':0,'baseFilesByteIdentical':len(files),'references':len(refs['references']),'drift':0,'details':checks};(ev/'metadata-checks.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='details'}))
