"""Offline ECR command vocabulary and capture controls; no real AWS process."""
import hashlib
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


class EcrTransport(unittest.TestCase):
    repository = 'meri-greenfield/qualification-worker'
    image = 'imageDigest=sha256:' + '8' * 64

    def scan(self):
        return ['ecr', 'describe-image-scan-findings', '--repository-name',
                self.repository, '--image-id', self.image]

    def refuse(self, args, **kwargs):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / 'not-created'
            with patch.object(aws_evidence.subprocess, 'run') as run:
                with self.assertRaises(ValueError):
                    aws_evidence.capture(out, 'scan', args, **kwargs)
            run.assert_not_called()
            self.assertFalse(out.exists(), 'refusal must precede output allocation')

    def test_singular_scan_keeps_exact_argv_raw_bytes_and_receipt(self):
        args = self.scan()
        raw = '{"description":"synthetic café’s scan","nextToken":null}'.encode('utf-8')
        stderr = b'synthetic diagnostic\r\n'
        suffix = ['--profile', 'capiro-dev', '--region', 'us-east-1', '--output',
                  'json', '--no-cli-pager', '--cli-connect-timeout', '10',
                  '--cli-read-timeout', '30']
        hostile = {'AWS_ENDPOINT_URL': 'https://invalid.example',
                   'AWS_PROFILE': 'foreign', 'AWS_ACCESS_KEY_ID': 'synthetic',
                   'AWS_CLI_OUTPUT_ENCODING': 'CP1252',
                   'HTTPS_PROXY': 'https://invalid.example',
                   'REQUESTS_CA_BUNDLE': 'synthetic-foreign-ca',
                   'MERI_CAPTURE_TEST_SENTINEL': 'preserved'}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.dict(aws_evidence.os.environ, hostile), patch.object(
                    aws_evidence.subprocess, 'run', return_value=
                    subprocess.CompletedProcess([], 0, raw, stderr)) as run:
                result = aws_evidence.capture(root, 'scan', args)
            run.assert_called_once()
            argv, kwargs = run.call_args.args[0], run.call_args.kwargs
            self.assertEqual(argv, [aws_evidence.AWS, *args, *suffix])
            self.assertIs(kwargs['shell'], False)
            self.assertEqual(kwargs['stdin'], subprocess.DEVNULL)
            self.assertEqual(kwargs['stdout'], subprocess.PIPE)
            self.assertEqual(kwargs['stderr'], subprocess.PIPE)
            self.assertEqual(kwargs['timeout'], 45)
            env = kwargs['env']
            for key in hostile:
                if key not in ('MERI_CAPTURE_TEST_SENTINEL', 'AWS_CLI_OUTPUT_ENCODING'):
                    self.assertNotIn(key, env)
            self.assertEqual(env['MERI_CAPTURE_TEST_SENTINEL'], 'preserved')
            self.assertEqual(env['AWS_MAX_ATTEMPTS'], '1')
            self.assertEqual(env['AWS_RETRY_MODE'], 'standard')
            self.assertEqual(env['AWS_CLI_OUTPUT_ENCODING'], 'UTF-8')
            self.assertEqual(env['AWS_IGNORE_CONFIGURED_ENDPOINT_URLS'], 'true')
            self.assertEqual(env['AWS_CONFIG_FILE'], str(Path.home() / '.aws' / 'config'))
            self.assertEqual(env['AWS_SHARED_CREDENTIALS_FILE'],
                             str(Path.home() / '.aws' / 'credentials'))
            self.assertEqual(result, {'description': 'synthetic café’s scan', 'nextToken': None})
            self.assertEqual((root / 'scan/stdout.bin').read_bytes(), raw)
            self.assertEqual((root / 'scan/stderr.bin').read_bytes(), stderr)
            receipt = json.loads((root / 'scan/process.json').read_bytes())
            self.assertEqual(receipt['argv'], argv)
            self.assertEqual(receipt['automaticRetries'], 0)
            self.assertEqual(receipt['exitCode'], 0)
            self.assertIs(receipt['timedOut'], False)
            self.assertEqual(receipt['timeoutSeconds'], 45)
            self.assertIsNone(receipt['readonlyRequestValidation'])
            self.assertEqual(receipt['stdout'],
                             {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
            self.assertEqual(receipt['stderr'],
                             {'bytes': len(stderr), 'sha256': hashlib.sha256(stderr).hexdigest()})
        self.assertEqual(args, self.scan(), 'caller arguments must remain unchanged')

    def test_existing_ecr_plural_operations_are_unchanged(self):
        cases = [
            ['ecr', 'describe-repositories', '--repository-names', self.repository],
            ['ecr', 'describe-images', '--repository-name', self.repository,
             '--image-ids', self.image],
            ['ecr', 'batch-get-image', '--repository-name', self.repository,
             '--image-ids', self.image, '--accepted-media-types',
             'application/vnd.docker.distribution.manifest.v2+json'],
        ]
        for args in cases:
            with self.subTest(operation=args[1]), tempfile.TemporaryDirectory() as directory:
                with patch.object(aws_evidence.subprocess, 'run', return_value=
                                  subprocess.CompletedProcess([], 0, b'{}', b'')) as run:
                    self.assertEqual(aws_evidence.capture(directory, 'read', args), {})
                self.assertEqual(run.call_args.args[0][1:1 + len(args)], args)
                self.assertEqual(run.call_args.kwargs['timeout'], 45)
                self.assertEqual(run.call_args.kwargs['env']['AWS_CLI_OUTPUT_ENCODING'], 'UTF-8')

    def test_incorrect_plural_and_foreign_scan_options_refuse_before_effects(self):
        plural = self.scan()
        plural[4] = '--image-ids'
        cases = [plural, self.scan() + ['--image-ids', self.image]]
        for option, value in [('--repository-names', self.repository),
                              ('--accepted-media-types', 'synthetic'),
                              ('--image', self.image),
                              ('--image-id=' + self.image, None),
                              ('--profile', 'foreign'), ('--region', 'foreign'),
                              ('--endpoint-url', 'https://invalid.example'),
                              ('--output', 'text'), ('--query', 'imageId'),
                              ('--no-verify-ssl', None), ('--no-paginate', None)]:
            cases.append(self.scan() + [option] + ([] if value is None else [value]))
        for args in cases:
            with self.subTest(args=args):
                self.refuse(args)

    def test_singular_option_cannot_escape_to_another_command(self):
        for service, operations in aws_evidence.ALLOWED.items():
            for operation in operations:
                if (service, operation) == ('ecr', 'describe-image-scan-findings'):
                    continue
                with self.subTest(service=service, operation=operation):
                    self.refuse([service, operation, '--image-id', self.image])
        self.refuse(['ecr', 'start-image-scan', '--image-id', self.image])

    def test_scan_keeps_profile_and_deadline_refusals(self):
        for profile in ('foreign', '', None, 1):
            with self.subTest(profile=profile):
                self.refuse(self.scan(), profile=profile)
        for timeout in (61, True, 0):
            with self.subTest(timeout=timeout):
                self.refuse(self.scan(), timeout=timeout)
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(aws_evidence.subprocess, 'run', return_value=
                              subprocess.CompletedProcess([], 0, b'{}', b'')) as run:
                aws_evidence.capture(directory, 'scan', self.scan(), profile='default')
            argv = run.call_args.args[0]
            self.assertEqual(argv[argv.index('--profile') + 1], 'default')

    def test_failed_scan_retains_raw_error_without_retry(self):
        raw = b'synthetic partial stdout'
        stderr = b'synthetic CLI or service failure\r\n'
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(aws_evidence.subprocess, 'run', return_value=
                              subprocess.CompletedProcess([], 252, raw, stderr)) as run:
                with self.assertRaisesRegex(RuntimeError, 'AWS operation failed'):
                    aws_evidence.capture(root, 'scan', self.scan())
            run.assert_called_once()
            self.assertEqual((root / 'scan/stdout.bin').read_bytes(), raw)
            self.assertEqual((root / 'scan/stderr.bin').read_bytes(), stderr)
            receipt = json.loads((root / 'scan/process.json').read_bytes())
            self.assertEqual(receipt['exitCode'], 252)
            self.assertEqual(receipt['automaticRetries'], 0)
            self.assertIs(receipt['timedOut'], False)


    def test_non_utf8_stdout_is_retained_and_never_transcoded(self):
        raw = b'{"description":"synthetic \x92 scan"}'
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(aws_evidence.subprocess, 'run', return_value=
                              subprocess.CompletedProcess([], 0, raw, b'')) as run:
                with self.assertRaises(UnicodeDecodeError):
                    aws_evidence.capture(root, 'scan', self.scan())
            run.assert_called_once()
            self.assertEqual(run.call_args.kwargs['env']['AWS_CLI_OUTPUT_ENCODING'], 'UTF-8')
            self.assertEqual((root / 'scan/stdout.bin').read_bytes(), raw)
            receipt = json.loads((root / 'scan/process.json').read_bytes())
            self.assertEqual(receipt['exitCode'], 0)
            self.assertEqual(receipt['automaticRetries'], 0)
            self.assertEqual(receipt['stdout'],
                             {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})


if __name__ == '__main__':
    unittest.main(verbosity=2)
