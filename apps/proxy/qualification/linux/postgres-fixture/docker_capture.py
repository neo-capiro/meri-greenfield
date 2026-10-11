"""Bounded Linux Docker receipts, adapted from reviewed linux-run.py capture."""
import hashlib
import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import time

CAP=2*1024*1024

class DockerCapture:
    def __init__(self,output,deadline_ms):
        self.output=Path(output);self.deadline_ms=deadline_ms;self.count=0
        self.wall_origin=time.time_ns()//1000000;self.mono_origin=time.monotonic()

    def call(self,label,args,*,allowed=(0,),cleanup=False):
        self.count+=1
        if self.count>128:raise ValueError('DOCKER_CALL_CAP')
        anchored=self.wall_origin+(time.monotonic()-self.mono_origin)*1000
        if abs(time.time_ns()//1000000-anchored)>2000:raise ValueError('CLOCK_DRIFT')
        remaining=(self.deadline_ms-anchored)/1000
        if remaining<=.5:raise TimeoutError('ORIGINAL_DEADLINE')
        timeout=min(10 if cleanup else 45,remaining-.25)
        prefix=self.output/(str(self.count).zfill(2)+'-'+label)
        argv=['docker',*args];start=time.time_ns()//1000000;tick=time.monotonic()
        counts={'stdout':0,'stderr':0};written=dict(counts);failure=None;complete=False;code=None
        env={'PATH':'/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin','LANG':'C.UTF-8'}
        with Path(str(prefix)+'.stdout.bin').open('xb') as out,Path(str(prefix)+'.stderr.bin').open('xb') as err:
            p=subprocess.Popen(argv,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                shell=False,start_new_session=True,env=env)
            with selectors.DefaultSelector() as selector:
                for pipe,name,target in ((p.stdout,'stdout',out),(p.stderr,'stderr',err)):
                    os.set_blocking(pipe.fileno(),False);selector.register(pipe,selectors.EVENT_READ,(name,target))
                try:
                    while selector.get_map() or p.poll() is None:
                        anchored=self.wall_origin+(time.monotonic()-self.mono_origin)*1000
                        if abs(time.time_ns()//1000000-anchored)>2000:failure='CLOCK_DRIFT';break
                        if time.monotonic()-tick>=timeout:failure='TIMEOUT';break
                        for key,_ in selector.select(.05):
                            name,target=key.data;block=os.read(key.fileobj.fileno(),65536)
                            if not block:selector.unregister(key.fileobj);key.fileobj.close();continue
                            counts[name]+=len(block);kept=block[:max(0,CAP-written[name])]
                            target.write(kept);written[name]+=len(kept)
                            if len(kept)!=len(block):failure='BYTE_CAP';break
                        if failure:break
                    complete=not failure and not selector.get_map()
                finally:
                    if p.poll() is None or failure:
                        try:os.killpg(p.pid,signal.SIGKILL)
                        except ProcessLookupError:pass
                    for key in list(selector.get_map().values()):selector.unregister(key.fileobj);key.fileobj.close()
                    p.wait(timeout=max(.1,min(2,remaining)));code=p.returncode
        row={'argv':argv,'startedAtMs':start,'endedAtMs':time.time_ns()//1000000,'timeoutSeconds':timeout,
            'exitCode':code,'failure':failure,'captureComplete':complete,'observedBytes':counts,'retainedBytes':written}
        for name in counts:
            raw=Path(str(prefix)+'.'+name+'.bin').read_bytes()
            row[name]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
        with Path(str(prefix)+'.process.json').open('x') as f:json.dump(row,f,indent=2)
        if not complete or failure or code not in allowed:raise ValueError('DOCKER_CAPTURE_FAILED_'+label)
        return Path(str(prefix)+'.stdout.bin').read_bytes(),Path(str(prefix)+'.stderr.bin').read_bytes(),code

    def inspect(self,kind,identity,owner,image=None):
        raw,_,_=self.call('inspect-'+kind,[kind,'inspect',identity],cleanup=True)
        values=json.loads(raw)
        if type(values)is not list or len(values)!=1:raise ValueError('SINGLETON_INSPECT')
        v=values[0];labels=v['Config']['Labels'] if kind=='container' else v['Labels']
        if labels.get('meri.qualification.owner')!=owner:raise ValueError('FOREIGN_RESOURCE')
        if image is not None and v['Image']!=image:raise ValueError('IMAGE_DRIFT')
        return v

    def remove_container(self,name,owner,image):
        v=self.inspect('container',name,owner,image);identity=v['Id']
        self.call('remove-container',['container','rm','--force','--volumes',identity],cleanup=True)
        raw,err,code=self.call('absent-container',['container','inspect',identity],allowed=(1,),cleanup=True)
        if json.loads(raw)!=[] or b'No such container' not in err:raise ValueError('CONTAINER_ABSENCE_UNPROVEN')
        return identity

    def remove_network(self,name,owner):
        v=self.inspect('network',name,owner)
        if v.get('Containers') not in ({},None):raise ValueError('NETWORK_NOT_EMPTY')
        identity=v['Id'];self.call('remove-network',['network','rm',identity],cleanup=True)
        raw,err,code=self.call('absent-network',['network','inspect',identity],allowed=(1,),cleanup=True)
        if json.loads(raw)!=[] or b'not found' not in err.lower():raise ValueError('NETWORK_ABSENCE_UNPROVEN')
        return identity
