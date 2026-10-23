"""Review reproduction (not for commit): do answered owner refusals spend the proxy's carrier-reset quota?

Uses the PR's own test fixture (test_owner_https.exchange): a valid pair lease, synthetic held sockets and an owner that
answers every exchange with HTTP 403. The plan (P2 §3.2) limits the 3/min reset quota to read-only timeouts after send;
an answered refusal must refuse only its request."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from apps.proxy.product.owner_channel import OPERATION
from apps.proxy.product.test.test_owner_https import exchange


def refusing_connection():
    response = SimpleNamespace(status=403, version=11, will_close=False, length=0,
        getheaders=lambda: [('content-type', 'application/json'), ('content-length', '2'),
                            ('cache-control', 'no-store'), ('x-meri-owner-revision', 'reviewed-v1')],
        read=lambda _size: b'{}')
    sock = SimpleNamespace(settimeout=lambda _value: None, close=lambda: None)
    return SimpleNamespace(sock=sock, request=lambda *a, **k: None, getresponse=lambda: response, close=lambda: None)


class AnsweredRefusalQuota(unittest.TestCase):
    def test_answered_refusals_do_not_retire_the_proxy(self):
        item = exchange()

        def connect(channel, _cutoff):
            connection = refusing_connection()
            item._connections[channel] = connection
            item._connection_generations[channel] = item.generation
            return connection

        trace = []
        with patch.object(item, '_connect', side_effect=connect), patch.object(item, '_evidence', return_value='peer'):
            for attempt in range(1, 6):
                try:
                    item._send('operation', OPERATION, b'[]', item.now_ms() + 1000)
                    trace.append((attempt, 'answered-200'))
                except Exception as error:  # every attempt is an answered 403
                    trace.append((attempt, type(error).__name__, str(error)[:48], 'available=%s' % item.available))
        print('TRACE', trace)
        self.assertTrue(item.available, 'proxy retired after answered refusals: %r' % (trace,))
        item.abort()


if __name__ == '__main__':
    unittest.main()
