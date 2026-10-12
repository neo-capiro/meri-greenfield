"""Git/schema/receipt audit for the frozen artifact-only integration stage."""
import hashlib,json,subprocess,os
from pathlib import Path
r=Path(__file__).resolve().parents[5];e=Path(__file__).resolve().parent
BASE='9f9e7e4e12fc81d3727ba556089dd8b1b64f4ce7';SOURCE='1625c95d89593f07ec072ad71f9756a41e0c0db1';DOMAIN='47aef9f9a58d14a932ddc0b8cfdaf1475a5cb1ae'
def git(*args):return subprocess.check_output(['git',*args],cwd=r)
def tree(ref):
 out={}
 for row in git('ls-tree','-rz',ref).split(b'\0'):
  if row:
   meta,p=row.split(b'\t',1);out[p.decode()]=meta.decode()
 return out
checks=[]
def check(n,v):checks.append({'name':n,'pass':bool(v)})
a,b,c=tree(BASE),tree(SOURCE),tree(DOMAIN)
joined=tree('83d0f5951a5e0c5d86d3a8684c2396b6cf13f794')
expected={'docs/coordination/tasks/CODEX-VERTICAL-SOURCE-20261012.md','packages/contracts/retrieval-0.2/catalog-validation.mjs','packages/contracts/retrieval-0.2/catalog.json','packages/contracts/retrieval-0.2/validate.mjs'}
changed={p for p,v in a.items() if b.get(p)!=v};check('exact declared prior changes only',changed==expected)
check('all other baseline mode/blobs preserved',all(b.get(p)==v for p,v in a.items() if p not in expected))
for p,v in c.items():
 if p.startswith(('apps/artifacts/','packages/contracts/artifacts-0.2/')):check('exact accepted artifact '+p,joined.get(p)==v)
for row in json.loads((e/'baseline.json').read_text())['references']:
 if row['path'] in expected:continue
 data=git('show',SOURCE+':'+row['path']);check('preserved reference '+row['path'],len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'])
loader=git('show',SOURCE+':packages/contracts/retrieval-0.2/validate.mjs').decode();compose=git('show',SOURCE+':packages/contracts/retrieval-0.2/execution-tool-validators.mjs').decode()
check('strict Ajv remains enabled','new Ajv({ strict: true, allErrors: true })' in loader)
check('domain callback uses namespaced schema','schemaShape(\'artifacts\',name,value)' in compose)
check('no application executor imported by new validator composition',"../artifacts-0.2/artifact-validation.mjs" in compose and 'apps/' not in compose)
# Read registered original groups from the static list; artifact exposure is explicit metadata.
import re
line=next(x for x in loader.splitlines() if x.startswith('const groups ='))
groups=re.findall(r"'([^']+)'",line);check('one fixed artifact group extension', '...executionSchemaSources.map' in line)
seen={};duplicates=[]
for group in groups:
 schema=json.loads(git('show',SOURCE+':packages/contracts/retrieval-0.2/'+group+'.schema.json'))
 for name in schema['$defs']:
  if name in seen:duplicates.append([name,seen[name],group])
  seen[name]=group
schema=json.loads(git('show',SOURCE+':packages/contracts/artifacts-0.2/artifact.schema.json'))
exposed=['WordRequest','ExcelRequest','PowerpointRequest','AnalysisRequest','ArtifactCreatedResult','ArtifactOperationResult']
check('six artifact exposed names exist and collide with none',all(n in schema['$defs'] and n not in seen for n in exposed))
check('artifact2020 schema namespace is exact',schema['$id']=='urn:meri:artifacts:0.2.0' and schema['$schema']=='https://json-schema.org/draft/2020-12/schema')
rootPrefix='docs/qualification/candidates/vertical-source-20261012/integration/'
rootReceipts=[]
for stem in ['artifact-registry-before','artifact-registry-import-repaired']:
 cap=json.loads(git('show',SOURCE+':'+rootPrefix+stem+'.json'));rootReceipts.append(cap)
 for stream in cap['streams']:
  data=git('show',SOURCE+':'+stream['path']);check('root raw '+stream['path'],len(data)==stream['bytes'] and hashlib.sha256(data).hexdigest()==stream['sha256'])
 check('root cleanup '+stem,cap['ownedProcessGroupAbsent'] and not cap['timedOut'])
check('root actual empty requirement failure retained',rootReceipts[0]['exitCode']!=0 and rootReceipts[1]['exitCode']==0 and 'must NOT have fewer than 1 items' in git('show',SOURCE+':'+rootPrefix+'artifact-registry-before.stderr.bin').decode())
for stem in ['artifact-first','artifact-complete']:
 cap=json.loads((e/(stem+'.json')).read_text())
 for stream in cap['streams']:
  data=(r/stream['path']).read_bytes();check('independent raw '+stream['path'],len(data)==stream['bytes'] and hashlib.sha256(data).hexdigest()==stream['sha256'])
 check('independent source clean '+stem,cap['sourceDiffBytes']==0)
 try:os.killpg(cap['ownedPidAndPgid'],0);absent=False
 except ProcessLookupError:absent=True
 check('independent owned group absent '+stem,cap['ownedProcessGroupAbsent'] and absent)
report={'base':BASE,'source':SOURCE,'tree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'baseEntries':len(a),'unchangedBaseEntries':len(a)-len(changed),'allowedPriorChanges':sorted(changed),'existingUnchangedDefinitionCollisions':duplicates,'exposedArtifactDefinitions':exposed,'outOfScope':['packages/contracts/commands-0.2/tool-interface.schema.json','packages/contracts/commands-0.2/tool-interface-validation.mjs'],'checks':checks,'passed':sum(x['pass'] for x in checks),'failed':sum(not x['pass'] for x in checks),'verdictScope':'Artifact4 registry/loader only; combined13 and all runtime gates pending.'}
(e/'artifact-stage-audit-repaired.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['source','tree','baseEntries','unchangedBaseEntries','passed','failed']}));raise SystemExit(report['failed']!=0)
