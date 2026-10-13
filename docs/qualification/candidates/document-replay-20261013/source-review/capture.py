"""Bounded process capture for the exact independent source review; no external access."""
import hashlib,json,os,pathlib,signal,subprocess,sys,time
HERE=pathlib.Path(__file__).resolve().parent
ROOT=pathlib.Path('/workspace/meri-document-replay-review')
label=sys.argv[1];argv=sys.argv[2:];started=time.time()
proc=subprocess.Popen(argv,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,
 env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','MERI_REVIEW_SOURCE_ROOT':str(ROOT)})
timed_out=False
try:out,err=proc.communicate(timeout=240)
except subprocess.TimeoutExpired:
 timed_out=True;os.killpg(proc.pid,signal.SIGKILL);out,err=proc.communicate(timeout=10)
record={'argv':argv,'cwd':str(ROOT),'reviewedCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip(),
 'timeoutSeconds':240,'timedOut':timed_out,'returncode':proc.returncode,'durationSeconds':round(time.time()-started,3),
 'processReaped':proc.poll() is not None,'environment':{'PYTHONDONTWRITEBYTECODE':'1','MERI_REVIEW_SOURCE_ROOT':str(ROOT)},
 'stdoutBytes':len(out),'stderrBytes':len(err),'stdoutSha256':hashlib.sha256(out).hexdigest(),'stderrSha256':hashlib.sha256(err).hexdigest(),
 'evidenceKind':'local-source-only-process','nativeDatabase':False,'nativeRuntimeAcceptance':False}
(HERE/(label+'.stdout.txt')).write_bytes(out);(HERE/(label+'.stderr.txt')).write_bytes(err)
(HERE/(label+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
raise SystemExit(0 if proc.returncode==0 and not timed_out else 1)
