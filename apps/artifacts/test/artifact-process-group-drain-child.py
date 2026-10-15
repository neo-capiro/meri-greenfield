"""Fixed test fixture: leaves one exited member (a zombie) in the owned process group whose parent has moved to
another session and reaps it only after argv[1] seconds. Writes that parent's pid to ./reaper.pid. No user input."""
import os,sys,time
delay=float(sys.argv[1])
reaper=os.fork()
if reaper==0:
    member=os.fork()
    if member==0:
        os._exit(0)
    os.setsid()
    with open('reaper.pid','w') as handle:
        handle.write(str(os.getpid()))
    null=os.open(os.devnull,os.O_RDWR)
    for fd in (0,1,2):
        os.dup2(null,fd)
    time.sleep(delay)
    os.waitpid(member,0)
    os._exit(0)
sys.exit(0)
