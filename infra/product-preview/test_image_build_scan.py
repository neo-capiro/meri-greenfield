"""Scan refusals and the installed CLI's waiter against a closed loopback server."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

spec=importlib.util.spec_from_file_location('build_fixture',Path(__file__).with_name('test_image_build_diagnostics.py'))
fixture=importlib.util.module_from_spec(spec); spec.loader.exec_module(fixture)

class ScanGate(unittest.TestCase):
    def test_waiter_failures_are_terminal_without_custom_retry_or_success(self):
        # These are final nonzero waiter exits, including exhausted not-found.
        # Retry behavior itself is exercised below using the actual CLI.
        for scenario in ['scan-not-found','scan-failed','scan-timeout','scan-unknown']:
            with self.subTest(scenario=scenario), fixture.build_fixture(scenario) as (root,result):
                self.assertNotEqual(result.returncode,0)
                self.assertFalse((root/'source/image-evidence/result.json').exists())
                calls=(root/'calls').read_text()
                self.assertEqual(calls.count('\nwait\n'),1)
                self.assertNotIn('describe-image-scan-findings',calls)
                self.assertFalse((root/'image').exists())

    def test_scan_findings_and_digest_must_match_and_be_complete(self):
        for scenario in ['high','critical','bad-count','wrong-scan','incomplete','wrong-digest']:
            with self.subTest(scenario=scenario), fixture.build_fixture(scenario) as (root,result):
                self.assertNotEqual(result.returncode,0)
                self.assertFalse((root/'source/image-evidence/result.json').exists())
                self.assertFalse((root/'image').exists())
                if scenario=='wrong-digest': self.assertNotIn('\nwait\n',(root/'calls').read_text())

    def waiter_model(self, root):
        model=json.loads((root/'waiter.json').read_text())
        self.assertEqual(model, {'version':2,'waiters':{'ImageScanComplete':{
            'operation':'DescribeImageScanFindings','delay':5,'maxAttempts':60,
            'acceptors':[
                {'state':'success','matcher':'path','argument':'imageScanStatus.status','expected':'COMPLETE'},
                {'state':'failure','matcher':'path','argument':'imageScanStatus.status','expected':'FAILED'},
                {'state':'retry','matcher':'error','expected':'ScanNotFoundException'},
            ]}}})
        return model

    def run_cli(self, root, model, responses):
        cli=shutil.which('aws')
        self.assertIsNotNone(cli, 'AWS CLI is required for the closed standard-waiter test')
        data=root/'cli-models'
        model_path=data/'ecr/2015-09-21/waiters-2.json'
        model_path.parent.mkdir(parents=True,exist_ok=True)
        model_path.write_text(json.dumps(model))
        empty=root/'empty-aws-config'; empty.write_text('')
        requests=[]
        class ClosedScan(BaseHTTPRequestHandler):
            def log_message(self,*args): pass
            def do_POST(self):
                size=int(self.headers.get('Content-Length','0'))
                if not 0<size<=4096:
                    self.send_error(400); return
                body=json.loads(self.rfile.read(size))
                requests.append({'body':body,'target':self.headers.get('X-Amz-Target'),
                                 'authorizationPresent':'Authorization' in self.headers})
                status,response=responses[min(len(requests)-1,len(responses)-1)]
                payload=json.dumps(response).encode()
                self.send_response(status)
                self.send_header('Content-Type','application/x-amz-json-1.1')
                self.send_header('Content-Length',str(len(payload)))
                self.end_headers(); self.wfile.write(payload)
        server=ThreadingHTTPServer(('127.0.0.1',0),ClosedScan)
        thread=threading.Thread(target=server.serve_forever,daemon=True); thread.start()
        # No credentials, shared config, proxy or AWS endpoint can be inherited.
        env={k:v for k,v in os.environ.items() if not k.startswith('AWS_') and k.lower() not in ['http_proxy','https_proxy','all_proxy','no_proxy']}
        env.update(AWS_DATA_PATH=str(data),AWS_CONFIG_FILE=str(empty),AWS_SHARED_CREDENTIALS_FILE=str(empty),
                   AWS_EC2_METADATA_DISABLED='true',AWS_MAX_ATTEMPTS='1',AWS_PAGER='',NO_PROXY='127.0.0.1')
        try:
            result=subprocess.run([cli,'--endpoint-url',f'http://127.0.0.1:{server.server_port}',
                '--region','us-east-1','--no-sign-request','--no-cli-pager','--no-cli-auto-prompt',
                '--cli-connect-timeout','2','--cli-read-timeout','2','ecr','wait','image-scan-complete',
                '--repository-name','synthetic/review','--image-id','imageDigest='+fixture.DIGEST],
                env=env,stdin=subprocess.DEVNULL,capture_output=True,text=True,timeout=25)
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=5)
        self.assertTrue(requests)
        for request in requests:
            self.assertFalse(request['authorizationPresent'])
            self.assertEqual(request['target'],'AmazonEC2ContainerRegistry_V20150921.DescribeImageScanFindings')
            self.assertEqual(request['body'],{'repositoryName':'synthetic/review','imageId':{'imageDigest':fixture.DIGEST}})
        return result,requests

    def test_standard_cli_retries_only_registration_error_until_complete(self):
        with fixture.build_fixture() as (root,build):
            self.assertEqual(build.returncode,0,build.stderr)
            result,requests=self.run_cli(root,self.waiter_model(root),[
                (400,{'__type':'ScanNotFoundException','message':'synthetic registration delay'}),
                (200,{'imageScanStatus':{'status':'IN_PROGRESS'}}),
                (200,{'imageScanStatus':{'status':'COMPLETE'}}),
            ])
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual(len(requests),3)
            self.assertEqual(result.stdout,'')

    def test_standard_cli_failure_unknown_and_exhaustion_stay_nonzero(self):
        with fixture.build_fixture() as (root,build):
            self.assertEqual(build.returncode,0,build.stderr)
            # Keep the exact production acceptors. Compress only cadence/bound
            # for exhaustion controls; the positive case uses production values.
            model=copy.deepcopy(self.waiter_model(root))
            model['waiters']['ImageScanComplete'].update(delay=0,maxAttempts=3)
            for name,response,calls in [
                ('failed',(200,{'imageScanStatus':{'status':'FAILED'}}),1),
                ('unknown-error',(400,{'__type':'AccessDeniedException','message':'synthetic denied'}),1),
                ('registration-exhausted',(400,{'__type':'ScanNotFoundException','message':'synthetic absent'}),3),
                ('unknown-status',(200,{'imageScanStatus':{'status':'UNKNOWN'}}),3),
            ]:
                with self.subTest(scenario=name):
                    result,requests=self.run_cli(root,model,[response])
                    self.assertNotEqual(result.returncode,0)
                    self.assertEqual(len(requests),calls,result.stderr)
                    self.assertIn('Waiter ImageScanComplete failed',result.stderr)

if __name__=='__main__': unittest.main()
