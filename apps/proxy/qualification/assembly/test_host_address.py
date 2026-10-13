"""Proper server address projection with unchanged strict identity and no driver imports."""
import copy
import unittest
from .lifecycle import QualificationLifecycle, StateDenied
from .test_lifecycle import admission, Cursor, ScriptedStore, NOW


class ProjectingCursor(Cursor):
    def execute(self, sql, params=()):
        if sql.startswith('SELECT current_database'):
            assert 'pg_catalog.host(pg_catalog.inet_server_addr()) AS address' in sql
        super().execute(sql, params)
        if sql.startswith('SELECT current_database'):
            self.row.update(self.store.identity_override)


class ProjectingStore(ScriptedStore):
    def __init__(self, fixture, changes=None):
        super().__init__()
        self.fixture = copy.deepcopy(fixture)
        self.identity_override = changes or {}

    def transact(self, operation):
        before = copy.deepcopy(self.rows)
        try: return operation(ProjectingCursor(self))
        except Exception:
            self.rows = before
            raise


class HostAddressTests(unittest.TestCase):
    def owner(self, address, changes=None):
        value = admission()
        value['fixture'].update(serverAddress=address, serverPort=5432)
        store = ProjectingStore(value['fixture'], changes)
        return QualificationLifecycle(store, value, deadline_ms=NOW+15000, now_ms=lambda: NOW), store

    def test_ipv4_and_ipv6_plain_host_prepare_two_pending_without_activation(self):
        for address in ['192.0.2.41', '2001:db8::41']:
            with self.subTest(address=address):
                owner, store = self.owner(address)
                self.assertEqual(owner.run('prepare')['status'], 'PREPARED')
                self.assertEqual([g['state'] for g in store.rows['grants'].values()], ['PENDING', 'PENDING'])
                self.assertEqual(store.fixture['host'], '127.0.0.1')

    def test_masked_and_foreign_observed_hosts_refuse_before_insert(self):
        for address, observed in [('192.0.2.41', '192.0.2.41/32'), ('192.0.2.41', '192.0.2.42'), ('2001:db8::41', '2001:db8::41/128'), ('2001:db8::41', '2001:db8::42')]:
            with self.subTest(address=address, observed=observed):
                owner, store = self.owner(address, {'address': observed})
                with self.assertRaises(StateDenied): owner.run('prepare')
                self.assertFalse(any(x.startswith('INSERT') for x in store.statements))

    def test_masked_caller_addresses_still_fail_fixture_admission(self):
        for address in ['192.0.2.41/32', '2001:db8::41/128']:
            with self.subTest(address=address), self.assertRaises(StateDenied): self.owner(address)

    def test_every_other_identity_field_retains_its_gate(self):
        for key, value in {'database': 'other', 'username': 'postgres', 'port': 5433, 'version': '160014', 'started_ms': '0', 'fsync': 'off', 'synchronous_commit': 'off', 'system_identifier': 'foreign'}.items():
            with self.subTest(field=key):
                owner, store = self.owner('192.0.2.41', {key: value})
                with self.assertRaises(StateDenied): owner.run('prepare')
                self.assertIsNone(store.rows['run'])


if __name__ == '__main__': unittest.main()
