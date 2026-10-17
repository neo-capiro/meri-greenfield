"""Explicit product proxy executable; imports never start a service.

Reviewed files and the task's container-role credential provider are the only
startup inputs. Native dependencies remain pinned by the existing Linux lock.
No provider call, credential creation or database authority belongs here.
"""
import argparse
import asyncio
from contextlib import asynccontextmanager, contextmanager, redirect_stderr, redirect_stdout
import hashlib
from importlib import import_module, metadata
import os
from pathlib import Path
import ssl
import sys
import threading
import time

from ..qualification.state.pricing import PRICING_REVISION, StateDenied
from .owner_channel import OwnerPeerPolicy
from .startup_config import (ProductProxyConfiguration, parse_product_proxy_startup,
                             read_reviewed_file, _environment)


_NATIVE_CONFIG = Path(__file__).with_name("litellm-product-config.yaml")
# Updated only with an independently reviewed change of the fixed product file.
_NATIVE_SHA = "64860d829d7c022f6640b1a75eb48ad05dc2421d8e5e2bcdfdda50b421754d19"
_running = False


def _deny():
    raise StateDenied("PRODUCT_PROXY_STARTUP_DENIED")


class CleanupUnknown(StateDenied):
    def __init__(self):
        super().__init__("PRODUCT_PROXY_CLEANUP_UNKNOWN")


class _Resources:
    """Retirement precedes cleanup; unresolved borrowed native I/O is UNKNOWN."""
    def __init__(self):
        self.lock = threading.Lock()
        self.retired = False
        self.active = 0
        self.clients = []
        self.transports = []
        self.native_pending = set()
        self.cleanup_unknown = False
        self.native_started = self.native_stopped = self.native_failed = False

    def track_client(self, client, methods):
        with self.lock:
            retired = self.retired
            if not retired:
                self.clients.append(client)
        if retired:
            client.close()  # Foreign cleanup must never hold the registry lock.
            _deny()
        for name in methods:
            original = getattr(client, name)
            def call(*args, _original=original, **kwargs):
                with self.lock:
                    if self.retired:
                        _deny()
                    self.active += 1
                try:
                    return _original(*args, **kwargs)
                finally:
                    with self.lock:
                        self.active -= 1
            setattr(client, name, call)
        return client

    async def close(self):
        with self.lock:
            self.retired = True
        work = [asyncio.create_task(asyncio.to_thread(client.close)) for client in self.clients]
        work += [asyncio.create_task(item.aclose()) for item in self.transports]
        done, pending = await asyncio.wait(work, timeout=1) if work else (set(), set())
        for task in pending:
            task.add_done_callback(lambda item: None if item.cancelled() else item.exception())
        failed = any(task.cancelled() or task.exception() is not None for task in done)
        if pending or failed or self.active or self.native_pending or self.cleanup_unknown:
            self.cleanup_unknown = True
            raise CleanupUnknown()


async def _bounded_native(factory, resources, seconds=5):
    task = asyncio.create_task(factory())
    resources.native_pending.add(task)
    def done(value):
        resources.native_pending.discard(value)
        if not value.cancelled():
            value.exception()
    task.add_done_callback(done)
    ready, _ = await asyncio.wait({task}, timeout=seconds)
    if not ready:
        resources.cleanup_unknown = True
        task.cancel()
        raise CleanupUnknown()
    return task.result()


def _native_bootstrap(resources):
    from . import native_auth
    if metadata.version("litellm") != "1.104.2":
        _deny()
    read_reviewed_file(_NATIVE_CONFIG, _NATIVE_SHA)
    os.environ["CONFIG_FILE_PATH"] = str(_NATIVE_CONFIG)
    os.environ["LITELLM_LOCAL_MODEL_COST_MAP"] = "True"
    native = import_module("litellm.proxy.proxy_server")
    # This explicit compatibility installation is version/source pinned and
    # refuses until the product-only native auth gates have been qualified.
    from .native_compatibility import install_native_compatibility
    compatibility = install_native_compatibility(native)
    original_app = native.app
    original_lifespan = original_app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(app):
        read_reviewed_file(_NATIVE_CONFIG, _NATIVE_SHA)
        context = original_lifespan(app)
        entered = False
        try:
            await _bounded_native(context.__aenter__, resources)
            entered = True
            read_reviewed_file(_NATIVE_CONFIG, _NATIVE_SHA)
            compatibility.check_loaded()
            resources.native_started = True
            yield
        except BaseException:
            resources.native_failed = True
            raise
        finally:
            if entered:
                try:
                    await _bounded_native(lambda: context.__aexit__(None, None, None), resources, 1)
                    resources.native_stopped = True
                except BaseException:
                    resources.native_failed = True
                    raise

    original_app.router.lifespan_context = lifespan
    native.app = native_auth.wrap_native_app(original_app)
    return compatibility


def _clients(resources):
    if metadata.version("botocore") != "1.43.111":
        _deny()
    session = import_module("botocore.session").get_session()
    resolver = session.get_component("credential_provider")
    providers = [item for item in resolver.providers if getattr(item, "METHOD", None) == "container-role"]
    if len(providers) != 1:
        _deny()
    resolver.providers[:] = providers
    config_type = import_module("botocore.config").Config
    config = config_type(region_name="us-east-1", signature_version="v4",
        connect_timeout=1, read_timeout=1, proxies={},
        retries={"mode": "standard", "total_max_attempts": 1},
        use_fips_endpoint=False, use_dualstack_endpoint=False,
        ignore_configured_endpoint_urls=True)
    clients = []
    for service, methods in (("ecs", ("describe_tasks",)),
                             ("ec2", ("describe_network_interfaces",)),
                             ("bedrock-runtime", ("count_tokens",))):
        client = session.create_client(service, region_name="us-east-1", config=config, verify=True)
        resources.track_client(client, methods)
        credentials = getattr(getattr(client, "_request_signer", None), "_credentials", None)
        if getattr(credentials, "method", None) != "container-role":
            _deny()
        clients.append(client)
    return tuple(clients)


def _provider_factory(resources):
    if metadata.version("httpx") != "0.28.1":
        _deny()
    httpx = import_module("httpx")

    class ProductTransport(httpx.AsyncBaseTransport):
        def __init__(self):
            self.inner = httpx.AsyncHTTPTransport(retries=0, trust_env=False, verify=True,
                                                 http1=True, http2=False)
            self.calls = set()
            self.streams = set()
            self.closed = False

        async def handle_async_request(self, request):
            if self.closed or resources.retired:
                _deny()
            task = asyncio.current_task()
            self.calls.add(task)
            try:
                response = await self.inner.handle_async_request(request)
                if self.closed or resources.retired:
                    await response.aclose()
                    _deny()
                inner = response.stream
                owner = self
                class Stream(httpx.AsyncByteStream):
                    async def __aiter__(self):
                        async for chunk in inner:
                            if owner.closed or resources.retired:
                                _deny()
                            yield chunk

                    async def aclose(self):
                        await inner.aclose()
                        owner.streams.discard(self)
                response.stream = Stream()
                self.streams.add(response.stream)
                return response
            finally:
                self.calls.discard(task)

        async def aclose(self):
            self.closed = True
            await self.inner.aclose()
            if self.calls or self.streams:
                raise CleanupUnknown()
            if self in resources.transports:
                resources.transports.remove(self)

    def make():
        if resources.retired:
            _deny()
        transport = ProductTransport()
        resources.transports.append(transport)
        return transport
    return make


def _tls(value):
    from .owner_https import load_owner_client_tls_material
    for section in ("serverTls", "ownerTls"):
        for key, ref in value[section].items():
            if key.endswith("File"):
                read_reviewed_file(ref["path"], ref["sha256"], secret=key == "privateKeyFile")
    server = value["serverTls"]
    pem = Path(server["certificateFile"]["path"]).read_text(encoding="ascii")
    leaf = pem[:pem.index("-----END CERTIFICATE-----")+len("-----END CERTIFICATE-----")]
    if hashlib.sha256(ssl.PEM_cert_to_DER_cert(leaf)).hexdigest() != server["certificateSha256"]:
        _deny()
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = context.maximum_version = ssl.TLSVersion.TLSv1_3
    context.options |= ssl.OP_NO_TICKET
    context.set_alpn_protocols(["http/1.1"])
    context.load_cert_chain(server["certificateFile"]["path"], server["privateKeyFile"]["path"])
    policy = OwnerPeerPolicy(**value["ownerPeer"])
    owner = value["ownerTls"]
    material = load_owner_client_tls_material(policy=policy, ca_file=owner["caFile"]["path"],
        certificate_file=owner["certificateFile"]["path"], private_key_file=owner["privateKeyFile"]["path"])
    # Native SSL loaders reopen explicit protected refs; verify stable custody
    # again after loading. No copied secret/config becomes an HTTP authority.
    for section in ("serverTls", "ownerTls"):
        for key, ref in value[section].items():
            if key.endswith("File"):
                read_reviewed_file(ref["path"], ref["sha256"], secret=key == "privateKeyFile")
    return context, policy, material


async def run_product_proxy(configuration):
    global _running
    if type(configuration) is not ProductProxyConfiguration or _running:
        _deny()
    _running = True
    _environment()
    if sys.platform != "linux" or sys.version_info[:2] != (3, 13):
        _deny()
    value = configuration.value
    if value["expiresAtMs"] <= time.time_ns()//1000000:
        _deny()
    resources = _Resources()
    operation = None
    compatibility = None
    try:
        context, policy, material = _tls(value)
        # Both native boto3 signing and the explicit read/count clients see
        # only the task-container credential chain, never a host profile.
        os.environ["AWS_SHARED_CREDENTIALS_FILE"] = os.devnull
        os.environ["AWS_CONFIG_FILE"] = os.devnull
        os.environ["AWS_EC2_METADATA_DISABLED"] = "true"
        os.environ["AWS_REGION"] = os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
        compatibility = _native_bootstrap(resources)
        ecs, ec2, count = await _bounded_native(lambda: asyncio.to_thread(_clients, resources), resources)
        from .uvicorn_tls_protocol import serve_product_proxy_with_owner
        operation = asyncio.create_task(serve_product_proxy_with_owner(
            enabled=True, server_tls_context=context, owner_policy=policy, owner_tls_material=material,
            owner_ipv4=value["ownerIpv4"], proxy_ipv4=value["proxyIpv4"],
            deployment_expires_at_ms=value["expiresAtMs"], deployment_revision=value["deploymentRevision"],
            ecs_client=ecs, ec2_client=ec2, count_client=count,
            make_provider_transport=_provider_factory(resources), pricing_revision=value["pricingRevision"]))
        ready, _ = await asyncio.wait({operation}, timeout=max(0, (value["expiresAtMs"]-time.time_ns()//1000000)/1000))
        if not ready:
            operation.cancel()
            _deny()
        operation.result()
        if not resources.native_started or not resources.native_stopped or resources.native_failed:
            _deny()
    finally:
        if operation is not None and not operation.done():
            operation.cancel()
            ready, _ = await asyncio.wait({operation}, timeout=1)
            if not ready:
                resources.native_pending.add(operation)
        await resources.close()
        if compatibility is not None:
            compatibility.close()


@contextmanager
def _quiet_native_output():
    # Native logging/tracebacks must not expose request bodies or task creds.
    # The executable emits only one fixed terminal status outside this scope.
    with open(os.devnull, "w", encoding="utf-8") as sink:
        with redirect_stdout(sink), redirect_stderr(sink):
            yield


def main(argv=None):
    parser = argparse.ArgumentParser(description="Explicit Meri product proxy startup")
    parser.add_argument("--config", required=True)
    parser.add_argument("--config-sha256", required=True)
    args = parser.parse_args(argv)
    loop = None
    try:
        _environment()
        raw = read_reviewed_file(args.config, args.config_sha256)
        configuration = parse_product_proxy_startup(raw, args.config_sha256)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        with _quiet_native_output():
            loop.run_until_complete(run_product_proxy(configuration))
        return 0
    except CleanupUnknown:
        # asyncio.run waits indefinitely for a borrowed native thread. The
        # executable instead terminates its own process after sticky retirement.
        os._exit(75)
    except BaseException:
        return 78
    finally:
        if loop is not None:
            pending = asyncio.all_tasks(loop)
            if pending:
                os._exit(75)
            loop.close()


if __name__ == "__main__":
    raise SystemExit(main())
