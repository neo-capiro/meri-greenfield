"""Offline controls only. No Docker, real native client or DB is invoked."""
import asyncio
import importlib.util
import json
import os
from pathlib import Path,PurePosixPath
import socket
import stat
import subprocess
import sys
import types
import unittest
from urllib.parse import parse_qsl,urlsplit

HERE=Path(__file__).parent
def deny(event,args):
    if event.startswith('socket.') or event in ('subprocess.Popen','os.system','os.posix_spawn'):raise PermissionError('OFFLINE_EFFECT_DENIED')
sys.addaudithook(deny)
sys.path.insert(0,str(HERE))
import config

def load(name,file):
    spec=importlib.util.spec_from_file_location(name,HERE/file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
peer=load('fixture_peer','prisma-peer.py')
runner=load('fixture_runner','run-fixture.py')
capture=load('fixture_capture','docker_capture.py')

def example():
    return {'schema':'meri.postgres.tls-fixture/1','runId':'11111111-1111-4111-8111-111111111111',
        'proxyImage':'sha256:'+'a'*64,'postgresImage':config.PG_IMAGE,'t0Ms':1000000,'startDeadlineMs':1060000,
        'workDeadlineMs':1300000,'cleanupDeadlineMs':1330000,'originalC':1900000}

class FixtureTests(unittest.TestCase):
    def test_suppressed_streams_supply_only_current_native_descriptors(self):
        before=(sys.stdout,sys.stderr)
        with peer.discard_native_output():
            self.assertEqual((sys.stdout.fileno(),sys.stderr.fileno()),(1,2))
            self.assertIsNot(sys.stdout,sys.stderr)
            self.assertTrue(stat.S_ISCHR(os.fstat(sys.stdout.fileno()).st_mode))
            self.assertTrue(stat.S_ISCHR(os.fstat(sys.stderr.fileno()).st_mode))
            for stream in (sys.stdout,sys.stderr):
                self.assertEqual(stream.write('SYNTHETIC_PYTHON_SUPPRESSED'),27)
                stream.flush()
                self.assertEqual(os.write(stream.fileno(),b'SYNTHETIC_NATIVE_SUPPRESSED'),27)
        self.assertIs(sys.stdout,before[0]);self.assertIs(sys.stderr,before[1])

    def test_suppression_restores_python_and_native_descriptors_after_error(self):
        before=(sys.stdout,sys.stderr)
        identities=[(os.fstat(fd).st_dev,os.fstat(fd).st_ino,os.fstat(fd).st_mode) for fd in (1,2)]
        with self.assertRaisesRegex(RuntimeError,'SYNTHETIC_BODY_FAILURE'):
            with peer.discard_native_output():raise RuntimeError('SYNTHETIC_BODY_FAILURE')
        self.assertIs(sys.stdout,before[0]);self.assertIs(sys.stderr,before[1])
        self.assertEqual([(os.fstat(fd).st_dev,os.fstat(fd).st_ino,os.fstat(fd).st_mode) for fd in (1,2)],identities)

    def test_discard_preserves_per_stream_write_bound(self):
        for fd in (1,2):
            sink=peer.Discard(fd)
            self.assertEqual(sink.write('x'*(2*1024*1024)),2*1024*1024)
            with self.assertRaisesRegex(ValueError,'UPSTREAM_OUTPUT_BOUND'):sink.write('x')
            self.assertEqual(sink.fileno(),fd)
        for fd in (None,True,0,3,'1'):
            with self.subTest(fd=fd),self.assertRaisesRegex(ValueError,'OUTPUT_DESCRIPTOR'):peer.Discard(fd)

    def test_postgres_familiar_name_keeps_exact_repository_and_digest(self):
        self.assertTrue(config.is_postgres_repo_digest(config.PG_IMAGE))
        self.assertTrue(config.is_postgres_repo_digest(config.PG_IMAGE.removeprefix('docker.io/library/')))
        for ref in (None, True, config.PG_IMAGE+'x', 'other/postgres@'+config.PG_IMAGE.split('@')[1],
                    'postgres@sha256:'+'0'*64, 'docker.io/other/postgres@'+config.PG_IMAGE.split('@')[1]):
            with self.subTest(ref=ref):self.assertFalse(config.is_postgres_repo_digest(ref))

    def test_original_clock_and_new_image(self):
        v=example();self.assertEqual(config.parse(json.dumps(v).encode()),v)
        for key,value in [('originalC',1900001),('t0Ms',True),('proxyImage',config.OLD_IMAGE),('cleanupDeadlineMs',1330001),('workDeadlineMs',1300001)]:
            changed=dict(v);changed[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):config.parse(json.dumps(changed).encode())

    def test_duplicate_and_extra_refused(self):
        raw=json.dumps(example()).encode()
        with self.assertRaises(ValueError):config.parse(raw[:-1]+b',"runId":"x"}')
        v=example();v['execute']=True
        with self.assertRaises(ValueError):config.parse(json.dumps(v).encode())

    def test_owner_read_bound_before_open(self):
        # This existing source is larger than the owner-data cap; no test config/T0 is allocated.
        self.assertGreater((HERE/'test_fixture.py').stat().st_size,4096)
        with self.assertRaisesRegex(ValueError,'OWNER_FILE_BOUND'):
            config.read_owner((HERE/'test_fixture.py').resolve())

    def test_clock_drift_refused_before_process(self):
        c=capture.DockerCapture(Path('.'),10**15)
        c.wall_origin-=5000
        with self.assertRaisesRegex(ValueError,'CLOCK_DRIFT'):c.call('never',['version'])

    def test_exact_native_tls_url_and_wrong_san(self):
        v=example();password='b'*64
        u=urlsplit(config.url(v,password,'positive').decode())
        self.assertEqual(u.hostname,'meri-native-auth-pg')
        self.assertEqual(parse_qsl(u.query),[('sslmode','require'),('sslaccept','strict'),('sslcert',config.mount(v)+'/ca.pem')])
        self.assertNotIn('sslrootcert',u.query)
        self.assertEqual(urlsplit(config.url(v,password,'wrong-san').decode()).hostname,'meri-native-wrong-san')
        self.assertEqual(urlsplit(config.url(v,password,'plaintext').decode()).hostname,'meri-native-plain-pg')

    def test_no_secret_runtime_arguments(self):
        argv=runner.common('n','o','net','10001:10001','sha256:'+'a'*64)
        self.assertNotIn('--env',argv);self.assertIn('--read-only',argv)
        self.assertEqual(argv[argv.index('--cap-drop')+1],'ALL')

    def test_positive_same_native_backend_role_proof(self):
        row={'who':config.USER,'db':config.names(example())['native'],'pid':42,'ssl':True,'version':'TLSv1.3','cipher':'TLS_AES_256_GCM_SHA384',
            'rolsuper':False,'rolcreatedb':False,'rolcreaterole':False,'rolreplication':False,'rolbypassrls':False,'owns_database':False}
        seen=[]
        class Fake:
            def __init__(self,**kw):pass
            async def connect(self):pass
            async def query_raw(self,sql):seen.append(sql);return [row]
            async def disconnect(self):pass
        result=self.fake_probe(Fake,'positive')
        self.assertTrue(result['passed']);self.assertIn('WHERE s.pid=pg_backend_pid()',seen[0])
        row['owns_database']=True
        self.assertFalse(self.fake_probe(Fake,'positive')['passed'])

    def fake_probe(self,cls,case):
        old=sys.modules.get('prisma');oldread=peer.read;oldtimeout=peer.asyncio.timeout
        class FakeTimeout:
            async def __aenter__(self):return self
            async def __aexit__(self,*args):return False
        sys.modules['prisma']=types.SimpleNamespace(Prisma=cls)
        peer.read=lambda p:config.url(example(),'b'*64,case) if p.name.endswith('-url') else b'SYNTHETIC_CA_DATA'
        peer.asyncio.timeout=lambda *_:FakeTimeout()
        try:
            # Immediate fake coroutines need no event loop/self-pipe/network.
            coro=peer.probe(PurePosixPath(config.mount(example())),case)
            try:coro.send(None)
            except StopIteration as done:return done.value
            raise AssertionError('fake unexpectedly yielded IO')
        finally:
            peer.read=oldread;peer.asyncio.timeout=oldtimeout
            if old is None:sys.modules.pop('prisma',None)
            else:sys.modules['prisma']=old

    def test_specific_negative_errors_only(self):
        for case,text in [('wrong-ca','TLS certificate verify failed: unable to get local issuer'),('wrong-san','TLS hostname mismatch'),('plaintext','TLS server does not support TLS'),('wrong-password','P1000 password authentication failed')]:
            class Fake:
                def __init__(self,**kw):pass
                async def connect(self):raise RuntimeError(text)
                async def disconnect(self):pass
            with self.subTest(case=case):self.assertTrue(self.fake_probe(Fake,case)['passed'])
        class NetworkFailure:
            def __init__(self,**kw):pass
            async def connect(self):raise RuntimeError('connection timeout')
            async def disconnect(self):pass
        for case in ('wrong-ca','wrong-san','plaintext','wrong-password'):
            self.assertFalse(self.fake_probe(NetworkFailure,case)['passed'])

    def test_negative_success_is_failure(self):
        class Fake:
            def __init__(self,**kw):pass
            async def connect(self):pass
            async def query_raw(self,sql):return []
            async def disconnect(self):pass
        for case in ('wrong-ca','wrong-san','plaintext','wrong-password'):self.assertFalse(self.fake_probe(Fake,case)['passed'])

    def test_cleanup_requires_positive_owned_id(self):
        c=capture.DockerCapture(Path('.'),10);calls=[]
        c.inspect=lambda kind,name,owner,image:{'Id':'a'*64}
        def call(label,args,**kw):
            calls.append(args)
            return (b'[]',b'Error: No such container: '+b'a'*64,1) if label=='absent-container' else (b'a'*64,b'',0)
        c.call=call
        self.assertEqual(c.remove_container('owned','run','image'),'a'*64)
        self.assertEqual(calls[0],['container','rm','--force','--volumes','a'*64])
        c.call=lambda *a,**k:(b'[]',b'permission denied',1)
        with self.assertRaises(ValueError):c.remove_container('owned','run','image')

if __name__=='__main__':
    unittest.main()
