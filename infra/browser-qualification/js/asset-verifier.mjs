// Finite installation verifier text, executed only by the reviewed guest loader.
// No provider/source credentials, imports or IO occur in this JavaScript module.
export const ASSET_VERIFIER = `import hashlib,json,os,stat,sys
root,expected=sys.argv[1],json.loads(sys.argv[2])
paths=('bootstrap.sh','host-evidence.py','host_evidence/__init__.py','host_evidence/admission.py','host_evidence/browser_capture.py','host_evidence/classification.py','host_evidence/cli.py','host_evidence/collection.py','host_evidence/config.py','host_evidence/evidence_io.py','host_evidence/export_protocol.py','host_evidence/poll.py','host_evidence/source_binding.py','seccomp.json')
assert tuple(expected)==paths and len(expected)==14
assert all(set(v)=={'bytes','sha256'} and type(v['bytes']) is int and 0<v['bytes']<=2097152 and type(v['sha256']) is str and len(v['sha256'])==64 and set(v['sha256'])<=set('0123456789abcdef') for v in expected.values())
assert sum(v['bytes'] for v in expected.values())<=29360128
package=os.path.join(root,'host_evidence')
manifest_path=os.path.join(root,'source-manifest.v2.json')
def directory(path,mode=None):
    s=os.lstat(path)
    assert stat.S_ISDIR(s.st_mode) and s.st_uid==0 and not(s.st_mode&0o022),'unsafe directory'
    assert mode is None or stat.S_IMODE(s.st_mode)==mode,'directory mode'
for path in ('/','/opt',root,package): directory(path,0o700 if path in (root,package) else None)
def tree(final):
    assert set(os.listdir(root))=={'bootstrap.sh','host-evidence.py','seccomp.json','host_evidence'}|({'source-manifest.v2.json'} if final else set()),'unexpected root members'
    assert set(os.listdir(package))=={p.split('/')[1] for p in paths if '/' in p},'unexpected package members'
    directory(root,0o700);directory(package,0o700)
def identity(s):
    return(s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_uid,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
def read(path,want,apply_mode=False):
    before=os.lstat(path)
    assert stat.S_ISREG(before.st_mode) and before.st_nlink==1 and before.st_uid==0 and before.st_size==want['bytes'],'unsafe file'
    if apply_mode:os.chmod(path,0o600,follow_symlinks=False)
    before=os.lstat(path)
    assert stat.S_IMODE(before.st_mode)==0o600,'file mode'
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|getattr(os,"O_BINARY",0))
    try:
        opened=os.fstat(fd)
        assert identity(before)==identity(opened),'path/open identity'
        chunks=[];total=0
        while total<=want['bytes']:
            part=os.read(fd,min(65536,want['bytes']+1-total))
            if not part:break
            total+=len(part);chunks.append(part)
        data=b''.join(chunks)
        assert identity(opened)==identity(os.fstat(fd))==identity(os.lstat(path)),'post-read identity'
        assert len(data)==want['bytes'] and hashlib.sha256(data).hexdigest()==want['sha256'],'content mismatch'
        return data
    finally:os.close(fd)
tree(False)
for name,want in expected.items():read(os.path.join(root,*name.split('/')),want,True)
manifest={'schema':'meri-browser-source/2','assets':[{'path':p,**expected[p]} for p in paths]}
raw=(json.dumps(manifest,sort_keys=True,separators=(',',':'),ensure_ascii=True)+'\\n').encode('ascii')
assert len(raw)<=32768
fd=os.open(manifest_path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|getattr(os,"O_BINARY",0),0o600)
try:
    at=0
    while at<len(raw):
        count=os.write(fd,raw[at:]);assert count>0;at+=count
    os.fsync(fd)
finally:os.close(fd)
assert read(manifest_path,{'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})==raw
tree(True)
for name,want in expected.items():read(os.path.join(root,*name.split('/')),want)
`;
