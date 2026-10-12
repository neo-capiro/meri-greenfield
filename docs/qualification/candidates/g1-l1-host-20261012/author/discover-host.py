"""Read-only bounded host and local Docker metadata discovery. No target runtime probes."""
from pathlib import Path
import hashlib
import importlib.metadata
import json
import os
import platform
import shutil
import stat
import subprocess
import time

HERE=Path(__file__).resolve().parent
RAW=HERE/'raw'
BINS=['postgres','initdb','pg_ctl','pg_controldata','psql','pg_config','docker','bwrap','unshare','python','python3','node']
# Enumeration is bounded to known conventional package directories; no recursive
# host search, symlink tree traversal or network mount walk is performed.
records=[]
for name in BINS:
 path=shutil.which(name)
 row={'name':name,'path':path,'targetRuntimeProbeExecuted':False}
 if path:
  p=Path(path);s=p.lstat();row.update(mode=stat.filemode(s.st_mode),size=s.st_size,isSymlink=p.is_symlink())
  if not p.is_symlink() and s.st_size<=16777216 and stat.S_ISREG(s.st_mode):row['sha256']=hashlib.sha256(p.read_bytes()).hexdigest()
 records.append(row)
known=[]
for item in ['/usr/lib/postgresql','/usr/local/pgsql','/opt/postgresql','/usr/bin/postgres','/usr/bin/initdb','/usr/bin/pg_ctl','/usr/bin/psql','/var/run/docker.sock','/proc/self/ns/user','/proc/self/ns/mnt','/proc/self/ns/net','/proc/self/ns/pid']:
 p=Path(item)
 try:
  s=p.lstat();row={'path':item,'exists':True,'mode':stat.filemode(s.st_mode),'uid':s.st_uid,'gid':s.st_gid,'bytes':s.st_size,'isSymlink':stat.S_ISLNK(s.st_mode)}
  if stat.S_ISLNK(s.st_mode):row['linkTarget']=os.readlink(item)
 except FileNotFoundError:row={'path':item,'exists':False}
 known.append(row)
status={}
for line in Path('/proc/self/status').read_text().splitlines():
 key,_,value=line.partition(':')
 if key in ['Uid','Gid','CapInh','CapPrm','CapEff','CapBnd','CapAmb','NoNewPrivs','Seccomp','Seccomp_filters','NSpid']:status[key]=value.strip()
packages={}
for name in ['psycopg','psycopg-binary','psycopg2','psycopg2-binary','httpx']:
 try:packages[name]={'installedDistributionVersion':importlib.metadata.version(name),'packageImported':False}
 except importlib.metadata.PackageNotFoundError:packages[name]={'installedDistributionVersion':None,'packageImported':False}
meta={'platform':platform.system(),'machine':platform.machine(),'kernel':platform.release(),'uid':os.getuid(),'gid':os.getgid(),'pythonInterpreterForMetadata':os.sys.executable,'binaries':records,'knownPaths':known,'processStatus':status,'pythonDistributions':packages,'osRelease':Path('/etc/os-release').read_text(),'targetRuntimeBinariesExecuted':False,'namespaceProbesExecuted':False,'scanScope':'PATH and enumerated conventional paths only; no claim of exhaustive filesystem absence'}
(HERE/'host-metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
docker=shutil.which('docker'); dpkg=shutil.which('dpkg-query');commands=[]
if dpkg:commands.append(('dpkg-postgresql', [dpkg,'-W','-f=${binary:Package}\t${Version}\t${db:Status-Status}\n','postgresql*','libpq*','python3-psycopg*']))
if docker:
 prefix=[docker,'--config',str(HERE/'docker-client-config-empty'),'--host','unix:///var/run/docker.sock']
 commands.extend([
 ('docker-version',prefix+['version','--format','{{json .}}']),
 ('docker-info',prefix+['info','--format','{"serverVersion":{{json .ServerVersion}},"operatingSystem":{{json .OperatingSystem}},"osType":{{json .OSType}},"architecture":{{json .Architecture}},"kernelVersion":{{json .KernelVersion}},"driver":{{json .Driver}},"securityOptions":{{json .SecurityOptions}},"cgroupDriver":{{json .CgroupDriver}},"cgroupVersion":{{json .CgroupVersion}},"images":{{json .Images}},"containers":{{json .Containers}},"containersRunning":{{json .ContainersRunning}},"cpus":{{json .NCPU}},"memoryTotal":{{json .MemTotal}},"rootDir":{{json .DockerRootDir}}}']),
 ('docker-images',prefix+['image','ls','--all','--digests','--no-trunc','--format','{{json .}}']),
 ('docker-context',prefix+['context','ls','--format','{"name":{{json .Name}},"current":{{json .Current}},"endpoint":{{json .DockerEndpoint}}}'])])
receipts=[]
for name,argv in commands:
 start=time.monotonic();started=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());env={k:os.environ[k] for k in ['PATH','LANG','LC_ALL','TZ'] if k in os.environ}
 try:
  r=subprocess.run(argv,cwd=HERE,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=10,check=False)
  out,err,code,timed=r.stdout,r.stderr,r.returncode,False
 except subprocess.TimeoutExpired as e:out,err,code,timed=e.stdout or b'',e.stderr or b'',None,True
 # Commands request narrow metadata only. An unexpected large response is retained
 # as failure; this authoring capture does not claim a hard streaming byte cap.
 (RAW/(name+'.stdout.bin')).write_bytes(out);(RAW/(name+'.stderr.bin')).write_bytes(err)
 receipts.append({'name':name,'argv':argv,'startedUtc':started,'elapsedSeconds':time.monotonic()-start,'exitCode':code,'timeout':timed,'metadataOnly':True,'outputLimitExceeded':len(out)>65536 or len(err)>65536,'stdout':{'bytes':len(out),'sha256':hashlib.sha256(out).hexdigest()},'stderr':{'bytes':len(err),'sha256':hashlib.sha256(err).hexdigest()}})
(HERE/'metadata-commands.json').write_text(json.dumps({'commands':receipts,'dockerConfig':'Empty task-owned config; avoids reading user Docker credentials/contexts. Only explicit local UNIX socket queried.','mutationCommandsIssued':False},indent=2)+'\n')
print(json.dumps({'metadata':meta,'commands':[{'name':r['name'],'exitCode':r['exitCode'],'timeout':r['timeout'],'stdoutBytes':r['stdout']['bytes'],'stderrBytes':r['stderr']['bytes']} for r in receipts]},indent=2))
