"""Offline pinned SDK checks. All HTTP sends are forbidden or synthetic fakes."""
import asyncio
import copy
import hashlib
import json
import os
from pathlib import Path
import sys
import threading
import time
import unittest
from unittest.mock import patch

if os.environ.get("AWS_EC2_METADATA_DISABLED") != "true" or os.environ.get("LITELLM_LOCAL_MODEL_COST_MAP") != "True":
    raise RuntimeError("OFFLINE_ENV_REQUIRED")
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
with patch("socket.getaddrinfo",side_effect=AssertionError("NETWORK_FORBIDDEN")):
    from botocore.session import Session
    from botocore.config import Config
    from botocore.serialize import create_serializer
    from botocore.awsrequest import AWSResponse
    from runtime.aws_counter import AwsNativeCounter
    from runtime.bedrock_body import AdmissionDenied, COUNT_MODEL_ID

RAW=b'{"anthropic_version":"bedrock-2023-05-31","max_tokens":16,"messages":[{"role":"user","content":"synthetic"}]}'
def params(raw=RAW):return {"modelId":COUNT_MODEL_ID,"input":{"invokeModel":{"body":raw}}}
def response():return {"inputTokens":7,"ResponseMetadata":{"RequestId":"synthetic","HTTPStatusCode":200,"HTTPHeaders":{},"RetryAttempts":0}}


class CounterTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.network=patch("socket.getaddrinfo",side_effect=AssertionError("NETWORK_FORBIDDEN"));self.network.start();self.addCleanup(self.network.stop)
        self.clients=[]

    def tearDown(self):
        for client in self.clients:client.close()

    def client(self,*,real_operation=False,**changes):
        values=dict(region_name="us-east-1",signature_version="v4",connect_timeout=.01,read_timeout=.02,
                    retries={"mode":"standard","total_max_attempts":1},proxies={},ignore_configured_endpoint_urls=True)
        endpoint=changes.pop("endpoint_url",None);values.update(changes)
        client=Session().create_client("bedrock-runtime",region_name="us-east-1",endpoint_url=endpoint,aws_access_key_id="SYNTHETIC-NOT-CREDENTIAL",aws_secret_access_key="SYNTHETIC-NOT-SECRET",config=Config(**values))
        self.clients.append(client)
        self.calls=[]
        if not real_operation:
            client._endpoint.make_request=lambda *a,**k:(_ for _ in ()).throw(AssertionError("SEND_FORBIDDEN"))
            def fake(**kwargs):self.calls.append(kwargs);return response()
            client.count_tokens=fake
        return client

    async def test_exact_final_bytes_and_foundation_count_observation(self):
        client=self.client();counter=AwsNativeCounter(client,deadline=time.monotonic()+2)
        value=await counter.count(params())
        self.assertEqual((value.input_tokens,value.model_id,value.origin),(7,COUNT_MODEL_ID,"aws-counttokens"))
        self.assertEqual(value.native_body_sha256,hashlib.sha256(RAW).hexdigest());self.assertEqual(self.calls,[params()])
        # Installed serializer accepts Blob bytes and independently base64 encodes.
        op=client.meta.service_model.operation_model("CountTokens")
        encoded=create_serializer(client.meta.service_model.protocol).serialize_to_request(params(),op)
        import base64
        self.assertEqual(base64.b64decode(json.loads(encoded["body"])["input"]["invokeModel"]["body"]),RAW)
        with self.assertRaisesRegex(AdmissionDenied,"SECOND_COUNT"):await counter.count(params())

    async def test_invalid_count_parameters_and_native_features_never_call(self):
        bad=[{}, {**params(),"modelId":"us."+COUNT_MODEL_ID}, {**params(),"extra":1},
             {"modelId":COUNT_MODEL_ID,"input":{"converse":{}}}, params(bytearray(RAW)),params(RAW[:-1]),
             params(RAW.replace(b'"max_tokens":16',b'"max_tokens":16,"thinking":{}'))]
        for item in bad:
            client=self.client();counter=AwsNativeCounter(client,deadline=time.monotonic()+2)
            with self.assertRaises(AdmissionDenied):await counter.count(item)
            self.assertEqual(self.calls,[])

    async def test_real_sdk_serializes_signs_parses_one_fake_http_200(self):
        # Keep count_tokens, serializer, signer, endpoint and retry checker REAL.
        # Replace only the lowest HTTP send boundary; no socket/network operation.
        client=self.client(real_operation=True);sent=[]
        class SyntheticRaw:
            def stream(self):yield b'{"inputTokens":7}'
        def send(request):
            sent.append(request)
            return AWSResponse(request.url,200,{"content-type":"application/json","x-amzn-requestid":"synthetic-operation"},SyntheticRaw())
        client._endpoint.http_session.send=send
        client.meta.events.register("after-call.bedrock-runtime.CountTokens",lambda parsed,**kwargs:observed.append(copy.deepcopy(parsed)))
        observed=[]
        counter=AwsNativeCounter(client,deadline=time.monotonic()+5)
        value=await counter.count(params())
        self.assertEqual((value.input_tokens,value.model_id,value.origin),(7,COUNT_MODEL_ID,"aws-counttokens"))
        self.assertEqual(value.native_body_sha256,hashlib.sha256(RAW).hexdigest())
        self.assertEqual(len(sent),1);self.assertEqual(len(observed),1)
        metadata=observed[0]["ResponseMetadata"]
        self.assertEqual(set(metadata),{"RequestId","HTTPStatusCode","HTTPHeaders","MaxAttemptsReached","RetryAttempts"})
        self.assertIs(metadata["MaxAttemptsReached"],True);self.assertEqual(metadata["RetryAttempts"],0)
        request=sent[0];self.assertEqual(request.method,"POST")
        self.assertEqual(request.url,"https://bedrock-runtime.us-east-1.amazonaws.com/model/anthropic.claude-sonnet-4-6/count-tokens")
        import base64
        serialized=json.loads(request.body)
        self.assertEqual(set(serialized),{"input"});self.assertEqual(set(serialized["input"]),{"invokeModel"})
        self.assertEqual(set(serialized["input"]["invokeModel"]),{"body"})
        self.assertEqual(base64.b64decode(serialized["input"]["invokeModel"]["body"],validate=True),RAW)
        auth=request.headers["Authorization"]
        if type(auth) is bytes:auth=auth.decode("ascii")
        self.assertTrue(auth.startswith("AWS4-HMAC-SHA256 "))
        self.assertIn("/us-east-1/bedrock/aws4_request",auth)
        # Never print or retain the synthetic Authorization value.
        with self.assertRaisesRegex(AdmissionDenied,"SECOND_COUNT"):await counter.count(params())
        self.assertEqual(len(sent),1)

    async def test_client_policy_and_endpoint_refuse(self):
        for options in ({"retries":{"mode":"standard","total_max_attempts":2}}, {"proxies":None},
                        {"endpoint_url":"https://foreign.invalid"},{"endpoint_url":"https://bedrock-runtime.us-east-1.amazonaws.com"},
                        {"connect_timeout":31},{"read_timeout":float("inf")},
                        {"signature_version":"v4a"}):
            with self.subTest(options=repr(options)):
                client=self.client(**options)
                with self.assertRaises(AdmissionDenied):AwsNativeCounter(client,deadline=time.monotonic()+60)
        client=self.client();client.meta._endpoint_url="https://foreign.invalid"
        with self.assertRaises(AdmissionDenied):AwsNativeCounter(client,deadline=time.monotonic()+2)
        client=self.client();client._endpoint.http_session._verify=False
        with self.assertRaises(AdmissionDenied):AwsNativeCounter(client,deadline=time.monotonic()+2)
        with self.assertRaises(AdmissionDenied):AwsNativeCounter(object(),deadline=time.monotonic()+2)
        client=self.client();client._ruleset_resolver._builtins["SDK::Endpoint"]="https://foreign.invalid"
        with self.assertRaises(AdmissionDenied):AwsNativeCounter(client,deadline=time.monotonic()+2)

    async def test_config_drift_is_rechecked_before_call(self):
        client=self.client();counter=AwsNativeCounter(client,deadline=time.monotonic()+2)
        client.meta.config.retries["total_max_attempts"]=2
        with self.assertRaises(AdmissionDenied):await counter.count(params())
        self.assertEqual(self.calls,[])

    async def test_effective_socket_timeout_must_match_config(self):
        client=self.client();counter=AwsNativeCounter(client,deadline=time.monotonic()+2)
        client.meta.config.read_timeout=.001
        with self.assertRaisesRegex(AdmissionDenied,"COUNT_SOCKET_TIMEOUT_DRIFT"):await counter.count(params())
        self.assertEqual(self.calls,[])

    async def test_bad_response_never_returns_observation(self):
        bad=[{}, {"inputTokens":7}, {**response(),"extra":1}]
        for n in (True,-1,0,65537,7.0):bad.append({**response(),"inputTokens":n})
        for key,value in (("HTTPStatusCode",500),("HTTPStatusCode",True),("RetryAttempts",1),("RetryAttempts",False),("RequestId",None)):
            r=response();r["ResponseMetadata"][key]=value;bad.append(r)
        for value in (False,"true",1,None,[]):
            r=response();r["ResponseMetadata"]["MaxAttemptsReached"]=value;bad.append(r)
        r=response();r["ResponseMetadata"]["UnknownRetryField"]=True;bad.append(r)
        for r in bad:
            client=self.client();calls=[]
            def bad_response(**kwargs):calls.append(kwargs);return r
            client.count_tokens=bad_response
            with self.assertRaises(AdmissionDenied):await AwsNativeCounter(client,deadline=time.monotonic()+2).count(params())
            self.assertEqual(len(calls),1)

    async def test_failure_scrubbed_and_no_retry(self):
        client=self.client();calls=[]
        def fail(**kwargs):calls.append(kwargs);raise RuntimeError("UNSAFE-DETAIL")
        client.count_tokens=fail
        with self.assertRaisesRegex(AdmissionDenied,"^AWS_COUNT_FAILED$") as caught:
            await AwsNativeCounter(client,deadline=time.monotonic()+2).count(params())
        self.assertNotIn("UNSAFE",str(caught.exception));self.assertEqual(len(calls),1)

    async def test_deadline_expired_before_and_after_count(self):
        client=self.client()
        with self.assertRaises(AdmissionDenied):AwsNativeCounter(client,deadline=1,clock=lambda:2)
        now=[1.0];counter=AwsNativeCounter(client,deadline=2,clock=lambda:now[0])
        def late(**kwargs):now[0]=3;return response()
        client.count_tokens=late
        with self.assertRaisesRegex(AdmissionDenied,"DEADLINE_EXPIRED"):await counter.count(params())

    async def test_cancel_does_not_authorize_second_attempt(self):
        client=self.client();entered=threading.Event();release=threading.Event();finished=threading.Event()
        def slow(**kwargs):
            entered.set();release.wait(1);finished.set();return response()
        client.count_tokens=slow;counter=AwsNativeCounter(client,deadline=time.monotonic()+2)
        task=asyncio.create_task(counter.count(params()))
        try:
            for _ in range(100):
                if entered.is_set():break
                await asyncio.sleep(.002)
            self.assertTrue(entered.is_set());task.cancel()
            with self.assertRaises(asyncio.CancelledError):await task
            with self.assertRaises(AdmissionDenied):await counter.count(params())
        finally:release.set()
        for _ in range(100):
            if finished.is_set():break
            await asyncio.sleep(.002)
        self.assertTrue(finished.is_set())

    async def test_timeout_denies_with_no_count_retry(self):
        client=self.client();release=threading.Event();finished=threading.Event();calls=[]
        def slow(**kwargs):
            calls.append(kwargs);release.wait(1);finished.set();return response()
        client.count_tokens=slow;counter=AwsNativeCounter(client,deadline=time.monotonic()+.08)
        try:
            with self.assertRaisesRegex(AdmissionDenied,"AWS_COUNT_FAILED"):await counter.count(params())
            with self.assertRaises(AdmissionDenied):await counter.count(params())
        finally:release.set()
        for _ in range(100):
            if finished.is_set():break
            await asyncio.sleep(.002)
        self.assertTrue(finished.is_set());self.assertEqual(len(calls),1)

if __name__=="__main__":unittest.main()
