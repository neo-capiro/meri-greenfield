"""AST-isolated public inventory functions, fake clock/FS only; no native calls.

Args: source root, receipt label. The fake paths are synthetic; no host path is
opened. Private collector/helper/diagnostic/supervisor are never loaded.
"""
import ast
import hashlib
import json
from pathlib import Path
import stat
import sys
from types import SimpleNamespace

ROOT=Path(sys.argv[1]);LABEL=sys.argv[2]
HERE=Path(__file__).resolve().parent
source_path=ROOT/'scripts/qualification/worker_runner_inventory.py'
source=source_path.read_bytes();tree=ast.parse(source)
selected=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in {'identity','check_deadline','plain','ancestors','hash_file'}]
assert len(selected)==5
scope={'Path':Path,'stat':stat,'hashlib':hashlib}
exec(compile(ast.Module(body=selected,type_ignores=[]),'isolated-public-inventory','exec'),scope)
class FakeFS:
    def __init__(self,late=None):
        self.now=0;self.late=late;self.events=[];self.after_expiry=[];self.closed=0;self.file_stats=0;self.fd_stats=0;self.reads=0
    def port(self,label):
        if self.now>=10 and label!='close':self.after_expiry.append(label)
        self.events.append(label)
        if label==self.late:self.now=10
    def info(self,directory=False):
        return SimpleNamespace(st_dev=1,st_ino=2,st_mode=(stat.S_IFDIR|0o700) if directory else (stat.S_IFREG|0o600),st_nlink=1,st_size=3,st_mtime_ns=4,st_ctime_ns=5,st_file_attributes=0)
    def lstat(self,path):
        if path==Path('/synthetic/input.bin'):
            self.file_stats+=1;self.port('initial-file-lstat' if self.file_stats==1 else 'final-file-lstat');return self.info()
        self.port('ancestor-lstat:'+str(path));return self.info(True)
    def open_read(self,path):self.port('open');return 47
    def fstat(self,fd):
        assert fd==47;self.fd_stats+=1;self.port('opened-fstat' if self.fd_stats==1 else 'final-fstat');return self.info()
    def read(self,fd,size):
        assert fd==47 and size==65536;self.reads+=1;self.port('data-read' if self.reads==1 else 'eof-read');return b'abc' if self.reads==1 else b''
    def close(self,fd):
        assert fd==47;self.closed+=1;self.port('close')

def run(late):
    fs=FakeFS(late)
    try:
        value=scope['hash_file'](Path('/synthetic/input.bin'),fs=fs,clock=lambda:fs.now,end=10,cap=10)
        status='RETURNED';error=None
    except Exception as exc:
        value=None;status='REFUSED';error=type(exc).__name__+':'+str(exc)
    acquired='open' in fs.events
    ok=(status=='RETURNED' and value['sha256']==hashlib.sha256(b'abc').hexdigest() and fs.closed==1) if late is None else (status=='REFUSED' and error=='ValueError:runner inventory deadline' and not fs.after_expiry and fs.closed==(1 if acquired else 0))
    return {'case':late or 'normal-success','passed':ok,'outcome':status,'error':error,'events':fs.events,'noncleanupPortsAfterExpiry':fs.after_expiry,'ownedCloseCount':fs.closed}
rows=[run(x) for x in [None,'ancestor-lstat:/','initial-file-lstat','open','opened-fstat','eof-read','final-fstat','close','final-file-lstat']]
result={'sourcePath':'scripts/qualification/worker_runner_inventory.py','sourceSha256':hashlib.sha256(source).hexdigest(),'sourceBytes':len(source),'checks':rows,'passed':sum(r['passed'] for r in rows),'failed':sum(not r['passed'] for r in rows),'scope':'AST-isolated public functions with inert fake FS and clock; no native calls or private-source execution','nativeExecution':False}
(HERE/(LABEL+'.json')).write_text(json.dumps(result,indent=2)+'\n')
(HERE/(LABEL+'.source.py.txt')).write_bytes(source)
print(json.dumps({'passed':result['passed'],'failed':result['failed'],'sourceSha256':result['sourceSha256']}))
sys.exit(0 if result['failed']==0 else 1)
