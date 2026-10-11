"""Fixed disposable native schema composition; not production migration/auth."""
import argparse
import asyncio
import contextlib
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import time
import types
from urllib.parse import urlsplit,parse_qsl

SOURCE_NAMES=('fixture_config.py','native_auth_probe.py')
DIAGNOSTIC_NAMES=('native_output_capture.py','prisma_error_evidence.py')
RUNTIME={'schema':'/opt/meri-proxy/schema.prisma',
 'cli':'/opt/prisma/binaries/node_modules/prisma/build/index.js',
 'engine':'/opt/prisma/binaries/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x',
 'views':'/opt/meri-proxy-venv/lib/python3.13/site-packages/litellm/proxy/db/create_views.py'}
VIEWS=('LiteLLM_VerificationTokenView','MonthlyGlobalSpend','Last30dKeysBySpend','Last30dModelsBySpend',
 'MonthlyGlobalSpendPerKey','MonthlyGlobalSpendPerUserPerKey','DailyTagSpend','Last30dTopEndUsersSpend')
ENGINE='ac9d7041ed77bcc8a8dbd2ab6616b39013829574'
DISCOVERY='4fa4672b51d80d83caa27e3dddfb26e40fd0bad1'

def require(value,reason):
    if not value:raise ValueError(reason)

def sha(raw):return hashlib.sha256(raw).hexdigest()

def pairs(rows):
    v={}
    for k,x in rows:require(k not in v,'DUPLICATE');v[k]=x
    return v

def data(raw):return json.loads(raw.decode('utf-8'),object_pairs_hook=pairs,parse_constant=lambda _:require(False,'NONFINITE'))

def hashes(value,names):
    require(type(value)is dict and set(value)==set(names) and all(type(x)is str and re.fullmatch('[0-9a-f]{64}',x) for x in value.values()),'PIN_MAP')

def admission(raw,v):
    require(type(raw)is bytes and len(raw)<=4096 and sha(raw)==v['rootAdmissionSha256'],'ROOT_ADMISSION_HASH')
    a=data(raw)
    require(type(a)is dict and set(a)=={'schema','decision','runId','image','clock','sourceSha256','runtimeSha256','cleanupPlanSha256'},'ROOT_ADMISSION_SHAPE')
    require(a['schema']=='meri.native-combined.root-admission/1' and a['decision']=='ADMIT_ONE_COMBINED_SYNTHETIC_FIXTURE','ROOT_DECISION')
    require(a['runId']==v['runId'] and a['image']==v['proxyImage'],'ROOT_BINDING')
    require(a['clock']=={k:v[k] for k in ('t0Ms','startDeadlineMs','workDeadlineMs','cleanupDeadlineMs','originalC')},'ROOT_CLOCK')
    require(all(type(x)is int for x in a['clock'].values()),'ROOT_CLOCK_TYPES')
    hashes(a['sourceSha256'],SOURCE_NAMES);hashes(a['runtimeSha256'],RUNTIME)
    require(type(a['cleanupPlanSha256'])is str and re.fullmatch('[0-9a-f]{64}',a['cleanupPlanSha256']),'EXTERNAL_CLEANUP_PLAN')
    return a

def raw_source(path,expected,cap=32768):
    s=path.lstat();require(stat.S_ISREG(s.st_mode) and s.st_nlink==1 and 0<s.st_size<=cap,'SOURCE_FILE')
    raw=path.read_bytes();require(len(raw)==s.st_size and sha(raw)==expected,'SOURCE_HASH');return raw

def native_config_module(folder,a):
    raw=raw_source(folder/'fixture_config.py',a['sourceSha256']['fixture_config.py'])
    raw_source(folder/'native_auth_probe.py',a['sourceSha256']['native_auth_probe.py'])
    name='_meri_combined_native_config';require(name not in sys.modules,'PRELOADED_CONFIG')
    module=types.ModuleType(name);module.__file__=str(folder/'fixture_config.py');sys.modules[name]=module
    try:exec(compile(raw,module.__file__,'exec'),module.__dict__)
    finally:sys.modules.pop(name,None)
    return module

def diagnostic_modules(folder,pins):
    # Fixed private descriptor hashes, no -I sibling search or bytecode lookup.
    hashes(pins,DIAGNOSTIC_NAMES);modules=[]
    for name in DIAGNOSTIC_NAMES:
        path=folder/name;raw=raw_source(path,pins[name],65536)
        module=types.ModuleType('_meri_owner_'+path.stem);module.__file__=str(path)
        exec(compile(raw,str(path),'exec'),module.__dict__);modules.append(module)
    return tuple(modules)

def measured_evidence(controls,schema_result):
    records={name:json.dumps(controls[case],sort_keys=True,separators=(',',':')).encode() for name,case in (
     ('positiveEncryptedPrismaQuery','positive'),('wrongCaDenied','wrong-ca'),('wrongSanDenied','wrong-san'),
     ('plaintextDenied','plaintext'),('wrongPasswordScramDenied','wrong-password'),('nonownerRole','positive'))}
    records['nativeSchemaInitialized']=json.dumps(schema_result,sort_keys=True,separators=(',',':')).encode()
    return records

def activation(v,a,mounted,controls,schema_result,config_module,now_ms):
    require(type(now_ms)is int and v['t0Ms']<=now_ms<=v['startDeadlineMs'],'AUTH_ORIGINAL_60_SECOND_START_EXPIRED')
    require(set(controls)=={'positive','wrong-ca','wrong-san','plaintext','wrong-password'} and all(type(x)is dict and x.get('passed') is True for x in controls.values()),'MEASURED_TLS_REQUIRED')
    expected={'schemaInitialized':True,'viewsVerified':8,'grantsVerified':True,'ownerCredentialRevoked':True,'runtimeAdmitted':False}
    require(type(schema_result)is dict and set(schema_result)==set(expected) and all(type(schema_result[k])is type(x) and schema_result[k]==x for k,x in expected.items()),'MEASURED_SCHEMA_REQUIRED')
    work=(v['workDeadlineMs']-v['t0Ms'])//1000;cleanup=(v['cleanupDeadlineMs']-v['workDeadlineMs'])//1000
    require(work*1000==v['workDeadlineMs']-v['t0Ms'] and cleanup*1000==v['cleanupDeadlineMs']-v['workDeadlineMs'],'CANONICAL_INTEGER_SECONDS')
    config={'schema':'meri.native-auth.fixture/1','runId':v['runId'],'postgresImage':v['postgresImage'],'proxyImage':v['proxyImage'],
      'nativeUrlSha256':sha(mounted['database-url']),'workSeconds':work,'cleanupSeconds':cleanup}
    config_raw=json.dumps(config,sort_keys=True,separators=(',',':')).encode()
    evidence={name:sha(raw) for name,raw in measured_evidence(controls,schema_result).items()}
    evidence['ownedCleanupPlan']=a['cleanupPlanSha256']
    result={'schema':'meri.native-auth.activation/1','decision':'ADMIT_ONE_SYNTHETIC_NATIVE_AUTH_PROBE','runId':v['runId'],
     'configSha256':sha(config_raw),'imageSha256':v['proxyImage'],'sourceSha256':a['sourceSha256'],'linuxUid':10001,
     'notBeforeUnixMs':v['t0Ms'],'startDeadlineUnixMs':v['startDeadlineMs'],'workDeadlineUnixMs':v['workDeadlineMs'],
     'cleanupDeadlineUnixMs':v['cleanupDeadlineMs'],'mountedSha256':{k:sha(x) for k,x in mounted.items()},
     'tls':{'engineCommit':ENGINE,'discoveryCommit':DISCOVERY,'sslmode':'require','sslaccept':'strict',
       'sslcert':'/run/meri-native-auth/'+v['runId']+'/ca.pem','host':'meri-native-auth-pg','serverMinimumProtocol':'TLSv1.2'},
     'prerequisiteEvidenceSha256':evidence}
    act=json.dumps(result,sort_keys=True,separators=(',',':')).encode()
    # Reuse canonical validators before writing/launching, not a parallel schema.
    cf,validated=config_module.validate_activation(config_raw,act,sha(act),sources=a['sourceSha256'],now_ms=now_ms,uid=10001,platform='linux')
    config_module.validate_mounts(cf,validated,mounted)
    return config_raw,act

def read_mount(path,cap=16384):
    for p in (path,*path.parents):require(not p.is_symlink(),'MOUNT_LINK')
    before=path.lstat();require(stat.S_ISREG(before.st_mode) and before.st_nlink==1 and before.st_uid==10001 and stat.S_IMODE(before.st_mode)==0o400 and 0<before.st_size<=cap,'MOUNT_FILE')
    def key(s):return(s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC)
    with os.fdopen(fd,'rb') as stream:
        require(key(os.fstat(stream.fileno()))==key(before),'MOUNT_OPEN');raw=stream.read(cap+1);require(key(os.fstat(stream.fileno()))==key(before),'MOUNT_READ')
    require(key(path.lstat())==key(before) and len(raw)==before.st_size,'MOUNT_POST');return raw

@contextlib.contextmanager
def discard():
    saved=(os.dup(1),os.dup(2));null=os.open(os.devnull,os.O_WRONLY)
    try:os.dup2(null,1);os.dup2(null,2);yield
    finally:os.dup2(saved[0],1);os.dup2(saved[1],2);os.close(saved[0]);os.close(saved[1]);os.close(null)

def grant_sql():
    return ('REVOKE CREATE ON SCHEMA public FROM PUBLIC','REVOKE ALL ON SCHEMA public FROM meri_native_auth_app',
     'GRANT USAGE ON SCHEMA public TO meri_native_auth_app','GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO meri_native_auth_app',
     'GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO meri_native_auth_app')

async def revoked_owner_reconnect(check,deadline,native,diagnostics):
    """Require complete specific private P1000 evidence, never generic failure."""
    caught=None
    with native.capture_native_output(deadline) as captured:
        try:await check.connect()
        except Exception as error:caught=error
        finally:await check.disconnect()
        captured.check()
    captured.check();facts=captured.facts()
    stdout_bytes,stderr_bytes=captured.private_bytes()
    try:
        evidence=diagnostics.classify_native_output('wrong-password',stderr_bytes,
            expected_user='meri_fixture_owner',expected_host='meri-native-auth-pg',
            evidence_complete=facts['complete'] is True)
        typed=diagnostics.classify_exception('wrong-password',caught,evidence_complete=facts['complete'] is True)
        require(caught is not None and not stdout_bytes and facts['complete'] is True
            and evidence['complete'] is True and evidence['specificRejection'] is True
            and evidence['reason']=='PASSWORD_REJECTED' and typed['complete'] is True
            and 'TIMEOUT' not in typed['classes']
            and (typed['specificRejection'] is False or typed['reason']=='PASSWORD_REJECTED'),
            'OLD_OWNER_CREDENTIAL_NOT_REVOKED')
    finally:del stdout_bytes,stderr_bytes,caught

async def views_and_grants(owner_url,deadline,native,diagnostics):
    from prisma import Prisma
    from litellm.proxy.db.create_views import create_missing_views
    db=Prisma(datasource={'url':owner_url});await db.connect()
    try:
        await create_missing_views(db)
        rows=await db.query_raw("SELECT viewname FROM pg_views WHERE schemaname='public'")
        require(set(VIEWS)<=set(r['viewname'] for r in rows),'VIEWS_MISSING')
        for sql in grant_sql():await db.execute_raw(sql)
        rows=await db.query_raw("SELECT r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls,(d.datdba=r.oid) owns_database,has_schema_privilege(r.oid,'public','CREATE') schema_create,has_schema_privilege(r.oid,'public','USAGE') schema_usage,has_database_privilege(r.oid,d.oid,'CONNECT') database_connect,pg_has_role(r.oid,'meri_fixture_owner','MEMBER') owner_member FROM pg_roles r CROSS JOIN pg_database d WHERE r.rolname='meri_native_auth_app' AND d.datname=current_database()")
        require(len(rows)==1 and all(rows[0].get(k) is False for k in ('rolsuper','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls','owns_database','schema_create','owner_member')) and all(rows[0].get(k) is True for k in ('schema_usage','database_connect')),'APP_PRIVILEGE_DRIFT')
        rows=await db.query_raw("SELECT count(*)::int missing FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v','m') AND NOT (has_table_privilege('meri_native_auth_app',c.oid,'SELECT') AND has_table_privilege('meri_native_auth_app',c.oid,'INSERT') AND has_table_privilege('meri_native_auth_app',c.oid,'UPDATE') AND has_table_privilege('meri_native_auth_app',c.oid,'DELETE'))")
        require(len(rows)==1 and type(rows[0]['missing'])is int and rows[0]['missing']==0,'APP_DML_MISSING')
        rows=await db.query_raw("SELECT count(*)::int missing FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S' AND NOT (has_sequence_privilege('meri_native_auth_app',c.oid,'USAGE') AND has_sequence_privilege('meri_native_auth_app',c.oid,'SELECT'))")
        require(len(rows)==1 and type(rows[0]['missing'])is int and rows[0]['missing']==0,'APP_SEQUENCE_MISSING')
        # An ordinary LOGIN owner can change its own password; it cannot set NOLOGIN.
        await db.execute_raw('ALTER ROLE meri_fixture_owner PASSWORD NULL')
    finally:await db.disconnect()
    check=Prisma(datasource={'url':owner_url})
    await revoked_owner_reconnect(check,deadline,native,diagnostics)

def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__,allow_abbrev=False);p.add_argument('--run',required=True);p.add_argument('--deadline-ms',type=int,required=True);args=p.parse_args(argv)
    require(sys.platform=='linux' and os.getuid()==10001 and re.fullmatch('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',args.run),'FIXED_LINUX_UID_RUN')
    root=Path('/run/meri-native-owner')/args.run;desc=data(read_mount(root/'bootstrap.json'))
    require(type(desc)is dict and set(desc)=={'runtimeSha256','diagnosticSha256','deadlineMs'} and type(desc['deadlineMs'])is int and desc['deadlineMs']==args.deadline_ms,'BOOTSTRAP_DESCRIPTOR')
    hashes(desc['runtimeSha256'],RUNTIME)
    native,diagnostics=diagnostic_modules(Path(__file__).absolute().parent,desc['diagnosticSha256'])
    for key,path in RUNTIME.items():raw_source(Path(path),desc['runtimeSha256'][key],64*1024*1024)
    require(importlib.metadata.version('prisma')=='0.11.0' and importlib.metadata.version('litellm')=='1.104.2','RUNTIME_VERSION')
    owner=read_mount(root/'database-url').decode('ascii');parsed=urlsplit(owner)
    require(parsed.scheme=='postgresql' and parsed.hostname=='meri-native-auth-pg' and parsed.port==5432 and parsed.username=='meri_fixture_owner' and re.fullmatch('[0-9a-f]{64}',parsed.password or '') and parsed.path=='/meri_native_auth_'+args.run.replace('-','') and not parsed.fragment,'OWNER_URL')
    require(parse_qsl(parsed.query)==[('sslmode','require'),('sslaccept','strict'),('sslcert',str(root/'ca.pem'))],'OWNER_TLS')
    read_mount(root/'ca.pem');wall=time.time_ns()//1000000;mono=time.monotonic();deadline=mono+(args.deadline_ms-wall)/1000
    def remaining():
        require(abs(time.time_ns()//1000000-(wall+(time.monotonic()-mono)*1000))<=2000,'CLOCK_DRIFT')
        value=deadline-time.monotonic();require(value>1,'ORIGINAL_BOOTSTRAP_DEADLINE');return value
    env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/tmp','TMPDIR':'/tmp','DATABASE_URL':owner,
      'PRISMA_SCHEMA_ENGINE_BINARY':RUNTIME['engine'],'PRISMA_CLI_QUERY_ENGINE_TYPE':'binary','PRISMA_HIDE_UPDATE_MESSAGE':'true','CHECKPOINT_DISABLE':'1','LITELLM_LOCAL_MODEL_COST_MAP':'True'}
    with discard():
        completed=subprocess.run(['/usr/local/bin/node',RUNTIME['cli'],'db','push','--schema',RUNTIME['schema'],'--accept-data-loss','--skip-generate'],env=env,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,shell=False,timeout=remaining())
        require(completed.returncode==0,'DB_PUSH_FAILED')
        # Fresh disposable process, no ambient provider authority. No schema copy/SQL view clone.
        os.environ.clear();os.environ.update({k:v for k,v in env.items() if k!='DATABASE_URL'})
        async def bounded():
            async with asyncio.timeout(remaining()):await views_and_grants(owner,deadline,native,diagnostics)
        asyncio.run(bounded())
        remaining()
    print(json.dumps({'schemaInitialized':True,'viewsVerified':8,'grantsVerified':True,'ownerCredentialRevoked':True,'runtimeAdmitted':False},sort_keys=True));return 0

if __name__=='__main__':
    try:raise SystemExit(main())
    except Exception as error:print(json.dumps({'status':'NATIVE_BOOTSTRAP_REFUSED','errorType':type(error).__name__,'runtimeAdmitted':False}));raise SystemExit(2)
