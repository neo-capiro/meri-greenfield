"""Security properties of process-local pair leases over real discovery code."""
import json
import threading
import time
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from apps.proxy.product.pair_lease import ProductPairLease
from apps.proxy.product.service_pair_discovery import PairProofError
from apps.proxy.product.test.test_service_pair_discovery import fixture
from apps.proxy.product import telemetry_lines, refusal_diagnostics


def replace_partner(f, token, *, created=None):
    f.ids['owner'] = token
    index = int(token)
    ip, eni = '10.40.4.'+str(index), 'eni-'+token*8
    def tasks(value, _):
        task = value['tasks'][1]
        if created is not None:
            task['createdAt'] = datetime.fromtimestamp(created/1000, tz=timezone.utc)
        task['containers'][1]['networkInterfaces'][0]['privateIpv4Address'] = ip
        for detail in task['attachments'][0]['details']:
            if detail['name'] == 'networkInterfaceId':
                detail['value'] = eni
            if detail['name'] == 'privateIPv4Address':
                detail['value'] = ip
        return value
    def network(value, _):
        value['NetworkInterfaces'][1].update(NetworkInterfaceId=eni, PrivateIpAddress=ip,
            PrivateIpAddresses=[{'PrivateIpAddress': ip, 'Primary': True}])
        return value
    f.changes.update(describe_tasks=tasks, describe_network_interfaces=network)


class LeaseTests(unittest.TestCase):
    def build(self):
        f = fixture()
        wall, mono = [f.at], [0]
        reader = f.reader(now_ms=lambda: wall[0])
        holder = ProductPairLease(reader, monotonic_ms=lambda: mono[0], random_value=lambda: .5)
        holder.renew(deadline_ms=wall[0]+1000)
        self.addCleanup(holder.close)
        return f, holder, wall, mono

    def test_lease_checks_monotonic_expiry_even_after_wall_steps_and_renewer_starvation(self):
        for step in (-5000, 5000):
            f, holder, wall, mono = self.build()
            wall[0] += step
            mono[0] = 29999
            if step < 0:
                self.assertEqual(holder.require().generation, 1)
            mono[0] = 30000
            with self.assertRaisesRegex(PairProofError, 'PAIR_UNAVAILABLE'):
                holder.require()
            self.assertEqual(len(f.calls), 10, 'cached use never calls discovery')

    def test_unavailable_renewal_preserves_old_lease_then_one_bounded_sync_proof(self):
        f, holder, wall, mono = self.build()
        original = holder.current
        def unavailable(*_):
            raise TimeoutError('must never be logged')
        f.changes['describe_services'] = unavailable
        with self.assertRaisesRegex(PairProofError, 'PAIR_UNAVAILABLE'):
            holder.renew(deadline_ms=wall[0]+1000)
        self.assertIs(holder.require(), original)
        mono[0] = 30000
        before = len([method for method, _ in f.calls if method == 'describe_services'])
        with self.assertRaisesRegex(PairProofError, 'PAIR_UNAVAILABLE'):
            holder.require(deadline_ms=wall[0]+1000)
        after = len([method for method, _ in f.calls if method == 'describe_services'])
        self.assertEqual(after-before, 1)
        self.assertTrue(holder.available)

    def test_replacement_closes_generation_before_install_and_needs_fresh_socket_proof(self):
        f, holder, wall, mono = self.build()
        order, health, diagnostics = [], [], []
        holder.subscribe_generation_close(lambda generation: order.append(('close', generation, holder.current)))
        holder.subscribe_generation_install(lambda generation: order.append(('install', generation, holder.current.owner.ip)))
        telemetry_lines.install(write=lambda line: health.append(json.loads(line)))
        refusal_diagnostics.install(write=lambda line: diagnostics.append(line))
        self.addCleanup(telemetry_lines.uninstall)
        self.addCleanup(refusal_diagnostics.uninstall)
        replace_partner(f, '3', created=f.at-1000)
        lease = holder.renew(deadline_ms=wall[0]+1000)
        self.assertEqual(order, [('close', 1, None), ('install', 2, '10.40.4.3')])
        with self.assertRaisesRegex(PairProofError, 'PAIR_REPROVING'):
            holder.require()
        self.assertTrue(holder.ready)
        mono[0] = 30000
        self.assertFalse(holder.ready, 'uncompleted reproof fails readiness at its bound')
        mono[0] = 100
        fresh = holder.prove_socket(lease, owner_ip='10.40.4.3', proxy_ip='10.40.4.2', deadline_ms=wall[0]+1000)
        holder.socket_ready(fresh.generation)
        holder.socket_ready(fresh.generation)
        self.assertEqual(holder.require().generation, 2)
        self.assertEqual([line['transition'] for line in health], ['reproven'])
        self.assertEqual(len(diagnostics), 1)
        with self.assertRaisesRegex(PairProofError, 'PAIR_REPROVING'):
            holder.require(generation=1)

    def test_own_replacement_old_partner_return_and_backward_created_at_retire(self):
        for mode in ('own', 'seen', 'older', 'same-arn-new-ip'):
            with self.subTest(mode=mode):
                f, holder, wall, mono = self.build()
                if mode == 'own':
                    f.ids['proxy'] = '3'
                elif mode == 'older':
                    replace_partner(f, '3', created=f.at-20000)
                elif mode == 'same-arn-new-ip':
                    replace_partner(f, '3'); f.ids['owner'] = '1'
                else:
                    replace_partner(f, '3', created=f.at-1000)
                    holder.renew(deadline_ms=wall[0]+1000)
                    replace_partner(f, '1', created=f.at-500)
                with self.assertRaisesRegex(PairProofError, 'PAIR_DRIFT'):
                    holder.renew(deadline_ms=wall[0]+1000)
                self.assertFalse(holder.available)

    def test_fourth_reproof_within_rolling_ten_minutes_retires(self):
        f, holder, wall, mono = self.build()
        health = []
        telemetry_lines.install(write=lambda line: health.append(json.loads(line)))
        self.addCleanup(telemetry_lines.uninstall)
        for token in ('3', '4', '5'):
            replace_partner(f, token)
            lease = holder.renew(deadline_ms=wall[0]+1000)
            holder.socket_ready(lease.generation)
        replace_partner(f, '6')
        with self.assertRaisesRegex(PairProofError, 'PAIR_DRIFT'):
            holder.renew(deadline_ms=wall[0]+1000)
        self.assertFalse(holder.available)
        self.assertEqual([line['code'] for line in health if line.get('transition') == 'retired'], ['PAIR_REPROOF_LIMIT'])

    def test_retirement_preserves_reason_and_exits_once_after_resource_invalidation(self):
        for reason in ('PAIR_DRIFT', 'CARRIER_RESET_LIMIT', 'PAIR_REPROOF_LIMIT'):
            with self.subTest(reason=reason):
                f = fixture()
                order, health = [], []
                telemetry_lines.install(write=lambda line: health.append(json.loads(line)))
                self.addCleanup(telemetry_lines.uninstall)
                holder = ProductPairLease(f.reader(), on_retire=lambda: order.append(('exit', holder.available)))
                self.addCleanup(holder.close)
                holder.renew(deadline_ms=f.at+1000)
                holder.subscribe_generation_close(lambda generation: order.append(('closed', holder.current)))
                holder.retire(reason)
                holder.retire(reason)
                self.assertEqual(order, [('closed', None), ('exit', False)])
                self.assertEqual([line['code'] for line in health if line.get('transition') == 'retired'], [reason])
        f = fixture()
        holder = ProductPairLease(f.reader(), on_retire=lambda: self.fail('normal close must not terminate'))
        holder.close()
        holder.retire()

    def test_every_contradicting_pin_retires_the_holder(self):
        cases = (
            ('describe_services', lambda value: value['services'][1].update(taskDefinition='another:2')),
            ('describe_services', lambda value: value['services'][1].update(runningCount=2)),
            ('describe_task_definition', lambda value: value['taskDefinition']['containerDefinitions'][0].update(image='foreign')),
            ('describe_network_interfaces', lambda value: value['NetworkInterfaces'][0].update(Association={'PublicIp':'203.0.113.1'})),
            ('describe_network_interfaces', lambda value: value['NetworkInterfaces'][0].update(Groups=[])),
            ('describe_network_interfaces', lambda value: value['NetworkInterfaces'][0].update(SubnetId='subnet-99999999')),
        )
        for method, mutate in cases:
            with self.subTest(method=method, mutate=mutate):
                f, holder, wall, mono = self.build()
                f.changes[method] = lambda value, _, mutate=mutate: mutate(value) or value
                with self.assertRaisesRegex(PairProofError, 'PAIR_DRIFT'):
                    holder.renew(deadline_ms=wall[0]+1000)
                self.assertFalse(holder.available)

    def test_observed_drift_wins_over_simultaneous_unavailability(self):
        f, holder, wall, mono = self.build()
        f.changes['describe_services'] = lambda *_: (_ for _ in ()).throw(TimeoutError())
        def foreign(value, _):
            value['taskDefinition']['containerDefinitions'][0]['image'] = 'foreign'
            return value
        f.changes['describe_task_definition'] = foreign
        with self.assertRaisesRegex(PairProofError, 'PAIR_DRIFT'):
            holder.renew(deadline_ms=wall[0]+1000)
        self.assertFalse(holder.available)

    def test_partial_service_task_and_eni_replies_cannot_hide_observed_drift(self):
        cases = (
            ('describe_services', 'services', lambda row: row.update(desiredCount=2)),
            ('describe_tasks', 'tasks', lambda row: row.update(taskDefinitionArn='foreign:2')),
            ('describe_network_interfaces', 'NetworkInterfaces', lambda row: row.update(Association={'PublicIp':'203.0.113.1'})),
            ('describe_network_interfaces', 'NetworkInterfaces', lambda row: row.update(Groups=[])),
        )
        for method, key, contradict in cases:
            for index in (0, 1):  # Responses intentionally return proxy before owner.
                modes = ('missing',) if method == 'describe_network_interfaces' else ('missing', 'failures', 'both')
                for mode in modes:
                    with self.subTest(method=method, role=index, mode=mode):
                        f, holder, wall, mono = self.build()
                        def partial(value, _, key=key, index=index, mode=mode, contradict=contradict):
                            contradict(value[key][index])
                            if mode != 'failures':
                                value[key] = [value[key][index]]
                            if mode != 'missing':
                                value['failures'] = [{'reason':'MISSING'}]
                            return value
                        f.changes[method] = partial
                        with self.assertRaisesRegex(PairProofError, 'PAIR_DRIFT'):
                            holder.renew(deadline_ms=wall[0]+1000)
                        self.assertFalse(holder.available)

    def test_partial_consistent_replies_remain_unavailable_without_retirement(self):
        for method, key in (('describe_services', 'services'), ('describe_tasks', 'tasks'),
                            ('describe_network_interfaces', 'NetworkInterfaces')):
            with self.subTest(method=method):
                f, holder, wall, mono = self.build()
                before = holder.current
                f.changes[method] = lambda value, _, key=key: value.update({key:value[key][:1]}) or value
                with self.assertRaisesRegex(PairProofError, 'PAIR_UNAVAILABLE'):
                    holder.renew(deadline_ms=wall[0]+1000)
                self.assertTrue(holder.available)
                self.assertIs(holder.require(), before)

    def test_renewal_schedule_subtracts_discovery_and_warmup_duration(self):
        f, holder, wall, mono = self.build()
        waits = []
        class Stop:
            def wait(self, seconds):
                waits.append(seconds)
                return len(waits) > 1
            def set(self): pass
        holder._stop = Stop()
        def renew(**_): mono[0] += 2500
        def warm(): mono[0] += 3000
        holder.set_warmup(warm)
        with patch.object(holder, 'renew', side_effect=renew):
            holder._run()
        self.assertEqual(waits, [0, 4.5], '10s cadence is start-to-start, not work plus 10s')

    def test_post_handshake_proof_is_fresh_and_checks_complete_socket_identity(self):
        f, holder, wall, mono = self.build()
        lease = holder.current
        before = len(f.calls)
        fresh = holder.prove_socket(lease, owner_ip=lease.owner.ip, proxy_ip=lease.proxy.ip, deadline_ms=wall[0]+1000)
        self.assertEqual(len(f.calls)-before, 10)
        self.assertEqual(fresh.generation, lease.generation)
        with self.assertRaisesRegex(PairProofError, 'PAIR_REPROVING'):
            holder.prove_socket(lease, owner_ip='10.40.4.9', proxy_ip=lease.proxy.ip, deadline_ms=wall[0]+1000)

    def test_unsettled_discovery_is_quarantined_and_recreated_only_after_cooldown(self):
        f, holder, wall, mono = self.build()
        entered, release = threading.Event(), threading.Event()
        def stuck(value, _):
            entered.set(); release.wait(1); return value
        f.changes['describe_services'] = stuck
        reader = holder.discovery
        with self.assertRaisesRegex(PairProofError, 'PAIR_UNAVAILABLE'):
            holder.renew(deadline_ms=wall[0]+20)
        self.assertTrue(entered.is_set())
        self.assertTrue(reader.quarantined)
        self.assertTrue(holder.available)
        f.changes.clear(); release.set()
        with self.assertRaisesRegex(PairProofError, 'PAIR_UNAVAILABLE'):
            holder.renew(deadline_ms=wall[0]+1000)
        self.assertIs(holder.discovery, reader)
        mono[0] = 30000
        holder.renew(deadline_ms=wall[0]+1000)
        self.assertIsNot(holder.discovery, reader)


if __name__ == '__main__':
    unittest.main()
