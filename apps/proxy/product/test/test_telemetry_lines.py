"""P0 proxy EMF privacy, boundedness and failure isolation contracts."""
import json
import unittest

from apps.proxy.product import telemetry_lines as lines

RUN = '11111111-1111-4111-8111-111111111111'
ATTEMPT = '22222222-2222-4222-8222-222222222222'


class TelemetryLineTests(unittest.TestCase):
    def setUp(self):
        self.output = []
        lines.install(write=self.output.append, now_ms=lambda: 1000)

    def tearDown(self):
        lines.uninstall()

    def fields(self):
        return dict(runId=RUN, attemptId=ATTEMPT, requestId='a' * 32, outcome='completed',
                    bootstrapMs=12, bedrockHeadersMs=2, firstChunkMs=3, streamEndMs=20,
                    settleMs=4, ownerExchangeMs=15, awsMs=5, inputTokens=100, outputTokens=9,
                    ownerExchanges={'admission': {'OPERATION': 2}, 'operation': {'OPEN': 1}},
                    aws={'DescribeTasks': {'success': 2}}, component='pair', transition='retired',
                    code='PAIR_RETIRED', windowMs=60000, telemetryDropped=0)

    def test_each_proxy_schema_has_only_safe_dimensions_and_bounded_emf(self):
        for event in sorted(lines.EVENTS):
            with self.subTest(event=event):
                self.assertTrue(lines.emit(event, self.fields()))
                raw = self.output[-1]
                self.assertLessEqual(len(raw), 8192)
                self.assertEqual(raw.count(b'\n'), 1)
                row = json.loads(raw)
                self.assertEqual((row['schema'], row['event'], row['service']), ('meri.telemetry/1', event, 'proxy'))
                self.assertEqual(row['_aws']['Timestamp'], 1000)
                for definition in row['_aws']['CloudWatchMetrics']:
                    self.assertEqual(definition['Namespace'], 'Meri/Preview')
                    for dimensions in definition['Dimensions']:
                        self.assertLessEqual(set(dimensions), {'Service', 'Outcome', 'Component', 'Attribution'})
                        for dimension in dimensions:
                            self.assertIn(dimension, row)
                if event == 'meri.model.request':
                    self.assertEqual(row['ProxyAwsCalls'], 2)
                    self.assertEqual(row['OwnerExchanges'], 3)
                    self.assertEqual(row['ModelTtftMs'], 3)
                elif event == 'meri.health':
                    self.assertEqual(row['_aws']['CloudWatchMetrics'][0]['Dimensions'], [['Service'], ['Service', 'Component']])

    def test_budget_table_schema_has_a_checked_digest_count_and_no_metrics_or_values(self):
        fields = {"hops": 278, "tableSha256": "a" * 64, "values": {"secret-hop": 123},
                  "runId": RUN, "tenantId": "private-tenant", "url": "https://private.invalid"}
        self.assertTrue(lines.emit("meri.budget.table", fields))
        row = json.loads(self.output[-1])
        self.assertEqual(row, {"schema": "meri.telemetry/1", "event": "meri.budget.table",
                              "service": "proxy", "Service": "proxy", "atMs": 1000,
                              "hops": 278, "tableSha256": "a" * 64,
                              "_aws": {"Timestamp": 1000, "CloudWatchMetrics": []}})
        for digest in ("a" * 63, "A" * 64, "g" * 64, "a" * 64 + "\n", "private-secret", None, {}):
            with self.subTest(digest=digest):
                self.assertTrue(lines.emit("meri.budget.table", {**fields, "tableSha256": digest}))
                self.assertEqual(json.loads(self.output[-1])["tableSha256"], "invalid")
        for hops in (-1, 1.5, True, 9007199254740992, None):
            with self.subTest(hops=hops):
                self.assertTrue(lines.emit("meri.budget.table", {**fields, "hops": hops}))
                self.assertIsNone(json.loads(self.output[-1])["hops"])

    def test_secret_pin_covers_every_proxy_schema_and_nested_allowed_fields(self):
        poison = {'tenantId': 'tenant-poison', 'actorId': 'actor-poison', 'bearer': 'bearer-poison',
                  'authorization': 'auth-poison', 'grantId': 'grant-poison',
                  'taskArn': 'arn:aws:ecs:us-east-1:123:task/poison', 'ip': '10.20.30.40',
                  'url': 'https://poison.example/?token=secret', 'error': 'private exception detail',
                  'sql': 'SELECT secret FROM private_table'}
        for event in sorted(lines.EVENTS):
            with self.subTest(event=event):
                value = {**self.fields(), **poison, 'headers': poison, 'body': poison}
                value['aws'].update(poison)
                value['aws']['DescribeTasks'].update(poison)
                value['ownerExchanges']['admission'].update(poison)
                value['refusal'] = {**poison, 'gate': poison['bearer'], 'step': poison['sql'], 'code': poison['authorization']}
                self.assertTrue(lines.emit(event, value))
                output = self.output[-1].decode()
                for key, item in poison.items():
                    self.assertNotIn(key, output)
                    self.assertNotIn(item, output)

    def test_proxy_rollup_exports_aws_aggregate_and_background_without_core_or_db_metrics(self):
        fields = {**self.fields(), 'aws': {'DescribeTasks': {'success': 2, 'error': 1}}}
        self.assertTrue(lines.emit('meri.process.rollup', fields))
        row = json.loads(self.output[-1])
        self.assertEqual(row['aws'], fields['aws'])
        self.assertEqual(row['Attribution'], 'background')
        self.assertEqual(row['AwsCalls'], 3)
        metrics = {metric['Name']: definition['Dimensions']
                   for definition in row['_aws']['CloudWatchMetrics'] for metric in definition['Metrics']}
        self.assertEqual(metrics, {'AwsCalls': [['Service'], ['Service', 'Attribution']],
                                   'TelemetryDropped': [['Service']]})
        self.assertNotIn('CoreCalls', row)
        self.assertNotIn('DbStatements', row)

    def test_aws_outcomes_use_error_and_reject_old_failed_label(self):
        fields = {**self.fields(), 'aws': {'DescribeTasks': {'error': 1, 'failed': 9}}}
        for event, metric in (('meri.model.request', 'ProxyAwsCalls'), ('meri.process.rollup', 'AwsCalls')):
            with self.subTest(event=event):
                self.assertTrue(lines.emit(event, fields))
                row = json.loads(self.output[-1])
                self.assertEqual(row['aws'], {'DescribeTasks': {'error': 1}})
                self.assertEqual(row[metric], 1)

    def test_ids_codes_and_numbers_reject_untrusted_values_even_with_valid_syntax(self):
        fields = {**self.fields(), 'runId': 'tenant-poison', 'attemptId': 'a' * 64,
                  'requestId': 'secret', 'firstChunkMs': float('nan'), 'inputTokens': True,
                  'component': 'credential-secret', 'code': 'secret', 'transition': 'SECRET',
                  'refusal': {'gate': 'secret', 'step': 'secret', 'code': 'secret'}}
        lines.emit('meri.model.request', fields)
        row = json.loads(self.output[-1])
        self.assertEqual([row[key] for key in ('runId', 'attemptId', 'requestId')], ['invalid'] * 3)
        self.assertEqual(row['refusal'], {'gate': 'other', 'step': 'other', 'code': 'other'})
        self.assertIsNone(row['firstChunkMs'])
        self.assertIsNone(row['inputTokens'])
        self.assertNotIn('ModelTtftMs', row)
        lines.emit('meri.health', fields)
        self.assertEqual(json.loads(self.output[-1])['code'], 'other')
        self.assertNotIn('secret', self.output[-1].decode())

    def test_production_namespace_and_explicit_invalid_environment(self):
        lines.install(write=self.output.append, environment='Production')
        lines.emit('meri.model.request', self.fields())
        self.assertEqual(json.loads(self.output[-1])['_aws']['CloudWatchMetrics'][0]['Namespace'], 'Meri/Production')
        for value in (None, '', 'development', 'secret', {}):
            with self.assertRaises(ValueError):
                lines.install(write=self.output.append, environment=value)

    def test_writer_failure_short_write_and_bad_schema_are_counted_and_never_throw(self):
        def fail(_):
            raise OSError('secret')
        lines.install(write=fail)
        self.assertFalse(lines.emit('meri.model.request', self.fields()))
        lines.install(write=lambda _: 0)
        self.assertFalse(lines.emit('meri.health', self.fields()))
        self.assertFalse(lines.emit('unknown', self.fields()))
        self.assertEqual(lines.dropped(), 3)
        lines.install(write=self.output.append)
        self.assertTrue(lines.emit('meri.process.rollup', {'telemetryDropped': lines.dropped(), 'windowMs': 60000}))
        self.assertEqual(json.loads(self.output[-1])['TelemetryDropped'], 3)

    def test_timeout_class_all_mappings(self):
        groups = {'deadline': ('DEADLINE', 'RUNTIME_STARTUP_TIMEOUT', 'RUNTIME_SHUTDOWN_TIMEOUT', 'PRODUCT_OWNER_STARTUP_TIMEOUT'),
                  'transport-timeout': ('PINNED_NATIVE_TIMEOUT', 'REMOTE_RUNNER_CLEANUP_UNKNOWN', 'SDK_CLEANUP_UNKNOWN'),
                  'upstream-unavailable': ('NATIVE_UNAVAILABLE', 'PINNED_NATIVE_STATUS_503', '503', 503, 'timeout', 'unanswered'),
                  'none': (None, 'REFUSED', 'secret')}
        for expected, codes in groups.items():
            for code in codes:
                self.assertEqual(lines.timeout_class(code), expected)
