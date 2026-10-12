"""Read-only source/reference/receipt audit; no product or legacy entry execution."""
import hashlib
import json
from pathlib import Path
import subprocess

root=Path(__file__).resolve().parents[5]
lane=Path(__file__).resolve().parent
base='4566cef6417428d46274a14f7937ca11df66ae9d'
candidate='530416e490763155c5531140f4b70e95a9493b7b'
source=[
 'packages/contracts/retrieval-0.2/facility-representation.schema.json',
 'packages/contracts/retrieval-0.2/facility-representation-validation.mjs',
 'packages/contracts/test/retrieval-facility-representation.test.mjs']
checks=[]
def check(label,value):
 checks.append({'check':label,'pass':bool(value)})
def git(*args,cwd=root):
 return subprocess.check_output(['git',*args],cwd=cwd)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def blob(ref,path,cwd=root):return git('show',f'{ref}:{path}',cwd=cwd)
check('exact candidate tree',git('rev-parse',candidate+'^{tree}').decode().strip()=='b0b9210fabbb06422a912562dde257b8e54fa01b')
check('base ancestor',subprocess.run(['git','merge-base','--is-ancestor',base,candidate],cwd=root).returncode==0)
check('candidate ancestor of review',subprocess.run(['git','merge-base','--is-ancestor',candidate,'HEAD'],cwd=root).returncode==0)
changes=git('diff','--name-status',base,candidate).decode().splitlines()
allowed={*source,'docs/coordination/reports/CODEX-FACILITY-REPRESENTATION-AUTHOR-20261012.md','docs/qualification/candidates/read-continuation-20261012/facility-representation-author/capture-reaped.py'}
check('exact five additive candidate paths',set(changes)=={'A\t'+p for p in allowed})
check('zero changed or deleted baseline files',not git('diff','--name-only','--diff-filter=DMRTUXB',base,candidate))
for path in source:check('working source equals frozen '+path,(root/path).read_bytes()==blob(candidate,path))
refs=json.loads((lane/'reference-identities.json').read_text())
check('thirteen independent reference paths',len(refs['references'])==13)
for ref in refs['references']:
 observed=[]
 for version in ref['versions']:
  data=blob(version['commit'],ref['path'],Path('/workspace/capirov2'))
  actual=git('rev-parse',f"{version['commit']}:{ref['path']}",cwd=Path('/workspace/capirov2')).decode().strip()
  check('reference bytes '+ref['path']+' '+version['commit'],len(data)==version['bytes'] and sha(data)==version['sha256'] and actual==version['blob'])
  observed.append(actual)
 check('no observed source drift '+ref['path'],len(set(observed))==1 and ref['unchanged'])
text=blob(candidate,source[1]).decode()
check('one canonical imported snapshot owner',text.count('import ')==1 and "import {snapshotOperationData} from './operation-contracts.mjs';" in text)
check('no copied state resolver or duplicate vocabulary','resolveStateName' not in text and 'US_STATE_BY_ABBR' not in text)
check('explicit unqualified federal geography comment','Federal fullname/abbreviation resolution remains an adapter obligation' in text)
schema=json.loads(blob(candidate,source[0]));defs=schema['$defs']
expected={
 'FacilityRepresentationInput':['clientId','state'],
 'FacilityRepresentationSelection':['clientId','state'],
 'FacilityRepresentationContext':['binding','subject'],
 'FacilityFederalMember':['bioguideId','fullName','party','state','district','chamber'],
 'FacilityStateMember':['id','name','state','chamber','district','party','url'],
 'FacilityUnresolvedRepresentation':['unresolved','reason'],
 'FacilityResolvedRepresentation':['federal','state'],
 'FacilityRepresentationRow':['facilityId','facilityName','city','state','representation'],
 'FacilityRepresentationData':['tool','generatedAt','facilities','note'],
 'FacilityRepresentationResult':['binding','subject','data']}
check('exact cohesive definitions',set(defs)==set(expected))
for name,fields in expected.items():
 check('closed exact properties '+name,set(defs[name]['properties'])==set(fields) and defs[name]['additionalProperties'] is False)
 check('exact required keys '+name,set(defs[name]['required'])==(set() if name=='FacilityRepresentationInput' else set(fields)))
check('private schema identifier',schema['$id']=='urn:meri:retrieval:facility-representation:0.2.0')
check('generatedAt wire format',defs['FacilityRepresentationData']['properties']['generatedAt']=={'type':'string','format':'date-time'})
check('facility storage codepoint limit',defs['FacilityRepresentationRow']['properties']['state']['anyOf']==[{'type':'string','maxLength':2},{'type':'null'}])
check('uncapped facility array','maxItems' not in defs['FacilityRepresentationData']['properties']['facilities'])
for name in ['independent-first','independent-complete','full-root','public-distribution']:
 receipt=json.loads((lane/(name+'.json')).read_text())
 check('pass no skips/timeout/source diff '+name,receipt['exitCode']==0 and receipt['timedOut'] is False and receipt['sourceDiffBytes']==0 and receipt['ownedProcessGroupAbsent'] is True)
 for stream in receipt['streams']:
  data=(root/stream['path']).read_bytes();check('exact captured stream '+stream['path'],len(data)==stream['bytes'] and sha(data)==stream['sha256'])
 check('capture helper bound '+name,receipt['captureSha256']==sha((lane/'capture-reaped.py').read_bytes()))
check('candidate whitespace',subprocess.run(['git','diff','--check',base,candidate],cwd=root,capture_output=True).returncode==0)
report={'scope':'INDEPENDENT_SOURCE_ONLY_NOT_RUNTIME','base':base,'sourceCandidate':candidate,'checks':checks,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'sourceIdentities':[{'path':p,'bytes':len(blob(candidate,p)),'sha256':sha(blob(candidate,p)),'blob':git('rev-parse',f'{candidate}:{p}').decode().strip()} for p in source]}
print(json.dumps(report,indent=2));raise SystemExit(1 if report['failed'] else 0)
