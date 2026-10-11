"""Genuine pinned native Prisma TLS controls; no LiteLLM lifespan or providers."""
import argparse
import asyncio
import contextlib
from datetime import timedelta
import json
import importlib.metadata
import os
from pathlib import Path
import signal
import stat
import sys
import time
import types
from urllib.parse import parse_qsl,urlsplit

DIAGNOSTIC_SOURCE_NAMES=('native_output_capture.py','prisma_error_evidence.py')

def diagnostic_modules():
    # -I excludes sibling lookup; execute only exact read-only mounted sources.
    # Initialization belongs here, not at import, and no .pyc/search path is used.
    modules=[]
    for name in DIAGNOSTIC_SOURCE_NAMES:
        path=Path(__file__).absolute().with_name(name)
        before=path.lstat()
        if (not stat.S_ISREG(before.st_mode) or before.st_nlink!=1
                or not 0<before.st_size<=65536
                or getattr(before,'st_file_attributes',0)&0x400):
            raise ValueError('DIAGNOSTIC_SOURCE_FILE')
        with path.open('rb') as stream:
            opened=os.fstat(stream.fileno())
            raw=stream.read(65537)
            after=os.fstat(stream.fileno())
        def identity(value):
            return (value.st_dev,value.st_ino,value.st_mode,value.st_nlink,
                    value.st_size,value.st_mtime_ns,value.st_ctime_ns)
        def cross_identity(value):
            # Windows lstat reports creation ctime, fstat reports modification
            # ctime. Same-accessor stability still uses the complete tuple.
            return identity(value)[:-1] if os.name=='nt' else identity(value)
        if (cross_identity(before)!=cross_identity(opened) or identity(after)!=identity(opened)
                or identity(path.lstat())!=identity(before) or len(raw)!=before.st_size):
            raise ValueError('DIAGNOSTIC_SOURCE_DRIFT')
        module=types.ModuleType('_meri_tls_'+path.stem)
        module.__file__=str(path)
        exec(compile(raw,str(path),'exec'),module.__dict__)
        modules.append(module)
    return tuple(modules)

def expected_host(case):
    return 'meri-native-wrong-san' if case=='wrong-san' else ('meri-native-plain-pg' if case=='plaintext' else 'meri-native-auth-pg')

class Discard:
    def __init__(self,fd,budget):
        if type(fd)is not int or fd not in (1,2):raise ValueError('OUTPUT_DESCRIPTOR')
        self.fd=fd;self.budget=budget
    def fileno(self):
        # Prisma passes this object to Popen. These descriptors are already
        # redirected to private capture/devnull; never expose saved descriptors.
        return self.fd
    def write(self,text):
        self.budget[0]+=len(text)
        if self.budget[0]>2*1024*1024:raise ValueError('UPSTREAM_OUTPUT_BOUND')
        return len(text)
    def flush(self):pass

@contextlib.contextmanager
def discard_native_output():
    # Python redirects alone do not suppress inherited Rust-engine fd output.
    saved=[os.dup(1),os.dup(2)];sink=os.open(os.devnull,os.O_WRONLY)
    try:
        os.dup2(sink,1);os.dup2(sink,2)
        budget=[0]
        with contextlib.redirect_stdout(Discard(1,budget)),contextlib.redirect_stderr(Discard(2,budget)):yield
    finally:
        os.dup2(saved[0],1);os.dup2(saved[1],2)
        for fd in (*saved,sink):os.close(fd)

def read(path):
    for p in (path,*path.parents):
        s=p.lstat()
        if stat.S_ISLNK(s.st_mode):raise ValueError('LINKED_INPUT')
    s=path.lstat()
    if not stat.S_ISREG(s.st_mode) or s.st_nlink!=1 or s.st_uid!=10001 or stat.S_IMODE(s.st_mode)!=0o400 or not 0<s.st_size<=4096:raise ValueError('INPUT_OWNERSHIP')
    def key(s):return(s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC)
    with os.fdopen(fd,'rb') as f:
        before=os.fstat(f.fileno())
        if key(before)!=key(s):raise ValueError('INPUT_OPEN_DRIFT')
        raw=f.read(4097)
        if key(os.fstat(f.fileno()))!=key(before):raise ValueError('INPUT_READ_DRIFT')
    if key(path.lstat())!=key(s) or len(raw)!=s.st_size:raise ValueError('INPUT_POST_DRIFT')
    return raw

async def probe(root,case):
    from prisma import Prisma
    url=read(root/(case+'-url')).decode('ascii')
    endpoint=urlsplit(url)
    host=expected_host(case)
    expected_db='meri_native_auth_'+root.name.replace('-','')
    ca=root/('wrong-ca.pem' if case=='wrong-ca' else 'ca.pem')
    # Validate the generated private mount again before handing anything to native code.
    import re
    if not(endpoint.scheme=='postgresql' and endpoint.hostname==host and endpoint.port==5432
        and endpoint.username=='meri_native_auth_app' and re.fullmatch('[0-9a-f]{64}',endpoint.password or '')
        and endpoint.path=='/'+expected_db and not endpoint.fragment
        and parse_qsl(endpoint.query,strict_parsing=True)==[('sslmode','require'),('sslaccept','strict'),('sslcert',str(ca))]):raise ValueError('EXACT_NATIVE_URL')
    read(ca)
    client=Prisma(datasource={'url':url})
    result={'case':case,'passed':False,'providerCalls':0,'runtimeAdmitted':False}
    caught=None
    try:
        async with asyncio.timeout(25):
            await client.connect(timeout=timedelta(seconds=3))
            rows=await client.query_raw("SELECT current_user AS who, current_database() AS db, pg_backend_pid() AS pid, s.ssl, s.version, s.cipher, r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls, (d.datdba=r.oid) AS owns_database FROM pg_stat_ssl s JOIN pg_roles r ON r.rolname=current_user JOIN pg_database d ON d.datname=current_database() WHERE s.pid=pg_backend_pid()")
            if case!='positive':
                result['negativeConnected']=True
                raise ValueError('NEGATIVE_CONNECTED')
            if len(rows)!=1:raise ValueError('PEER_ROW')
            row=rows[0]
            if not(row['who']=='meri_native_auth_app' and row['db']==expected_db and row['ssl'] is True
                and row['version'] in ('TLSv1.2','TLSv1.3') and type(row['pid'])is int
                and row['cipher'] and all(row[k] is False for k in ('rolsuper','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls','owns_database'))):raise ValueError('TLS_OR_NONOWNER_ROLE')
            result.update(passed=True,peer=row)
    except Exception as error:
        # Private caller-owned exception; never stringify or put it in result.
        caught=error
    finally:
        try:
            async with asyncio.timeout(3):await client.disconnect()
        except Exception:result.update(passed=False,disconnectUnknown=True)
    return result,caught

def finish_probe(case,outcome,stderr_bytes,capture_facts,diagnostics):
    """Compose sanitized observations only; private exceptions never escape."""
    result,error=outcome
    complete=capture_facts.get('complete') is True
    result['nativeCapture']=capture_facts
    if case=='positive':
        result['passed']=result['passed'] is True and error is None and complete and not stderr_bytes
        return result
    native=diagnostics.classify_native_output(case,stderr_bytes,
        expected_user='meri_native_auth_app',expected_host=expected_host(case),evidence_complete=complete)
    typed=diagnostics.classify_exception(case,error,evidence_complete=complete)
    result.update(exceptionEvidence=typed,nativeEvidence=native,specificRejection=False)
    observations=[value for value in (native,typed) if value['specificRejection'] is True]
    coherent=(typed['complete'] is True and (not stderr_bytes or
        (native['complete'] is True and native['specificRejection'] is True))
        and len({value['reason'] for value in observations})==1)
    passed=(error is not None and complete and coherent and bool(observations)
        and not result.get('negativeConnected',False) and not result.get('disconnectUnknown',False))
    result.update(passed=passed,specificRejection=passed)
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--run',required=True);parser.add_argument('--case',choices=('positive','wrong-ca','wrong-san','plaintext','wrong-password'),required=True);args=parser.parse_args()
    if sys.platform!='linux' or os.getuid()!=10001 or os.getgid()!=10001 or sys.version_info[:3]!=(3,13,5) or Path(sys.prefix)!=Path('/opt/meri-proxy-venv'):raise ValueError('NATIVE_RUNTIME_REQUIRED')
    if importlib.metadata.version('prisma')!='0.11.0':raise ValueError('PINNED_PRISMA_REQUIRED')
    if any(k.upper().startswith(('AWS_','ANTHROPIC_','OPENAI_','AZURE_','DATABASE_URL','PGPASSWORD','PRISMA_','SSL_CERT_')) or k.upper() in ('OPENSSL_CONF','REQUESTS_CA_BUNDLE','HTTPS_PROXY','HTTP_PROXY','ALL_PROXY') for k in os.environ):raise ValueError('SENSITIVE_ENV')
    import uuid
    if str(uuid.UUID(args.run))!=args.run:raise ValueError('RUN_UUID')
    deadline=time.monotonic()+32
    signal.signal(signal.SIGALRM,lambda *_:(_ for _ in ()).throw(TimeoutError('PEER_DEADLINE')))
    signal.setitimer(signal.ITIMER_REAL,max(.000001,deadline-time.monotonic()))
    try:
        native,diagnostics=diagnostic_modules()
        with discard_native_output():
            with native.capture_native_output(deadline) as captured:
                outcome=asyncio.run(probe(Path('/run/meri-native-auth')/args.run,args.case))
                captured.check()
            # Native child must have disconnected and closed its inherited FDs.
            captured.check()
            stdout_bytes,stderr_bytes=captured.private_bytes()
            del stdout_bytes
            result=finish_probe(args.case,outcome,stderr_bytes,captured.facts(),diagnostics)
            del outcome,stderr_bytes
        if time.monotonic()>=deadline:raise TimeoutError('PEER_DEADLINE')
    finally:
        signal.setitimer(signal.ITIMER_REAL,0)
    print(json.dumps(result,sort_keys=True));return 0 if result['passed'] else 1

if __name__=='__main__':
    try:raise SystemExit(main())
    except Exception as error:
        print(json.dumps({'status':'PEER_REFUSED','errorType':type(error).__name__,'runtimeAdmitted':False}));raise SystemExit(2)
