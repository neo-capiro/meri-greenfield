"""Bounded source-only capture; no install, native or external operation."""
import hashlib,json,os,pathlib,signal,subprocess,sys,time
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[4]
label=sys.argv[1];argv=sys.argv[2:];started=time.time()
assert not (HERE/(label+'.json')).exists(), 'Do not overwrite earlier evidence'
proc=subprocess.Popen(argv,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,
 env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','MERI_REVIEW_SOURCE_ROOT':str(ROOT),'npm_config_update_notifier':'false'})
timed_out=False
try:out,err=proc.communicate(timeout=180)
except subprocess.TimeoutExpired:
 timed_out=True;os.killpg(proc.pid,signal.SIGKILL);out,err=proc.communicate(timeout=10)
try:os.killpg(proc.pid,0);absent=False
except ProcessLookupError:absent=True
record={'argv':argv,'cwd':str(ROOT),'reviewedCommit':'123767d120e7286d0550fb8ba63166ea4ffcbd34',
 'worktreeHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip(),
 'timeoutSeconds':180,'timedOut':timed_out,'returncode':proc.returncode,'durationSeconds':round(time.time()-started,3),
 'processReaped':proc.poll() is not None,'ownedProcessGroupAbsent':absent,
 'stdoutBytes':len(out),'stderrBytes':len(err),'stdoutSha256':hashlib.sha256(out).hexdigest(),'stderrSha256':hashlib.sha256(err).hexdigest(),
 'evidenceKind':'local-source-only-process','nativeDatabase':False,'nativeRuntimeAcceptance':False}
(HERE/(label+'.stdout.txt')).write_bytes(out);(HERE/(label+'.stderr.txt')).write_bytes(err)
(HERE/(label+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
raise SystemExit(0 if proc.returncode==0 and not timed_out and absent else 1)
