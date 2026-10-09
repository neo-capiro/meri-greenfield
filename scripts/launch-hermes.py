"""Thin bounded launcher for the discovered Hermes 0.20.0 CLI, not a scheduler.

Only Codex invokes this after allocating a confirmed repository, reviewed base
commit, owned paths and one dedicated worktree. Text output is honestly labeled;
this installed CLI does not support stream-json or query-file flags.
"""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import subprocess
import threading
import time
import uuid

from windows_job import CREATE_SUSPENDED, WindowsJob
from hermes_session_id import is_valid_hermes_session_id, session_footer_ids

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--worktree', required=True, type=Path)
parser.add_argument('--base', required=True)
parser.add_argument('--query-file', required=True, type=Path)
parser.add_argument('--evidence', required=True, type=Path)
parser.add_argument('--owned-path', required=True, action='append')
parser.add_argument('--profile', choices=['default','capirophase04','capirophase58'], default='default')
parser.add_argument('--resume')
parser.add_argument('--timeout-seconds', type=int, default=3600)
parser.add_argument('--max-turns', type=int, default=40)
args = parser.parse_args()
if os.name != 'nt':
    parser.error('This launcher is qualified only on the discovered Windows host')
if not 1 <= args.timeout_seconds <= 3600 or not 1 <= args.max_turns <= 40:
    parser.error('Initial bounds are at most 3600 seconds and 40 turns')
if not re.fullmatch(r'[a-f0-9]{40}', args.base):
    parser.error('A real pinned 40-character base commit is required')
if args.resume is not None and not is_valid_hermes_session_id(args.resume):
    parser.error('Resume requires an explicit Hermes YYYYMMDD_HHMMSS_<6 lowercase hex> session ID')
worktree = args.worktree.resolve(strict=True)
query_file = args.query_file.resolve(strict=True)
if not query_file.is_relative_to(worktree) or not (worktree/'AGENTS.md').is_file():
    parser.error('Query file and repository instructions must be in the assigned worktree')
hermes = Path(r'C:\Users\neoma\AppData\Local\hermes\hermes-agent\venv\Scripts\hermes.exe')
if not hermes.is_file():
    parser.error('Discovered Hermes executable missing; rediscover instead of upgrading')
def git(*arguments):
    return subprocess.check_output(['git','-C',str(worktree),*arguments],text=True).strip()
if Path(git('rev-parse','--show-toplevel')).resolve() != worktree or git('rev-parse','HEAD') != args.base:
    parser.error('Worktree root or pinned base mismatch')
changed = set(filter(None,git('diff','--name-only','-z','HEAD').split('\x00')))
changed.update(filter(None,git('ls-files','--others','--exclude-standard','-z').split('\x00')))
if changed - set(args.owned_path) or (changed and not args.resume):
    parser.error('Unexpected worktree changes; inspect before launch/resume')
for name in args.owned_path:
    target=(worktree/name).resolve()
    if not target.is_relative_to(worktree) or name.startswith('/') or '\\' in name or '..' in Path(name).parts:
        parser.error('Owned paths must be relative and stay in the assigned worktree')
prompt=query_file.read_text(encoding='utf-8')
if 'UNASSIGNED' in prompt:
    parser.error('Task brief still has unassigned dependencies/worktree fields')
evidence=args.evidence.resolve()
evidence.mkdir(parents=True,exist_ok=False)
record={'invocationId':str(uuid.uuid4()),'base':args.base,'branch':git('branch','--show-current'),'worktree':str(worktree),'profile':args.profile,'queryFile':str(query_file),'resume':args.resume,'maxTurns':args.max_turns,'timeoutSeconds':args.timeout_seconds,'startedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'format':'captured-text; stream-json unsupported','status':'preparing','sessionIds':[]}
record_path=evidence/'process.json'
def save(): record_path.write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
save()
# Avoid ordinary inherited AWS/GitHub deployment credential resolution. This is
# process configuration, not an OS sandbox; local host-user access is unchanged.
remove_env={'ANTHROPIC_API_KEY','GH_TOKEN','GITHUB_TOKEN','HERMES_YOLO','HERMES_ALLOW_ALL','HERMES_SKIP_APPROVALS','HERMES_YOLO_MODE','HERMES_IGNORE_RULES','HERMES_IGNORE_USER_CONFIG','HERMES_SAFE_MODE','HERMES_ACCEPT_HOOKS','HERMES_CRON_SESSION','HERMES_GATEWAY_SESSION','HERMES_EXEC_ASK','_HERMES_GATEWAY'}
env={k:v for k,v in os.environ.items() if not k.upper().startswith(('AWS_','HERMES_KANBAN_')) and k.upper() not in remove_env}
empty=evidence/'empty-credentials.ini'; empty.write_text('',encoding='utf-8')
env.update(AWS_CONFIG_FILE=str(empty),AWS_SHARED_CREDENTIALS_FILE=str(empty),AWS_EC2_METADATA_DISABLED='true',GIT_CONFIG_COUNT='1',GIT_CONFIG_KEY_0='credential.helper',GIT_CONFIG_VALUE_0='')
env['GH_CONFIG_DIR']=str(evidence/'empty-gh-config')
env.update(PYTHONIOENCODING='utf-8',PYTHONUTF8='1')
command=[str(hermes),'-p',args.profile,'chat','--cli','-q',prompt,'-Q','--max-turns',str(args.max_turns),'--pass-session-id','--checkpoints','-t','terminal,file']
if args.resume: command += ['--resume',args.resume]
lock=worktree/'.hermes-session.lock'
lockfile=None
process=None
job=None
assigned=False
readers=[]
capture_errors=[]
cleanup_confirmed=False
launch_failed=False
try:
    lockfile=lock.open('x',encoding='utf-8')
    lockfile.write(record['invocationId']); lockfile.close()
    job=WindowsJob()
    flags=subprocess.CREATE_NO_WINDOW | CREATE_SUSPENDED
    process=subprocess.Popen(command,cwd=worktree,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',errors='replace',creationflags=flags)
    # Assignment happens while the child cannot execute or spawn descendants.
    # A failed assignment never resumes it; finally kills the suspended child.
    job.assign(process); assigned=True
    job.resume(process)
    record.update(pid=process.pid,status='running'); save()
    print(json.dumps({'pid':process.pid,'record':str(record_path),'status':'running'}),flush=True)
    def capture(stream,name):
        try:
            with (evidence/name).open('w',encoding='utf-8') as log:
                for line in stream:
                    channel='stderr' if name=='stderr.scrubbed.txt' else 'stdout'
                    for session_id in session_footer_ids((line,),stream=channel):
                        if session_id not in record['sessionIds']:
                            record['sessionIds'].append(session_id)
                    line=re.sub(r'(?i)(bearer\s+)[^\s"\']+',r'\1[REDACTED]',line)
                    line=re.sub(r'\b(?:sk-or-v1-|sk-ant-|ghp_|gho_)[A-Za-z0-9_-]+','[REDACTED]',line)
                    log.write(line); log.flush()
        except Exception as error:
            capture_errors.append({'stream':name,'errorType':type(error).__name__})
    readers=[threading.Thread(target=capture,args=(process.stdout,'stdout.scrubbed.txt'),daemon=True),threading.Thread(target=capture,args=(process.stderr,'stderr.scrubbed.txt'),daemon=True)]
    for thread in readers: thread.start()
    try:
        record['exitCode']=process.wait(timeout=args.timeout_seconds)
        record['status']='exited-unreviewed' if record['exitCode']==0 else 'failed-unreviewed'
    except subprocess.TimeoutExpired:
        record['status']='deadline-exceeded-unreviewed'
        job.terminate()
        record['exitCode']=process.wait(timeout=10)
except BaseException as error:
    launch_failed=True
    record.update(status='launcher-error-unreviewed',launcherErrorType=type(error).__name__)
finally:
    cleanup_errors=[]
    tree_empty=process is None
    if process is not None:
        record['pid']=process.pid
    if job is not None:
        try:
            # Job accounting can briefly include a parent whose process handle
            # has already signaled. Allow that bookkeeping to settle before
            # classifying the remaining count as surviving descendants.
            if process is not None and process.poll() is not None:
                job.wait_empty(timeout=0.5)
            remaining=job.active_processes()
            record['processesRemainingAtCleanup']=remaining
            if remaining:
                job.terminate()
                if process is not None and process.poll() is not None and record['status']=='exited-unreviewed':
                    record['status']='descendants-terminated-unreviewed'
                    launch_failed=True
            tree_empty=job.wait_empty(timeout=10)
        except Exception as error:
            cleanup_errors.append({'operation':'job-termination','errorType':type(error).__name__})
            tree_empty=False
        finally:
            # KILL_ON_JOB_CLOSE remains the final containment measure even
            # when querying or terminating the job failed.
            try:
                job.close()
            except Exception as error:
                cleanup_errors.append({'operation':'job-close','errorType':type(error).__name__})
                tree_empty=False
    if process is not None:
        try:
            if process.poll() is None and not assigned:
                process.kill()
            record['exitCode']=process.wait(timeout=10)
        except Exception as error:
            cleanup_errors.append({'operation':'parent-termination','errorType':type(error).__name__})
            tree_empty=False
        if not assigned:
            tree_empty=process.poll() is not None and not cleanup_errors
    reader_deadline=time.monotonic()+10
    for thread in readers:
        if thread.ident is not None:
            thread.join(timeout=max(0,reader_deadline-time.monotonic()))
    readers_finished=not any(thread.is_alive() for thread in readers)
    cleanup_confirmed=tree_empty and readers_finished and not cleanup_errors and not capture_errors
    record.update(treeEmptyConfirmed=tree_empty,readersFinished=readers_finished,cleanupConfirmed=cleanup_confirmed,cleanupErrors=cleanup_errors,captureErrors=capture_errors,finishedAt=dt.datetime.now(dt.timezone.utc).isoformat())
    if not cleanup_confirmed:
        record['status']='cleanup-incomplete-unreviewed'
        launch_failed=True
    try:
        record['resultCommit']=git('rev-parse','HEAD')
    except Exception as error:
        record['resultCommit']=None
        record['resultCommitErrorType']=type(error).__name__
        launch_failed=True
    save()
    # Preserve the writer lock whenever process-tree or evidence cleanup is
    # uncertain. Codex must inspect it before any retry or explicit resume.
    if cleanup_confirmed and lockfile is not None and lock.exists() and lock.read_text(encoding='utf-8')==record['invocationId']:
        lock.unlink()
print(json.dumps({k:record.get(k) for k in ['status','exitCode','sessionIds','resultCommit','cleanupConfirmed']}),flush=True)
if launch_failed or record.get('exitCode',1)!=0 or len(record['sessionIds'])!=1:
    raise SystemExit(1)
