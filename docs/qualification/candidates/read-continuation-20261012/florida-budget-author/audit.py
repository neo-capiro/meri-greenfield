"""Local metadata/source preservation only; private producer modules never execute."""
import hashlib,json,os,subprocess,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
BASE='c1c9bfde7dd466a0474589a224a99b44277adbc9';FREEZE='dabe2b50d94f0b12ef983292a1c18e1ef35d4675'
SOURCE=['packages/contracts/retrieval-0.2/florida-budget.schema.json','packages/contracts/retrieval-0.2/florida-budget-validation.mjs','packages/contracts/test/retrieval-florida-budget.test.mjs']
checks=[]
def check(label,okay):
 checks.append({'check':label,'pass':bool(okay)})
 if not okay:raise AssertionError(label)
def git(*args,repo=ROOT):return subprocess.check_output(['git','-C',str(repo),*args])
def sha(data):return hashlib.sha256(data).hexdigest()
refs=json.loads((HERE/'reference-identities.json').read_text())['references']
for ref in refs:
 for version in ['frozen','observed']:
  meta=ref[version];data=git('show',meta['commit']+':'+ref['path'],repo='/workspace/capirov2')
  check(ref['path']+' '+version+' bytes/hash',len(data)==meta['bytes'] and sha(data)==meta['sha256'])
  check(ref['path']+' '+version+' blob',git('rev-parse',meta['commit']+':'+ref['path'],repo='/workspace/capirov2').decode().strip()==meta['blob'])
 check(ref['path']+' no drift',ref['frozen']['blob']==ref['observed']['blob'] and ref['changed'] is False)
check('eleven independently repinned source pairs',len(refs)==11)
sourceRecords=[]
for path in SOURCE:
 raw=(ROOT/path).read_bytes();check('exact source freeze '+path,raw==git('show',FREEZE+':'+path))
 sourceRecords.append({'path':path,'bytes':len(raw),'sha256':sha(raw),'blob':git('rev-parse',FREEZE+':'+path).decode().strip()})
allowed=set(SOURCE)|{'docs/coordination/reports/CODEX-FLORIDA-BUDGET-AUTHOR-20261012.md'}
evidence='docs/qualification/candidates/read-continuation-20261012/florida-budget-author/'
changes=git('diff','--name-status',BASE).decode().splitlines();new=git('ls-files','--others','--exclude-standard').decode().splitlines()
check('all tracked changes are additions in allocated paths',all(line.startswith('A\t') and (line[2:] in allowed or line[2:].startswith(evidence)) for line in changes))
check('all untracked changes are allocated evidence',all(p.startswith(evidence) or p in allowed for p in new))
baseNames=git('ls-tree','-r','--name-only',BASE).decode().splitlines()
check('every original tracked file unchanged',not any(line[2:] in baseNames for line in changes))
# Preserve the original test prefix after three exact, documented corrections.
testPath=SOURCE[-1];original=git('show','86e3ce07f8d57369049bdf8ebe0fc2149cd1eb3f:'+testPath).decode()
fixed=original.replace('outputAssert:(validators,page,request,ctx)=>validators.assertResult(id,page,request,ctx)',"outputAssert:(validators,page,request,ctx,binding)=>validators.assertResult(id,page,request,Object.fromEntries(binding.contextKeys.map(key=>[key,ctx[key]])))")
fixed=fixed.replace("assert.equal(v.inputDefinition(id),'FloridaBudgetRequest')","assert.equal(v.inputDefinition(id),'FloridaBudgetInput')")
fixed=fixed.replace('assert.equal(check(p),p);','assert.deepEqual(check(p),p);assert.notStrictEqual(check(p),p);')
check('original test prefix preserved after exact fixture and two assertion corrections',(ROOT/testPath).read_text().startswith(fixed))
for commit,name in [('5691a6a456a8134326f3b65bb47d1f23a36aacda','client UUID identity survives'),('9ba91b44589e27340d5d62977a743350e5c57389','validated Florida output is detached')]:
 original=git('show',commit+':'+testPath).decode();start=original.index("test('"+name)
 check('unchanged regression '+name,original[start:].strip() in (ROOT/testPath).read_text())
receipts=[]
for label,expected in [('focused-initial',1),('focused-binding-repair',0),('client-cutoff-before',1),('focused-client-repair',0),('output-alias-before',1),('focused-output-repair',0),('focused-definition-alignment',0)]:
 receipt=json.loads((HERE/(label+'.json')).read_text());receipts.append(receipt)
 check(label+' expected exit',receipt['exitCode']==expected)
 check(label+' clean source capture',receipt['sourceDiffBytes']==0)
 check(label+' bounded cleanup',receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'] and not receipt['ownedGroupKillRequired'])
 try:os.killpg(receipt['ownedPidAndPgid'],0);absent=False
 except ProcessLookupError:absent=True
 check(label+' current group absent',absent)
 for stream in receipt['streams']:
  data=(ROOT/stream['path']).read_bytes();check(label+' '+Path(stream['path']).suffix+' stream hash',len(data)==stream['bytes'] and sha(data)==stream['sha256'])
# Verify copied dependency bytes against the untouched donor; no package execution.
donor=Path('/workspace/meri-read-continuation-20261012/node_modules')
for package in ['ajv','ajv-formats','canonicalize','fast-uri','fast-deep-equal','json-schema-traverse','require-from-string']:
 copied=ROOT/'node_modules'/package
 files=sorted(p.relative_to(copied) for p in copied.rglob('*') if p.is_file())
 check('minimal copied dependency '+package,all((copied/p).read_bytes()==(donor/package/p).read_bytes() for p in files))
if '--packet' in sys.argv:
 for row in json.loads((HERE/'manifest.json').read_text())['members']:
  data=(ROOT/row['path']).read_bytes();check('packet '+row['path'],len(data)==row['bytes'] and sha(data)==row['sha256'])
print(json.dumps({'passed':len(checks),'failed':0,'baseOriginalFiles':len(baseNames),'sourceFreeze':FREEZE,'sourceFiles':sourceRecords,'checks':checks},indent=2))
