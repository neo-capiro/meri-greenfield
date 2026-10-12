"""Source identity/ownership audit only; never starts product or source services."""
import hashlib, json, subprocess
from pathlib import Path
root=Path.cwd(); evidence=Path(__file__).parent
base='1f7bf122f6180534c8bd43ff93a4f102f1a4eaf8'; dependency='0463c80a521c0d0db83f3769b1511e54a4d8b3f5'
def git(*args): return subprocess.check_output(['git',*args],cwd=root)
def tree(ref):
    return {row.split(b'\t',1)[1].decode():row.split(b'\t',1)[0].decode() for row in git('ls-tree','-r',ref).splitlines()}
checks=[]
def check(name,okay):
    checks.append({'name':name,'passed':bool(okay)})
    if not okay: raise AssertionError(name)
a=tree(base); b=tree('HEAD')
expected={'apps/gateway/dispatch/operation-context.mjs','apps/gateway/dispatch/read-result-envelope.mjs','packages/contracts/retrieval-0.2/catalog-validation.mjs'}
changed={p for p in a if a[p]!=b.get(p)}
check('original source changes only three explicitly allocated files',changed==expected)
check('all original tests retained',all(a[p]==b.get(p) for p in a if '/test/' in p or p.endswith('.test.mjs')))
check('all public contracts retained',all(a[p]==b.get(p) for p in a if p.startswith('packages/contracts/') and '/retrieval-0.2/' not in p))
check('all lockfiles and production catalog retained',all(a[p]==b.get(p) for p in a if 'lock' in p or p.endswith('/catalog.json')))
p='packages/contracts/retrieval-0.2/catalog-validation.mjs'
check('binding change only literal dataset profile',git('show','HEAD:'+p).replace(b"    dispatchProfile: 'dataset-metadata/1',\n",b'')==git('show',base+':'+p))
check('no duplicate profile declarations',git('show','HEAD:'+p).count(b"dispatchProfile: 'dataset-metadata/1'")==1)
dep_paths=git('diff-tree','--no-commit-id','--name-only','-r',dependency).decode().splitlines()
source=[]
for path in dep_paths:
    check('exact accepted dependency '+path,git('show','HEAD:'+path)==git('show',dependency+':'+path))
for path in sorted(expected|{'apps/gateway/sources/dataset-metadata/handler.mjs','apps/gateway/test/dataset-metadata-handler.test.mjs'}):
    data=git('show','HEAD:'+path)
    check('working source equals frozen '+path,(root/path).read_bytes()==data)
    source.append({'path':path,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
for path in ['packages/contracts/retrieval-0.2/public-domain-registry.mjs','packages/contracts/retrieval-0.2/public-domain-datasets.json']:
    data=git('show','HEAD:'+path);source.append({'path':path,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
handler=(root/'apps/gateway/sources/dataset-metadata/handler.mjs').read_text()
for token in ['fetch(', 'process.env', 'setInterval(', 'createServer(', 'http:', 'https:']:
    check('handler has no outbound/ambient initializer '+token,token not in handler)
check('actual canonical resolver reused','resolveOperationContract(operation)' in handler and 'contract.assertOutput(result,{request})' in handler)
check('branded accepted provider reused','assertPublicDomainDatasetRegistry(registry)' in handler)
check('five field lineage wrapper','{binding:authority.binding,subject:authority.subject,operation,argumentsSha256,result}' in handler)
for path in evidence.glob('*.json'):
    try: receipt=json.loads(path.read_text())
    except (ValueError,UnicodeDecodeError): continue
    if 'ownedPidAndPgid' in receipt:
        check('owned group absent '+path.name,receipt['ownedProcessGroupAbsent'] and not receipt['timedOut'])
        for stream in receipt['streams']:
            raw=(root/stream['path']).read_bytes();check('raw stream retained '+stream['path'],len(raw)==stream['bytes'] and hashlib.sha256(raw).hexdigest()==stream['sha256'])
report={'base':base,'sourceCommit':git('rev-parse','HEAD').decode().strip(),'acceptedDependency':dependency,'acceptedDependencyFiles':dep_paths,'originalFiles':len(a),'originalFilesByteIdentical':len(a)-len(changed),'changedOriginals':sorted(changed),'sourceFiles':source,'checks':checks,'scope':'SOURCE_ONLY_NO_RUNTIME_ADMISSION'}
(evidence/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'checksPassed':len(checks),'originals':len(a),'unchanged':len(a)-len(changed),'sourceCommit':report['sourceCommit']}))
