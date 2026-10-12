"""Independent inert API/identity/cleanup controls for public inventory only."""
import ast
import hashlib
import json
from pathlib import Path
import stat
import sys
from types import SimpleNamespace

ROOT=Path(sys.argv[1]);LABEL=sys.argv[2];HERE=Path(__file__).resolve().parent
raw=(ROOT/'scripts/qualification/worker_runner_inventory.py').read_bytes();tree=ast.parse(raw)
scope={'Path':Path,'stat':stat,'hashlib':hashlib}
functions=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in {'identity','check_deadline','plain','ancestors','hash_file'}]
exec(compile(ast.Module(body=functions,type_ignores=[]),'public-inventory-inert','exec'),scope)
fake_tree=ast.parse((HERE/'hash-deadline-controls.py').read_bytes())
classes=[n for n in fake_tree.body if isinstance(n,ast.ClassDef) and n.name=='FakeFS']
fake_scope={'Path':Path,'stat':stat,'SimpleNamespace':SimpleNamespace}
exec(compile(ast.Module(body=classes,type_ignores=[]),'review-fake-filesystem','exec'),fake_scope)
FakeFS=fake_scope['FakeFS'];results=[]
def check(name,ok):results.append({'name':name,'passed':bool(ok)})
def call(fs,*,cap=10,allow_empty=False,clock=None):
 try:
  value=scope['hash_file']('/synthetic/input.bin',fs=fs,clock=clock or (lambda:fs.now),end=10,cap=cap,allow_empty=allow_empty)
  return value,None
 except Exception as exc:return None,(type(exc).__name__,str(exc))
def mutate_info(fs,method,when,values):
 original=getattr(fs,method)
 def wrapped(*args):
  info=original(*args)
  if when(fs,args):
   for k,v in values.items():setattr(info,k,v)
  return info
 setattr(fs,method,wrapped)
fs=FakeFS();fs.now=10;value,error=call(fs)
check('exact-start-deadline-refuses-with-no-port',error==('ValueError','runner inventory deadline') and fs.events==[])
fs=FakeFS();fs.now=9.999;value,error=call(fs)
check('strictly-before-deadline-preserves-success',error is None and value['bytes']==3 and fs.closed==1)
for key in ['clock','end']:
 fs=FakeFS()
 try:scope['ancestors']('/synthetic',fs,**{key:(lambda:0) if key=='clock' else 10});error=None
 except Exception as exc:error=(type(exc).__name__,str(exc))
 check('optional-pair-'+key+'-alone-refuses',error==('ValueError','runner ancestor deadline pair required') and fs.events==[])
fs=FakeFS('ancestor-lstat:/');scope['ancestors']('/synthetic',fs)
check('legacy-ancestors-no-pair-retains-original-walk',fs.events==['ancestor-lstat:/','ancestor-lstat:/synthetic'])
fs=FakeFS();fs.now=10
try:scope['ancestors']('/synthetic',fs,clock=lambda:fs.now,end=10);error=None
except Exception as exc:error=(type(exc).__name__,str(exc))
check('bounded-ancestors-exact-deadline-refuses',error==('ValueError','runner inventory deadline') and fs.events==[])
fs=FakeFS('ancestor-lstat:/')
try:scope['ancestors']('/synthetic',fs,clock=lambda:fs.now,end=10);error=None
except Exception as exc:error=(type(exc).__name__,str(exc))
check('bounded-ancestor-late-return-no-next-port',error==('ValueError','runner inventory deadline') and fs.events==['ancestor-lstat:/'])
fs=FakeFS('open');value,error=call(fs)
check('late-acquired-descriptor-closed-once-no-fstat',error==('ValueError','runner inventory deadline') and fs.closed==1 and 'opened-fstat' not in fs.events)
fs=FakeFS()
def raising_clock():
 if 'open' in fs.events:raise RuntimeError('synthetic clock failure')
 return fs.now
value,error=call(fs,clock=raising_clock)
check('clock-error-after-open-still-closes',error==('RuntimeError','synthetic clock failure') and fs.closed==1 and 'opened-fstat' not in fs.events)
fs=FakeFS();original=fs.close
def close_failure(fd):original(fd);raise OSError('synthetic close failure')
fs.close=close_failure;value,error=call(fs)
check('close-error-retained-no-final-named-port',error==('OSError','synthetic close failure') and fs.closed==1 and 'final-file-lstat' not in fs.events)
for name,values in [('hardlink',{'st_nlink':2}),('symlink',{'st_mode':stat.S_IFLNK|0o600}),('reparse',{'st_file_attributes':0x400})]:
 fs=FakeFS();mutate_info(fs,'lstat',lambda f,a:a[0]==Path('/synthetic/input.bin'),values);value,error=call(fs)
 check('original-plain-defense:'+name,error is not None and 'open' not in fs.events)
for name,values in [('file-id',{'st_ino':99}),('size',{'st_size':4}),('kind',{'st_mode':stat.S_IFDIR|0o700})]:
 fs=FakeFS();mutate_info(fs,'fstat',lambda f,a:f.fd_stats==1,values);value,error=call(fs)
 check('original-open-defense:'+name,error==('ValueError','runner open identity changed') and fs.closed==1 and fs.reads==0)
for field in ['st_mtime_ns','st_ctime_ns','st_ino','st_size']:
 fs=FakeFS();mutate_info(fs,'fstat',lambda f,a:f.fd_stats==2,{field:99});value,error=call(fs)
 check('original-post-read-identity:'+field,error==('ValueError','runner file changed while reading') and fs.closed==1 and 'final-file-lstat' not in fs.events)
fs=FakeFS();mutate_info(fs,'lstat',lambda f,a:f.file_stats==2 and a[0]==Path('/synthetic/input.bin'),{'st_ino':99});value,error=call(fs)
check('original-final-named-defense',error==('ValueError','runner named file changed') and fs.closed==1)
fs=FakeFS();value,error=call(fs,cap=2)
check('original-size-cap-no-open',error==('ValueError','runner file byte bound') and 'open' not in fs.events)
for name,data in [('growth',b'abcd'),('short',b'ab')]:
 fs=FakeFS();original_read=fs.read
 def read(fd,size,data=data):
  original_read(fd,size);return data if fs.reads==1 else b''
 fs.read=read;value,error=call(fs)
 check('original-byte-count:'+name,error==('ValueError','runner growing file refused' if name=='growth' else 'runner named file changed') and fs.closed==1)
fs=FakeFS();mutate_info(fs,'lstat',lambda f,a:a[0]==Path('/synthetic/input.bin'),{'st_size':0});mutate_info(fs,'fstat',lambda f,a:True,{'st_size':0})
def empty(fd,size):fs.reads+=1;fs.port('eof-read');return b''
fs.read=empty;value,error=call(fs,allow_empty=True)
check('existing-allow-empty-result-preserved',error is None and value=={'path':'/synthetic/input.bin','bytes':0,'sha256':hashlib.sha256(b'').hexdigest()} and fs.closed==1)
result={'sourceSha256':hashlib.sha256(raw).hexdigest(),'checks':results,'passed':sum(r['passed'] for r in results),'failed':sum(not r['passed'] for r in results),'privateSourceExecuted':False,'nativeExecution':False,'scope':'Public AST functions and synthetic FS/clock only'}
(HERE/(LABEL+'.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'passed':result['passed'],'failed':result['failed']}));sys.exit(0 if result['failed']==0 else 1)
