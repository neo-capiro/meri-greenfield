#!/usr/bin/env python3
"""Metadata/shape audit of the first actual reviewed family; no private execution."""
import hashlib
import json
from pathlib import Path
import subprocess

BASE='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8'
SOURCE='3da3f17ec677f5c3f67435501e723d1ab23d1d26'
P=Path(__file__).resolve().parent
ROOT=P.parents[4]
checks=[]
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def raw(c,p):return git('show',c+':'+p)
def check(x,name):checks.append({'name':name,'pass':bool(x)})
def tree(c):
 out={}
 for entry in git('ls-tree','-rz',c).split(b'\0'):
  if entry:
   value,path=entry.split(b'\t',1);out[path.decode()]=value.decode()
 return out

before,after=tree(BASE),tree(SOURCE)
check(all(after.get(p)==v for p,v in before.items()),'all PR35 original entries mode/blob preserved')
files=['packages/contracts/retrieval-0.2/research-legal-candidates.schema.json','packages/contracts/retrieval-0.2/research-legal-candidates-validation.mjs','packages/contracts/test/retrieval-research-legal-candidates.test.mjs']
check({p for p in after.keys()-before.keys() if p.startswith(('apps/','packages/','scripts/'))}==set(files),'exact three new family files only')
for f in files:check((ROOT/f).read_bytes()==raw(SOURCE,f),'exact exercised source '+f)
schema=json.loads(raw(SOURCE,files[0]));code=raw(SOURCE,files[1]).decode()
check(schema['$id']=='urn:meri:retrieval:research-legal-candidates:0.2.0','private namespace')
check(schema['$defs']['ResearchLegalCandidatesContext']=={'$ref':'urn:meri:retrieval:outreach-query:0.2.0#/$defs/OutreachQueryContext'},'canonical trusted resolution shape reused')
check("from './operation-contracts.mjs'" in code and "from './public-data-deadlines.mjs'" in code,'canonical inert snapshot and date owner reused')
check(all(x not in code for x in ['fetch(', 'new Date()', 'process.env', 'setInterval(', '$queryRaw', 'node:child_process', 'capirov2']), 'no producer/ambient clock/service execution')
check("const ID = 'search_research_sources'" in code,'first-family operation only; no six-family acceptance inferred')
defs=schema['$defs'];variants=['ResearchCandidateClient','ResearchCandidateMeeting','ResearchCandidateMailThread','ResearchCandidateMailMessage','ResearchCandidateClioNote','ResearchCandidateDirectoryNote']
check(defs['ResearchLegalCandidate']['oneOf']==[{'$ref':'#/$defs/'+n} for n in variants],'six complete discriminated source variants')
for name in variants:
 d=defs[name];check(d['additionalProperties'] is False and set(d['required'])==set(d['properties']),name+' exact mandatory projection')
check(defs['ResearchCandidateDirectoryNote']['properties']['clientId']=={'type':'null'},'directory notes preserve tenant-only client exception')
check(defs['ResearchCandidateDirectoryNote']['properties']['metadata']['properties']['directoryContactId']=={'type':'string'},'opaque directory ID has no invented UUID restriction')
check(defs['ResearchCandidateClioNote']['properties']['title']=={'type':'string','minLength':1},'note empty-title fallback faithfully admitted')
refs=json.loads((P/'initial-reference-identities.json').read_text())
for item in refs['references']:
 for pin in item['versions']:
  value=subprocess.check_output(['git','-C','/workspace/capirov2','show',pin['commit']+':'+item['path']])
  actual=hashlib.sha1(b'blob '+str(len(value)).encode()+b'\0'+value).hexdigest()
  check((len(value),hashlib.sha256(value).hexdigest(),actual)==(pin['bytes'],pin['sha256'],pin['blob']),'source pin '+item['path']+' '+pin['commit'][:8])
check(all(x['unchanged'] for x in refs['references']),'all ten inspected interface/reference pairs unchanged')
for label,want in [('research-first',1),('research-corrected',0)]:
 r=json.loads((P/(label+'.json')).read_text());check(r['exitCode']==want and r['ownedProcessGroupAbsent'] and not r['timedOut'],label+' raw exit and owned cleanup')
 for st in r['streams']:
  value=(ROOT/st['path']).read_bytes();check((len(value),hashlib.sha256(value).hexdigest())==(st['bytes'],st['sha256']),label+' '+Path(st['path']).name+' raw bytes')
check('tests 55' in (P/'research-corrected.stdout.bin').read_text() and 'fail 0' in (P/'research-corrected.stdout.bin').read_text(),'28 independent plus27 author exact final pass')
result={'status':'PASS' if all(x['pass'] for x in checks) else 'FAIL','source':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'production':'1b52df122e0eb660dd74e79386fc3bbf8983c98e','base':BASE,'originalEntries':len(before),'passed':sum(x['pass'] for x in checks),'total':len(checks),'checks':checks,'qualification':'search_research_sources source only; remaining five operations and runtime not accepted'}
print(json.dumps(result,indent=2));raise SystemExit(0 if result['status']=='PASS' else 1)
