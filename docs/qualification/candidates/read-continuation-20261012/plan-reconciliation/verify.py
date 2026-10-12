#!/usr/bin/env python3
"""Offline document/source identities only. No project imports or network."""
import hashlib,json,subprocess,zipfile,io,xml.etree.ElementTree as E
from pathlib import Path
P=Path(__file__).resolve().parent;ROOT=P.parents[4];n=0

def check(ok,msg):
 global n
 if not ok:raise AssertionError(msg)
 n+=1

def read(name):return json.loads((P/name).read_text())
def raw(ref,path):return subprocess.check_output(['git','-C',str(ROOT),'show',ref+':'+path])
s=read('source-identities.json');base=s['base']
for x in s['files']:
 b=raw(x['ref'],x['path']);check(len(b)==x['bytes'],x['path']+' length');check(hashlib.sha256(b).hexdigest()==x['sha256'],x['path']+' hash')
w=read('workbook-requirements.json');check(len(w['rows'])==705,'705 workbook rows');seen=set()
for row in w['rows']:
 k=(row['locator']['sheet'],row['locator']['row']);check(k not in seen,'unique row');seen.add(k);check(bool(row['originalFields']) and bool(row['blockerOrNextReceipt']) and bool(row['owner']),'original and status');check(row['runtimeQualification']=='not-established-by-this-lane','no runtime pass')
original=json.loads(raw(base,'docs/plans/revisions/20261010-R2/inventory-stored-cells.json'));expected={(s['name'],int(r['row'])) for s in original if s['name']!='Overview' for r in s['rows'] if int(r['row'])>=8};check(seen==expected,'every data row covered')
check(sum('formula' in c for s in original for r in s['rows'] for c in r['cells'])==18,'18 untouched formulas')
for sh in original:
 if sh['name']=='Overview':continue
 header={c['cell'].rstrip('0123456789'):c.get('value','') for r in sh['rows'] if r['row']=='7' for c in r['cells']}
 lookup={r['locator']['row']:r for r in w['rows'] if r['locator']['sheet']==sh['name']}
 for r in sh['rows']:
  if int(r['row'])<8:continue
  fields={header[c['cell'].rstrip('0123456789')]:c.get('value','') for c in r['cells']}
  check(lookup[int(r['row'])]['originalFields']==fields,'exact original fields')
lines=read('plan-line-coverage.json')['units'];by={}
for r in lines:by.setdefault(r['locator']['path'],[]).append(r)
for path,rs in by.items():
 ls=raw(base,path).decode().splitlines();check(len(rs)==len(ls),'all lines');check([r['locator']['line'] for r in rs]==list(range(1,len(ls)+1)),'line sequence');check([r['text'] for r in rs]==ls,'line bytes')
d=read('original-docx-coverage.json');ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with zipfile.ZipFile(io.BytesIO(raw(base,'docs/plans/Meri_Greenfield_Agent_Plan.docx'))) as z:ps=E.fromstring(z.read('word/document.xml')).findall('.//w:p',ns)
texts=[''.join(n.text or '' for n in p.findall('.//w:t',ns)) for p in ps];check([r['text'] for r in d['paragraphs']]==texts,'all docx paragraphs');check(len(texts)==315 and sum(bool(t) for t in texts)==307,'paragraph units explicit')
ids=read('normative-id-ledger.json')['requirements'];check(len(ids)==53,'53 explicit identifiers')
for prefix,start,end in [('W',0,11),('R-',1,12),('REL-',1,9),('RG-',1,12)]:check({r['id'] for r in ids if r['id'].startswith(prefix)}=={prefix+str(i).zfill(2) for i in range(start,end+1)},prefix+' full coverage')
check({r['id'] for r in ids if r['id'].startswith('G')}=={'G'+str(i) for i in range(8)},'all gates')
c=read('current-source-boundary.json');check((c['originals'],c['selected'],c['deferred'],c['typedOperations'])==(139,96,43,67),'original counts');check(c['allHandlerNull'],'null handlers');catalog=json.loads(raw(c['readSource'],'packages/contracts/retrieval-0.2/catalog.json'));check([(o['id'],o['version'],o['nativeCoverage']) for o in c['operations']]==[(o['operation']['id'],o['operation']['version'],'partial' if o['operation']['id']=='query_action_items' else None) for o in catalog['operations']],'exact ordered nested operation identities');check(b"id: 'query_action_items', nativeId: 'query_action_items', nativeCoverage: 'partial'" in raw(c['readSource'],'packages/contracts/retrieval-0.2/catalog-validation.mjs'),'canonical partial registry declaration');check(c['canonicalStates'].get('mapped')==66 and c['canonicalStates'].get('pending')==30,'66/30');check(len(read('coverage-summary.json')['quickSkills'])==14,'14 separate workflows');check(all(g['runtimeQualified'] is False for g in read('groups.json')),'no group runtime pass')
byid={r['originalId']:r for r in w['rows'] if r['locator']['sheet']=='New Meri'}
for key,needed in [('N-084','schedules'),('N-028','retention'),('N-033','security'),('N-001','deployment')]:check(needed in [byid[key]['group']]+byid[key]['additionalGroups'],'cross-cutting owner '+key)
for key,needed in [('REL-05','sdk'),('REL-09','deployment'),('REL-09','process'),('REL-09','benchmark')]:
 row=next(r for r in w['rows'] if r['originalId']==key and r['locator']['sheet']=='Deployment work');check(needed in [row['group']]+row['additionalGroups'],'cross-cutting ticket '+key)
# Exact input duplicates, no claims from filenames alone.
for a,b in [('docs/plans/Meri_Greenfield_Agent_Plan.docx','docs/handover/20261012/inputs/Meri_Greenfield_Agent_Plan.original.docx'),('docs/plans/MERI-DEPLOYMENT.md','docs/plans/revisions/20261010-R2/Meri_Codex_Hermes_Deployment_Plan-R2.md'),('docs/plans/archive/MERI-DEPLOYMENT-20261010-before-R2.md','docs/handover/20261012/inputs/Meri_Codex_Hermes_Deployment_Plan.original.md')]:check(raw(base,a)==raw(base,b),'duplicate bytes '+a)
print(json.dumps({'status':'PASS','checks':n,'base':base,'productTestsRun':False,'runtimeActions':False}))
