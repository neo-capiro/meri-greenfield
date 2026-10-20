"""Concurrent request correlation, counts and product wiring without AWS calls."""
import asyncio
import json
import threading
import unittest
from unittest.mock import patch

from apps.proxy.product import telemetry_context as telemetry, telemetry_lines as lines
from apps.proxy.product import refusal_diagnostics as diagnostics
from apps.proxy.product.main import _Resources
from apps.proxy.product.owner_channel import OwnerHostGate
from apps.proxy.qualification.runtime.lifetime import PendingWork

RUN = '11111111-1111-4111-8111-111111111111'
ATTEMPT = '22222222-2222-4222-8222-222222222222'


class TelemetryContextTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.output = []
        lines.install(write=self.output.append)
        telemetry.rollup()
        self.output.clear()

    def tearDown(self):
        lines.uninstall()
        diagnostics.uninstall()

    def records(self, event):
        return [json.loads(row) for row in self.output if json.loads(row)['event'] == event]

    async def test_concurrent_contexts_and_copied_threads_do_not_share_counters(self):
        async def run(index):
            request_id = str(index) * 32
            with telemetry.request():
                telemetry.bind({'runId': RUN, 'attemptId': ATTEMPT, 'tenantId': 'secret'}, request_id)
                await asyncio.to_thread(telemetry.count, 'aws', 'DescribeTasks', 'success', index)
                await asyncio.sleep(0)
                telemetry.count('ownerExchanges', 'operation', 'OPEN', 2 * index)
                with telemetry.request():
                    telemetry.outcome('completed')
                telemetry.finish()
                telemetry.finish()
        await asyncio.gather(run(1), run(2))
        rows = self.records('meri.model.request')
        self.assertEqual(len(rows), 2)
        self.assertEqual({row['requestId'] for row in rows}, {'1' * 32, '2' * 32})
        for row in rows:
            self.assertEqual(row['aws'], {'DescribeTasks': {'success': 1}})
            self.assertEqual(row['ownerExchanges'], {'operation': {'OPEN': 1}})
            self.assertEqual(row['outcome'], 'completed')
            self.assertNotIn('secret', json.dumps(row))

    async def test_timing_marks_keep_first_chunk_and_emit_once_at_close(self):
        clock = [100]
        with patch.object(telemetry, '_now', lambda: clock[0]):
            with telemetry.request():
                telemetry.bind({'runId': RUN, 'attemptId': ATTEMPT}, 'a' * 32)
                clock[0] = 120; telemetry.mark('bootstrapMs')
                clock[0] = 130; telemetry.mark('provider.start')
                clock[0] = 140; telemetry.mark('bedrockHeadersMs')
                clock[0] = 145; telemetry.mark('firstChunkMs')
                clock[0] = 155; telemetry.mark('firstChunkMs')
                clock[0] = 160; telemetry.mark('streamEndMs')
                result = type('Usage', (), {'input_tokens': 41, 'output_tokens': 9})()
                clock[0] = 165; telemetry.settle(160, result)
                telemetry.outcome('completed')
        row = self.records('meri.model.request')[0]
        self.assertEqual([row[name] for name in ('bootstrapMs', 'bedrockHeadersMs', 'firstChunkMs', 'streamEndMs', 'settleMs')], [20, 10, 15, 30, 5])
        self.assertEqual((row['inputTokens'], row['outputTokens']), (41, 9))

    async def test_unplaced_refusal_has_uuid_request_and_unknown_binding_even_without_text_sink(self):
        with telemetry.request():
            diagnostics.refused('bootstrap', 'timeout', TimeoutError('secret'))
            diagnostics.refused('owner', 'placement')
            telemetry.failed()
        row = self.records('meri.model.request')[0]
        self.assertEqual((row['runId'], row['attemptId']), ('unknown', 'unknown'))
        self.assertRegex(row['requestId'], '^[0-9a-f]{32}$')
        self.assertEqual(row['outcome'], 'refused')
        self.assertEqual(row['refusal'], {'gate': 'bootstrap', 'step': 'timeout', 'code': 'DEADLINE'})

    async def test_concurrent_refusals_preserve_the_first_cause(self):
        entered, release, second_started, second_finished = (threading.Event() for _ in range(4))
        original_word = lines._word

        def slow_first(value, allowed):
            if value == 'bootstrap':
                entered.set()
                if not release.wait(2):
                    raise AssertionError('first refusal was not released')
            return original_word(value, allowed)

        def later_refusal():
            second_started.set()
            diagnostics.refused('owner', 'placement')
            second_finished.set()

        with telemetry.request(), patch.object(lines, '_word', slow_first):
            first = asyncio.create_task(asyncio.to_thread(diagnostics.refused, 'bootstrap', 'timeout', TimeoutError()))
            self.assertTrue(await asyncio.to_thread(entered.wait, 1))
            second = asyncio.create_task(asyncio.to_thread(later_refusal))
            try:
                self.assertTrue(await asyncio.to_thread(second_started.wait, 1))
                self.assertFalse(await asyncio.to_thread(second_finished.wait, 0.05),
                                 'a concurrent refusal must wait for the first cause to be recorded')
            finally:
                release.set()
                await asyncio.gather(first, second)
        row = self.records('meri.model.request')[0]
        self.assertEqual(row['refusal'], {'gate': 'bootstrap', 'step': 'timeout', 'code': 'DEADLINE'})

    async def test_aws_wrapper_returns_identical_result_and_error_and_counts_once(self):
        result = object(); error = TimeoutError('secret')
        class Client:
            def describe_tasks(self, **kwargs):
                if kwargs.get('fail'):
                    raise error
                return result
            def close(self):
                pass
        resources = _Resources(); client = resources.track_client(Client(), ['describe_tasks'])
        with telemetry.request():
            self.assertIs(client.describe_tasks(), result)
            try:
                client.describe_tasks(fail=True)
            except TimeoutError as actual:
                self.assertIs(actual, error)
            else:
                self.fail('original error was not propagated')
        row = self.records('meri.model.request')[0]
        self.assertEqual(row['aws'], {'DescribeTasks': {'success': 1, 'timeout': 1}})
        self.assertEqual(row['ProxyAwsCalls'], 2)
        await resources.close()

    async def test_health_only_on_gate_and_pending_transitions(self):
        gate = OwnerHostGate()
        gate.poison(); gate.poison()
        pending = PendingWork()
        future = asyncio.get_running_loop().create_future()
        pending.quarantine(set())
        pending.quarantine({future}); pending.quarantine({future})
        future.set_result(None)
        rows = self.records('meri.health')
        self.assertEqual([(row['component'], row['transition']) for row in rows], [('owner-gate', 'poisoned'), ('pending-work', 'quarantined')])

    async def test_background_and_failed_writer_rollup_preserve_drop_count(self):
        telemetry.count('aws', 'DescribeTasks', 'success', 2)
        telemetry.count('ownerExchanges', 'capture', 'POLL', 3)
        lines.install(write=lambda _: (_ for _ in ()).throw(OSError('secret')))
        telemetry.health('pair', 'retired', 'PAIR_RETIRED')
        telemetry.rollup()
        self.assertEqual(lines.dropped(), 2)
        lines.install(write=self.output.append)
        telemetry.rollup()
        row = self.records('meri.process.rollup')[-1]
        self.assertEqual(row['TelemetryDropped'], 2)
        self.assertEqual(lines.dropped(), 0)

    async def test_same_raw_diagnostics_writer_is_used_without_refusal_rate_limit(self):
        raw = []
        diagnostics.install(write=raw.append, burst=1)
        lines.install(write=diagnostics.raw_writer)
        diagnostics.refused('bootstrap', 'busy')
        for _ in range(3):
            with telemetry.request():
                telemetry.outcome('completed')
        self.assertEqual(raw[0], b'PRODUCT_PROXY_REFUSED gate=bootstrap step=busy code=REFUSED\n')
        self.assertEqual(sum(row.startswith(b'{') for row in raw), 3)

    async def test_real_inference_lifetime_flushes_once_and_writer_failure_preserves_response(self):
        from apps.proxy.qualification.test.test_server import ServerTests
        from apps.proxy.qualification.runtime.lifetime import _request_lifetime
        async def upstream(scope, receive, send):
            await receive()
            telemetry.bind({'runId': RUN, 'attemptId': ATTEMPT}, 'a' * 32)
            self.assertIsNotNone(_request_lifetime.get())
            await send({'type': 'http.response.start', 'status': 200})
            await send({'type': 'http.response.body', 'body': b'original', 'more_body': False})
        fixture = ServerTests()
        for broken in (False, True):
            if broken:
                lines.install(write=lambda _: (_ for _ in ()).throw(OSError('secret')))
            _, scope, app, queue, sends, send = fixture.make(upstream)
            with telemetry.request():
                telemetry.count('aws', 'DescribeTasks', 'success', 1)
                await app(scope, queue.get, send)
            self.assertEqual(sends, [{'type': 'http.response.start', 'status': 200},
                                     {'type': 'http.response.body', 'body': b'original', 'more_body': False}])
            self.assertTrue(app.ready)
        rows = self.records('meri.model.request')
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0]['outcome'], rows[0]['ProxyAwsCalls']), ('completed', 1))
        self.assertEqual(lines.dropped(), 1)

    async def test_real_owner_send_counter_is_one_per_exchange_and_abort_health_is_once(self):
        from types import SimpleNamespace
        from apps.proxy.product.test.test_owner_https import exchange
        from apps.proxy.product.owner_channel import OPERATION
        item = exchange()
        response = SimpleNamespace(status=200, version=11, will_close=False, length=0,
            getheaders=lambda: [('content-type', 'application/json'), ('content-length', '2'),
                                ('cache-control', 'no-store'), ('x-meri-owner-revision', 'reviewed-v1')],
            read=lambda _: b'[]')
        sock = SimpleNamespace(settimeout=lambda _: None)
        connection = SimpleNamespace(sock=sock, request=lambda *a, **kw: None, getresponse=lambda: response)
        with telemetry.request():
            with patch.object(item, '_connect', return_value=connection), patch.object(item, '_evidence', return_value='fixture-only'):
                result = item._send('operation', OPERATION, b'[]', item.now_ms()+1000)
                self.assertEqual(result.body, b'[]')
            item.abort(); item.abort()
        row = self.records('meri.model.request')[0]
        self.assertEqual(row['ownerExchanges'], {'operation': {'OPERATION': 1}})
        self.assertEqual([(row['component'], row['transition']) for row in self.records('meri.health')],
                         [('pair', 'retired'), ('exchange', 'retired')])

    async def test_startup_telemetry_option_is_closed_optional_and_validated(self):
        from apps.proxy.product.test.test_startup_config import configuration, parse
        base = configuration()
        self.assertEqual(parse(base).value, base)
        for environment in ('Preview', 'Production'):
            base['telemetry'] = {'environment': environment}
            self.assertEqual(parse(base).value['telemetry'], {'environment': environment})
        for value in (None, {}, {'environment': None}, {'environment': 'Other'},
                      {'environment': 'Preview', 'exporter': 'https://secret.invalid'}):
            base['telemetry'] = value
            with self.assertRaises(Exception):
                parse(base)

    async def test_rollup_timer_is_owned_cancelled_and_never_rearms_after_close(self):
        from types import SimpleNamespace
        scheduled = []
        cancelled = []
        def call_later(seconds, callback):
            scheduled.append((seconds, callback))
            return SimpleNamespace(cancel=lambda: cancelled.append(True))
        timer = telemetry.RollupTimer(SimpleNamespace(call_later=call_later))
        self.assertEqual([seconds for seconds, _ in scheduled], [60])
        scheduled[-1][1]()
        self.assertEqual([seconds for seconds, _ in scheduled], [60, 60])
        self.assertEqual(len(self.records('meri.process.rollup')), 1)
        timer.close()
        scheduled[-1][1]()
        self.assertEqual(len(scheduled), 2)
        self.assertEqual(cancelled, [True])
