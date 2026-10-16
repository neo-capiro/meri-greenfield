import hashlib, json, pathlib, tarfile
root=pathlib.Path(__file__).resolve().parent
package=root/'meri-greenfield/packages/contracts'
archive=root/'history-package/capiro-meri-contracts-0.1.6.tgz'
entries=[]
with tarfile.open(archive,'r:gz') as tar:
    for member in tar:
        if len(entries)>=128 or not member.isfile() or not member.name.startswith('package/') or member.size>8388608:
            raise ValueError('Unexpected package member')
        relative=member.name[len('package/'):]
        path=(package/relative).resolve()
        if not path.is_relative_to(package.resolve()): raise ValueError('Package path escaped')
        raw=tar.extractfile(member).read(8388609)
        if len(raw)!=member.size or raw!=path.read_bytes(): raise ValueError('Package/source byte mismatch: '+relative)
        entries.append({'path':relative,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
if len(entries)!=31 or sum(row['bytes'] for row in entries)>16777216: raise ValueError('Package bound mismatch')
if len({row['path'] for row in entries})!=len(entries): raise ValueError('Duplicate package entry')
manifest=json.loads((package/'package.json').read_text())
if manifest['version']!='0.1.6' or manifest['exports']['./conversation-history']['default']!='./dist/conversation-history.mjs': raise ValueError('Public export mismatch')
baseline=json.loads((root/'history-tooling/preserved-inputs.json').read_text())
for row in baseline:
    if hashlib.sha256((root/'meri-greenfield'/row['path']).read_bytes()).hexdigest()!=row['sha256']: raise ValueError('Preserved byte drift')
result={'archive':archive.name,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'entries':entries,'preservedFiles':len(baseline),'preservedBytes':True}
(root/'history-tooling/package-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'entries':len(entries),'bytes':sum(row['bytes'] for row in entries),'preservedFiles':len(baseline),'preservedBytes':True,'archiveSha256':result['sha256']}))
