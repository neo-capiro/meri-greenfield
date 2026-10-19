"""Real installed LiteLLM route with explicit local qualification boundaries.

The outer HTTPS socket is loopback. The RFC1918 ingress/source observations and
owner IPC are fixtures; product owner HTTPS and live Core/AWS are NOT qualified.
"""
import argparse
import asyncio
import base64
from contextlib import redirect_stdout, redirect_stderr
from dataclasses import replace
import hashlib
import ipaddress
from importlib.metadata import version
import json
import os
from pathlib import Path
import socket
import sys
import time
import traceback
import uuid

from provider_stub import ProviderStub, request_observation

ROOT = Path(__file__).resolve().parents[3]
KEY = "synthetic-offline-sdk-proxy-key-000001"


def encode(value):
    if type(value) is bytes:
        return {"$bytes": base64.b64encode(value).decode()}
    if type(value) in (set, frozenset):
        return sorted(encode(item) for item in value)
    if type(value) in (tuple, list):
        return [encode(item) for item in value]
    if type(value) is dict:
        return {key: encode(item) for key, item in value.items()}
    return value


def decode(value):
    if type(value) is dict and set(value) == {"$bytes"}:
        return base64.b64decode(value["$bytes"], validate=True)
    if type(value) is list:
        return [decode(item) for item in value]
    if type(value) is dict:
        return {key: decode(item) for key, item in value.items()}
    return value


class OwnerRpc:
    """Private inherited pipes; never represented as product mTLS evidence."""
    def __init__(self, process, receipt):
        self.process, self.sequence = process, 0
        self.receipt = receipt
        self.waiters = {}
        self.reader = asyncio.create_task(self.read())

    async def write(self, value):
        self.process.stdin.write((json.dumps(encode(value), separators=(",", ":")) + "\n").encode())
        await self.process.stdin.drain()

    async def read(self):
        while line := await self.process.stdout.readline():
            message = json.loads(line)
            waiter = self.waiters.pop(message["id"], None)
            if waiter is not None and not waiter.done():
                waiter.set_result(message)
        for waiter in self.waiters.values():
            if not waiter.done():
                waiter.set_exception(RuntimeError("OFFLINE_OWNER_EXITED"))

    async def call(self, method, **values):
        self.sequence += 1
        identifier = str(self.sequence)
        waiter = asyncio.get_running_loop().create_future()
        self.waiters[identifier] = waiter
        await self.write({"id": identifier, "method": method, **values})
        result = await asyncio.wait_for(waiter, 5)
        if not result["ok"]:
            self.receipt["errors"].append({"operation": method, "code": result["code"]})
            raise RuntimeError(result["code"])
        return decode(result["value"])

    async def close(self):
        self.process.stdin.close()
        try:
            await asyncio.wait_for(self.process.wait(), 3)
        except TimeoutError:
            self.process.kill()
            await self.process.wait()
        await asyncio.gather(self.reader, return_exceptions=True)


def fixture_issued(metadata):
    """One immutable synthetic issuance, reused by every request and retry."""
    from apps.proxy.product.test.test_bearer_eni_admission import source
    from apps.proxy.qualification.state.grants import RunBinding
    b, q = metadata["binding"], metadata["qualificationBinding"]
    binding = RunBinding(q["runId"], q["attempt"], q["workerArn"], q["fence"], q["policyRevision"])
    identity = hashlib.sha256(json.dumps(b, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    template = source()[0].issued
    issued = replace(template, binding=binding, grant_id=metadata["grantId"], expires_at_ms=metadata["expiresAtMs"],
                     cluster_arn=q["workerArn"].split(":task/")[0] + ":cluster/Synthetic",
                     execution_binding=b, started_by=identity, group="meri:" + identity,
                     tags=tuple((key, identity if key in ("meri:execution-id", "meri:binding-sha256") else
                                 str(metadata["expiresAtMs"]) if key == "meri:expires-at-ms" else value)
                                for key, value in template.tags))
    return issued


def pipe_owner_exchange(policy, issued, metadata, rpc, receipt):
    """Synthetic TLS carrier only; real bridge/channel own every protocol rule."""
    from apps.proxy.product.test.test_owner_admission import Exchange
    from apps.proxy.product.owner_channel import OwnerReply

    class PipeOwnerExchange(Exchange):
        def abort(self):
            super().abort()
            receipt["ownerExchangeAborted"] = True

        async def __call__(self, channel, path, body, timeout):
            if self.aborted:
                raise RuntimeError("OFFLINE_OWNER_CARRIER_RETIRED")
            frame = json.loads(body)
            if frame[0] == "meri.proxy.admission-read/1":
                return await super().__call__(channel, path, body, timeout)
            self.calls.append((channel, path, frame, timeout))
            operation = {"meri.proxy.reservation/1": "reserve", "meri.proxy.settlement/1": "settle",
                         "meri.proxy.outcome/1": "outcome"}.get(frame[2][0]) if frame[0] == "meri.proxy.operation/1" else None
            if operation:
                operations = receipt.setdefault("ownerOperations", {})
                operations[operation] = operations.get(operation, 0) + 1
            raw = await rpc.call("wire", channel=channel, path=path, body=body)
            synthetic = self.reply([], channel)
            return OwnerReply(raw, synthetic.evidence)

    exchange = PipeOwnerExchange(policy, issued)
    exchange.source[2] = metadata["capabilitySha256"]
    exchange.source[7] = metadata["clientId"]
    return exchange


async def fixture_lifetime(metadata, scope, body, reader, issued):
    """Synthetic trusted source; real admission/bridge share one carrier/gate."""
    from apps.proxy.qualification.runtime.ingress import PeerLease, IngressAdmission
    from apps.proxy.qualification.runtime.lifetime import RequestLifetime, LifetimeLimits, PendingWork
    binding = issued.binding
    result = await asyncio.to_thread(reader.resolve_for_issued_sync, issued=issued,
                                    capability_sha256=metadata["capabilitySha256"],
                                    deadline_ms=time.time_ns() // 1000000 + 3000)
    peer = PeerLease("10.77.0.9", time.monotonic(), binding, metadata["grantId"])
    async def observe():
        return replace(peer, observed_at=time.monotonic())
    life = RequestLifetime(IngressAdmission(result.authority, peer), observe,
                           time.monotonic() + 30, LifetimeLimits(), PendingWork())
    await life.start(scope)
    life.original_body = body
    return life


async def serve(args, receipt):
    import boto3
    from botocore.config import Config
    from botocore.stub import Stubber, ANY
    import uvicorn
    from apps.proxy.product import main
    from apps.proxy.product.host_composition import ProductSession, create_guarded_product_handler
    from apps.proxy.product.upstream_callback import load_pinned_product_litellm_invoker
    from apps.proxy.product.owner_channel import OwnerHostGate, OwnerPeerPolicy, make_product_owner_bridge
    from apps.proxy.product.owner_admission import ProductOwnerAdmissionReader
    from apps.proxy.qualification.runtime.bedrock_body import BodyLimits
    from apps.proxy.qualification.runtime.lifetime import _request_lifetime
    receipt["versions"] = {"python": ".".join(map(str, sys.version_info[:3])),
        **{name: version(name) for name in ("litellm", "boto3", "botocore", "httpx", "fastapi", "uvicorn")}}
    if (receipt["versions"]["python"] != "3.13.5" or receipt["versions"]["litellm"] != "1.104.2"
            or receipt["versions"]["botocore"] != "1.43.111" or receipt["versions"]["boto3"] != "1.43.111"):
        raise RuntimeError("OFFLINE_PYTHON_DEPENDENCY_PIN_REFUSED")
    body_limits = (BodyLimits(structured_output_schema_json=args.schema_json,
        allowed_tool_names=frozenset({"StructuredOutput"})) if args.output_format == "json-schema" else BodyLimits())
    process = await asyncio.create_subprocess_exec("node", str(Path(__file__).with_name("owner_peer.mjs")), args.mode,
                                                  stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
                                                  stderr=asyncio.subprocess.DEVNULL, limit=16 * 1024 * 1024)
    rpc = OwnerRpc(process, receipt)
    metadata = await rpc.call("init")
    admission_gate = OwnerHostGate()
    policy = OwnerPeerPolicy("https://owner.invalid:8444", "owner.invalid", "owner-task", "proxy-task",
                             "1" * 64, "2" * 64, "3" * 64, "proxy-subject")
    issued = fixture_issued(metadata)
    exchange = pipe_owner_exchange(policy, issued, metadata, rpc, receipt)
    reader = ProductOwnerAdmissionReader(policy=policy, exchange=exchange, host_gate=admission_gate,
                                         owner_loop=asyncio.get_running_loop())
    resources, gate, server_task = main._Resources(), None, None
    counter = boto3.client("bedrock-runtime", region_name="us-east-1", aws_access_key_id="synthetic-offline",
                           aws_secret_access_key="synthetic-offline-never-an-account-key",
                           config=Config(region_name="us-east-1", signature_version="v4", connect_timeout=1,
                                         read_timeout=1, proxies={}, retries={"mode": "standard", "total_max_attempts": 1},
                                         ignore_configured_endpoint_urls=True))
    stub = Stubber(counter)
    for _ in range(12):
        stub.add_response("count_tokens", {"inputTokens": 12, "ResponseMetadata": {
            "RequestId": "offline-count", "HTTPStatusCode": 200, "HTTPHeaders": {},
            "RetryAttempts": 0, "MaxAttemptsReached": True}}, {"modelId": "anthropic.claude-sonnet-4-6", "input": ANY})
    stub.activate()
    def counted(**_values):
        receipt["countRequests"] += 1
    counter.meta.events.register("before-parameter-build.bedrock-runtime.CountTokens", counted)
    try:
        import litellm.proxy.proxy_server as native
        original = native.app
        gate = main._native_bootstrap(resources)
        invoker = load_pinned_product_litellm_invoker()
        async def route(scope, receive, send):
            if scope["path"] == "/api/hello":
                await send({"type": "http.response.start", "status": 200, "headers": [(b"content-type", b"application/json")]})
                await send({"type": "http.response.body", "body": b'{"offline":true}'})
                return
            parts = []
            while True:
                event = await receive()
                parts.append(event.get("body", b""))
                if not event.get("more_body", False):
                    break
            body = b"".join(parts)
            observation = request_observation(body)
            betas = [value.decode("ascii") for name, value in scope["headers"] if name == b"anthropic-beta"]
            observation["headerBetaEnums"] = [item.strip() for value in betas for item in value.split(",")
                if len(item.strip()) < 120 and all(c.isalnum() or c in "-_" for c in item.strip())]
            retry_names = {b"idempotency-key", b"x-client-request-id", b"anthropic-request-id",
                           b"x-request-id", b"request-id", b"x-stainless-retry-count"}
            observation["ingressRetryHeaders"] = [{"name": name.decode("ascii"), "bytes": len(value),
                **({"retryCount": int(value)} if name == b"x-stainless-retry-count"
                   and value.isdigit() and len(value) <= 2 else {"sha256": hashlib.sha256(value).hexdigest()})}
                for name, value in scope["headers"] if name in retry_names]
            receipt["sdkRequests"].append(observation)
            # Explicitly synthetic ingress boundary: this is not a real ECS peer.
            selected_scope = {**scope, "client": ("10.77.0.9", 4321)}
            life = await fixture_lifetime(metadata, selected_scope, body, reader, issued)
            token = _request_lifetime.set(life)
            identifier = uuid.uuid4().hex
            deadline = min(time.time_ns() // 1000000 + 25000, metadata["expiresAtMs"])
            async def current(_request):
                at = time.time_ns() // 1000000
                return {"identitySha256": "a" * 64, "binding": metadata["binding"],
                        "scopes": [{"kind": "client", "tenantId": metadata["binding"]["tenantId"],
                                    "resourceId": metadata["clientId"], "policyRevision": metadata["qualificationBinding"]["policyRevision"]}],
                        "selectedClientId": metadata["clientId"], "contextRevision": "b" * 64,
                        "checkedAtMs": at, "expiresAtMs": at + 10000}
            session = ProductSession(identifier, metadata["binding"], metadata["grantId"], deadline,
                                     metadata["clientId"], metadata["pricing"]["revision"], counter,
                                     lambda: ProviderStub(args.mode, receipt, structured=args.output_format == "json-schema"),
                                     make_product_owner_bridge(policy=policy, exchange=exchange, host_gate=admission_gate,
                                         request_id=identifier, binding=metadata["binding"], deadline_ms=deadline,
                                         grant_id=metadata["grantId"], capability_sha256=metadata["capabilitySha256"]),
                                     current, limits=body_limits)
            handler = await create_guarded_product_handler(life, session)
            async def observe_native(request):
                observation = request_observation(request.content)
                value = json.loads(request.content)
                if type(value.get("anthropic_beta")) is list:
                    observation["betaEnums"] = [item for item in value["anthropic_beta"]
                        if type(item) is str and len(item) < 120 and all(c.isalnum() or c in "-_" for c in item)]
                receipt["nativeRequests"].append({**observation,
                    "url": str(request.url), "headerNames": sorted(request.headers.keys()),
                    "nativeHeaderBetaEnums": [item.strip() for value in request.headers.get_list("anthropic-beta")
                        for item in value.split(",") if len(item.strip()) < 120
                        and all(c.isalnum() or c in "-_" for c in item.strip())]})
            handler.client.event_hooks["request"].insert(0, observe_native)
            sent = False
            async def once():
                nonlocal sent
                if not sent:
                    sent = True
                    return {"type": "http.request", "body": body, "more_body": False}
                await asyncio.sleep(60)
                return {"type": "http.disconnect"}
            try:
                await invoker(handler, selected_scope, once, send)
            except BaseException as error:
                receipt["errors"].append(type(error).__name__)
                raise
            finally:
                await handler.close()
                _request_lifetime.reset(token)
                await life.close()
                receipt["ledger"] = await rpc.call("snapshot")
                Path(args.receipt).write_text(json.dumps(receipt, indent=2) + "\n")
        async def app(scope, receive, send):
            try:
                return await route(scope, receive, send)
            except BaseException as error:
                frames = traceback.extract_tb(error.__traceback__)
                detail = {"type": type(error).__name__, "trace": [
                    {"file": Path(frame.filename).name, "line": frame.lineno, "function": frame.name}
                    for frame in frames[-8:]]}
                reason = str(error)
                if reason and len(reason) <= 100 and all(c.isupper() or c.isdigit() or c == "_" for c in reason):
                    detail["code"] = reason
                receipt["errors"].append(detail)
                raise
        # Product native bootstrap owns and checks the actual native lifespan.
        async with original.router.lifespan_context(original):
            listener = socket.socket()
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
            config = uvicorn.Config(app, host="127.0.0.1", port=port, ssl_certfile=args.cert,
                                    ssl_keyfile=args.key, log_level="critical", access_log=False,
                                    proxy_headers=False, lifespan="off")
            server = uvicorn.Server(config)
            server_task = asyncio.create_task(server.serve(sockets=[listener]))
            for _ in range(500):
                if server.started:
                    break
                if server_task.done():
                    await server_task
                await asyncio.sleep(.01)
            if not server.started:
                raise RuntimeError("OFFLINE_LISTENER_START_TIMEOUT")
            print(json.dumps({"ready": True, "port": port}), file=sys.__stdout__, flush=True)
            await asyncio.wait_for(asyncio.to_thread(sys.stdin.readline), 90)
            server.should_exit = True
            await asyncio.wait_for(server_task, 5)
    finally:
        receipt["ledger"] = await rpc.call("snapshot")
        receipt["nativeStarted"], receipt["nativeStopped"] = resources.native_started, resources.native_stopped
        receipt["ownerHostGateAvailable"] = admission_gate.available
        receipt["ownerBridge"] = "actual-ProductOwnerBridge-and-JS-owner-channel"
        receipt["ownerTlsEvidence"] = "SYNTHETIC_NOT_HTTPS_QUALIFICATION"
        await rpc.close()
        stub.deactivate()
        counter.close()
        if gate is not None:
            gate.close()
        await resources.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cert", required=True)
    parser.add_argument("--key", required=True)
    parser.add_argument("--receipt", required=True)
    parser.add_argument("--output-format", choices=("none", "json-schema"), default="none")
    parser.add_argument("--schema-json")
    parser.add_argument("--mode", default="complete", choices=("complete", "truncated", "cached", "missing-usage",
                        "reservation-ack-lost", "settlement-ack-committed", "settlement-ack-unresolved"))
    args = parser.parse_args()
    if (args.output_format == "json-schema") != (args.schema_json is not None):
        parser.error("the structured fixture requires its trusted schema argument")
    receipt = {"scope": "offline-partition-only", "fullOwnerHttps": "OPEN_RFC1918_INTERFACES_UNAVAILABLE",
               "syntheticIngress": True, "ownerTransport": "private-subprocess-IPC",
               "database": "scripted-SQL-canonical-JS-accounting", "countTransport": "botocore-Stubber",
               "providerTransport": "in-process-HTTPX-stub", "providerExecutions": 0,
               "countRequests": 0, "sdkRequests": [], "nativeRequests": [], "errors": []}
    original_connect = socket.socket.connect
    def connect(sock, address):
        if isinstance(address, tuple) and not ipaddress.ip_address(address[0]).is_loopback:
            raise RuntimeError("OFFLINE_EXTERNAL_SOCKET_DENIED")
        return original_connect(sock, address)
    socket.socket.connect = connect
    try:
        with open(os.devnull, "w") as sink, redirect_stdout(sink), redirect_stderr(sink):
            asyncio.run(serve(args, receipt))
        return 0
    except BaseException as error:
        receipt["startupOrCleanupError"] = type(error).__name__
        if isinstance(error, ModuleNotFoundError):
            receipt["missingDependency"] = error.name
        return 2
    finally:
        Path(args.receipt).write_text(json.dumps(receipt, indent=2) + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
