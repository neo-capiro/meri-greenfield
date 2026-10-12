"""Offline Git/reference/receipt audit; no producer, package, or service execution."""
import argparse,hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]
HERE=Path(__file__).resolve().parent
BASE='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8'
SOURCE='2084f947ede709dfea0705bf2b67e62c3e929438'
INITIAL='d8aa806dde5a0015769af913bf4a8a4c768951c6'
FILES=['packages/contracts/commands-0.2/memory-propose-validation.mjs','packages/contracts/commands-0.2/memory-propose.schema.json','packages/contracts/test/commands-memory-propose.test.mjs']
def git(*args,cwd=ROOT):return subprocess.check_output(['git',*args],cwd=cwd)
def tree(ref):
 out={}
 for row in git('ls-tree','-r','-z',ref).split(b'\0'):
  if row:
   left,path=row.split(b'\t',1);out[path.decode()]=left.decode()
 return out
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--packet');opt=ap.parse_args();checks=[]
 def check(name,value):
  checks.append({'name':name,'passed':bool(value)})
  if not value:raise AssertionError(name)
 base,source,current=tree(BASE),tree(SOURCE),tree('HEAD')
 check('all original entries preserved in exact author source',all(source.get(k)==v for k,v in base.items()))
 check('all original entries preserved in reviewer tree',all(current.get(k)==v for k,v in base.items()))
 identities=[]
 for path in FILES:
  b=git('show',SOURCE+':'+path);check(path+' exact review bytes',(ROOT/path).read_bytes()==b)
  identities.append({'path':path,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':source[path].split()[-1]})
 for path in FILES[:2]:check(path+' unchanged from initial candidate',git('show',INITIAL+':'+path)==git('show',SOURCE+':'+path))
 allowed={*FILES,'docs/coordination/tasks/CODEX-MEMORY-PROPOSE-20261012.md','docs/coordination/reports/CODEX-MEMORY-PROPOSE-20261012.md'}
 prefix='docs/qualification/candidates/backend-execution-20261012/memory-propose/'
 check('author source changes only allocated paths',all(p in allowed or p.startswith(prefix) for p in set(source)-set(base)))
 check('criteria before candidate inspection',json.loads((HERE/'criteria.json').read_text())['candidateInspected'] is False)
 refs=json.loads((HERE/'reference-identities.json').read_text())['sources']
 for ref in refs:
  for ident in ref['identities']:
   b=git('show',ident['commit']+':'+ref['path'],cwd=Path('/workspace/capirov2'))
   check(ref['path']+' '+ident['commit'][:7],len(b)==ident['bytes'] and hashlib.sha256(b).hexdigest()==ident['sha256'])
 for label in ['baseline-absent','initial31','exact31']:
  capture=json.loads((HERE/(label+'.json')).read_text())
  check(label+' owned group absent without timeout/kill',capture['ownedProcessGroupAbsent'] and not capture['timedOut'] and not capture['ownedGroupKillRequired'])
  for stream in capture['streams']:
   b=(ROOT/stream['path']).read_bytes();check(label+' stream '+stream['path'].split('.')[-2],len(b)==stream['bytes'] and hashlib.sha256(b).hexdigest()==stream['sha256'])
 check('expected absent-module baseline retained','ERR_MODULE_NOT_FOUND' in (HERE/'baseline-absent.stdout.bin').read_text())
 for label in ['initial31','exact31']:
  out=(HERE/(label+'.stdout.bin')).read_text();check(label+'31 passed','tests 31' in out and 'pass 31' in out and 'fail 0' in out and 'skipped 0' in out)
 # Scope source invariant supplements behavioral tests; it does not certify every possible side effect.
 module=(ROOT/FILES[0]).read_text()
 check('only canonical inert snapshot imported',module.count('import ')==1 and "from '../retrieval-0.2/operation-contracts.mjs'" in module)
 check('no clock/provider/source execution tokens',not any(x in module for x in ['Date.now','fetch(','proposeSaveMemory(','setTimeout(','process.env','createConnection']))
 check('whole command digest correlation','result.commandSha256!==canonicalSha256(command)' in module)
 check('pending-only result schema',json.loads((ROOT/FILES[1]).read_text())['$defs']['MemoryProposeResult']['properties']['status']=={'const':'pending'})
 if opt.packet:
  packet=tree(opt.packet);check('packet retains exact production and final author tests',all(packet[p]==source[p] for p in FILES))
  check('packet retains all original entries',all(packet.get(k)==v for k,v in base.items()))
 report={'scope':'LOCAL_SOURCE_ONLY','source':SOURCE,'sourceTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'reviewHead':git('rev-parse','HEAD').decode().strip(),'originalEntries':len(base),'sourceIdentities':identities,'checks':checks,'passed':len(checks),'failed':0}
 (HERE/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'passed':len(checks),'failed':0,'originalEntries':len(base)}))
if __name__=='__main__':main()
