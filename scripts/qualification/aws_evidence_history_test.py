"""Offline service-page transport controls; real processes/network are denied."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import aws_evidence

def audit(event, arguments):
    if event.startswith('socket.') or event in {'subprocess.Popen', 'os.system', 'os.posix_spawn'}:
        raise PermissionError('OFFLINE_EFFECT_DENIED')

sys.addaudithook(audit)

class HistoryTransport(unittest.TestCase):
    def test_exact_service_page_flag_and_raw_token_are_retained(self):
        raw = b'{"events":[],"nextToken":"synthetic-next-page"}'
        with tempfile.TemporaryDirectory() as directory:
            args = ['stepfunctions', 'get-execution-history', '--execution-arn',
                    'arn:aws:states:us-east-1:967807252336:execution:fixture:synthetic',
                    '--max-results', '1000', '--no-paginate']
            with patch.object(aws_evidence.subprocess, 'run', return_value=
                              subprocess.CompletedProcess([], 0, raw, b'')) as run:
                result = aws_evidence.capture(Path(directory), 'page', args)
            self.assertEqual(result['nextToken'], 'synthetic-next-page')
            self.assertEqual(run.call_args.args[0][1:1 + len(args)], args)
            self.assertEqual((Path(directory) / 'page/stdout.bin').read_bytes(), raw)
            receipt = json.loads((Path(directory) / 'page/process.json').read_bytes())
            self.assertEqual(receipt['argv'].count('--no-paginate'), 1)
            self.assertEqual(receipt['automaticRetries'], 0)

    def test_flag_cannot_escape_to_other_operations(self):
        for service, operations in aws_evidence.ALLOWED.items():
            for operation in operations:
                if (service, operation) == ('stepfunctions', 'get-execution-history'):
                    continue
                with self.subTest(service=service, operation=operation), tempfile.TemporaryDirectory() as directory:
                    out = Path(directory) / 'not-created'
                    with patch.object(aws_evidence.subprocess, 'run') as run:
                        with self.assertRaises(ValueError):
                            aws_evidence.capture(out, 'page', [service, operation, '--no-paginate'])
                    run.assert_not_called()
                    self.assertFalse(out.exists())

    def test_duplicate_flag_refuses_before_allocation(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / 'not-created'
            with patch.object(aws_evidence.subprocess, 'run') as run:
                with self.assertRaises(ValueError):
                    aws_evidence.capture(out, 'page', ['stepfunctions', 'get-execution-history',
                                                     '--no-paginate', '--no-paginate'])
            run.assert_not_called()
            self.assertFalse(out.exists())

if __name__ == '__main__':
    unittest.main()
