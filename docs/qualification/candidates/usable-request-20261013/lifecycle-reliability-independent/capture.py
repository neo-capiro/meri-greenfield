#!/usr/bin/env python3
"""Bound only the explicitly owned review command and retain its raw evidence."""
import json,os,signal,subprocess,sys,time
from pathlib import Path
out=Path(__file__).resolve().parent
label=sys.argv[1]
command=sys.argv[2:]
assert label.replace('-','').isalnum() and command and command[0]=='node'
root=out.parents[4]
start=time.monotonic()
with (out/f'{label}.stdout.txt').open('xb') as stdout,(out/f'{label}.stderr.txt').open('xb') as stderr:
 process=subprocess.Popen(command,cwd=root,stdout=stdout,stderr=stderr,start_new_session=True)
 timeout=False
 try:
  code=process.wait(timeout=180)
 except subprocess.TimeoutExpired:
  timeout=True;os.killpg(process.pid,signal.SIGTERM)
  try:code=process.wait(timeout=2)
  except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);code=process.wait(timeout=2)
 try:os.killpg(process.pid,0);group_remaining=True
 except ProcessLookupError:group_remaining=False
 if group_remaining:
  os.killpg(process.pid,signal.SIGKILL)
  time.sleep(.1)
  try:os.killpg(process.pid,0);group_remaining=True
  except ProcessLookupError:group_remaining=False
receipt={'command':command,'sourceHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),
 'exitCode':code,'seconds':time.monotonic()-start,'outerTimeoutSeconds':180,'timeout':timeout,
 'ownedPid':process.pid,'leaderReaped':process.poll() is not None,'groupRemaining':group_remaining,'nativeQualified':False}
(out/f'{label}.receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
sys.exit(0 if code==0 and not timeout and not group_remaining else 1)
