"""Root source review controls. Local temporary fixtures; no native collector."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

candidate = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('reviewed_metadata', candidate / 'inspect-local-metadata.py')
diagnostic = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnostic)


class IndependentBoundaries(unittest.TestCase):
    def test_stream_exact_cap_and_unknown_bytes_stay_private(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'original.stderr'
            original = b'\xff' * diagnostic.MAX_STREAM_BYTES
            path.write_bytes(original)
            with patch.object(diagnostic, 'fixed_drive', return_value=None):
                result = diagnostic.inspect_stream(path, time.monotonic() + 2)
            self.assertEqual(result['bytes'], diagnostic.MAX_STREAM_BYTES)
            self.assertIsNone(result['knownMessage'])
            self.assertTrue(result['bodyContentsOmitted'])
            self.assertEqual(path.read_bytes(), original)

    def test_hardlinked_stream_refuses_before_body_read(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'original.stderr'
            path.write_bytes(b'original')
            os.link(path, Path(folder) / 'alias')
            with patch.object(diagnostic, 'fixed_drive', return_value=None), \
                    patch.object(Path, 'open', side_effect=AssertionError('body read')), \
                    self.assertRaisesRegex(diagnostic.Refusal, 'single_plain_stream_file_required'):
                diagnostic.inspect_stream(path, time.monotonic() + 2)

    def test_real_wrong_host_entrypoint_refuses_missing_paths(self):
        self.assertEqual(sys.platform, 'linux')
        result = subprocess.run([sys.executable, '-I', '-B', '-S',
                                 str(candidate / 'inspect-local-metadata.py'), 'evidence',
                                 '--stdout-file', '/nonexistent/owned-diagnostic.stdout',
                                 '--stderr-file', '/nonexistent/owned-diagnostic.stderr'],
                                capture_output=True, timeout=3, check=False)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stderr, b'')
        self.assertEqual(json.loads(result.stdout)['reason'], 'actual_windows_python_3_11_15_required')


if __name__ == '__main__':
    unittest.main()
