"""Partner restart observations through real discovery and generation ownership."""
import copy
from datetime import datetime, timezone
import unittest
from unittest.mock import patch

from apps.proxy.product.pair_lease import ProductPairLease
from apps.proxy.product.service_pair_discovery import PairProofError
from apps.proxy.product.test.test_service_pair_discovery import fixture, PREFIX


def replacement_fixture(*, rolling=False, pending_status='PENDING', unplaced=False, draining_desired=0):
    f = fixture()
    stage = ['running']
    owner_id = lambda token: PREFIX+'task/capiro-dev/'+token*32

    def selected():
        return (['1', '3', '4'] if stage[0] == 'overfull' else
                [] if stage[0] == 'gap' else ['1', '3'] if stage[0] == 'rolling'
                else ['1'] if stage[0] == 'running' else ['3'])

    def services(value, _):
        for s in value['services']:
            s['deploymentController'] = {'type': 'ECS'}
            s['deploymentConfiguration'] = {'strategy': 'ROLLING', 'maximumPercent': 200, 'minimumHealthyPercent': 100}
        s = value['services'][1]
        d = s['deployments'][0]
        if stage[0] == 'gap':
            s['runningCount'] = d['runningCount'] = 0
        elif stage[0] == 'pending':
            s['runningCount'] = d['runningCount'] = 0
            s['pendingCount'] = d['pendingCount'] = 1
        if rolling and stage[0] != 'running':
            d.update(id='ecs-svc/3', rolloutState='IN_PROGRESS')
            if stage[0] in ('rolling', 'overfull'):
                old = copy.deepcopy(d)
                old.update(id='ecs-svc/1', status='ACTIVE', desiredCount=draining_desired, rolloutState='COMPLETED')
                s['deployments'].append(old)
                s['runningCount'] = 2
        return value

    def members(value, args):
        if args['serviceName'] == 'meri-owner':
            value['taskArns'] = [owner_id(token) for token in selected()]
        return value

    def tasks(value, args):
        proxy, owner = value['tasks']
        owners = []
        for token in selected():
            task = copy.deepcopy(owner)
            task['taskArn'] = owner_id(token)
            if token == '3':
                task['createdAt'] = datetime.fromtimestamp((f.at-1000)/1000, tz=timezone.utc)
            task['startedBy'] = 'ecs-svc/'+('1' if token == '1' else '3') if rolling else 'ecs-svc/1'
            for container in task['containers']:
                container['taskArn'] = task['taskArn']
            c = task['containers'][1]
            c['containerArn'] = PREFIX+'container/capiro-dev/'+token*32+'/11111111-1111-4111-8111-111111111111'
            c['networkInterfaces'][0]['privateIpv4Address'] = '10.40.4.'+token
            for detail in task['attachments'][0]['details']:
                if detail['name'] == 'networkInterfaceId':
                    detail['value'] = 'eni-'+token*8
                if detail['name'] == 'privateIPv4Address':
                    detail['value'] = '10.40.4.'+token
            if stage[0] == 'pending':
                task['lastStatus'] = c['lastStatus'] = pending_status
                if unplaced:
                    del c['imageDigest']
                    del c['containerArn']
                    del c['networkInterfaces']
                    task['attachments'] = []
            owners.append(task)
        value['tasks'] = [proxy, *owners]
        assert set(args['tasks']) == {row['taskArn'] for row in value['tasks']}
        return value

    def network(value, args):
        proxy, owner = value['NetworkInterfaces']
        owners = []
        for token in selected():
            row = copy.deepcopy(owner)
            row.update(NetworkInterfaceId='eni-'+token*8, PrivateIpAddress='10.40.4.'+token,
                       PrivateIpAddresses=[{'PrivateIpAddress': '10.40.4.'+token, 'Primary': True}])
            if row['NetworkInterfaceId'] in args['NetworkInterfaceIds']:
                owners.append(row)
        value['NetworkInterfaces'] = [proxy, *owners]
        return value

    f.changes.update(describe_services=services, list_tasks=members, describe_tasks=tasks, describe_network_interfaces=network)
    f.stage = stage
    return f


class PartnerReplacementTests(unittest.TestCase):
    def holder(self, f):
        wall, mono = [f.at], [0]
        h = ProductPairLease(f.reader(now_ms=lambda: wall[0]), monotonic_ms=lambda: mono[0])
        self.addCleanup(h.close)
        return h, wall, mono

    def complete_sequence(self, f, stages):
        h, wall, mono = self.holder(f)
        with patch('apps.proxy.product.telemetry_context.health') as health:
            initial = h.renew(deadline_ms=wall[0]+1000)
            for stage in stages:
                f.stage[0] = stage
                mono[0] += 1000
                with self.assertRaisesRegex(PairProofError, '^PAIR_UNAVAILABLE$'):
                    h.renew(deadline_ms=wall[0]+1000)
                self.assertIs(h.current, initial, 'transitional read publishes no lease')
                self.assertEqual(h.generation, 1, 'transitional read publishes no generation')
                self.assertTrue(h.available)
            f.stage[0] = 'replacement'
            lease = h.renew(deadline_ms=wall[0]+1000)
            self.assertEqual(lease.generation, 2)
            self.assertTrue(h.reproving)
            fresh = h.prove_socket(lease, owner_ip='10.40.4.3', proxy_ip='10.40.4.2', deadline_ms=wall[0]+1000)
            h.socket_ready(fresh.generation)
            h.socket_ready(fresh.generation)
            self.assertEqual(h.require().generation, 2)
            self.assertTrue(h.ready)
            self.assertEqual(health.call_args_list, [(('pair', 'reproven', 'PAIR_REPROVEN'),)])

    def test_stop_task_gap_pending_and_running_reproves_once_without_retirement(self):
        self.complete_sequence(replacement_fixture(), ['gap', 'pending'])

    def test_same_revision_rolling_two_running_then_one_reproves_once_without_retirement(self):
        for desired in (0, 1):
            with self.subTest(draining_desired=desired):
                self.complete_sequence(replacement_fixture(rolling=True, draining_desired=desired), ['rolling'])

    def midproof_replacement_sequence(self, *, rolling, initial, final):
        f = replacement_fixture(rolling=rolling)
        h, wall, mono = self.holder(f)
        with patch('apps.proxy.product.telemetry_context.health') as health:
            lease = h.renew(deadline_ms=wall[0]+1000)
            f.stage[0] = initial
            original = f.changes['describe_network_interfaces']
            def transition(value, args):
                original(value, args)
                f.stage[0] = final
                return value
            f.changes['describe_network_interfaces'] = transition
            f.calls.clear()
            with self.assertRaisesRegex(PairProofError, '^PAIR_UNAVAILABLE$'):
                h.renew(deadline_ms=wall[0]+1000)
            replacement_id = PREFIX+'task/capiro-dev/'+'3'*32
            self.assertTrue(all(replacement_id not in args['tasks'] for method, args in f.calls
                                if method == 'describe_tasks'), 'final newcomer was not inspected')
            self.assertIs(h.current, lease, 'an uninspected newcomer publishes no lease')
            self.assertEqual(h.generation, 1, 'an uninspected newcomer publishes no generation')
            self.assertTrue(h.available, 'the survivor is not retired')
            self.assertFalse(h.reproving)
            health.assert_not_called()

            # The next renewal inspects the newcomer fully; its pending/rolling
            # snapshot remains unavailable until there is one running primary.
            f.changes['describe_network_interfaces'] = original
            f.calls.clear()
            mono[0] += 1000
            with self.assertRaisesRegex(PairProofError, '^PAIR_UNAVAILABLE$'):
                h.renew(deadline_ms=wall[0]+1000)
            self.assertTrue(any(replacement_id in args['tasks'] for method, args in f.calls
                                if method == 'describe_tasks'))
            self.assertIs(h.current, lease)
            self.assertEqual(h.generation, 1)
            self.assertTrue(h.available)
            f.stage[0] = 'replacement'
            fresh = h.renew(deadline_ms=wall[0]+1000)
            self.assertEqual(fresh.generation, 2)
            self.assertTrue(h.reproving)
            proven = h.prove_socket(fresh, owner_ip='10.40.4.3', proxy_ip='10.40.4.2', deadline_ms=wall[0]+1000)
            h.socket_ready(proven.generation)
            h.socket_ready(proven.generation)
            h.renew(deadline_ms=wall[0]+1000)
            self.assertEqual(h.require().generation, 2)
            self.assertTrue(h.ready)
            self.assertEqual(health.call_args_list, [(('pair', 'reproven', 'PAIR_REPROVEN'),)])

    def test_stop_task_replacement_arriving_during_proof_reproves_once_without_retirement(self):
        self.midproof_replacement_sequence(rolling=False, initial='gap', final='pending')

    def test_force_new_deployment_arriving_during_proof_reproves_once_without_retirement(self):
        self.midproof_replacement_sequence(rolling=True, initial='running', final='rolling')

    def test_final_two_partner_members_without_pinned_rolling_are_drift(self):
        f = replacement_fixture()
        network = f.changes['describe_network_interfaces']
        def transition(value, args):
            network(value, args)
            # Membership overlaps, but the final service remains nonrolling.
            f.stage[0] = 'rolling'
            return value
        f.changes['describe_network_interfaces'] = transition
        reader = f.reader()
        with self.assertRaisesRegex(PairProofError, '^PAIR_DRIFT$'):
            reader.read(deadline_ms=f.at+1000)
        self.assertIsNone(reader.last_observation)

    def test_midproof_partner_replacement_preserves_final_pin_checks(self):
        for mode in ('task-definition', 'primary-count', 'network', 'duplicate-member', 'foreign-member', 'cross-service-member'):
            with self.subTest(mode=mode):
                f = replacement_fixture(rolling=True)
                network = f.changes['describe_network_interfaces']
                services, members = f.changes['describe_services'], f.changes['list_tasks']
                def transition(value, args):
                    network(value, args)
                    f.stage[0] = 'rolling'
                    return value
                def final_services(value, args):
                    services(value, args)
                    if f.stage[0] == 'rolling':
                        owner = value['services'][1]
                        if mode == 'task-definition':
                            owner['deployments'][0]['taskDefinition'] = PREFIX+'task-definition/foreign:4'
                        elif mode == 'primary-count':
                            owner['deployments'][0]['runningCount'] = 2
                        elif mode == 'network':
                            owner['networkConfiguration']['awsvpcConfiguration']['securityGroups'] = ['sg-99999999']
                    return value
                def final_members(value, args):
                    members(value, args)
                    if f.stage[0] == 'rolling' and args['serviceName'] == 'meri-owner':
                        if mode == 'duplicate-member':
                            value['taskArns'] = [value['taskArns'][1]]*2
                        elif mode == 'foreign-member':
                            value['taskArns'] = ['foreign']
                        elif mode == 'cross-service-member':
                            value['taskArns'] = [f.task_id('proxy')]
                    return value
                f.changes.update(describe_network_interfaces=transition, describe_services=final_services,
                                 list_tasks=final_members)
                reader = f.reader()
                with self.assertRaisesRegex(PairProofError, '^PAIR_DRIFT$'):
                    reader.read(deadline_ms=f.at+1000)
                self.assertIsNone(reader.last_observation)

    def test_three_distinct_running_partner_members_are_drift_even_during_pinned_rolling(self):
        for rolling in (False, True):
            with self.subTest(rolling=rolling):
                f = replacement_fixture(rolling=rolling); f.stage[0] = 'overfull'
                reader = f.reader()
                with self.assertRaisesRegex(PairProofError, '^PAIR_DRIFT$'):
                    reader.read(deadline_ms=f.at+1000)
                self.assertIsNone(reader.last_observation)

    def test_single_running_primary_in_progress_is_a_passing_proof_without_opt_in(self):
        f = replacement_fixture(rolling=True)
        f.stage[0] = 'replacement'
        self.assertFalse(f.configuration['owner'].get('allowPrimaryInProgress', False))
        proof = f.reader().read(deadline_ms=f.at+1000)
        self.assertEqual(proof['owner']['taskArn'], PREFIX+'task/capiro-dev/'+'3'*32)

    def test_empty_partner_inventory_with_stale_running_count_is_unavailable(self):
        f = replacement_fixture(); f.stage[0] = 'gap'
        original = f.changes['describe_services']
        def stale(value, args):
            original(value, args)
            value['services'][1]['runningCount'] = 1
            value['services'][1]['deployments'][0]['runningCount'] = 1
            return value
        f.changes['describe_services'] = stale
        reader = f.reader()
        with self.assertRaisesRegex(PairProofError, '^PAIR_UNAVAILABLE$'):
            reader.read(deadline_ms=f.at+1000)
        self.assertIsNone(reader.last_observation)

    def test_allowed_partner_transition_during_final_recheck_is_unavailable(self):
        for rolling, initial, final in ((False, 'running', 'gap'), (True, 'rolling', 'replacement')):
            with self.subTest(initial=initial, final=final):
                f = replacement_fixture(rolling=rolling); f.stage[0] = initial
                original = f.changes['describe_network_interfaces']
                def transition(value, args):
                    original(value, args)
                    f.stage[0] = final
                    return value
                f.changes['describe_network_interfaces'] = transition
                reader = f.reader()
                with self.assertRaisesRegex(PairProofError, '^PAIR_UNAVAILABLE$'):
                    reader.read(deadline_ms=f.at+1000)
                self.assertIsNone(reader.last_observation)
                self.assertTrue(reader.available)

    def test_final_service_gap_with_stale_inventory_is_unavailable(self):
        f = replacement_fixture()
        original = f.changes['describe_network_interfaces']
        def transition(value, args):
            original(value, args)
            f.stage[0] = 'gap'
            return value
        f.changes['describe_network_interfaces'] = transition
        # The final ListTasks snapshot can lag the service count update.
        f.changes['list_tasks'] = lambda value, _args: value
        with self.assertRaisesRegex(PairProofError, '^PAIR_UNAVAILABLE$'):
            f.reader().read(deadline_ms=f.at+1000)

    def test_pending_members_with_missing_placement_never_publish_a_proof(self):
        for status in ('PROVISIONING', 'PENDING', 'ACTIVATING'):
            for unplaced in (False, True):
                with self.subTest(status=status, unplaced=unplaced):
                    f = replacement_fixture(pending_status=status, unplaced=unplaced)
                    f.stage[0] = 'pending'
                    reader = f.reader()
                    with self.assertRaisesRegex(PairProofError, '^PAIR_UNAVAILABLE$'):
                        reader.read(deadline_ms=f.at+1000)
                    self.assertIsNone(reader.last_observation)
                    self.assertTrue(reader.available)

    def test_sparse_provisioning_metadata_is_unavailable_not_drift(self):
        f = replacement_fixture(pending_status='PROVISIONING', unplaced=True); f.stage[0] = 'pending'
        original = f.changes['describe_tasks']
        def sparse(value, args):
            original(value, args)
            for key in ('createdAt', 'launchType', 'platformFamily', 'platformVersion', 'enableExecuteCommand', 'containers', 'attachments'):
                value['tasks'][1].pop(key, None)
            return value
        f.changes['describe_tasks'] = sparse
        with self.assertRaisesRegex(PairProofError, '^PAIR_UNAVAILABLE$'):
            f.reader().read(deadline_ms=f.at+1000)

    def test_pending_without_eni_still_checks_known_container_network_metadata(self):
        for interface in ({'privateIpv4Address': '203.0.113.8'},
                          {'privateIpv4Address': '10.40.4.3', 'publicIpv4Address': '203.0.113.8'}):
            with self.subTest(interface=interface):
                f = replacement_fixture(unplaced=True); f.stage[0] = 'pending'
                original = f.changes['describe_tasks']
                def contradiction(value, args):
                    original(value, args)
                    value['tasks'][1]['containers'][1]['networkInterfaces'] = [interface]
                    return value
                f.changes['describe_tasks'] = contradiction
                with self.assertRaisesRegex(PairProofError, '^PAIR_DRIFT$'):
                    f.reader().read(deadline_ms=f.at+1000)

    def test_pending_eni_primary_public_ip_cannot_hide_behind_private_alias(self):
        f = replacement_fixture(); f.stage[0] = 'pending'
        tasks, network = f.changes['describe_tasks'], f.changes['describe_network_interfaces']
        def no_ip(value, args):
            tasks(value, args)
            owner = value['tasks'][1]
            owner['attachments'][0]['details'] = [item for item in owner['attachments'][0]['details'] if item['name'] != 'privateIPv4Address']
            owner['containers'][1].pop('networkInterfaces')
            return value
        def public_primary(value, args):
            network(value, args)
            value['NetworkInterfaces'][1]['PrivateIpAddress'] = '203.0.113.8'
            return value
        f.changes.update(describe_tasks=no_ip, describe_network_interfaces=public_primary)
        with self.assertRaisesRegex(PairProofError, '^PAIR_DRIFT$'):
            f.reader().read(deadline_ms=f.at+1000)

    def test_single_primary_running_passes_when_old_deployment_desired_count_lags(self):
        f = replacement_fixture(rolling=True, draining_desired=1); f.stage[0] = 'replacement'
        original = f.changes['describe_services']
        def drained(value, args):
            original(value, args)
            old = copy.deepcopy(value['services'][1]['deployments'][0])
            old.update(id='ecs-svc/1', status='ACTIVE', desiredCount=1, runningCount=0)
            value['services'][1]['deployments'].append(old)
            return value
        f.changes['describe_services'] = drained
        self.assertEqual(f.reader().read(deadline_ms=f.at+1000)['owner']['taskArn'], PREFIX+'task/capiro-dev/'+'3'*32)

    def test_rolling_count_snapshot_skew_is_unavailable_not_drift(self):
        f = replacement_fixture(rolling=True); f.stage[0] = 'rolling'
        original = f.changes['describe_services']
        def skewed(value, args):
            original(value, args)
            value['services'][1]['runningCount'] = 1
            return value
        f.changes['describe_services'] = skewed
        with self.assertRaisesRegex(PairProofError, '^PAIR_UNAVAILABLE$'):
            f.reader().read(deadline_ms=f.at+1000)

    def test_partner_gap_never_hides_own_task_or_network_drift(self):
        for method, mutate in (
            ('describe_tasks', lambda v: v['tasks'][0].update(taskDefinitionArn='foreign')),
            ('describe_tasks', lambda v: v['tasks'][0].update(group='service:foreign')),
            ('describe_tasks', lambda v: v['tasks'][0]['containers'][1].update(imageDigest='sha256:'+'f'*64)),
            ('describe_network_interfaces', lambda v: v['NetworkInterfaces'][0].update(Groups=[])),
            ('describe_network_interfaces', lambda v: v['NetworkInterfaces'][0].update(Association={'PublicIp': '203.0.113.4'})),
        ):
            with self.subTest(method=method, mutate=mutate):
                f = replacement_fixture(); f.stage[0] = 'gap'
                original = f.changes[method]
                f.changes[method] = lambda v, args, original=original: mutate(original(v, args)) or v
                with self.assertRaisesRegex(PairProofError, '^PAIR_DRIFT$'):
                    f.reader().read(deadline_ms=f.at+1000)

    def test_transitions_never_hide_any_partner_pin_contradiction(self):
        cases = (
            ('describe_services', lambda v: v['services'][1]['deployments'][0].update(taskDefinition='foreign')),
            ('describe_services', lambda v: v['services'][1]['networkConfiguration']['awsvpcConfiguration'].update(subnets=['subnet-99999999'])),
            ('describe_services', lambda v: v['services'][1]['networkConfiguration']['awsvpcConfiguration'].update(securityGroups=['sg-99999999'])),
            ('describe_services', lambda v: v['services'][1]['networkConfiguration']['awsvpcConfiguration'].update(assignPublicIp='ENABLED')),
            ('describe_tasks', lambda v: v['tasks'][-1].update(taskDefinitionArn='foreign')),
            ('describe_tasks', lambda v: v['tasks'][-1].update(group='service:foreign')),
            ('describe_tasks', lambda v: v['tasks'][-1]['containers'][1].update(image='foreign')),
            ('describe_tasks', lambda v: v['tasks'][-1]['containers'][1].update(imageDigest='sha256:'+'f'*64)),
            ('describe_tasks', lambda v: v['tasks'][-1]['overrides'].update(taskRoleArn='foreign')),
            ('describe_tasks', lambda v: v['tasks'][-1]['overrides'].update(executionRoleArn='foreign')),
            ('describe_network_interfaces', lambda v: v['NetworkInterfaces'][-1].update(SubnetId='subnet-99999999')),
            ('describe_network_interfaces', lambda v: v['NetworkInterfaces'][-1].update(Groups=[])),
            ('describe_network_interfaces', lambda v: v['NetworkInterfaces'][-1].update(Association={'PublicIp': '203.0.113.4'})),
        )
        for stage in ('pending', 'rolling'):
            for method, mutate in cases:
                with self.subTest(stage=stage, method=method, mutate=mutate):
                    f = replacement_fixture(rolling=stage == 'rolling'); f.stage[0] = stage
                    original = f.changes[method]
                    f.changes[method] = lambda v, args, original=original: mutate(original(v, args)) or v
                    with self.assertRaisesRegex(PairProofError, '^PAIR_DRIFT$'):
                        f.reader().read(deadline_ms=f.at+1000)

    def test_a_draining_deployment_on_a_different_revision_is_drift(self):
        f = replacement_fixture(rolling=True); f.stage[0] = 'rolling'
        original = f.changes['describe_services']
        def foreign(value, args):
            original(value, args)
            value['services'][1]['deployments'][1]['taskDefinition'] = 'foreign'
            return value
        f.changes['describe_services'] = foreign
        with self.assertRaisesRegex(PairProofError, '^PAIR_DRIFT$'):
            f.reader().read(deadline_ms=f.at+1000)

    def test_own_service_transitions_are_still_drift(self):
        for mutate in (
            lambda s: s.update(runningCount=0),
            lambda s: s.update(pendingCount=1),
            lambda s: s.update(runningCount=2),
            lambda s: s['deployments'][0].update(rolloutState='IN_PROGRESS'),
        ):
            with self.subTest(mutate=mutate):
                f = replacement_fixture(); original = f.changes['describe_services']
                f.changes['describe_services'] = lambda v, args: mutate(original(v, args)['services'][0]) or v
                with self.assertRaisesRegex(PairProofError, '^PAIR_DRIFT$'):
                    f.reader().read(deadline_ms=f.at+1000)


if __name__ == '__main__':
    unittest.main()
