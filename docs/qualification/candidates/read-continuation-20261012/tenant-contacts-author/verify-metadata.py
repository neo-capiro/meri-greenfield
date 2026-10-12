"""Source identity/DTO metadata and preservation audit; private files never run."""
import hashlib,json,pathlib,re,subprocess
root=pathlib.Path(__file__).resolve().parents[5];ev=pathlib.Path(__file__).resolve().parent
base='a3e946c1fa264ae7b33205f5b87804ee1ef75773';checks=[]
def check(label,ok):
 checks.append({'label':label,'pass':bool(ok)})
 if not ok:raise AssertionError(label)
refs=json.loads((ev/'reference-identities.json').read_text())
for r in refs['references']:
 for side in ['pinned','observed']:
  i=r[side];data=subprocess.check_output(['git','-C','/workspace/capirov2','show',i['commit']+':'+r['path']]);blob=subprocess.check_output(['git','-C','/workspace/capirov2','rev-parse',i['commit']+':'+r['path']],text=True).strip();check(side+':'+r['path'],len(data)==i['bytes'] and hashlib.sha256(data).hexdigest()==i['sha256'] and blob==i['blob'])
 check('no drift:'+r['path'],r['unchanged'] and r['pinned']['blob']==r['observed']['blob'])
source=subprocess.check_output(['git','-C','/workspace/capirov2','show',refs['pinnedCommit']+':apps/api/prisma/schema.prisma'],text=True)
meta=json.loads((ev/'projection-metadata.json').read_text())
models=dict(re.findall(r'\bmodel\s+(\w+)\s*\{([\s\S]*?)\n\}',source))
for model,fields in meta['storedFields'].items():
 actual=dict(re.findall(r'^\s*(\w+)\s+(\S+)',models[model],re.M))
 for field,type in fields.items():check(model+'.'+field,actual.get(field)==type)
schema=json.loads((root/'packages/contracts/retrieval-0.2/tenant-contacts.schema.json').read_text())
contact=schema['$defs']['TenantContactsContact'];check('nine required closed contact fields',set(contact['required'])=={'name','email','phone','title','organization','lastContact','messageCount','source','onProfile'} and contact['additionalProperties'] is False)
check('closed empty context',schema['$defs']['TenantContactsContext']['properties']=={} and schema['$defs']['TenantContactsContext']['additionalProperties'] is False)
catalog=json.loads((root/'packages/contracts/retrieval-0.2/catalog.json').read_text());entry=next(x for x in catalog['originals'] if x['id']=='find_contacts');check('selected pending unavailable',entry['state']=='pending' and entry['replacement'] is None and entry['disposition']=='selected')
files=subprocess.check_output(['git','ls-tree','-r','--name-only',base],cwd=root,text=True).splitlines()
for p in files:
 if (root/p).read_bytes()!=subprocess.check_output(['git','show',base+':'+p],cwd=root):raise AssertionError('changed original '+p)
check('all base files unchanged',True)
result={'scope':'OFFLINE_SOURCE_METADATA_ONLY','checks':len(checks),'passed':len(checks),'failed':0,'baseFilesByteIdentical':len(files),'references':len(refs['references']),'drift':0,'details':checks}
(ev/'metadata-checks.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='details'}))
