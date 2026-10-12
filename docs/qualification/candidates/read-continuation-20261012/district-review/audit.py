"""Bounded source/evidence audit; reads private Git objects for hashes/metadata only."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT=Path(__file__).resolve().parents[5]
E=Path(__file__).resolve().parent
BASE='fea47fdc68c7f0f22a335d3b16ba492c614b59d1'
SOURCE='c651a0ab75f416a06c91eff07a463d697adb0fa4'
AUTHOR='23c8ab5951b14766e001ff59b23371ffc41b60f4'
checks=[]
def check(name,ok):
    checks.append({'name':name,'pass':bool(ok)})
    if not ok:raise AssertionError(name)
def git(*args,repo=ROOT):return subprocess.check_output(['git','-C',str(repo),*args])
def blob(ref,path,repo=ROOT):return git('show',ref+':'+path,repo=repo)
def entries(ref):
    rows={}
    for line in git('ls-tree','-r',ref).decode().splitlines():
        meta,path=line.split('\t',1);rows[path]=meta.split()[2]
    return rows
old,source,author,review=map(entries,[BASE,SOURCE,AUTHOR,'HEAD'])
check('all base files exact in source',all(source.get(p)==h for p,h in old.items()))
check('all base files exact in final author',all(author.get(p)==h for p,h in old.items()))
check('all base files exact in review',all(review.get(p)==h for p,h in old.items()))
paths=['packages/contracts/retrieval-0.2/district-nexus-validation.mjs','packages/contracts/retrieval-0.2/district-nexus.schema.json','packages/contracts/test/retrieval-district-nexus.test.mjs']
identities=[]
for p in paths:
    data=blob(SOURCE,p)
    check('source frozen '+p, data==blob(AUTHOR,p)==(ROOT/p).read_bytes())
    identities.append({'path':p,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'blob':source[p]})
allowed={'docs/coordination/reports/CODEX-READ-CONTINUATION-DISTRICT-AUTHOR-20261012.md',*paths}
check('source adds only allocated paths',set(source)-set(old)==allowed)
check('metadata changes only author report/evidence',all(p.startswith('docs/qualification/candidates/read-continuation-20261012/district-author/') or p=='docs/coordination/reports/CODEX-READ-CONTINUATION-DISTRICT-AUTHOR-20261012.md' for p in set(author)|set(source) if author.get(p)!=source.get(p)))
manifest=json.loads((E/'reference-identities.json').read_text());private={}
for r in manifest['references']:
    p=r['path'];data=blob(manifest['sourceCommit'],p,Path('/workspace/capirov2'));private[p]=data
    check('private pinned identity '+p,len(data)==r['bytes'] and hashlib.sha256(data).hexdigest()==r['sha256'] and git('rev-parse',manifest['sourceCommit']+':'+p,repo=Path('/workspace/capirov2')).decode().strip()==r['blob'])
    check('private observed identity '+p,data==blob(manifest['observedCommit'],p,Path('/workspace/capirov2')))
schema=json.loads((ROOT/paths[1]).read_text());defs=schema['$defs'];module=(ROOT/paths[0]).read_text()
types=private['apps/api/src/district-nexus/r5-action-layer/r5-types.ts'].decode()
enums={m.group(1):re.findall(r"'([^']+)'",m.group(2)) for m in re.finditer(r'export type (\w+)\s*=([\s\S]*?);',types)}
fact=defs['DistrictNexusFact']['properties']
for name,values in [('R5FactSection',defs['DistrictNexusFactSection']['enum']),('R5FactBasis',fact['basis']['enum']),('R5AmountStage',fact['amountStage']['anyOf'][0]['enum']),('R5GeographyScope',fact['geography']['properties']['scope']['enum']),('R5Coverage',fact['coverage']['enum'])]:check('pinned enum '+name,enums[name]==values)
prisma=private['apps/api/prisma/schema.prisma'].decode();model=re.search(r'model DistrictNexusChange\s*\{([\s\S]*?)\n\}',prisma).group(1)
for key in ['changeKind','source','severity']:
    width=int(re.search(r'^\s*'+key+r'\s+String[^\n]*@db.VarChar\((\d+)\)',model,re.M).group(1));check('database character width '+key,defs['DistrictNexusChange']['properties'][key]['maxLength']==width)
check('effective date nullable in storage',bool(re.search(r'^\s*effectiveAt\s+DateTime\?',model,re.M)))
check('single canonical snapshot helper import',re.findall(r"import .* from '([^']+)'",module)==['./operation-contracts.mjs'])
check('no source effects in family',all(s not in module for s in ['fetch(', 'process.', 'setTimeout(', 'node:','@temporal','PrismaClient','openai']))
check('factory public interface only',re.findall(r'export function (\w+)',module)==['createDistrictNexusValidators'])
check('context transport has only binding and subject',set(defs['DistrictNexusContext']['properties'])=={'binding','subject'})
for kind in ['Context','Changes']:
    check('result wrapper '+kind,set(defs['DistrictNexus'+kind+'Result']['properties'])=={'binding','subject','data'})
check('disabled exact fields',set(defs['DistrictNexusDisabledData']['properties'])=={'available','reason'})
check('forty facts and thirty gaps',defs['DistrictNexusContextData']['properties']['facts']['maxItems']==40 and defs['DistrictNexusContextData']['properties']['gaps']['maxItems']==30)
check('twenty changes without cursor/total',defs['DistrictNexusChangesData']['properties']['changes']['maxItems']==20 and not {'total','nextCursor','cursor','complete'}&set(defs['DistrictNexusChangesData']['properties']))
check('reported facts may claim complete only locally','complete' in fact['coverage']['enum'] and 'complete' not in defs['DistrictNexusContextData']['properties'])
check('no observation discriminator proof','observationKind' not in defs['DistrictNexusChange']['properties'])
raws=[]
for name in ['prefreeze-independent','corrected-prefreeze-independent','exact-source-tests']:
    receipt=json.loads((E/(name+'.json')).read_text());check('owned group absent '+name,receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'] and not receipt['ownedGroupKillRequired'])
    for stream in receipt['streams']:
        b=(ROOT/stream['path']).read_bytes();check('raw stream '+name+' '+Path(stream['path']).suffix,len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256']);raws.append(stream)
    check('stderr empty '+name,not (E/(name+'.stderr.bin')).read_bytes())
newfiles=set(review)-set(old)
check('no entire private bodies copied',all(body not in (ROOT/p).read_bytes() for body in private.values() for p in newfiles if (ROOT/p).is_file()))
check('source whitespace',subprocess.run(['git','diff','--check',BASE,SOURCE],cwd=ROOT,capture_output=True).returncode==0)
record={'base':BASE,'source':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'author':AUTHOR,'authorTree':git('rev-parse',AUTHOR+'^{tree}').decode().strip(),'reviewHeadAtAudit':git('rev-parse','HEAD').decode().strip(),'originalFiles':len(old),'originalsPreserved':len(old),'checks':checks,'sourceIdentities':identities,'rawStreams':raws,'privateBodiesPublished':False,'privateSourceExecuted':False,'runtimeAndAuthority':'UNRUN_UNAVAILABLE'}
(E/'audit.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'checks':len(checks),'passed':sum(c['pass'] for c in checks),'originalsPreserved':len(old),'source':SOURCE}))
