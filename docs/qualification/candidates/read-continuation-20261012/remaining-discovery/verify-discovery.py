"""Metadata-only discovery verification. Does not import or execute source producers."""
import hashlib,json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[5]; evidence=pathlib.Path(__file__).resolve().parent
results=[]
def check(name,ok):
 results.append({'check':name,'passed':bool(ok)})
 if not ok: raise AssertionError(name)
def read(n):return json.loads((evidence/n).read_text())
snapshot=read('inventory-snapshot.json');refs=read('reference-identities.json'); families=read('candidate-families.json'); ledger=read('pending-disposition.json')
catalog=root/'packages/contracts/retrieval-0.2/catalog.json'
check('exact canonical catalog bytes',hashlib.sha256(catalog.read_bytes()).hexdigest()==snapshot['catalogSha256'])
check('original139 and selected96 deferred43',snapshot['originalCount']==139 and snapshot['selected']==96 and snapshot['deferred']==43)
check('mapped36 pending60 typed unavailable37',snapshot['mappedSelected']==36 and snapshot['pendingSelected']==60 and snapshot['typedUnavailable']==37)
expected={x['id'] for x in snapshot['pending']}; actual=[x['id'] for x in ledger['entries']]
check('full60 preserved exactly once',len(actual)==60 and len(set(actual))==60 and set(actual)==expected)
recommended=[i for f in families['families'] for i in f['operations']]
check('ten distinct recommended selected reads',len(recommended)==len(set(recommended))==10 and set(recommended)<=expected)
check('nine prior allocations excluded',len(snapshot['excludedAlreadyAllocated'])==9 and not(set(recommended)&set(snapshot['excludedAlreadyAllocated'])))
check('all recommended runtime false',all(f['runtimeAccepted'] is False for f in families['families']))
check('all pending selected remain unchanged',all(e['catalogState']=='pending' and e['catalogDisposition']=='selected' for e in ledger['entries']))
check('11 command or analysis and30 otherreads',ledger['commandOrAnalysisCount']==11 and ledger['otherSelectedReads']==30)
for row in refs['references']:
 for ref,prefix in [(refs['inventoryPin'],''),(refs['observedHead'],'observed')]:
  raw=subprocess.check_output(['git','-C','/workspace/capirov2','show',f'{ref}:{row["path"]}'])
  blob=subprocess.check_output(['git','-C','/workspace/capirov2','rev-parse',f'{ref}:{row["path"]}'],text=True).strip()
  check(row['path']+':'+ref[:7]+' length',len(raw)==row['bytes' if not prefix else 'observedBytes'])
  check(row['path']+':'+ref[:7]+' SHA',hashlib.sha256(raw).hexdigest()==row['sha256' if not prefix else 'observedSha256'])
  check(row['path']+':'+ref[:7]+' blob',blob==row['blob' if not prefix else 'observedBlob'])
 check(row['path']+': exact no drift',row['unchanged'] and row['blob']==row['observedBlob'])
base=snapshot['base']; originals=subprocess.check_output(['git','ls-tree','-r','--name-only',base],cwd=root,text=True).splitlines()
changed=subprocess.check_output(['git','diff','--name-only',base,'--',*originals],cwd=root,text=True).splitlines()
check('all original tracked files unchanged',not changed)
check('no shared source/catalog changes',not subprocess.check_output(['git','diff',base,'--','apps','packages','scripts','package.json','package-lock.json'],cwd=root))
print(json.dumps({'passed':len(results),'failed':0,'originalFilesUnchanged':len(originals),'referenceCount':len(refs['references']),'privateBodiesPublished':False,'sourceProducerExecuted':False,'runtimeAccepted':False,'checks':results},indent=2))
