"""Genuine pinned native Prisma TLS controls; no LiteLLM lifespan or providers."""
import argparse
import asyncio
import contextlib
import json
import importlib.metadata
import os
from pathlib import Path
import signal
import stat
import sys
from urllib.parse import parse_qsl,urlsplit

class Discard:
    def __init__(self,fd):
        if type(fd)is not int or fd not in (1,2):raise ValueError('OUTPUT_DESCRIPTOR')
        self.fd=fd;self.count=0
    def fileno(self):
        # Prisma passes this object to Popen. These descriptors are already
        # redirected to devnull; never expose the saved original descriptors.
        return self.fd
    def write(self,text):
        self.count+=len(text)
        if self.count>2*1024*1024:raise ValueError('UPSTREAM_OUTPUT_BOUND')
        return len(text)
    def flush(self):pass

@contextlib.contextmanager
def discard_native_output():
    # Python redirects alone do not suppress inherited Rust-engine fd output.
    saved=[os.dup(1),os.dup(2)];sink=os.open(os.devnull,os.O_WRONLY)
    try:
        os.dup2(sink,1);os.dup2(sink,2)
        with contextlib.redirect_stdout(Discard(1)),contextlib.redirect_stderr(Discard(2)):yield
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
    host='meri-native-wrong-san' if case=='wrong-san' else ('meri-native-plain-pg' if case=='plaintext' else 'meri-native-auth-pg')
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
    try:
        async with asyncio.timeout(25):
            await client.connect()
            rows=await client.query_raw("SELECT current_user AS who, current_database() AS db, pg_backend_pid() AS pid, s.ssl, s.version, s.cipher, r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls, (d.datdba=r.oid) AS owns_database FROM pg_stat_ssl s JOIN pg_roles r ON r.rolname=current_user JOIN pg_database d ON d.datname=current_database() WHERE s.pid=pg_backend_pid()")
            if case!='positive':raise ValueError('NEGATIVE_CONNECTED')
            if len(rows)!=1:raise ValueError('PEER_ROW')
            row=rows[0]
            if not(row['who']=='meri_native_auth_app' and row['db']==expected_db and row['ssl'] is True
                and row['version'] in ('TLSv1.2','TLSv1.3') and type(row['pid'])is int
                and row['cipher'] and all(row[k] is False for k in ('rolsuper','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls','owns_database'))):raise ValueError('TLS_OR_NONOWNER_ROLE')
            result.update(passed=True,peer=row)
    except Exception as error:
        # Classification only: never print credential-bearing error/URL/native output.
        text=str(error).lower();code=getattr(error,'code',None)
        tls=('p1011' in text or code=='P1011' or 'tls' in text or 'ssl' in text)
        if case=='wrong-ca':specific=tls and any(x in text for x in ('certificate verify failed','unknown issuer','unable to get local issuer','self-signed certificate'))
        elif case=='wrong-san':specific=tls and any(x in text for x in ('hostname mismatch','certificate verify failed','not valid for','ip address mismatch'))
        elif case=='plaintext':specific=tls and any(x in text for x in ('does not support tls','does not support ssl','server does not support','ssl is not enabled'))
        elif case=='wrong-password':specific=code=='P1000' or 'p1000' in text or 'password authentication failed' in text or 'authentication failed' in text
        else:specific=False
        result.update(passed=bool(specific),errorType=type(error).__name__,specificRejection=bool(specific))
    finally:
        try:
            async with asyncio.timeout(3):await client.disconnect()
        except Exception:result.update(passed=False,disconnectUnknown=True)
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--run',required=True);parser.add_argument('--case',choices=('positive','wrong-ca','wrong-san','plaintext','wrong-password'),required=True);args=parser.parse_args()
    if sys.platform!='linux' or os.getuid()!=10001 or os.getgid()!=10001 or sys.version_info[:3]!=(3,13,5) or Path(sys.prefix)!=Path('/opt/meri-proxy-venv'):raise ValueError('NATIVE_RUNTIME_REQUIRED')
    if importlib.metadata.version('prisma')!='0.11.0':raise ValueError('PINNED_PRISMA_REQUIRED')
    if any(k.upper().startswith(('AWS_','ANTHROPIC_','OPENAI_','AZURE_','DATABASE_URL','PGPASSWORD','PRISMA_','SSL_CERT_')) or k.upper() in ('OPENSSL_CONF','REQUESTS_CA_BUNDLE','HTTPS_PROXY','HTTP_PROXY','ALL_PROXY') for k in os.environ):raise ValueError('SENSITIVE_ENV')
    import uuid
    if str(uuid.UUID(args.run))!=args.run:raise ValueError('RUN_UUID')
    signal.signal(signal.SIGALRM,lambda *_:(_ for _ in ()).throw(TimeoutError('PEER_DEADLINE')));signal.alarm(32)
    with discard_native_output():result=asyncio.run(probe(Path('/run/meri-native-auth')/args.run,args.case))
    signal.alarm(0);print(json.dumps(result,sort_keys=True));return 0 if result['passed'] else 1

if __name__=='__main__':
    try:raise SystemExit(main())
    except Exception as error:
        print(json.dumps({'status':'PEER_REFUSED','errorType':type(error).__name__,'runtimeAdmitted':False}));raise SystemExit(2)
