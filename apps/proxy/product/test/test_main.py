"""Executable boundary controls; native/AWS/socket constructors are synthetic.

These exercise the actual lifecycle and existing owner startup, not native
LiteLLM success, an mTLS handshake, AWS authorization or a model dispatch.
"""
import asyncio
from contextlib import asynccontextmanager
import hashlib
import json
from importlib import metadata, import_module
import os
from pathlib import Path
import ssl
import threading
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from apps.proxy.product import main
from apps.proxy.product.native_compatibility import FIXED_CONFIG_SHA256
from apps.proxy.product.owner_startup import ProductOwnerStartup
from apps.proxy.product.owner_channel import OwnerPeerPolicy
from apps.proxy.product.owner_https import OwnerClientTlsMaterial, ProductOwnerHttpsExchange
from apps.proxy.product.test.test_startup_config import configuration, parse
from apps.proxy.product.test.test_bearer_eni_admission import source
from apps.proxy.product.test.test_owner_admission import Exchange
from apps.proxy.product.test.test_service_pair_discovery import fixture as service_fixture
from apps.proxy.product.service_pair_discovery import compile_owner_peer, ProductServicePairDiscovery


class MainTests(unittest.IsolatedAsyncioTestCase):
    async def test_native_lifespan_boots_fixed_config_and_exits_same_context(self):
        events = []
        @asynccontextmanager
        async def original(_app):
            events.append("native-start")
            yield
            events.append("native-stop")
        app = SimpleNamespace(router=SimpleNamespace(lifespan_context=original))
        async def actual_app(*_args):
            raise AssertionError("HTTP is not dispatched in this boundary control")
        actual_app.router = app.router
        native = SimpleNamespace(app=actual_app)
        gate = SimpleNamespace(check_loaded=lambda: events.append("loaded-check"), close=lambda: None)
        resources = main._Resources()
        with patch.dict(os.environ, {}, clear=True), \
             patch.object(main.metadata, "version", return_value="1.104.2"), \
             patch.object(main, "import_module", return_value=native), \
             patch("apps.proxy.product.native_compatibility.install_native_compatibility", return_value=gate):
            result = main._native_bootstrap(resources)
            self.assertIs(result, gate)
            self.assertEqual(os.environ["CONFIG_FILE_PATH"], str(main._NATIVE_CONFIG))
            self.assertEqual(main._NATIVE_CONFIG.suffix, ".yaml")
            self.assertEqual(hashlib.sha256(main._NATIVE_CONFIG.read_bytes()).hexdigest(), FIXED_CONFIG_SHA256)
            async with actual_app.router.lifespan_context(actual_app):
                events.append("serving")
            self.assertEqual(events, ["native-start", "loaded-check", "serving", "native-stop"])
            self.assertTrue(resources.native_started and resources.native_stopped)
        await resources.close()

    async def test_lifespan_config_drift_and_pending_startup_cannot_pass(self):
        resources = main._Resources()
        ready = asyncio.Event()
        async def pending():
            await ready.wait()
        try:
            with self.assertRaises(main.CleanupUnknown):
                await main._bounded_native(pending, resources, .01)
        finally:
            ready.set()
            await asyncio.sleep(0)
            await asyncio.sleep(0)
        with self.assertRaises(main.CleanupUnknown):
            await resources.close()  # Uncertainty stays sticky even after cancellation settles.

    async def test_native_factory_timeout_stays_unknown_after_thread_late_completion(self):
        resources = main._Resources()
        entered, release, completed = threading.Event(), threading.Event(), threading.Event()
        def factory():
            entered.set(); release.wait(1); completed.set()
        try:
            with self.assertRaises(main.CleanupUnknown):
                await main._bounded_native(lambda: asyncio.to_thread(factory), resources, .01)
            self.assertTrue(entered.is_set())
            release.set()
            self.assertTrue(await asyncio.to_thread(completed.wait, .5))
            await asyncio.sleep(0)
            with self.assertRaises(main.CleanupUnknown):
                await resources.close()
        finally:
            release.set()

    async def test_retired_native_client_cannot_start_and_pending_call_is_unknown(self):
        entered, release = threading.Event(), threading.Event()
        class Client:
            closed = False
            def describe_tasks(self):
                entered.set(); release.wait(1)
                return {"synthetic": True}
            def close(self):
                self.closed = True
        client = Client(); resources = main._Resources()
        resources.track_client(client, ("describe_tasks",))
        task = asyncio.create_task(asyncio.to_thread(client.describe_tasks))
        try:
            self.assertTrue(await asyncio.to_thread(entered.wait, .5))
            with self.assertRaises(main.CleanupUnknown):
                await resources.close()
            self.assertTrue(client.closed)
            with self.assertRaises(Exception):
                client.describe_tasks()
        finally:
            release.set(); await task

    async def test_executable_uses_actual_existing_owner_startup_with_synthetic_wire_only(self):
        value = configuration()
        services = service_fixture()
        value['serviceTasks'] = services.configuration
        value['expiresAtMs'] = services.configuration['expiresAtMs']
        accepted = parse(value)
        policy = compile_owner_peer(value['ownerPeer'],services.reader().read(deadline_ms=services.at+3000))
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.minimum_version = context.maximum_version = ssl.TLSVersion.TLSv1_3
        material = OwnerClientTlsMaterial(context, policy.client_cert_sha256)
        server_tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        issued = source()[0].issued
        synthetic = Exchange(policy, issued)
        q = issued.binding
        names = ("tenantId", "actorId", "conversationId", "runId", "attemptId", "workerId", "writerFence")
        placement = [[q.run_id,q.attempt,q.worker_arn,q.fence,q.policy_revision],issued.grant_id,
            issued.cluster_arn,issued.task_definition_arn,issued.container_name,issued.image_digest,
            [issued.execution_binding[n] for n in names],issued.started_by,issued.group,
            issued.created_at_ms,issued.expires_at_ms,issued.vpc_id,issued.subnet_id,
            list(issued.security_group_ids),[list(row) for row in issued.tags]]
        loop = asyncio.get_running_loop()
        observed = []
        def wire(exchange, channel, path, body, cutoff):
            frame = json.loads(body)
            if frame[0] == "meri.proxy.placement-read/1":
                return synthetic.reply(["meri.proxy.placement/1",frame[1],frame[2],placement,
                    time.time_ns()//1000000,frame[3]],channel)
            future = asyncio.run_coroutine_threadsafe(synthetic(channel,path,body,1),loop)
            return future.result(timeout=1)
        async def server_boundary(**kwargs):
            startup = kwargs["resolve_bearer_sha256"].__self__
            self.assertIs(type(startup), ProductOwnerStartup)
            self.assertIs(type(startup.exchange), ProductOwnerHttpsExchange)
            self.assertIs(type(startup.exchange.service_pair_reader), ProductServicePairDiscovery)
            self.assertEqual(startup.exchange.policy.owner_task_arn,services.task_id('owner'))
            self.assertEqual(startup.exchange.proxy_ipv4,'10.40.4.2')
            resolved = await asyncio.to_thread(kwargs["resolve_bearer_sha256"], "a"*64)
            self.assertEqual(resolved.issued, issued)
            await asyncio.to_thread(resolved.authority.check)
            observed.append(startup)
        class Client:
            def close(self):
                pass
        gate = SimpleNamespace(close=lambda: None)
        def completed_native_boundary(resources):
            # Explicit external lifecycle fixture, not native startup proof.
            resources.native_started = resources.native_stopped = True
            return gate
        with patch.dict(os.environ, {}, clear=True), patch.object(main, "_running", False), \
             patch.object(main, "_environment"), patch.object(main.sys, "platform", "linux"), \
             patch.object(main.sys, "version_info", (3,13,5)), \
             patch.object(main, "_tls", return_value=(server_tls,policy,material)), \
             patch.object(main, "_native_bootstrap", side_effect=completed_native_boundary), \
             patch.object(main, "_clients", return_value=(services.ecs,services.ec2,Client())), \
             patch.object(main, "_provider_factory", return_value=lambda: None), \
             patch.object(ProductOwnerHttpsExchange, "_send", wire), \
             patch("apps.proxy.product.uvicorn_tls_protocol.serve_product_proxy", side_effect=server_boundary):
            await main.run_product_proxy(accepted)
        self.assertEqual(len(observed), 1)
        self.assertFalse(observed[0].exchange.available)
        self.assertFalse(observed[0].gate.available)

    async def test_unsupported_platform_refuses_before_native_import_or_client_constructor(self):
        with patch.object(main, "_running", False), patch.object(main, "_environment"), \
             patch.object(main.sys, "platform", "unsupported"), \
             patch.object(main, "_native_bootstrap") as native, patch.object(main, "_clients") as clients:
            with self.assertRaises(Exception):
                await main.run_product_proxy(parse(configuration()))
            native.assert_not_called(); clients.assert_not_called()

    def test_product_docker_recipe_preserves_pinned_separate_native_assembly(self):
        recipe = (Path(main.__file__).parent/"Dockerfile").read_text()
        self.assertIn("ARG PROXY_ASSEMBLY_IMAGE\nARG PROXY_RUNTIME_IMAGE\n"
                      "FROM ${PROXY_ASSEMBLY_IMAGE} AS assembly\nFROM ${PROXY_RUNTIME_IMAGE} AS product\n", recipe)
        self.assertEqual(recipe.count("\nFROM "), 2)
        self.assertNotIn("ARG PROXY_ASSEMBLY_IMAGE=", recipe)
        self.assertNotIn("ARG PROXY_RUNTIME_IMAGE=", recipe)
        self.assertIn('os.environ["PROXY_RUNTIME_IMAGE"]==lock["runtimeImageUri"]', recipe)
        # Wolfi packages only from the bind-mounted retained snapshot, never a layer or network.
        self.assertIn("--repositories-file /dev/null", recipe)
        self.assertIn("add --no-network --no-cache", recipe)
        instructions = "\n".join(line for line in recipe.splitlines() if not line.lstrip().startswith("#"))
        for forbidden in ("allow-untrusted", "apk upgrade", "apk update", "COPY proxy-runtime-packages",
                          "dl-cdn", "packages.wolfi.dev"):
            self.assertNotIn(forbidden, instructions)
        self.assertIn("runtime_packages verify", recipe)
        self.assertIn('"/usr/bin/dpkg","/var/lib/dpkg"', recipe)
        self.assertIn("@sha256:[0-9a-f]{64}", recipe)
        self.assertIn('"assembly-pins.json","requirements.lock"', recipe)
        self.assertIn('"boto3":"1.43.111"', recipe)
        self.assertIn("--network=none", recipe)
        self.assertIn("USER 10001:10001", recipe)
        self.assertIn("test_main.InstalledNativeStartup", recipe)
        self.assertIn('"-E", "-B", "-m", "apps.proxy.product.main"', recipe)
        self.assertNotIn("pip install", recipe)
        self.assertEqual({line.split()[1] for line in recipe.splitlines() if line.startswith("COPY --from=")},
                         {"--from=assembly"})


def _installed_native():
    try:
        return metadata.version("litellm") == "1.104.2"
    except metadata.PackageNotFoundError:
        return False


@unittest.skipUnless(_installed_native(), "pinned native packages absent; installed-native startup UNRUN")
class InstalledNativeStartup(unittest.IsolatedAsyncioTestCase):
    """Future offline image gate: real native lifespan/auth types/checks only.

    Owner wire/peer observations remain synthetic, and there is no TLS server,
    SDK model run, provider request, database, certificate or credential creation.
    """
    async def test_real_installed_lifespan_hook_projection_and_common_denial(self):
        from apps.proxy.product.test.test_native_auth import AuthTests
        from apps.proxy.product import native_auth
        from apps.proxy.qualification.runtime.lifetime import _request_lifetime
        from apps.proxy.qualification.test.test_ingress import KEY
        resources = main._Resources()
        fixture = AuthTests(methodName="test_real_product_authority_refreshes_and_projects_sha_model_only")
        fixture_started = False
        gate = None
        # HOME matches the assembly image's ENV, which production inherits; the nonroot
        # UID has no passwd entry, so clearing it breaks the real Prisma import (Path.home()).
        env = {"LITELLM_LOCAL_MODEL_COST_MAP": "True", "AWS_EC2_METADATA_DISABLED": "true",
               "AWS_SHARED_CREDENTIALS_FILE": os.devnull, "AWS_CONFIG_FILE": os.devnull,
               "HOME": "/tmp/meri-home"}
        try:
            with patch.dict(os.environ, env, clear=True), main._quiet_native_output():
                native = import_module("litellm.proxy.proxy_server")
                actual_app = native.app
                gate = main._native_bootstrap(resources)
                from apps.proxy.product.upstream_callback import load_pinned_product_litellm_invoker
                invoker = load_pinned_product_litellm_invoker()
                types = import_module("litellm.proxy._types")
                Request = import_module("starlette.requests").Request
                checks = import_module("litellm.proxy.auth.auth_checks")
                async with actual_app.router.lifespan_context(actual_app):
                    self.assertTrue(invoker.registration_current())
                    self.assertIs(native.user_custom_auth, native_auth.authenticate_product_request)
                    await fixture.asyncSetUp()
                    fixture_started = True
                    async def once():
                        return {"type": "http.request", "body": fixture.body, "more_body": False}
                    request = Request(fixture.scope, once)
                    async def probe(scope, receive, send):
                        projected = await native.user_custom_auth(request=request, api_key=KEY.decode())
                        self.assertIs(type(projected), types.UserAPIKeyAuth)
                        self.assertEqual(projected.models, [native_auth.MODEL])
                        self.assertEqual(projected.user_role, types.LitellmUserRoles.CUSTOMER)
                        # Exercise the genuine pinned common_checks denial,
                        # using an explicitly blocked synthetic team fixture.
                        with self.assertRaisesRegex(Exception, "blocked"):
                            await checks.common_checks(request_body=json.loads(fixture.body),
                                team_object=types.LiteLLM_TeamTable(team_id="synthetic-blocked", blocked=True),
                                user_object=None, end_user_object=None, global_proxy_spend=None,
                                general_settings=native.general_settings, route="/v1/messages",
                                llm_router=native.llm_router, proxy_logging_obj=native.proxy_logging_obj,
                                valid_token=projected, request=request)
                    token = _request_lifetime.set(fixture.life)
                    try:
                        await native_auth.wrap_native_app(probe)(fixture.scope, once, lambda _event: None)
                    finally:
                        _request_lifetime.reset(token)
                self.assertTrue(resources.native_started and resources.native_stopped)
        finally:
            if fixture_started:
                await fixture.asyncTearDown()
            if gate is not None:
                gate.close()
            await resources.close()


if __name__ == "__main__":
    unittest.main()
