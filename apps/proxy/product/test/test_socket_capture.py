"""Synthetic transport controls only; no socket, listener or TLS handshake."""
import asyncio
from contextvars import copy_context
import socket
import ssl
import threading
import time
import unittest
from unittest.mock import Mock

from apps.proxy.product.bearer_eni_admission import create_bearer_eni_trusted_resolver
from apps.proxy.product.socket_capture import DirectTlsSocketCapture
from apps.proxy.product.test.test_bearer_eni_admission import FakeAws, reader, source
from apps.proxy.qualification.state.pricing import StateDenied
from apps.proxy.qualification.test.test_ingress import SHA, fixture


def connection(ipv4="10.77.0.9", port=4321):
    # Spec'd mocks exercise runtime type/shape checks without opening a socket.
    sock = Mock(spec=socket.socket)
    sock.family, sock.type = socket.AF_INET, socket.SOCK_STREAM
    sock.fileno.return_value = 41
    sock.getpeername.return_value = (ipv4, port)
    tls = Mock(spec=ssl.SSLObject)
    tls.server_side = True
    tls.version.return_value = "TLSv1.3"
    extras = {"socket": sock, "ssl_object": tls,
              "peername": ("10.99.99.99", 9999)}
    transport = Mock(spec=asyncio.Transport)
    transport.is_closing.return_value = False
    transport.get_extra_info.side_effect = lambda key: extras.get(key)
    scope = {"type": "http", "scheme": "https", "client": (ipv4, port)}
    return transport, sock, tls, extras, scope


class SocketCaptureTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.capture = DirectTlsSocketCapture()
        self.transport, self.sock, self.tls, self.extras, self.scope = connection()

    def bind(self):
        return self.capture.bind_request(self.scope, self.transport,
                                         deadline=time.monotonic() + 10)

    async def test_socket_peer_is_read_in_off_loop_context(self):
        with self.bind():
            peer = await asyncio.to_thread(self.capture.read_direct_tls_socket, self.scope)
            self.assertEqual((peer.ipv4, peer.port, peer.tls_version),
                             ("10.77.0.9", 4321, "TLSv1.3"))
        self.assertGreaterEqual(self.sock.getpeername.call_count, 2)
        self.transport.close.assert_not_called()
        self.sock.close.assert_not_called()
        with self.assertRaises(StateDenied):
            self.capture.read_direct_tls_socket(self.scope)

    async def test_existing_bearer_resolver_uses_propagated_capture(self):
        grant, created = source()
        aws = FakeAws(grant.issued)
        aws.task["createdAt"] = created
        _, _, scope = fixture()
        resolve = create_bearer_eni_trusted_resolver(
            read_direct_tls_socket=self.capture.read_direct_tls_socket,
            resolve_bearer_sha256=lambda sha: grant if sha == SHA else None,
            observe_task_eni=reader(aws))
        with self.capture.bind_request(scope, self.transport, deadline=time.monotonic() + 10):
            trusted = await asyncio.to_thread(resolve, scope)
        self.assertEqual(trusted.admission.peer.ipv4, "10.77.0.9")
        self.assertEqual(aws.calls, 2)

    async def test_missing_or_foreign_scope_denies_and_revokes_binding(self):
        with self.assertRaises(StateDenied):
            self.capture.read_direct_tls_socket(self.scope)
        with self.bind():
            with self.assertRaises(StateDenied):
                self.capture.read_direct_tls_socket(dict(self.scope))
            with self.assertRaises(StateDenied):
                self.capture.read_direct_tls_socket(self.scope)

    async def test_scope_metadata_cannot_replace_actual_socket_peer(self):
        for key, value in (("client", ("10.77.0.10", 4321)), ("scheme", "http"),
                           ("type", "websocket")):
            with self.subTest(key=key):
                scope = {**self.scope, key: value}
                with self.assertRaises(StateDenied):
                    with self.capture.bind_request(scope, self.transport,
                                                   deadline=time.monotonic() + 10):
                        self.fail("spoofed scope admitted")

    async def test_missing_non_tls_or_closed_transports_refuse_before_binding(self):
        mutations = (
            lambda t, s, tls, e: e.update(socket=None),
            lambda t, s, tls, e: e.update(ssl_object=None),
            lambda t, s, tls, e: e.update(socket=object()),
            lambda t, s, tls, e: e.update(ssl_object=object()),
            lambda t, s, tls, e: setattr(t.is_closing, "return_value", True),
            lambda t, s, tls, e: setattr(s.fileno, "return_value", -1),
            lambda t, s, tls, e: setattr(s, "family", socket.AF_INET6),
            lambda t, s, tls, e: setattr(s, "type", socket.SOCK_DGRAM),
            lambda t, s, tls, e: setattr(tls, "server_side", False),
            lambda t, s, tls, e: setattr(tls.version, "return_value", "TLSv1.1"),
            lambda t, s, tls, e: setattr(tls.version, "return_value", None),
            lambda t, s, tls, e: setattr(s.getpeername, "side_effect", OSError("closed")),
        )
        for index, mutate in enumerate(mutations):
            with self.subTest(index=index):
                transport, sock, tls, extras, scope = connection()
                mutate(transport, sock, tls, extras)
                with self.assertRaises(StateDenied):
                    with self.capture.bind_request(scope, transport,
                                                   deadline=time.monotonic() + 10):
                        self.fail("invalid transport admitted")
        with self.assertRaises(StateDenied):
            with self.capture.bind_request(self.scope, object(), deadline=time.monotonic() + 10):
                self.fail("non-transport admitted")

    async def test_changed_socket_tls_descriptor_or_peer_permanently_revokes(self):
        mutations = (
            lambda t, s, tls, e, scope: e.update(socket=connection()[1]),
            lambda t, s, tls, e, scope: e.update(ssl_object=connection()[2]),
            lambda t, s, tls, e, scope: setattr(s.fileno, "return_value", 42),
            lambda t, s, tls, e, scope: setattr(s.getpeername, "return_value", ("10.77.0.10", 4321)),
            lambda t, s, tls, e, scope: setattr(tls.version, "return_value", "TLSv1.2"),
            lambda t, s, tls, e, scope: setattr(t.is_closing, "return_value", True),
            lambda t, s, tls, e, scope: scope.update(client=("10.77.0.10", 4321)),
        )
        for index, mutate in enumerate(mutations):
            with self.subTest(index=index):
                transport, sock, tls, extras, scope = connection()
                with self.capture.bind_request(scope, transport, deadline=time.monotonic() + 10):
                    mutate(transport, sock, tls, extras, scope)
                    with self.assertRaises(StateDenied):
                        await asyncio.to_thread(self.capture.read_direct_tls_socket, scope)
                    extras.update(socket=sock, ssl_object=tls)
                    sock.fileno.return_value = 41
                    sock.getpeername.return_value = ("10.77.0.9", 4321)
                    tls.version.return_value = "TLSv1.3"
                    transport.is_closing.return_value = False
                    scope["client"] = ("10.77.0.9", 4321)
                    with self.assertRaises(StateDenied):
                        self.capture.read_direct_tls_socket(scope)

    async def test_deadline_is_finite_bounded_and_not_refreshed(self):
        for deadline in (True, None, float("nan"), float("inf"), time.monotonic() - 1,
                         time.monotonic() + 901):
            with self.subTest(deadline=deadline):
                with self.assertRaises(StateDenied):
                    with self.capture.bind_request(self.scope, self.transport, deadline=deadline):
                        self.fail("invalid deadline admitted")
        with self.capture.bind_request(self.scope, self.transport,
                                       deadline=time.monotonic() + .01):
            await asyncio.sleep(.02)
            with self.assertRaises(StateDenied):
                self.capture.read_direct_tls_socket(self.scope)

    async def test_copied_context_and_late_thread_cannot_outlive_dispatch(self):
        gate, entered = threading.Event(), threading.Event()

        def late():
            entered.set()
            if not gate.wait(1):
                raise AssertionError("test gate timed out")
            return self.capture.read_direct_tls_socket(self.scope)

        pending = None
        try:
            with self.bind():
                copied = copy_context()
                pending = asyncio.create_task(asyncio.to_thread(late))
                self.assertTrue(await asyncio.to_thread(entered.wait, .5))
            gate.set()
            with self.assertRaises(StateDenied):
                await pending
            with self.assertRaises(StateDenied):
                copied.run(self.capture.read_direct_tls_socket, self.scope)
        finally:
            gate.set()
            if pending is not None:
                await asyncio.gather(pending, return_exceptions=True)

    async def test_cancellation_revokes_child_context(self):
        entered, wait = asyncio.Event(), asyncio.Event()
        copied = []

        async def dispatch():
            with self.bind():
                copied.append(copy_context())
                entered.set()
                await wait.wait()

        task = asyncio.create_task(dispatch())
        await entered.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        with self.assertRaises(StateDenied):
            copied[0].run(self.capture.read_direct_tls_socket, self.scope)

    async def test_parallel_dispatches_keep_distinct_peer_and_scope(self):
        entered, release = asyncio.Event(), asyncio.Event()
        count = 0

        async def dispatch(ipv4, port):
            nonlocal count
            transport, _, _, _, scope = connection(ipv4, port)
            with self.capture.bind_request(scope, transport, deadline=time.monotonic() + 10):
                count += 1
                if count == 2:
                    entered.set()
                await release.wait()
                peer = await asyncio.to_thread(self.capture.read_direct_tls_socket, scope)
                return peer.ipv4, peer.port

        tasks = [asyncio.create_task(dispatch("10.77.0.9", 4321)),
                 asyncio.create_task(dispatch("10.77.0.10", 4322))]
        try:
            await asyncio.wait_for(entered.wait(), 1)
            release.set()
            self.assertEqual(await asyncio.gather(*tasks),
                             [("10.77.0.9", 4321), ("10.77.0.10", 4322)])
        finally:
            release.set()
            await asyncio.gather(*tasks, return_exceptions=True)

    async def test_nested_binding_is_refused_without_replacing_original(self):
        with self.bind():
            with self.assertRaises(StateDenied):
                with self.bind():
                    self.fail("nested dispatch admitted")
            self.assertEqual(self.capture.read_direct_tls_socket(self.scope).ipv4, "10.77.0.9")


if __name__ == "__main__":
    unittest.main()
