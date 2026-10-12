"""Explicit local Docker read-only queries; empty config, no credential/context reads."""
from pathlib import Path
import datetime, hashlib, json, subprocess, time
root=Path(__file__).resolve().parents[5]
evidence=Path(__file__).resolve().parent
config=evidence/'docker-client-config-empty';config.mkdir(exist_ok=False)
(config/'config.json').write_text('{}\n')
base=['/usr/local/bin/docker','--config',str(config),'--host','unix:///var/run/docker.sock']
queries=[('docker-version',['version','--format','{{json .Server}}']),('docker-info',['info','--format','{"serverVersion":{{json .ServerVersion}},"images":{{json .Images}},"containers":{{json .Containers}},"containersRunning":{{json .ContainersRunning}},"securityOptions":{{json .SecurityOptions}},"cgroupVersion":{{json .CgroupVersion}},"cpus":{{json .NCPU}},"memoryTotal":{{json .MemTotal}}}']),('docker-images',['image','ls','--all','--digests','--no-trunc','--format','{{.ID}}'])]
receipts=[]
for label,args in queries:
    started=datetime.datetime.now(datetime.timezone.utc).isoformat();clock=time.monotonic()
    with (evidence/(label+'.stdout.bin')).open('xb') as out,(evidence/(label+'.stderr.bin')).open('xb') as err:
        child=subprocess.Popen(base+args,cwd=root,env={'PATH':'/usr/local/bin:/usr/bin:/bin','LANG':'C'},stdout=out,stderr=err)
        try:code=child.wait(timeout=5);timeout=False
        except subprocess.TimeoutExpired:child.kill();code=child.wait(timeout=2);timeout=True
    streams=[]
    for stream in ['stdout','stderr']:
        p=evidence/(label+'.'+stream+'.bin');data=p.read_bytes();streams.append({'file':p.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'postCaptureSizeWithin32KiB':len(data)<=32768})
    receipts.append({'argv':base+args,'startedAt':started,'elapsedSeconds':round(time.monotonic()-clock,6),'exitCode':code,'timeout':timeout,'ownedClientPid':child.pid,'ownedClientReaped':child.returncode is not None,'metadataOnly':True,'streams':streams})
(evidence/'daemon-metadata-receipts.json').write_text(json.dumps({'commands':receipts,'socket':'explicit local unix:///var/run/docker.sock','config':'task-owned empty config, sanitized client environment','noDaemonMutation':True,'noContainerOrImageLifecycleAction':True,'noDatabaseConnection':True,'noNativeNamespaceExecution':True,'limits':'5-second per-command wait; metadata output post-checked32KiB; no claim of admitted external watchdog'},indent=2)+'\n')
print(json.dumps({'commands':len(receipts),'exitCodes':[r['exitCode'] for r in receipts],'allClientsReaped':all(r['ownedClientReaped'] for r in receipts)}))
