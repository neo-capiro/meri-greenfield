"""Finite, fixed-instance qualification setup/restoration; no test supervision."""
import datetime, hashlib, json, pathlib, subprocess, sys, time
import psycopg
from psycopg import sql

EVIDENCE = pathlib.Path('/workspace/scratch/meri-native-invocation-run-20261012')
SOURCE = pathlib.Path('/workspace/scratch/meri-native-invocation-20261012')
ORIGINAL = 'meri_qualification'
ALIAS = 'meri_qualification_setup_invocation_20261012'
ARCHIVE = 'meri_qualification_invocation_20261012'
SCHEMAS = [ORIGINAL, 'meri_qualification_rc1_20261012', 'meri_qualification_rc1_20261012_repeat1', 'meri_qualification_budget_20261012']
DB = 'meri_qualification_test'
SDK_DB = 'meri_qualification_sdk_fixture_rc1_20261012'
CID = '5d55589bfbc222ea4c9ae5c0bba7b862a10b2c521e741792b86d9264c69af845'
IMAGE = 'sha256:f1447071e6c8449dcf4056aa0994c81d3566ce5ee232de36b04dc25696a116dd'

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), default=str).encode()).hexdigest()

def save(name, value):
    with (EVIDENCE/name).open('x') as f:
        json.dump(value, f, indent=2, default=str); f.write('\n')

def connect(db=DB):
    return psycopg.connect(host='127.0.0.1', port=55432, dbname=db, user='qualification_owner',
        connect_timeout=5, options='-c statement_timeout=6000 -c lock_timeout=3000',
        application_name='meri-native-invocation-evidence')

def identity(c, db=DB):
    r = c.execute("SELECT current_database(),current_user,host(inet_server_addr()),inet_server_port(),current_setting('server_version_num'),pg_postmaster_start_time(),(SELECT system_identifier::text FROM pg_control_system()),current_setting('fsync'),current_setting('synchronous_commit'),current_setting('full_page_writes')").fetchone()
    assert r[0:5] == (db, 'qualification_owner', '172.17.0.2', 5432, '160015')
    assert r[7:] == ('on', 'on', 'on')
    return {'database':r[0], 'user':r[1], 'serverHost':r[2], 'serverPort':r[3],
        'serverVersion':r[4], 'serverStartTime':r[5].isoformat(), 'systemIdentifier':r[6],
        'fsync':r[7], 'synchronous_commit':r[8], 'full_page_writes':r[9]}

def snapshot(c, schema):
    oid = c.execute('SELECT oid FROM pg_namespace WHERE nspname=%s', [schema]).fetchone()
    assert oid
    relations = c.execute('SELECT c.oid,c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname=%s ORDER BY c.relname', [schema]).fetchall()
    tables = {}
    for _, name, kind in relations:
        if kind != 'r': continue
        rows = sorted(r[0] for r in c.execute(sql.SQL('SELECT row_to_json(t)::text FROM {}.{} t').format(sql.Identifier(schema),sql.Identifier(name))).fetchall())
        raw = json.dumps(rows, separators=(',', ':')).encode()
        tables[name] = {'rows':len(rows), 'sha256':hashlib.sha256(raw).hexdigest()}
    return {'oid':oid[0], 'relations':[list(r) for r in relations], 'tables':tables}

def security(c):
    # Never query role passwords, HBA options, environment or private data files.
    roles=c.execute('SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,rolvaliduntil FROM pg_roles ORDER BY rolname').fetchall()
    hba=c.execute('SELECT line_number,type,database,user_name,address,netmask,auth_method FROM pg_hba_file_rules ORDER BY line_number').fetchall()
    dbs=c.execute('SELECT oid,datname,datdba,datacl FROM pg_database ORDER BY oid').fetchall()
    return {'roles_sha256':digest(roles),'hba_sha256':digest(hba),'database_catalog_sha256':digest(dbs)}

def no_backends(c):
    rows=c.execute('SELECT pid,datname,application_name,state FROM pg_stat_activity WHERE datname IN (%s,%s) AND pid<>pg_backend_pid() ORDER BY pid',[DB,SDK_DB]).fetchall()
    assert rows == [], 'LIVE_TEST_DATABASE_BACKEND'
    return rows

def container():
    fmt='{"id":{{json .Id}},"image":{{json .Image}},"running":{{json .State.Running}},"purpose":{{json (index .Config.Labels "purpose")}},"ports":{{json .NetworkSettings.Ports}},"serverHost":{{with index .NetworkSettings.Networks "bridge"}}{{json .IPAddress}}{{else}}null{{end}},"volume":{{range .Mounts}}{{json .Name}}{{end}}}'
    p=subprocess.run(['/usr/local/bin/docker','--host','unix:///var/run/docker.sock','inspect','--format',fmt,'meri-native-postgres'],env={'PATH':'/usr/local/bin:/usr/bin:/bin'},capture_output=True,text=True,timeout=5,check=True)
    r=json.loads(p.stdout)
    assert r == {'id':CID,'image':IMAGE,'running':True,'purpose':'meri-native-tests','ports':{'5432/tcp':[{'HostIp':'127.0.0.1','HostPort':'55432'}]},'serverHost':'172.17.0.2','volume':'meri-native-postgres-data'}
    return r

def preflight():
    with connect() as c:
        c.read_only=True
        i=identity(c); preserved={s:snapshot(c,s) for s in SCHEMAS}
        assert [preserved[s]['oid'] for s in SCHEMAS] == [16389,24577,24814,25602]
        expected=json.loads(pathlib.Path('/workspace/scratch/meri-native-repeat-rc1-20261012/approved-repeat-start.json').read_text())['original_row_hashes']
        assert preserved[ORIGINAL]['tables'] == expected
        assert c.execute('SELECT nspname FROM pg_namespace WHERE nspname IN (%s,%s)',[ALIAS,ARCHIVE]).fetchall()==[]
        sec=security(c); backends=no_backends(c)
    with connect(SDK_DB) as c:
        c.read_only=True; identity(c,SDK_DB)
        sdk=snapshot(c,'meri_qualification_sdk_fixture'); assert sdk['oid']==25502
    return {'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'identity':i,
        'container':container(),'preserved_schemas':preserved,'sdk':sdk,'security':sec,'other_test_backends':backends}

def setup():
    before=json.loads((EVIDENCE/'preflight.json').read_text())
    t0=int(time.time()*1000)
    admission={'t0Ms':t0,'workDeadlineMs':t0+720000,'cleanupDeadlineMs':t0+900000,
        'authority':'Current user authorizes ordinary synthetic actions after independent source acceptance; no new credentials/security changes.',
        'fixture':'Existing dedicated instance and qualification_owner; preserve all original and prior schemas/data.'}
    save('admission.json',admission)
    assert time.time()*1000+35000 < admission['workDeadlineMs']
    assert container()==before['container']
    assert not (EVIDENCE/'native-base-env.json').exists() and not (EVIDENCE/'setup-receipt.json').exists()
    with connect() as c:
        assert identity(c)==before['identity']; assert security(c)==before['security']; no_backends(c)
        assert {s:snapshot(c,s) for s in SCHEMAS}==before['preserved_schemas']
        assert c.execute('SELECT nspname FROM pg_namespace WHERE nspname IN (%s,%s)',[ALIAS,ARCHIVE]).fetchall()==[]
        c.execute(sql.SQL('ALTER SCHEMA {} RENAME TO {}').format(sql.Identifier(ORIGINAL),sql.Identifier(ALIAS)))
        for name in ['0001_qualification_state.sql','0002_tool_budget.sql']:
            c.execute((SOURCE/'apps/proxy/qualification/state/migrations'/name).read_text())
        fresh=snapshot(c,ORIGINAL); assert fresh['oid'] not in [16389,24577,24814,25602]
        assert fresh['tables']['budget']['rows']==1
        assert all(v['rows']==0 for k,v in fresh['tables'].items() if k!='budget')
        i=before['identity']
        config={'host':'127.0.0.1','port':55432,'database':DB,'user':'qualification_owner','password':None,
            'systemIdentifier':i['systemIdentifier'],'serverStartTime':i['serverStartTime'],'serverVersion':i['serverVersion'],
            't0Ms':t0,'workDeadlineMs':t0+720000,'cleanupDeadlineMs':t0+900000,
            'stateLockSha256':hashlib.sha256((SOURCE/'apps/control/qualification-sdk-fixture/state/package-lock.json').read_bytes()).hexdigest(),
            'migrationSha256':hashlib.sha256((SOURCE/'apps/proxy/qualification/state/migrations/0002_tool_budget.sql').read_bytes()).hexdigest(),
            'preparedContainer':{'id':CID,'image':IMAGE,'serverHost':i['serverHost'],'serverPort':i['serverPort']}}
        raw=json.dumps(config,separators=(',',':'))
        # Ownership manifests must exist before COMMIT; write failure rolls back
        # the schema change. A separate terminal record confirms commit success.
        save('native-base-env.json',{'MERI_BUDGET_PG_TEST_RUN':'explicit-isolated-engine','MERI_BUDGET_PG_TEST_CONFIG':raw,'MERI_BUDGET_PG_TEST_CONFIG_SHA256':hashlib.sha256(raw.encode()).hexdigest()})
        save('setup-receipt.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'fresh_schema':fresh,'original_alias':ALIAS,'original_oid':16389,'migrations':['0001_qualification_state.sql','0002_tool_budget.sql'],'atomic':True,'status':'OWNERSHIP_MANIFEST_BEFORE_COMMIT'})
    save('setup-terminal.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'COMMIT_SUCCEEDED','schema_oid':fresh['oid']})

def migrate0003():
    # This explicit prerequisite is recorded separately from native qualification.
    a=json.loads((EVIDENCE/'admission.json').read_text()); assert time.time()*1000+35000<a['workDeadlineMs']
    before=json.loads((EVIDENCE/'preflight.json').read_text())
    setup_receipt=json.loads((EVIDENCE/'setup-receipt.json').read_text())
    assert json.loads((EVIDENCE/'setup-terminal.json').read_text())['status']=='COMMIT_SUCCEEDED'
    assert not (EVIDENCE/'native-env.json').exists() and not (EVIDENCE/'migration-0003-manifest.json').exists()
    migration=(SOURCE/'apps/proxy/qualification/state/migrations/0003_tool_invocations.sql').read_bytes()
    assert container()==before['container']
    with connect() as c:
        assert identity(c)==before['identity']; no_backends(c)
        assert snapshot(c,ALIAS)==before['preserved_schemas'][ORIGINAL]
        assert snapshot(c,ORIGINAL)==setup_receipt['fresh_schema']
        assert security(c)==before['security']
        for s in SCHEMAS[1:]: assert snapshot(c,s)==before['preserved_schemas'][s]
        assert c.execute("SELECT to_regclass('meri_qualification.tool_invocations')").fetchone()[0] is None
        c.execute(migration.decode())
        assert c.execute('SELECT count(*) FROM meri_qualification.tool_invocations').fetchone()[0]==0
        oid=c.execute("SELECT 'meri_qualification.tool_invocations'::regclass::oid").fetchone()[0]
        env=json.loads((EVIDENCE/'native-base-env.json').read_text())
        env['MERI_INVOCATION_PG_MIGRATION_SHA256']=hashlib.sha256(migration).hexdigest()
        save('native-env.json',env)
        save('migration-0003-manifest.json',{'status':'OWNERSHIP_MANIFEST_BEFORE_COMMIT','migration_sha256':env['MERI_INVOCATION_PG_MIGRATION_SHA256'],'table_oid':oid,'rows':0,'qualification_result':False,'fresh_schema_oid':setup_receipt['fresh_schema']['oid']})
    save('migration-0003-terminal.json',{'status':'COMMIT_SUCCEEDED','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'qualification_result':False,'table_oid':oid})

def restore():
    a=json.loads((EVIDENCE/'admission.json').read_text()); assert time.time()*1000+35000<a['cleanupDeadlineMs']
    before=json.loads((EVIDENCE/'preflight.json').read_text())
    setup_receipt=json.loads((EVIDENCE/'setup-receipt.json').read_text())
    assert container()==before['container']
    with connect() as c:
        assert identity(c)==before['identity']; no_backends(c)
        assert snapshot(c,ALIAS)==before['preserved_schemas'][ORIGINAL]
        assert snapshot(c,ORIGINAL)['oid']==setup_receipt['fresh_schema']['oid']
        assert c.execute('SELECT oid FROM pg_namespace WHERE nspname=%s',[ARCHIVE]).fetchall()==[]
        archive=snapshot(c,ORIGINAL)
        c.execute(sql.SQL('ALTER SCHEMA {} RENAME TO {}').format(sql.Identifier(ORIGINAL),sql.Identifier(ARCHIVE)))
        c.execute(sql.SQL('ALTER SCHEMA {} RENAME TO {}').format(sql.Identifier(ALIAS),sql.Identifier(ORIGINAL)))
        assert {s:snapshot(c,s) for s in SCHEMAS}==before['preserved_schemas']
        assert security(c)==before['security']
    with connect(SDK_DB) as c:
        c.read_only=True; identity(c,SDK_DB); assert snapshot(c,'meri_qualification_sdk_fixture')==before['sdk']
    save('restoration-receipt.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'within_cleanup_deadline':time.time()*1000<a['cleanupDeadlineMs'],'original_and_prior_schemas_unchanged':True,'sdk_unchanged':True,'roles_hba_database_catalog_unchanged':True,'archive_name':ARCHIVE,'archive':archive,'no_other_test_backends':True,'new_credentials_or_security_changes':False,'container_kept_running':True,'host5432_untouched':True})

if __name__=='__main__':
    if sys.argv[1]=='preflight': save('preflight.json',preflight()); print('READ_ONLY_PREFLIGHT_PASS')
    elif sys.argv[1]=='setup': setup(); print('ATOMIC_SYNTHETIC_SETUP_PASS')
    elif sys.argv[1]=='migrate0003': migrate0003(); print('EXPLICIT_MIGRATION_0003_COMMITTED_NOT_QUALIFICATION')
    elif sys.argv[1]=='restore': restore(); print('ATOMIC_RESTORATION_PASS')
    else: raise ValueError('FIXED_OPERATION_REQUIRED')
