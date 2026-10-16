import ctypes, datetime, hashlib, json, subprocess, tarfile, time
from pathlib import Path
task=Path(__file__).resolve().parent
review=json.loads((task/'input-artifact-review.json').read_text())
assert review['passed'] is True
expected='53497d94c3f2b9ee0945f7d3398d621151702db17f5d9e2ffa37b7b915ba3614'
artifact=Path(review['artifact']['path']);assert hashlib.sha256(artifact.read_bytes()).hexdigest()==expected
consumer=task/'input-artifact-consumer-53497d94';target=consumer/'node_modules/@capiro/meri-contracts'
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
argv=['C:/Program Files/nodejs/node.exe','--max-old-space-size=128',str(task/'artifact-consumer-smoke.mjs'),str(consumer)]
start=datetime.datetime.now(datetime.timezone.utc).isoformat();clock=time.monotonic();stop=None;minimum=dict(before)
with (task/'input-artifact-smoke.stdout').open('wb') as out,(task/'input-artifact-smoke.stderr').open('wb') as err:
 p=subprocess.Popen(argv,cwd=task,stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
 while p.poll() is None:
  current=capacity();minimum={key:min(minimum[key],current[key]) for key in minimum}
  if time.monotonic()-clock>=120:stop='HARD_WALL_120S'
  if current['availableCommit']<1073741824:stop='ACTUAL_COMMIT_PRESSURE'
  if stop:p.kill();p.wait(timeout=5);break
  time.sleep(.1)
result={'artifactSource':'954f900cc1c5e250574b34ffe26b1dccbebef528','reviewedCheckpoint':'43142561c1b94f8d33d6db45a4a88a047929bd9a','artifactSha256':expected,'artifactIntegrity':review['artifact']['npmIntegrity'],'archiveChecksPassed':review['checksPassed'],'extractedExactFiles':len(observed),'consumerRoot':str(consumer),'argv':argv,'pid':p.pid,'startedAt':start,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'wallMs':round((time.monotonic()-clock)*1000,3),'exit':p.returncode,'stopReason':stop,'hardWallSeconds':120,'heapMiB':128,'ownedProcessRemains':p.poll() is None,'capacityBefore':before,'minimumObserved':minimum,'claim':'Independent actual extracted package consumer. One Node process, no test worker, generator, compiler, service, database, provider or native effect.'}
(task/'input-artifact-smoke.receipt.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result));print((task/'input-artifact-smoke.stdout').read_text());print((task/'input-artifact-smoke.stderr').read_text())
raise SystemExit(p.returncode or (1 if stop else 0))
