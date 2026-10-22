"""Read-timeout quota boundaries on held carriers; no AWS or TLS listener."""
import asyncio
from dataclasses import replace
import http.client
import json
import socket
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from apps.proxy.product.boundary_codec import (encode_admit, encode_operation,
    encode_complete_capture, encode_reservation, encode_settlement)
from apps.proxy.product import owner_channel
from apps.proxy.product.owner_channel import (OPERATION, OwnerHostGate, OwnerTlsEvidence,
    make_product_owner_bridge)
from apps.proxy.product.owner_https import OwnerExchangeUnavailable
from apps.proxy.product.owner_startup import ProductOwnerStartup
from apps.proxy.product.test.test_owner_https import exchange
from apps.proxy.product.test.test_complete_capture_codec import capture as complete_capture
from apps.proxy.product.test_boundary_codec import reservation, usage
from apps.proxy.qualification.state.pricing import StateDenied


def read_frame(kind, deadline):
    if kind == "admit":
        return encode_admit("read_reset_001", "a" * 64, deadline)
    frame = ["meri.proxy." + kind + "-read/1", "read_reset_001", "a" * 64]
    if kind == "admission":
        frame.append(None)
    return json.dumps([*frame, deadline], separators=(",", ":")).encode()


def timeout():
    raise TimeoutError("synthetic native I/O timeout")


class OwnerHttpsResetTests(unittest.IsolatedAsyncioTestCase):
    def make_exchange(self):
        item = exchange()
        self.addCleanup(item.close)
        wall = item.fixture.at
        item.now_ms = item.pair_lease._now = lambda: wall
        mono = item.pair_lease.current.checked_at_mono_ms
        item.pair_lease._mono = lambda: mono
        retired = []
        item.pair_lease._on_retire = lambda: retired.append(True)
        return item, retired

    def held(self, item, *, channel="admission", response=None, request_error=False):
        sent, closed = [], []
        def request(*args, **kwargs):
            sent.append((args, kwargs))
            if request_error:
                timeout()
        connection = SimpleNamespace(sock=SimpleNamespace(settimeout=lambda _: None),
            request=request, getresponse=timeout if response is None else lambda: response,
            close=lambda: closed.append(True))
        item._connections[channel] = connection
        item._connection_generations[channel] = item.generation
        return connection, sent, closed

    def blocked_reply(self, item, transport_at, *, channel="admission", expire=False, expire_at=None):
        connection, sent, closed = self.held(item, channel=channel)
        entered, released = threading.Event(), threading.Event()
        def reply():
            if expire:
                transport_at[0] = expire_at if expire_at is not None else json.loads(sent[-1][1]["body"])[-1]
            entered.set()
            if not released.wait(2):
                raise AssertionError("outer cancellation did not close the native carrier")
            raise ConnectionResetError("native read released by carrier close")
        def close():
            closed.append(True)
            released.set()
        connection.getresponse, connection.close = reply, close
        self.addCleanup(released.set)
        return entered, sent, closed

    async def native_idle(self, item, channel="admission"):
        acquired = await asyncio.to_thread(item._locks[channel].acquire, timeout=1)
        self.assertTrue(acquired, "cancelled native worker must release its carrier")
        if acquired:
            item._locks[channel].release()

    async def test_five_answered_403s_do_not_spend_read_timeout_quota(self):
        item, retired = self.make_exchange()
        response = SimpleNamespace(status=403, getheaders=lambda: [("content-length", "0")])
        body = read_frame("admission", item.now_ms() + 1000)
        with patch.object(item, "_evidence", return_value="verified-held-carrier"):
            for _ in range(5):
                _, sent, closed = self.held(item, response=response)
                with self.assertRaisesRegex(StateDenied, "^PRODUCT_OWNER_HTTPS_DENIED$"):
                    await item("admission", OPERATION, body, 1)
                self.assertEqual(len(sent), 1)
                self.assertEqual(closed, [True])
                self.assertEqual(item._resets, [])
                self.assertTrue(item.available)
                self.assertFalse(item._retired)
                self.assertEqual(retired, [])

    async def test_fourth_completed_read_write_timeout_before_status_retires_once(self):
        for kind in ("admission", "admit"):
            with self.subTest(kind=kind):
                item, retired = self.make_exchange()
                body = read_frame(kind, item.now_ms() + 1000)
                channel = "operation" if kind == "admit" else "admission"
                with patch.object(item, "_evidence", return_value="verified-held-carrier"):
                    for index in range(4):
                        _, sent, closed = self.held(item, channel=channel)
                        with self.assertRaises(OwnerExchangeUnavailable):
                            await item(channel, OPERATION, body, 1)
                        self.assertEqual(len(sent), 1, "the timed-out frame is never resent")
                        self.assertEqual(closed, [True])
                        self.assertEqual(len(item._resets), index + 1)
                        self.assertEqual(item.available, index < 3)
                        self.assertEqual(retired, [] if index < 3 else [True])
                item.reset(channel)
                self.assertEqual(len(item._resets), 4)
                self.assertEqual(retired, [True])

    def test_busy_carrier_never_writes_or_spends_read_timeout_quota(self):
        item, retired = self.make_exchange()
        connection, sent, closed = self.held(item)
        body = read_frame("admission", item.now_ms() + 1000)
        with item._locks["admission"], patch.object(item, "_evidence", return_value="verified-held-carrier"):
            with self.assertRaises(OwnerExchangeUnavailable):
                item._send("admission", OPERATION, body, item.now_ms() + 1)
        self.assertIs(item._connections["admission"], connection)
        self.assertEqual(sent, [])
        self.assertEqual(closed, [])
        self.assertEqual(item._resets, [])
        self.assertTrue(item.available)
        self.assertEqual(retired, [])

    async def test_disconnect_before_status_is_not_a_read_timeout(self):
        item, retired = self.make_exchange()
        connection, sent, closed = self.held(item)
        def disconnected():
            raise ConnectionResetError("peer disconnected before any status")
        connection.getresponse = disconnected
        with patch.object(item, "_evidence", return_value="verified-held-carrier"):
            with self.assertRaises(OwnerExchangeUnavailable):
                await item("admission", OPERATION, read_frame("admission", item.now_ms() + 1000), 1)
        self.assertEqual(len(sent), 1)
        self.assertEqual(closed, [True])
        self.assertEqual(item._resets, [])
        self.assertTrue(item.available)
        self.assertEqual(retired, [])

    async def test_incomplete_native_write_does_not_spend_read_timeout_quota(self):
        item, retired = self.make_exchange()
        _, sent, closed = self.held(item, channel="operation", request_error=True)
        with patch.object(item, "_evidence", return_value="verified-held-carrier"):
            with self.assertRaises(OwnerExchangeUnavailable):
                await item("operation", OPERATION, read_frame("admit", item.now_ms() + 1000), 1)
        self.assertEqual(len(sent), 1)
        self.assertEqual(closed, [True])
        self.assertEqual(item._resets, [])
        self.assertTrue(item.available)
        self.assertEqual(retired, [])

    async def test_transport_reports_bridge_sent_only_after_native_request_completes(self):
        item, retired = self.make_exchange()
        value, observation = reservation()
        trace = []
        async def capture(_request):
            return observation
        with patch.dict(owner_channel._SERVICE_GATES, clear=True):
            bridge = make_product_owner_bridge(policy=item.policy, exchange=item, host_gate=OwnerHostGate(),
                request_id=value["requestId"], binding=value["binding"], deadline_ms=item.now_ms() + 1000,
                grant_id="grant_A", capability_sha256="a" * 64, session_id="owner_reset_session",
                now_ms=item.now_ms)(capture)
            response = SimpleNamespace(status=200, version=11, will_close=False, length=0,
                getheaders=lambda: [("content-type", "application/json"), ("content-length", "2"),
                    ("cache-control", "no-store"), ("x-meri-owner-revision", "reviewed-v1")],
                read=lambda _: b"[]")
            connection, _, closed = self.held(item, channel="operation", response=response)
            def request(*_args, **_kwargs):
                trace.append(("native-write", bridge._sent))
                self.assertFalse(bridge._sent, "dispatch alone does not prove a completed write")
            def getresponse():
                trace.append(("reply-wait", bridge._sent))
                self.assertTrue(bridge._sent, "the real transport must report before waiting for a reply")
                return response
            connection.request, connection.getresponse = request, getresponse
            p = item.policy
            evidence = OwnerTlsEvidence(p.origin, p.server_name, p.owner_task_arn, p.proxy_task_arn,
                p.server_cert_sha256, p.server_issuer_sha256, p.client_cert_sha256, p.client_subject,
                "TLSv1.3", "http/1.1", "held_operation")
            claim = encode_reservation(value, observation)
            body = encode_operation("owner_reset_session", claim, encode_reservation(value, observation))
            with patch.object(item, "_evidence", return_value=evidence):
                self.assertEqual(await bridge._exchange("operation", OPERATION, body), [])
            self.assertEqual(trace, [("native-write", False), ("reply-wait", True)])
            self.assertTrue(bridge._sent)
            self.assertEqual(closed, [])
            self.assertEqual(item._resets, [])
            self.assertEqual(retired, [])

    async def test_reservation_and_settlement_read_timeouts_do_not_spend_read_only_quota(self):
        value, observation = reservation()
        for claim, captured in (
                (encode_reservation(value, observation), encode_reservation(value, observation)),
                (encode_settlement("request_A", usage()), encode_complete_capture("request_A", complete_capture()))):
            with self.subTest(kind=json.loads(claim)[0]):
                item, retired = self.make_exchange()
                _, sent, closed = self.held(item, channel="operation")
                body = encode_operation("owner_reset_session", claim, captured)
                with patch.object(item, "_evidence", return_value="verified-held-carrier"):
                    with self.assertRaises(OwnerExchangeUnavailable):
                        await item("operation", OPERATION, body, 1)
                self.assertEqual(len(sent), 1)
                self.assertEqual(closed, [True])
                self.assertEqual(item._resets, [])
                self.assertTrue(item.available)
                self.assertEqual(retired, [])

    async def test_timeout_reading_body_after_status_does_not_spend_read_timeout_quota(self):
        item, retired = self.make_exchange()
        response = SimpleNamespace(status=200, version=11, will_close=False, length=2,
            getheaders=lambda: [("content-type", "application/json"), ("content-length", "2"),
                ("cache-control", "no-store"), ("x-meri-owner-revision", "reviewed-v1")],
            read=lambda _: timeout())
        _, sent, closed = self.held(item, response=response)
        with patch.object(item, "_evidence", return_value="verified-held-carrier"):
            with self.assertRaises(OwnerExchangeUnavailable):
                await item("admission", OPERATION, read_frame("admission", item.now_ms() + 1000), 1)
        self.assertEqual(len(sent), 1)
        self.assertEqual(closed, [True])
        self.assertEqual(item._resets, [])
        self.assertTrue(item.available)
        self.assertEqual(retired, [])

    async def test_native_status_line_then_header_timeout_does_not_spend_read_timeout_quota(self):
        item, retired = self.make_exchange()
        client, server = socket.socketpair()
        self.addCleanup(server.close)
        class NativeReadTimeout:
            def settimeout(self, value): client.settimeout(min(value, .03))
            def __getattr__(self, name): return getattr(client, name)
        connection = http.client.HTTPConnection("unused.invalid")
        connection.sock = NativeReadTimeout()
        connection.auto_open = 0
        item._register(connection.sock, "operation", item.generation)
        item._connections["operation"] = connection
        item._connection_generations["operation"] = item.generation
        # The native parser receives a status, then blocks waiting for headers.
        server.sendall(b"HTTP/1.1 200 OK\r\n")
        body = read_frame("admit", item.now_ms() + 1000)
        with patch.object(item, "_evidence", return_value="verified-held-carrier"):
            with self.assertRaises(OwnerExchangeUnavailable):
                await item("operation", OPERATION, body, 1)
        server.settimeout(1)
        self.assertTrue(server.recv(4096).endswith(body), "the complete read frame reached the peer")
        self.assertEqual(client.fileno(), -1)
        self.assertEqual(item._resets, [])
        self.assertTrue(item.available)
        self.assertEqual(retired, [])

    async def test_real_admission_and_admit_outer_deadlines_count_and_fourth_retires(self):
        for layer in ("admission", "placement"):
            with self.subTest(layer=layer), patch.dict(owner_channel._SERVICE_GATES, clear=True):
                item, retired = self.make_exchange()
                item._policy = replace(item.policy, max_exchange_ms=100)
                outer_at, transport_at = [item.fixture.at], [item.fixture.at + 5]
                item.now_ms = lambda: transport_at[0]
                startup = ProductOwnerStartup(policy=item.policy, exchange=item, host_gate=OwnerHostGate(),
                    owner_loop=asyncio.get_running_loop(), count_client=object(), make_provider_transport=lambda: None,
                    pricing_revision="f" * 64, now_ms=lambda: outer_at[0])
                self.addCleanup(startup.close)
                channel = "operation" if layer == "placement" else "admission"
                await asyncio.to_thread(lambda: None)  # Start the native worker pool before the timed read.
                # Force the real outer timer to win over the adapter's watchdog.
                # ADMIT's longer requested authority deadline is independent of
                # the short I/O cutoff passed by startup to the native adapter.
                with patch.object(item, "_remaining", return_value=1), \
                        patch.object(item, "_evidence", return_value="verified-held-carrier"):
                    for index in range(4):
                        transport_at[0] = outer_at[0] + 5
                        io_cutoff = outer_at[0] + 100
                        entered, sent, closed = self.blocked_reply(item, transport_at, channel=channel,
                            expire=True, expire_at=io_cutoff if layer == "placement" else None)
                        read_id = "outer_read_" + str(index)
                        pending = (startup.reader._read(read_id, "a" * 64, None, outer_at[0],
                            outer_at[0] + 1000, "admission", None) if layer == "admission" else
                            startup._placement("a" * 64, read_id, outer_at[0], outer_at[0] + 1000))
                        with self.assertRaises((TimeoutError, asyncio.CancelledError)):
                            await asyncio.create_task(pending)
                        await self.native_idle(item, channel)
                        self.assertTrue(entered.is_set(), "a completed read write must precede the outer timeout")
                        self.assertEqual(len(sent), 1)
                        if layer == "placement":
                            frame = json.loads(sent[0][1]["body"])
                            self.assertEqual(frame[0], "meri.proxy.admit/1")
                            self.assertGreater(frame[-1], io_cutoff,
                                "the authority deadline must not become the transport timeout")
                        self.assertEqual(closed, [True])
                        self.assertEqual(len(item._resets), index + 1)
                        self.assertEqual(item.available, index < 3)
                        self.assertEqual(retired, [] if index < 3 else [True])

    async def test_real_outer_read_cancelled_before_deadline_does_not_spend_quota(self):
        for layer in ("admission", "placement"):
            with self.subTest(layer=layer), patch.dict(owner_channel._SERVICE_GATES, clear=True):
                item, retired = self.make_exchange()
                transport_at = [item.fixture.at]
                startup = ProductOwnerStartup(policy=item.policy, exchange=item, host_gate=OwnerHostGate(),
                    owner_loop=asyncio.get_running_loop(), count_client=object(), make_provider_transport=lambda: None,
                    pricing_revision="f" * 64, now_ms=item.now_ms)
                self.addCleanup(startup.close)
                channel = "operation" if layer == "placement" else "admission"
                entered, sent, closed = self.blocked_reply(item, transport_at, channel=channel)
                with patch.object(item, "_evidence", return_value="verified-held-carrier"):
                    pending = (startup.reader._read("user_cancel", "a" * 64, None, item.now_ms(),
                        item.now_ms() + 1000, "admission", None) if layer == "admission" else
                        startup._placement("a" * 64, "user_cancel", item.now_ms(), item.now_ms() + 1000))
                    task = asyncio.create_task(pending)
                    try:
                        self.assertTrue(await asyncio.to_thread(entered.wait, 1))
                        task.cancel()
                        with self.assertRaises(asyncio.CancelledError):
                            await task
                        await self.native_idle(item, channel)
                    finally:
                        task.cancel()
                        await asyncio.gather(task, return_exceptions=True)
                self.assertEqual(len(sent), 1)
                self.assertEqual(closed, [True])
                self.assertEqual(item._resets, [])
                self.assertTrue(item.available)
                self.assertEqual(retired, [])

    async def test_real_bridge_outer_outcome_timeout_counts_the_native_pending_read_once(self):
        item, retired = self.make_exchange()
        item._policy = replace(item.policy, max_exchange_ms=100)
        value, observation = reservation()
        async def capture(_request):
            return observation
        with patch.dict(owner_channel._SERVICE_GATES, clear=True):
            bridge = make_product_owner_bridge(policy=item.policy, exchange=item, host_gate=OwnerHostGate(),
                request_id=value["requestId"], binding=value["binding"], deadline_ms=item.now_ms() + 1000,
                grant_id="grant_A", capability_sha256="a" * 64, session_id="owner_reset_session",
                now_ms=item.now_ms)(capture)
            entered, sent, closed = self.blocked_reply(item, [item.now_ms()], channel="operation")
            body = encode_operation("owner_reset_session",
                json.dumps(["meri.proxy.outcome/1", value["requestId"]]).encode(), None)
            with patch.object(item, "_remaining", return_value=1), \
                    patch.object(item, "_evidence", return_value="verified-held-carrier"):
                with self.assertRaisesRegex(TimeoutError, "PRODUCT_OWNER_CHANNEL_DEADLINE"):
                    await bridge._exchange("operation", OPERATION, body)
                await self.native_idle(item, "operation")
            self.assertTrue(entered.is_set())
            self.assertTrue(bridge._sent)
            self.assertEqual(len(sent), 1)
            self.assertEqual(closed, [True])
            self.assertEqual(len(item._resets), 1)
            self.assertTrue(item.available)
            self.assertEqual(retired, [])


if __name__ == "__main__":
    unittest.main()
