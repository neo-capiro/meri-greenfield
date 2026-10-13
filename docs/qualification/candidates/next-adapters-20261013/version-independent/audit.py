"""Exact four package-version expectation changes; read-only source proof."""
from pathlib import Path
import hashlib,json,re,subprocess
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[4]
SOURCE='951a7021852b5205357c6780ed2c27527bab9d4d';BASE='a2aef4a5fcd3c19cec974dc62b69222836d71b3e';PR54='70516e5c9681917ce493bbc50e3023494f2e1209'
def git(*a):return subprocess.check_output(['git','-C',str(ROOT),*a],timeout=30)
def sha(b):return hashlib.sha256(b).hexdigest()
checks=[]
def check(name,value):checks.append({'name':name,'pass':bool(value)});assert value,name
check('exact source tree',git('rev-parse',SOURCE+'^{tree}').decode().strip()=='02f3887314970794384e26db42a41fa5ca133375')
files=['packages/contracts/test/retrieval-'+n+'.test.mjs' for n in ['mail','meeting-source','memory-proposals','operational-reads']]
changed=git('diff','--name-only',BASE,SOURCE,'packages','apps','infra','evals').decode().splitlines()
check('only four executable/assertion paths changed',set(changed)==set(files) and len(changed)==4)
bindings=[]
for path in files:
 old=git('show',BASE+':'+path);new=git('show',SOURCE+':'+path)
 spaced=b"pkg.version, '0.1.0'" in old
 before=b"pkg.version, '0.1.0'" if spaced else b"pkg.version,'0.1.0'"
 after=b"pkg.version, '0.1.2'" if spaced else b"pkg.version,'0.1.2'"
 check('one exact version expectation '+path,old.count(before)==1)
 check('all other bytes/assertions unchanged '+path,old.replace(before,after)==new)
 check('review source file exact '+path,new==(ROOT/path).read_bytes())
 bindings.append({'path':path,'oldBlob':git('rev-parse',BASE+':'+path).decode().strip(),'newBlob':git('rev-parse',SOURCE+':'+path).decode().strip(),'oldSha256':sha(old),'newSha256':sha(new),'bytes':len(new),'onlyChange':"pkg.version expectation0.1.0→0.1.2"})
for path in ['packages/contracts/package.json','packages/contracts/README.md','packages/contracts/meri.schema.json','packages/contracts/retrieval-0.2','packages/contracts/validate.mjs','packages/contracts/dist','packages/contracts/document-application','apps/gateway','apps/control','apps/worker','infra','package.json','package-lock.json']:
 check('original owner/source byte/tree unchanged '+path,git('rev-parse',SOURCE+':'+path)==git('rev-parse',BASE+':'+path))
package=json.loads(git('show',SOURCE+':packages/contracts/package.json'))
check('published public package0.1.2',package['name']=='@capiro/meri-contracts' and package['version']=='0.1.2')
check('package exactly PR54',git('show',SOURCE+':packages/contracts/package.json')==git('show',PR54+':packages/contracts/package.json'))
check('public README exactly PR54',git('show',SOURCE+':packages/contracts/README.md')==git('show',PR54+':packages/contracts/README.md'))
readme=git('show',SOURCE+':packages/contracts/README.md').decode()
check('README distinguishes wire and package','The package version does not change the frozen wire protocol.' in readme and 'Additive document application receiver (package 0.1.2)' in readme)
schema=json.loads(git('show',SOURCE+':packages/contracts/meri.schema.json'))
check('wire schema remains0.1.0',schema['$id']=='urn:meri:contracts:0.1.0' and all(branch['properties']['contractVersion']['const']=='0.1.0' for branch in schema['$defs']['UIEvent']['oneOf']))
check('retrieval private exports/files remain excluded',not any('retrieval-0.2' in k for k in package['exports']) and 'retrieval-0.2' not in package['files'])
catalog=json.loads(git('show',SOURCE+':packages/contracts/retrieval-0.2/catalog.json'))
check('all production operation handlers stay null/unavailable',all(x['handler'] is None and x['availability']=='unimplemented' and x['qualification']=='pending' for x in catalog['operations']))
receiptBindings=[]
for name,tests,passed,failed in [('version-baseline.tap',90,86,4),('version-repaired.tap',90,90,0)]:
 path='docs/qualification/candidates/next-adapters-20261013/root/'+name;raw=git('show',SOURCE+':'+path);text=raw.decode()
 check('root retained count '+name,all(f'# {key} {n}\n' in text for key,n in [('tests',tests),('pass',passed),('fail',failed)]))
 receiptBindings.append({'path':path,'bytes':len(raw),'sha256':sha(raw),'tests':tests,'passed':passed,'failed':failed,'executionOwner':'root historical capture; inspected, not independently rerun baseline'})
raw=(OUT/'focused90.stdout.txt').read_bytes();capture=json.loads((OUT/'focused90.json').read_bytes());tap=raw.decode()
check('independent90 tests pass',all(f'# {key} {n}\n' in tap for key,n in [('tests',90),('pass',90),('fail',0)]))
check('independent captured source/cleanup',capture['reviewedCommit']==SOURCE and capture['returncode']==0 and not capture['timedOut'] and capture['processReaped'] and capture['ownedProcessGroupAbsent'])
check('independent raw hash exact',capture['stdoutSha256']==sha(raw) and capture['stderrSha256']==sha((OUT/'focused90.stderr.txt').read_bytes()))
report={'reviewedCommit':SOURCE,'reviewedTree':git('rev-parse',SOURCE+'^{tree}').decode().strip(),'baseCommit':BASE,'publicPackageSourcePR54':PR54,'verdict':'ACCEPT_SOURCE','publicPackageVersion':'0.1.2','wireContractVersion':'0.1.0','onlyFourVersionExpectationsChanged':True,'testBindings':bindings,'rootReceiptBindings':receiptBindings,'checks':checks,'passed':len(checks),'failed':0,'independentTests':90,'independentPass':90,'independentFail':0,'broad3217SuiteRerun':False,'nativeRuntimeAccepted':False}
(OUT/'verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'verdict':'ACCEPT_SOURCE','source':SOURCE,'checks':len(checks),'focusedTests':90}))
