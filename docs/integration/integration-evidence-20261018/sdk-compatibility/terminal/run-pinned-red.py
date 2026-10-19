"""Load the pinned original response owner and run final committed regressions."""
from pathlib import Path
import importlib.util
import subprocess
import sys
import unittest

sys.path.insert(0, str(Path.cwd()))
import apps.proxy.product

base = '87b6e8beac3af3ed72d22247c59ac461b7edd3d5'
path = 'apps/proxy/product/response_settlement.py'
source = subprocess.run(['git', 'show', base + ':' + path], check=True, capture_output=True).stdout
snapshot = Path(__file__).parent / 'pinned-response_settlement.py'
snapshot.write_bytes(source)
spec = importlib.util.spec_from_file_location('apps.proxy.product.response_settlement', snapshot)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
suite = unittest.defaultTestLoader.loadTestsFromName('apps.proxy.product.test.test_response_terminal_gate')
result = unittest.TextTestRunner(verbosity=2).run(suite)
raise SystemExit(not result.wasSuccessful())
