"""Offline controls only. No Docker, real native client or DB is invoked."""
import asyncio
from datetime import timedelta
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
from unittest.mock import patch
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
            sink=peer.Discard(fd,[0])
            self.assertEqual(sink.write('x'*(2*1024*1024)),2*1024*1024)
            with self.assertRaisesRegex(ValueError,'UPSTREAM_OUTPUT_BOUND'):sink.write('x')
            self.assertEqual(sink.fileno(),fd)
        for fd in (None,True,0,3,'1'):
            with self.subTest(fd=fd),self.assertRaisesRegex(ValueError,'OUTPUT_DESCRIPTOR'):peer.Discard(fd,[0])

    def test_combined_stdout_stderr_share_two_mib_budget(self):
        before=(sys.stdout,sys.stderr)
        with peer.discard_native_output():
            self.assertEqual(sys.stdout.write('x'*(1024*1024)),1024*1024)
            self.assertEqual(sys.stderr.write('x'*(1024*1024)),1024*1024)
            with self.assertRaisesRegex(ValueError,'UPSTREAM_OUTPUT_BOUND'):sys.stderr.write('x')
        self.assertIs(sys.stdout,before[0]);self.assertIs(sys.stderr,before[1])

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
            async def connect(self,*,timeout):pass
            async def query_raw(self,sql):seen.append(sql);return [row]
            async def disconnect(self):pass
        result=self.fake_probe(Fake,'positive')
        self.assertTrue(result['passed']);self.assertIn('WHERE s.pid=pg_backend_pid()',seen[0])
        row['owns_database']=True
        self.assertFalse(self.fake_probe(Fake,'positive')['passed'])

    def fake_probe(self,cls,case,*,private=False):
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
            except StopIteration as done:return done.value if private else done.value[0]
            raise AssertionError('fake unexpectedly yielded IO')
        finally:
            peer.read=oldread;peer.asyncio.timeout=oldtimeout
            if old is None:sys.modules.pop('prisma',None)
            else:sys.modules['prisma']=old

    def test_untyped_negative_strings_never_qualify(self):
        for case,text in [('wrong-ca','TLS certificate verify failed: unable to get local issuer'),('wrong-san','TLS hostname mismatch'),('plaintext','TLS server does not support TLS'),('wrong-password','P1000 password authentication failed')]:
            class Fake:
                def __init__(self,**kw):pass
                async def connect(self,*,timeout):raise RuntimeError(text)
                async def disconnect(self):pass
            with self.subTest(case=case):
                result,error=self.fake_probe(Fake,case,private=True)
                self.assertFalse(result['passed']);self.assertIsInstance(error,RuntimeError)
                self.assertNotIn('errorType',result)
                self.assertNotIn(text,json.dumps(result))
        class NetworkFailure:
            def __init__(self,**kw):pass
            async def connect(self,*,timeout):raise RuntimeError('connection timeout')
            async def disconnect(self):pass
        for case in ('wrong-ca','wrong-san','plaintext','wrong-password'):
            self.assertFalse(self.fake_probe(NetworkFailure,case)['passed'])

    def test_negative_success_is_failure(self):
        class Fake:
            def __init__(self,**kw):pass
            async def connect(self,*,timeout):pass
            async def query_raw(self,sql):return []
            async def disconnect(self):pass
        for case in ('wrong-ca','wrong-san','plaintext','wrong-password'):self.assertFalse(self.fake_probe(Fake,case)['passed'])

    def native_plaintext(self):
        message='error performing TLS handshake: server does not support TLS'
        return (json.dumps({'is_panic':False,'message':'Error opening a TLS connection: '+message,
            'meta':{'message':message},'error_code':'P1011'})+'\n').encode()

    def engine_failure(self):
        class EngineConnectionError(RuntimeError):
            __module__='prisma.engine.errors'
            def __str__(self):raise AssertionError('PRIVATE_EXCEPTION_MUST_NOT_BE_STRINGIFIED')
        return EngineConnectionError('SYNTHETIC_PRIVATE_SENTINEL')

    def test_native_specific_evidence_composes_without_stringifying_exception(self):
        _,diagnostics=peer.diagnostic_modules()
        outcome=({'case':'plaintext','passed':False,'providerCalls':0,'runtimeAdmitted':False},self.engine_failure())
        result=peer.finish_probe('plaintext',outcome,self.native_plaintext(),{'complete':True},diagnostics)
        self.assertTrue(result['passed']);self.assertTrue(result['specificRejection'])
        self.assertEqual(result['nativeEvidence']['reason'],'TLS_UNSUPPORTED')
        self.assertNotIn('SYNTHETIC_PRIVATE_SENTINEL',json.dumps(result))

    def test_capture_disconnect_and_negative_connection_failures_override_specific_evidence(self):
        _,diagnostics=peer.diagnostic_modules()
        for flag in ('negativeConnected','disconnectUnknown','incomplete'):
            value={'case':'plaintext','passed':False}
            if flag!='incomplete':value[flag]=True
            with self.subTest(flag=flag):
                result=peer.finish_probe('plaintext',(value,self.engine_failure()),self.native_plaintext(),
                    {'complete':flag!='incomplete'},diagnostics)
                self.assertFalse(result['passed']);self.assertFalse(result['specificRejection'])

    def test_missing_exception_or_malformed_native_evidence_never_qualifies(self):
        _,diagnostics=peer.diagnostic_modules()
        for error,raw in ((None,self.native_plaintext()),(self.engine_failure(),b''),
                (self.engine_failure(),self.native_plaintext()+b'SYNTHETIC_EXTRA_LOG\n')):
            with self.subTest(has_error=error is not None,size=len(raw)):
                result=peer.finish_probe('plaintext',({'case':'plaintext','passed':False},error),raw,{'complete':True},diagnostics)
                self.assertFalse(result['passed'])

    def test_positive_requires_complete_capture_and_empty_stderr(self):
        _,diagnostics=peer.diagnostic_modules()
        for complete,raw,expected in ((True,b'',True),(False,b'',False),(True,b'SYNTHETIC_WARNING\n',False)):
            with self.subTest(complete=complete,size=len(raw)):
                result=peer.finish_probe('positive',({'case':'positive','passed':True},None),raw,{'complete':complete},diagnostics)
                self.assertIs(result['passed'],expected)

    def test_peer_arguments_pin_exact_sources_readonly_and_keep_isolated_python(self):
        value=example();client=PurePosixPath('/synthetic/private/client')
        args=runner.peer_arguments(value,'plaintext',client)
        mounts=[args[index+1] for index,token in enumerate(args) if token=='--mount']
        self.assertEqual(len(mounts),4)
        for name in ('prisma-peer.py',*peer.DIAGNOSTIC_SOURCE_NAMES):
            self.assertEqual(mounts.count('type=bind,source='+str(runner.HERE/name)+',target=/run/'+name+',readonly'),1)
        self.assertEqual(args[-7:],['-I','-B','/run/prisma-peer.py','--run',value['runId'],'--case','plaintext'])
        self.assertNotIn('--env',args)
        with self.assertRaisesRegex(ValueError,'PEER_CASE'):runner.peer_arguments(value,'unknown',client)

    def test_diagnostic_loader_does_not_search_siblings_or_retain_module_names(self):
        before_path=list(sys.path);before_modules=set(sys.modules)
        native,diagnostics=peer.diagnostic_modules()
        self.assertEqual(sys.path,before_path)
        self.assertTrue(callable(native.capture_native_output));self.assertTrue(callable(diagnostics.classify_native_output))
        self.assertFalse(any(name.startswith('_meri_tls_') for name in set(sys.modules)-before_modules))

    def test_only_terminal_coherent_negative_failures_allow_further_diagnostics(self):
        self.assertFalse(runner.peer_passed('wrong-ca',{'case':'wrong-ca','passed':False},1,1))
        self.assertTrue(runner.peer_passed('wrong-ca',{'case':'wrong-ca','passed':True},0,0))
        with self.assertRaisesRegex(ValueError,'NATIVE_CONTROL_FAILED_positive'):
            runner.peer_passed('positive',{'case':'positive','passed':False},1,1)
        for value,code,observed in (({'case':'wrong-ca','passed':False},0,0),
                ({'case':'wrong-ca','passed':True},0,1),({'case':'wrong-ca','passed':1},0,0),
                ({'case':'other','passed':False},1,1),({'status':'PEER_REFUSED'},2,2),([],1,1)):
            with self.subTest(value=value),self.assertRaisesRegex(ValueError,'NATIVE_PEER_OUTCOME'):
                runner.peer_passed('wrong-ca',value,code,observed)

    def injected_main(self,*,expire=False):
        import contextlib
        import io
        _,diagnostics=peer.diagnostic_modules()
        clock=[100.0];seen=[]
        class Capture:
            def __enter__(self):seen.append('enter');return self
            def __exit__(self,*args):seen.append('drain');return False
            def check(self):seen.append('check')
            def facts(self):return {'complete':True}
            def private_bytes(self):seen.append('private');return b'',b''
        def capture(deadline):seen.append(('deadline',deadline));return Capture()
        def initialize():clock[0]+=2;seen.append('modules');return types.SimpleNamespace(capture_native_output=capture),diagnostics
        def run(coro):
            coro.close();seen.append('body')
            if expire:clock[0]=132.0
            return ({'case':'positive','passed':True,'providerCalls':0,'runtimeAdmitted':False},None)
        output=io.StringIO()
        with contextlib.ExitStack() as stack:
            for obj,name,value in ((peer.sys,'platform','linux'),(peer.sys,'version_info',(3,13,5)),
                    (peer.sys,'prefix','/opt/meri-proxy-venv'),(peer.sys,'argv',['prisma-peer.py','--run',example()['runId'],'--case','positive']),
                    (peer.os,'getuid',lambda:10001),(peer.os,'getgid',lambda:10001),
                    (peer.importlib.metadata,'version',lambda _: '0.11.0'),(peer,'diagnostic_modules',initialize),
                    (peer.time,'monotonic',lambda:clock[0]),(peer.asyncio,'run',run),
                    (peer.signal,'SIGALRM',14),(peer.signal,'ITIMER_REAL',0),
                    (peer.signal,'signal',lambda *_:None),
                    (peer.signal,'setitimer',lambda kind,value:seen.append(('timer',value)))):
                stack.enter_context(patch.object(obj,name,value,create=True))
            stack.enter_context(patch.dict(peer.os.environ,{},clear=True))
            stack.enter_context(contextlib.redirect_stdout(output))
            if expire:
                with self.assertRaisesRegex(TimeoutError,'PEER_DEADLINE'):peer.main()
            else:self.assertEqual(peer.main(),0)
        return seen,output.getvalue()

    def test_main_preserves_original_clock_and_disconnect_drain_before_public_output(self):
        seen,output=self.injected_main()
        self.assertIn(('deadline',132.0),seen)
        self.assertLess(seen.index(('timer',32.0)),seen.index('modules'))
        self.assertLess(seen.index('body'),seen.index('drain'))
        self.assertLess(seen.index('drain'),seen.index('private'))
        self.assertEqual(seen[-1],('timer',0))
        self.assertTrue(json.loads(output)['passed'])

    def test_main_refuses_late_body_even_if_injected_capture_claims_complete(self):
        seen,output=self.injected_main(expire=True)
        self.assertIn(('deadline',132.0),seen)
        self.assertEqual(seen[-1],('timer',0));self.assertEqual(output,'')

    def test_real_pipe_capture_nested_inside_text_suppression_restores_and_keeps_bytes_private(self):
        before=(sys.stdout,sys.stderr)
        identities=[(os.fstat(fd).st_dev,os.fstat(fd).st_ino,os.fstat(fd).st_mode) for fd in (1,2)]
        native,diagnostics=peer.diagnostic_modules()
        raw=self.native_plaintext()
        with peer.discard_native_output():
            with native.capture_native_output(peer.time.monotonic()+2) as captured:
                sys.stderr.write('SYNTHETIC_PRIVATE_PYTHON_TEXT')
                os.write(1,b'SYNTHETIC_PRIVATE_NATIVE_TRACE')
                os.write(2,raw)
            captured.check()
            stdout_bytes,stderr_bytes=captured.private_bytes()
            self.assertEqual(stdout_bytes,b'SYNTHETIC_PRIVATE_NATIVE_TRACE')
            self.assertEqual(stderr_bytes,raw)
            result=peer.finish_probe('plaintext',({'case':'plaintext','passed':False},self.engine_failure()),
                stderr_bytes,captured.facts(),diagnostics)
        self.assertIs(sys.stdout,before[0]);self.assertIs(sys.stderr,before[1])
        self.assertEqual([(os.fstat(fd).st_dev,os.fstat(fd).st_ino,os.fstat(fd).st_mode) for fd in (1,2)],identities)
        self.assertTrue(result['passed']);self.assertTrue(result['nativeCapture']['complete'])
        public=json.dumps(result)
        for private in ('SYNTHETIC_PRIVATE','Error opening','server does not support'):
            self.assertNotIn(private,public)

    def test_supported_startup_timeout_reaches_success_and_failure_and_disconnects(self):
        timeouts=[];disconnected=[]
        row={'who':config.USER,'db':config.names(example())['native'],'pid':42,'ssl':True,
            'version':'TLSv1.3','cipher':'TLS_AES_256_GCM_SHA384',
            'rolsuper':False,'rolcreatedb':False,'rolcreaterole':False,'rolreplication':False,
            'rolbypassrls':False,'owns_database':False}
        failure=RuntimeError('SYNTHETIC_GENERIC_CONNECTION_FAILURE')
        class Fake:
            fail=False
            def __init__(self,**kw):pass
            async def connect(self,*,timeout):
                timeouts.append(timeout)
                if self.fail:raise failure
            async def query_raw(self,sql):return [row]
            async def disconnect(self):disconnected.append(True)
        result,error=self.fake_probe(Fake,'positive',private=True)
        self.assertTrue(result['passed']);self.assertIsNone(error)
        Fake.fail=True
        result,error=self.fake_probe(Fake,'plaintext',private=True)
        self.assertFalse(result['passed']);self.assertIs(error,failure)
        self.assertNotIn('SYNTHETIC_GENERIC',json.dumps(result))
        self.assertEqual(timeouts,[timedelta(seconds=3),timedelta(seconds=3)])
        self.assertEqual(disconnected,[True,True])

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
