"""Pure composition controls; no Docker, Prisma engine, DB or network."""
import importlib.util
import json
from pathlib import Path
import sys
import types
import unittest

HERE=Path(__file__).parent
def deny(event,args):
    if event.startswith('socket.') or event in ('subprocess.Popen','os.system','os.posix_spawn'):raise PermissionError('OFFLINE_EFFECT_DENIED')
sys.addaudithook(deny);sys.path.insert(0,str(HERE))
import config
import native_bootstrap as b

def inputs():
    v={'schema':'meri.postgres.native-combined/1','runId':'11111111-1111-4111-8111-111111111111','proxyImage':'sha256:'+'a'*64,
      'postgresImage':config.PG_IMAGE,'t0Ms':1000000,'startDeadlineMs':1060000,'workDeadlineMs':1300000,'cleanupDeadlineMs':1330000,'originalC':1900000}
    folder=HERE.parent/'native-runtime';pins={name:b.sha((folder/name).read_bytes()) for name in b.SOURCE_NAMES}
    a={'schema':'meri.native-combined.root-admission/1','decision':'ADMIT_ONE_COMBINED_SYNTHETIC_FIXTURE','runId':v['runId'],
       'image':v['proxyImage'],'clock':{k:v[k] for k in ('t0Ms','startDeadlineMs','workDeadlineMs','cleanupDeadlineMs','originalC')},
       'sourceSha256':pins,'runtimeSha256':{k:'b'*64 for k in b.RUNTIME},'cleanupPlanSha256':'c'*64}
    raw=json.dumps(a).encode();v['rootAdmissionSha256']=b.sha(raw);return v,a,raw

def measured():return {'schemaInitialized':True,'viewsVerified':8,'grantsVerified':True,'ownerCredentialRevoked':True,'runtimeAdmitted':False}

class CompositionTests(unittest.TestCase):
    def test_v1_data_unchanged_and_combined_strict(self):
        v,a,raw=inputs();self.assertEqual(config.parse(json.dumps(v).encode()),v)
        old=dict(v);old.pop('rootAdmissionSha256');old['schema']='meri.postgres.tls-fixture/1'
        self.assertEqual(config.parse(json.dumps(old).encode()),old)
        for key,value in [('duration',3),('workDeadlineMs',1299999),('rootAdmissionSha256',True)]:
            changed=dict(v);changed[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):config.parse(json.dumps(changed).encode())

    def test_external_admission_exact_binding(self):
        v,a,raw=inputs();self.assertEqual(b.admission(raw,v),a)
        for key,value in [('image','sha256:'+'d'*64),('decision','run'),('extra',True)]:
            changed=dict(a);changed[key]=value;raw=json.dumps(changed).encode();v['rootAdmissionSha256']=b.sha(raw)
            with self.subTest(key=key),self.assertRaises(ValueError):b.admission(raw,v)
        a['clock']['t0Ms']=True;raw=json.dumps(a).encode();v['rootAdmissionSha256']=b.sha(raw)
        with self.assertRaises(ValueError):b.admission(raw,v)

    def test_owner_separate_endpoint_no_app_owner_grant(self):
        from urllib.parse import urlsplit,parse_qsl
        v,_,_=inputs();url=urlsplit(config.owner_url(v,'d'*64).decode())
        self.assertEqual(url.username,'meri_fixture_owner');self.assertEqual(url.hostname,'meri-native-auth-pg')
        self.assertEqual(parse_qsl(url.query)[2],('sslcert','/run/meri-native-owner/'+v['runId']+'/ca.pem'))
        grants=b.grant_sql();self.assertTrue(all('meri_native_auth_app' in q or 'FROM PUBLIC' in q for q in grants))
        self.assertFalse(any('TO meri_native_auth_app' in q and any(x in q for x in ('OWNER','CREATE','ALL PRIVILEGES','CREATEROLE')) for q in grants))

    def activation_inputs(self):
        v,a,_=inputs();m=b.native_config_module(HERE.parent/'native-runtime',a)
        mounted={'database-url':config.url(v,'e'*64,'positive'),'master-key':b'sk-'+b'f'*64,'salt-key':b'g'*64,
          'ca.pem':b'-----BEGIN CERTIFICATE-----\nSYNTHETIC\n-----END CERTIFICATE-----\n',
          'config.yaml':(json.dumps(m.proxy_config(),sort_keys=True,separators=(',',':'))+'\n').encode()}
        controls={k:{'passed':True,'case':k} for k in config.CASES}
        return v,a,m,mounted,controls

    def test_actual_canonical_activation_validator_reused(self):
        v,a,m,mounted,controls=self.activation_inputs()
        raw,act=b.activation(v,a,mounted,controls,measured(),m,1050000)
        value=json.loads(act);self.assertEqual(value['notBeforeUnixMs'],1000000)
        self.assertEqual(value['cleanupDeadlineUnixMs'],1330000)
        self.assertEqual(json.loads(raw)['proxyImage'],v['proxyImage'])
        self.assertEqual(value['prerequisiteEvidenceSha256']['nativeSchemaInitialized'],b.sha(json.dumps(measured(),sort_keys=True,separators=(',',':')).encode()))

    def test_no_late_or_fabricated_measurement(self):
        v,a,m,mounted,controls=self.activation_inputs()
        with self.assertRaisesRegex(ValueError,'60_SECOND'):b.activation(v,a,mounted,controls,measured(),m,1060001)
        for key,value in [('grantsVerified',1),('ownerCredentialRevoked',False),('viewsVerified',True)]:
            x=measured();x[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):b.activation(v,a,mounted,controls,x,m,1050000)
        controls['wrong-ca']['passed']=1
        with self.assertRaises(ValueError):b.activation(v,a,mounted,controls,measured(),m,1050000)

    def test_source_substitution_refused(self):
        _,a,_=inputs();a['sourceSha256']['fixture_config.py']='0'*64
        with self.assertRaisesRegex(ValueError,'SOURCE_HASH'):b.native_config_module(HERE.parent/'native-runtime',a)

    def run_grants(self,*,privileged=False,reconnect='P1000 password authentication failed'):
        calls=[];count=[0]
        class Fake:
            def __init__(self,**kw):count[0]+=1;self.number=count[0]
            async def connect(self):
                if self.number==2:
                    if reconnect is not None:raise RuntimeError(reconnect)
            async def disconnect(self):pass
            async def execute_raw(self,sql):calls.append(sql);return 0
            async def query_raw(self,sql):
                if 'pg_views' in sql:return [{'viewname':v} for v in b.VIEWS]
                if 'pg_roles' in sql:return [{**{k:False for k in ('rolsuper','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls','owns_database','schema_create','owner_member')},'schema_usage':True,'database_connect':True,'owns_database':privileged}]
                return [{'missing':0}]
        async def views(db):self.assertIsInstance(db,Fake);calls.append('GENUINE_HELPER_CALL_FAKE')
        replacements={'prisma':types.SimpleNamespace(Prisma=Fake),'litellm.proxy.db.create_views':types.SimpleNamespace(create_missing_views=views)}
        old={k:sys.modules.get(k) for k in replacements};sys.modules.update(replacements)
        try:
            coro=b.views_and_grants('UNUSED_FAKE_MOUNTED_OWNER_URL')
            try:coro.send(None)
            except StopIteration:return calls
            raise AssertionError('fake yielded IO')
        finally:
            for key,value in old.items():
                if value is None:sys.modules.pop(key,None)
                else:sys.modules[key]=value

    def test_real_composition_function_grants_and_owner_revocation(self):
        calls=self.run_grants();self.assertEqual(calls[0],'GENUINE_HELPER_CALL_FAKE')
        self.assertEqual(calls[-1],'ALTER ROLE meri_fixture_owner PASSWORD NULL')
        self.assertEqual(len(calls),7)
        with self.assertRaisesRegex(ValueError,'PRIVILEGE'):self.run_grants(privileged=True)

    def test_owner_reconnect_unknown_or_success_not_revocation(self):
        for message in ('connection timeout',None):
            with self.subTest(message=message),self.assertRaisesRegex(ValueError,'CREDENTIAL_NOT_REVOKED'):self.run_grants(reconnect=message)

if __name__=='__main__':unittest.main()
