"""Offline metadata preservation checks; never imports or executes private source."""
import hashlib,json,subprocess,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
REPO='/workspace/capirov2'
BASE='c1c9bfde7dd466a0474589a224a99b44277adbc9'
checks=[]
def check(label,ok):
 checks.append({'check':label,'pass':bool(ok)})
 if not ok:raise AssertionError(label)
def git(*args,cwd=REPO):return subprocess.check_output(['git','-C',str(cwd),*args])
def load(name):return json.loads((HERE/name).read_text())
outline=load('outline.json');refs=load('reference-identities.json')['references'];recommendations=load('recommendations.json')
check('exact base retained',git('merge-base','--is-ancestor',BASE,'HEAD',cwd=ROOT)==b'')
check('priority9 unique',len(set(outline['priorityOperations']))==9)
check('prior9 retained',len(load('retained-prior-nine.json')['rows'])==9)
check('no priority/prior overlap',not set(outline['priorityOperations'])&{r['operation'] for r in outline['otherPrior18']})
check('recommendations cover priority exactly',sorted(x for f in recommendations['rankedFamilies'] for x in f['operations'])==sorted(outline['priorityOperations']))
check('scope139/96/43 unchanged',recommendations['scope']=={'original':139,'selected':96,'deferred':43,'priorityReads':9,'otherPriorReadsRetained':9,'newBindings':0})
catalog=json.loads(git('show',f'{BASE}:packages/contracts/retrieval-0.2/catalog.json',cwd=ROOT))
check('original count139',len(catalog['originals'])==139)
check('selected count96',sum(x['disposition']=='selected' for x in catalog['originals'])==96)
check('deferred count43',sum(x['disposition']=='deferred' for x in catalog['originals'])==43)
for op in outline['priorityOperations']:
 check(op+' remains pending',next(x for x in catalog['originals'] if x['id']==op)['state']=='pending')
for ref in refs:
 for which in ['frozen','observed']:
  pin=ref[which];spec=pin['commit']+':'+ref['path'];raw=git('show',spec)
  check(ref['path']+' '+which+' SHA256',hashlib.sha256(raw).hexdigest()==pin['sha256'])
  check(ref['path']+' '+which+' size',len(raw)==pin['bytes'])
  check(ref['path']+' '+which+' blob',git('rev-parse',spec).decode().strip()==pin['blob'])
 check(ref['path']+' drift declaration',ref['changed']==(ref['frozen']['blob']!=ref['observed']['blob']))
check('35 references unchanged',len(refs)==35 and not any(x['changed'] for x in refs))
check('74 stored scalars',sum(len(v['fields']) for v in load('scalar-inventory.json')['models'].values())==74)
check('148 DDL columns',sum(len(v['columns']) for v in load('ddl-field-inventory.json')['tables'].values())==148)
# Anchored source-text checks are provenance checks, not executed producer tests.
pin=outline['sourcePins']['frozen']
def span(path,start,end):return '\n'.join(git('show',pin+':'+path).decode().splitlines()[start-1:end])
def has(path,start,end,items):
 text=span(path,start,end)
 for label,token in items:check(label,token in text)
m='apps/api/src/meri/meri-tools.service.ts';pe='apps/api/src/program-element/program-element-read.service.ts'
has(m,8525,8604,[('SAM stored cap50','clampInt(input.limit, 1, 50, 20)'),('SAM48h source threshold','>= 48'),('SAM generatedAt binding','generatedAt: asOf'),('SAM excerpt300','summarizeText(opp.description, 300)'),('SAM mode-controlled deadline',"=== 'enforce'")])
has(pe,2850,2896,[('SAM active default','if (!filters.includeInactive)'),('SAM independent count','.count({ where })'),('SAM no POC selected','responseDeadline: true')])
check('SAM actual selected read excludes POC','pocEmail: true' not in span(pe,2850,2896))
has(m,10030,10042,[('global limit is JSON chars','JSON.stringify(row).length + 1'),('global prefix starts2','let used = 2')])
has(m,4832,4859,[('global audit swallowed','catch (err)'),('global audit current actor','userId: ctx.userId')])
has(pe,1204,1208,[('timeline predicts without persistence','.predict(peCode, year.fy, false)')])
has('apps/intel-api/src/tracker/research/research.service.ts',228,482,[('research fetched26','LIMIT 26'),('reference rows101','LIMIT 101'),('related rows201','LIMIT 201'),('legal adopted10','LIMIT 10'),('search scanned count','scanned: Math.min(rows.length, 25)'),('sections omitted','sections: undefined'),('reference classification limit','LEGAL_REFERENCE_CLASSIFICATION_NOT_QUALIFIED')])
allowedPrefix='docs/qualification/candidates/read-continuation-20261012/domain-source-next/'
allowedReport='docs/coordination/reports/CODEX-DOMAIN-SOURCE-NEXT-20261012.md'
changed=git('diff','--name-only',BASE,cwd=ROOT).decode().splitlines()
untracked=git('ls-files','--others','--exclude-standard',cwd=ROOT).decode().splitlines()
check('only allocated documentation paths changed',all(p.startswith(allowedPrefix) or p==allowedReport for p in changed+untracked))
tracked=git('diff','--name-status',BASE,cwd=ROOT).decode().splitlines()
check('no existing baseline file changed',all(line.startswith('A\t') for line in tracked))
check('no production changes',not any(p.startswith(('apps/','packages/','scripts/')) for p in changed+untracked))
if '--packet' in sys.argv:
 for row in load('manifest.json')['members']:
  f=ROOT/row['path'];raw=f.read_bytes()
  check('packet '+row['path'],len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'])
print(json.dumps({'passed':len(checks),'failed':0,'scope':'Offline metadata/source text integrity only; no private code or runtime executed','checks':checks},indent=2))
