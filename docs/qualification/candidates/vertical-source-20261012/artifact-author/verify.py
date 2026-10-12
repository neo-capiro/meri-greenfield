"""Offline exact artifact author packet integrity. No product/runtime imports."""
import pathlib,json,hashlib,subprocess,re
root=pathlib.Path(__file__).resolve().parents[5]
packet=pathlib.Path(__file__).resolve().parent
checks=[]
def check(name,value):
 checks.append({'name':name,'pass':bool(value)})
def digest(data):return hashlib.sha256(data).hexdigest()
def gitbytes(ref,path):return subprocess.check_output(['git','show',ref+':'+path],cwd=root)
manifest=json.loads((packet/'manifest.json').read_text())
for entry in manifest['members']:
 path=root/entry['path'];raw=path.read_bytes();check('member '+entry['path'],len(raw)==entry['bytes'] and digest(raw)==entry['sha256'])
source=json.loads((packet/'source-preservation.json').read_text())
for entry in source['newSources']:
 raw=gitbytes(source['source'],entry['path']);check('source '+entry['path'],len(raw)==entry['bytes'] and digest(raw)==entry['sha256'] and raw==(root/entry['path']).read_bytes())
def tree(ref):
 result={}
 for row in subprocess.check_output(['git','ls-tree','-r','-z',ref],cwd=root).split(b'\0'):
  if row:
   meta,path=row.split(b'\t',1);result[path]=meta
 return result
base=tree(source['base']);current=tree(source['source']);check('all8678originals',len(base)==8678 and all(current.get(k)==v for k,v in base.items()))
for entry in json.loads((packet/'reference-identities.json').read_text()):
 raw=gitbytes(entry['commit'],entry['path']);check('reference '+entry['path'],len(raw)==entry['bytes'] and digest(raw)==entry['sha256'])
for tag,tests,passed,failed in [('focused-first',19,19,0),('focused-second',27,26,1),('focused-repaired',30,30,0),('focused-overflow-image-repaired',32,32,0),('focused-canonical',34,34,0)]:
 record=json.loads((packet/(tag+'.json')).read_text());out=(packet/(tag+'.stdout.txt')).read_bytes();err=(packet/(tag+'.stderr.txt')).read_bytes();text=out.decode()
 check(tag+' raw',digest(out)==record['stdoutSha256'] and digest(err)==record['stderrSha256'])
 check(tag+' result',record['exitCode']==(1 if failed else 0) and f'tests {tests}\n' in text and f'pass {passed}\n' in text and f'fail {failed}\n' in text and 'skipped 0\n' in text)
 check(tag+' ownership',record['timeout'] is False and record['groupAbsent'] is True and record['sourceDiff']=='')
ws=json.loads((packet/'whitespace.json').read_text());before=gitbytes(ws['originalSource'],'apps/artifacts/process.mjs');after=gitbytes(ws['finalSource'],'apps/artifacts/process.mjs');check('whitespaceexactonebyte',before==after+b'\n')
for row in ws['checks']:
 out=(packet/('whitespace-'+row['tag']+'.stdout.txt')).read_bytes();err=(packet/('whitespace-'+row['tag']+'.stderr.txt')).read_bytes();check('whitespace '+row['tag'],digest(out)==row['stdoutSha256'] and digest(err)==row['stderrSha256'])
coverage=json.loads((packet/'coverage.json').read_text());check('allfourretained',{r['operation'] for r in coverage['obligations']}=={'create_word','create_excel','create_powerpoint','run_analysis'} and coverage['scopeReduction'] is False and all(r['unrun'] for r in coverage['obligations']))
check('nativeunjoined',coverage['nativePortableEvidence']['verifiedHere'] is False)
skills=json.loads((packet/'workflow-coverage.json').read_text());check('fourteenoriginalintents',len(skills['workflows'])==14 and all(r['sourceManifest'] is None for r in skills['workflows']))
api=json.loads((packet/'api.json').read_text());check('canonicalownership',api['registryChange'] is False and api['nativeQualified'] is False and api['modelAuthorityFields'] is False)
result={'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'checks':checks,'source':source['source'],'nativeExecution':False}
print(json.dumps(result,indent=2));raise SystemExit(0 if result['failed']==0 else 1)
