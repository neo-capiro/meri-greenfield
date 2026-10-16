import argparse, ctypes, datetime, hashlib, json, re, subprocess, tarfile, time
from pathlib import Path
task=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
for name in ['review','expected-sha256','reviewed-checkpoint','artifact-source','label']:parser.add_argument('--'+name,required=True)
args=parser.parse_args()
assert re.fullmatch('[0-9a-f]{64}',args.expected_sha256) and re.fullmatch('[a-z0-9-]+',args.label)
assert all(re.fullmatch('[0-9a-f]{40}',v) for v in [args.reviewed_checkpoint,args.artifact_source])
review=json.loads(Path(args.review).read_text())
assert review['passed'] is True
expected=args.expected_sha256
artifact=Path(review['artifact']['path']);assert hashlib.sha256(artifact.read_bytes()).hexdigest()==expected
consumer=task/('input-artifact-consumer-'+expected[:12]);target=consumer/'node_modules/@capiro/meri-contracts'
assert consumer.resolve().is_relative_to(task) and not consumer.exists()
expected_files={row['path']:row for row in review['files']};observed=[]
with tarfile.open(artifact,'r:gz') as archive:
 for member in archive:
  assert member.isfile() and not member.issym() and not member.islnk() and member.name in expected_files
  relative=member.name.removeprefix('package/');destination=target/relative
  assert destination.resolve().is_relative_to(target.resolve()) and '\\' not in relative and ':' not in relative
  raw=archive.extractfile(member).read();row=expected_files[member.name]
  assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256']
  destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(raw);observed.append(member.name)
assert set(observed)==set(expected_files) and len(observed)==35
class Memory(ctypes.Structure):
 _fields_=[('length',ctypes.c_ulong),('load',ctypes.c_ulong)]+[(n,ctypes.c_ulonglong) for n in ['totalPhysical','availablePhysical','totalPageFile','availablePageFile','totalVirtual','availableVirtual','availableExtendedVirtual']]
def capacity():
 m=Memory();m.length=ctypes.sizeof(m)
 if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)):raise RuntimeError('Normal capacity observation unavailable; no retry')
 return {'availableCommit':m.availablePageFile,'availablePhysical':m.availablePhysical}
before=capacity();assert before['availableCommit']>=1342177280,'Existing pure-test start margin unavailable; no Node launched'
other_canonical=Path(review['source']['contracts'])/'dist/conversation-application.mjs'
assert other_canonical.resolve().is_relative_to(task)
argv=['C:/Program Files/nodejs/node.exe','--max-old-space-size=128',str(task/'artifact-consumer-smoke.mjs'),str(consumer),str(other_canonical)]
start=datetime.datetime.now(datetime.timezone.utc).isoformat();clock=time.monotonic();stop=None;minimum=dict(before)
with (task/(args.label+'.stdout')).open('wb') as out,(task/(args.label+'.stderr')).open('wb') as err:
 p=subprocess.Popen(argv,cwd=task,stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
 while p.poll() is None:
  current=capacity();minimum={key:min(minimum[key],current[key]) for key in minimum}
  if time.monotonic()-clock>=120:stop='HARD_WALL_120S'
  if current['availableCommit']<1073741824:stop='ACTUAL_COMMIT_PRESSURE'
  if stop:p.kill();p.wait(timeout=5);break
  time.sleep(.1)
result={'artifactSource':args.artifact_source,'reviewedCheckpoint':args.reviewed_checkpoint,'artifactSha256':expected,'artifactIntegrity':review['artifact']['npmIntegrity'],'archiveChecksPassed':review['checksPassed'],'extractedExactFiles':len(observed),'consumerRoot':str(consumer),'argv':argv,'pid':p.pid,'startedAt':start,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'wallMs':round((time.monotonic()-clock)*1000,3),'exit':p.returncode,'stopReason':stop,'hardWallSeconds':120,'heapMiB':128,'ownedProcessRemains':p.poll() is None,'capacityBefore':before,'minimumObserved':minimum,'claim':'Independent actual extracted package consumer. One Node process, no test worker, generator, compiler, service, database, provider or native effect.'}
(task/(args.label+'.receipt.json')).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result));print((task/(args.label+'.stdout')).read_text());print((task/(args.label+'.stderr')).read_text())
raise SystemExit(p.returncode or (1 if stop else 0))
