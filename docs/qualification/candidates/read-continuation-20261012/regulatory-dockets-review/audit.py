"""Offline Git/reference/schema/capture audit; no producer or runtime execution."""
from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[5];lane=Path(__file__).resolve().parent
base='a3e946c1fa264ae7b33205f5b87804ee1ef75773';source='57e09ebfda15d6057bdf4bfb7fc84b4061eac03f'
paths=['packages/contracts/retrieval-0.2/regulatory-dockets.schema.json','packages/contracts/retrieval-0.2/regulatory-dockets-validation.mjs','packages/contracts/test/retrieval-regulatory-dockets.test.mjs']
checks=[]
def check(label,condition):checks.append({'check':label,'pass':bool(condition)})
def git(*args,cwd=root):return subprocess.check_output(['git',*args],cwd=cwd,timeout=10)
def raw(path,ref=source):return git('show',ref+':'+path)
def sha(b):return hashlib.sha256(b).hexdigest()
def tree(ref):
 return {p:i for row in git('ls-tree','-r','-z',ref).split(b'\0') if row for i,p in [row.split(b'\t',1)]}
old=tree(base);new=tree(source)
check('exact source tree',git('rev-parse',source+'^{tree}').decode().strip()=='485860a7d9b2d4cf1e9f19a45c00cd80213ca088')
check('every original file blob and mode preserved',all(new.get(p)==i for p,i in old.items()))
expected={*paths,'docs/qualification/candidates/read-continuation-20261012/regulatory-dockets-author/outline.json'}
check('only four allocated additions',set(git('diff','--name-status',base,source).decode().splitlines())=={'A\t'+p for p in expected})
for path in paths:check('working source exactly pinned '+path,(root/path).read_bytes()==raw(path))
check('source is review ancestor',subprocess.run(['git','merge-base','--is-ancestor',source,'HEAD'],cwd=root).returncode==0)
for path in ['packages/contracts/meri.schema.json','packages/contracts/validate.mjs','packages/contracts/package.json','packages/contracts/retrieval-0.2/catalog.json','packages/contracts/retrieval-0.2/operation-contracts.mjs']:
 if path.encode() in old:check('explicit shared/public preservation '+path,raw(path)==raw(path,base))
refs=json.loads((lane/'reference-identities.json').read_text())['references'];check('seven paired references',len(refs)==7)
for reference in refs:
 ids=[]
 for version in reference['versions']:
  data=git('show',version['commit']+':'+reference['path'],cwd=Path('/workspace/capirov2'));identity=git('rev-parse',version['commit']+':'+reference['path'],cwd=Path('/workspace/capirov2')).decode().strip();ids.append(identity)
  check('reference '+reference['path']+' '+version['commit'],len(data)==version['bytes'] and sha(data)==version['sha256'] and identity==version['blob'])
 check('paired no drift '+reference['path'],len(ids)==2 and len(set(ids))==1 and reference['unchanged'])
schema=json.loads(raw(paths[0]));defs=schema['$defs'];check('exact private schema ID',schema['$id']=='urn:meri:retrieval:regulatory-dockets:0.2.0')
check('three cohesive definitions',set(defs)=={'RegulatoryDocketsQueryInput','RegulatoryDocketsQueryOutput','RegulatoryDocketRow'})
fields=['id','documentId','agencyId','docketId','documentType','title','postedDate','commentStartDate','commentEndDate','frDocNum','subtype','withdrawn','lastModified','syncedAt']
check('complete raw projection',set(defs['RegulatoryDocketRow']['properties'])==set(defs['RegulatoryDocketRow']['required'])==set(fields))
check('generic storage ID',defs['RegulatoryDocketRow']['properties']['id']=={'type':'string'})
for name,value in defs.items():check('closed properties '+name,value['additionalProperties'] is False)
check('row cap from wrapper',defs['RegulatoryDocketsQueryOutput']['properties']['results']['maxItems']==50)
for key,maxvalue in [('limit',50),('days',365)]:check('approved strict integer boundary '+key,defs['RegulatoryDocketsQueryInput']['properties'][key]=={'type':'integer','minimum':1,'maximum':maxvalue})
text=raw(paths[1]).decode();check('canonical inert helper only import',text.count('import ')==1 and "import {snapshotOperationData} from './operation-contracts.mjs';" in text)
check('no source clock access',all(token not in text for token in ['Date.now','new Date()','performance.now','fetch(']))
check('qualification limitation retained','cannot prove current eligibility or membership in an actual source window' in text and 'Ordinary null placement' in text)
for label,count in [('independent-first',26),('family-combined',51)]:
 r=json.loads((lane/(label+'.json')).read_text());check('bounded clean successful receipt '+label,r['exitCode']==0 and not r['timedOut'] and r['sourceDiffBytes']==0 and r['ownedProcessGroupAbsent'])
 for member in r['streams']:
  b=(root/member['path']).read_bytes();check('captured stream '+member['path'],len(b)==member['bytes'] and sha(b)==member['sha256'])
 out=(lane/(label+'.stdout.bin')).read_text();check('exact test counts '+label,all(s in out for s in [f'tests {count}',f'pass {count}','fail 0','skipped 0']))
 check('capture helper bound '+label,r['captureSha256']==sha((lane/'capture-reaped.py').read_bytes()))
check('authored whitespace',subprocess.run(['git','diff','--check',base,source],cwd=root,capture_output=True).returncode==0)
print(json.dumps({'scope':'INDEPENDENT_SOURCE_ONLY_NOT_RUNTIME','base':base,'source':source,'originalFilesVerified':len(old),'checks':checks,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'sourceIdentities':[{'path':p,'bytes':len(raw(p)),'sha256':sha(raw(p)),'blob':git('rev-parse',source+':'+p).decode().strip()} for p in paths]},indent=2))
raise SystemExit(int(any(not c['pass'] for c in checks)))
