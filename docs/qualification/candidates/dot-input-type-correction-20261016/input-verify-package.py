"""Bounded stdlib verification of actual0.1.7 archive bytes, preserved siblings and additive metadata. No extraction or execution."""
import base64,hashlib,json,pathlib,tarfile
root=pathlib.Path(__file__).resolve().parent
package=root/'meri-greenfield/packages/contracts'; archive=root/'input-package/capiro-meri-contracts-0.1.7.tgz'
entries=[]
with tarfile.open(archive,'r:gz') as tar:
    for member in tar:
        if len(entries)>=128 or not member.isfile() or not member.name.startswith('package/') or member.size>8388608:raise ValueError('Unexpected member')
        relative=member.name[len('package/'):];path=(package/relative).resolve()
        if not path.is_relative_to(package.resolve()):raise ValueError('Path escaped')
        raw=tar.extractfile(member).read(8388609)
        if len(raw)!=member.size or raw!=path.read_bytes():raise ValueError('Package/source byte mismatch: '+relative)
        entries.append({'path':relative,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
if len(entries)!=35 or len(set(e['path'] for e in entries))!=35 or sum(e['bytes'] for e in entries)>16777216:raise ValueError('Package bound mismatch')
manifest=json.loads((package/'package.json').read_text())
if manifest['version']!='0.1.7' or manifest['exports']['./conversation-input']!={'types':'./dist/conversation-input.d.ts','default':'./dist/conversation-input.mjs'} or manifest['exports']['./conversation-input/schema']!='./dist/conversation-input.schema.json':raise ValueError('Input export mismatch')
baseline=json.loads((root/'input-tooling/preserved-inputs.json').read_text())
for relative,sha in baseline.items():
    if hashlib.sha256((root/'meri-greenfield'/relative).read_bytes()).hexdigest()!=sha:raise ValueError('Preserved byte drift: '+relative)
metadata=json.loads((package/'dist/conversation-input.metadata.json').read_text())
if metadata['packageVersion']!='0.1.7' or metadata['inputVersion']!='1.0.0' or len(metadata['browserImports'])!=1 or metadata['browserImports'][0]['path']!='./conversation-application.mjs':raise ValueError('Provenance mismatch')
for row in metadata['sources']:
    raw=(package/row['path']).read_bytes()
    if len(raw)!=row['bytes'] or hashlib.sha256(raw).hexdigest()!=row['sha256']:raise ValueError('Metadata source mismatch: '+row['path'])
raw=archive.read_bytes();pack=json.loads((root/'input-tooling/pack.stdout.txt').read_text(encoding='utf-8-sig'))[0]
integrity='sha512-'+base64.b64encode(hashlib.sha512(raw).digest()).decode()
if pack['integrity']!=integrity or pack['shasum']!=hashlib.sha1(raw).hexdigest() or pack['size']!=len(raw):raise ValueError('Pack digest mismatch')
result={'archive':archive.name,'bytes':len(raw),'unpackedBytes':sum(e['bytes'] for e in entries),'sha256':hashlib.sha256(raw).hexdigest(),'integrity':integrity,'entries':entries,'preservedFiles':len(baseline),'preservedBytes':True,'metadataSources':len(metadata['sources'])}
(root/'input-tooling/package-verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='entries'}))
