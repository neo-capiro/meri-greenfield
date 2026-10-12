"""Exact immutable source/reference audit; never executes producer or runtime code."""
from pathlib import Path
import hashlib,json,subprocess,sys
root=Path(__file__).resolve().parents[5];lane=Path(__file__).resolve().parent
source=sys.argv[1];base='a3e946c1fa264ae7b33205f5b87804ee1ef75773';prerequisite='a25516ae8d2c44638800e492e439e212098dc750'
paths=['packages/contracts/retrieval-0.2/entity-candidates.schema.json','packages/contracts/retrieval-0.2/entity-candidates-validation.mjs','packages/contracts/test/retrieval-entity-candidates.test.mjs'];state='packages/contracts/retrieval-0.2/state-bill-identity.mjs';congress='packages/contracts/retrieval-0.2/congressional-identity.mjs'
checks=[]
def check(label,value):checks.append({'check':label,'pass':bool(value)})
def git(*args,cwd=root):return subprocess.check_output(['git',*args],cwd=cwd,timeout=10)
def raw(path,ref=source):return git('show',ref+':'+path)
def sha(b):return hashlib.sha256(b).hexdigest()
def tree(ref):return {p:i for row in git('ls-tree','-r','-z',ref).split(b'\0') if row for i,p in [row.split(b'\t',1)]}
old=tree(base);new=tree(source)
check('every original complete blob/mode preserved',all(new.get(p)==v for p,v in old.items()))
changes=git('diff','--name-only',base,source,'--','packages','apps','scripts','package.json','package-lock.json').decode().splitlines()
check('only three new family files and exact helper prerequisite',set(changes)==set(paths+[state]))
check('state helper exact accepted bytes',raw(state)==raw(state,prerequisite))
check('congress helper unchanged',raw(congress)==raw(congress,base))
for p in paths+[state]:check('working source exact '+p,(root/p).read_bytes()==raw(p))
check('candidate is review ancestor',subprocess.run(['git','merge-base','--is-ancestor',source,'HEAD'],cwd=root).returncode==0)
refs=json.loads((lane/'reference-identities.json').read_text());check('eight independent pairs',len(refs['references'])==8)
for ref in refs['references']:
 ids=[]
 for version in ref['versions']:
  data=git('show',version['commit']+':'+ref['path'],cwd=Path('/workspace/capirov2'));identity=git('rev-parse',version['commit']+':'+ref['path'],cwd=Path('/workspace/capirov2')).decode().strip();ids.append(identity)
  check('reference '+ref['path']+' '+version['commit'],len(data)==version['bytes'] and sha(data)==version['sha256'] and identity==version['blob'])
 check('paired no drift '+ref['path'],len(ids)==2 and len(set(ids))==1 and ref['unchanged'])
for ref in refs['canonicalHelpers']:
 data=raw(ref['path'],ref['source']);check('canonical helper pin '+ref['path'],len(data)==ref['bytes'] and sha(data)==ref['sha256'])
schema=json.loads(raw(paths[0]));defs=schema['$defs'];check('exact private source schema ID',schema['$id']=='urn:meri:retrieval:entity-candidates:0.2.0')
check('required trusted context',set(defs['EntityCandidatesContext']['properties'])==set(defs['EntityCandidatesContext']['required'])=={'defaultCongress'} and defs['EntityCandidatesContext']['additionalProperties'] is False)
props=defs['EntityCandidatesContext']['properties']['defaultCongress'];check('trusted positive Int32',props['type']=='integer' and props['minimum']==1 and props['maximum']==2147483647)
expected={
'EntityMemberCandidate':['entityType','canonicalIdType','canonicalId','display','party','state','district','chamber','lisId','isCurrent','matchedBy'],
'EntityCommitteeCandidate':['entityType','canonicalIdType','canonicalId','display','chamber','parentSystemCode','isCurrent','matchedBy'],
'EntityFederalBillCandidate':['entityType','canonicalIdType','canonicalId','display','congress','sponsorName','sponsorBioguideId','latestActionText','latestActionDate','matchedBy'],
'EntityStateBillCandidate':['entityType','canonicalIdType','canonicalId','display','state','session','sponsorName','latestActionText','latestActionDate','matchedBy'],
'EntityStateLegislatorCandidate':['entityType','canonicalIdType','canonicalId','display','state','chamber','district','party','isCurrent','matchedBy']}
for name,fields in expected.items():check('closed exact projection '+name,set(defs[name]['properties'])==set(defs[name]['required'])==set(fields) and defs[name]['additionalProperties'] is False)
text=raw(paths[1]).decode();check('reuse congress helper',"from './congressional-identity.mjs'" in text);check('reuse accepted state helper',"from './state-bill-identity.mjs'" in text);check('reuse inert snapshot',"from './operation-contracts.mjs'" in text)
check('no source clock/provider API',all(x not in text for x in ['Date.now','new Date()','getUTCFullYear','fetch(','LegiScan','legiscanRequest']))
check('authored whitespace',subprocess.run(['git','diff','--check',base,source],cwd=root,capture_output=True).returncode==0)
print(json.dumps({'scope':'INDEPENDENT_SOURCE_ONLY','source':source,'sourceTree':git('rev-parse',source+'^{tree}').decode().strip(),'base':base,'originalFilesVerified':len(old),'checks':checks,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'sourceIdentities':[{'path':p,'bytes':len(raw(p)),'sha256':sha(raw(p)),'blob':git('rev-parse',source+':'+p).decode().strip()} for p in paths+[state]]},indent=2))
raise SystemExit(int(any(not c['pass'] for c in checks)))
