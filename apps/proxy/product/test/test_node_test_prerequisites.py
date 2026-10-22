"""Cross-runtime prerequisites skip explicitly without opening a Node process."""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import AsyncMock, patch

from apps.proxy.product.test import test_pair_lease_composed as composed
from apps.proxy.product.test import test_owner_wire_envelope as wire


class NodeTestPrerequisites(unittest.TestCase):
    def workspace(self, modules, *, missing=None):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        if missing != 'node_modules':
            (root/'node_modules').mkdir()
        for module in modules:
            if module != missing:
                path = root/module
                path.parent.mkdir(parents=True, exist_ok=True)
                path.touch()
        return root

    def test_composed_skips_missing_prerequisites_and_runs_when_present(self):
        modules = ('apps/proxy/product/test/p2-composed-owner.mjs',
                   'apps/gateway/budget/product-scripted-fixture.mjs', 'packages/contracts/validate.mjs')
        for missing in ('node', 'node_modules', *modules, None):
            with self.subTest(missing=missing):
                root = self.workspace(modules, missing=missing)
                node = None if missing == 'node' else '/synthetic/node'
                child = AsyncMock(side_effect=RuntimeError('NODE_CHILD_REACHED'))
                case = composed.ComposedPairLeaseTests('test_twenty_second_request_reuses_warm_pair_and_request_proofs')
                result = unittest.TestResult()
                with patch.object(composed, 'ROOT', root), patch.object(composed.shutil, 'which', return_value=node), \
                        patch.object(composed.asyncio, 'create_subprocess_exec', child):
                    case.run(result)
                if missing is not None:
                    self.assertEqual(result.errors, [])
                    self.assertEqual(len(result.skipped), 1)
                    self.assertIn('Node.js' if missing == 'node' else missing, result.skipped[0][1])
                    child.assert_not_called()
                else:
                    self.assertEqual(result.skipped, [])
                    self.assertEqual(len(result.errors), 1)
                    self.assertIn('NODE_CHILD_REACHED', result.errors[0][1])
                    child.assert_awaited_once()
                    self.assertEqual(child.call_args.args[0], node)

    def test_wire_skips_missing_prerequisites_and_runs_when_present(self):
        modules = ('apps/proxy/product/owner-wire-codec.mjs',
                   'apps/gateway/model-proxy/product-boundary-codec.mjs',
                   'apps/gateway/model-proxy/product-envelope.mjs')
        for missing in ('node', 'node_modules', *modules, None):
            with self.subTest(missing=missing):
                root = self.workspace(modules, missing=missing)
                node = None if missing == 'node' else '/synthetic/node'
                case = wire.OwnerWireEnvelopeTests()
                with patch.object(wire, 'ROOT', root), patch.object(wire.shutil, 'which', return_value=node), \
                        patch.object(wire.subprocess, 'run') as run:
                    run.return_value.stdout = '[]'
                    if missing is not None:
                        with self.assertRaises(unittest.SkipTest) as caught:
                            case.decode([])
                        self.assertIn('Node.js' if missing == 'node' else missing, str(caught.exception))
                        run.assert_not_called()
                    else:
                        try:
                            decoded = case.decode([])
                        except unittest.SkipTest as error:
                            self.fail('present prerequisites were skipped: '+str(error))
                        self.assertEqual(decoded, [])
                        run.assert_called_once()
                        self.assertEqual(run.call_args.args[0][0], node)

    def test_python_only_wire_assertions_still_run_without_node(self):
        case = wire.OwnerWireEnvelopeTests('test_python_reservation_and_capture_refuse_input_past_envelope')
        result = unittest.TestResult()
        with patch.object(wire.shutil, 'which', return_value=None), patch.object(wire.subprocess, 'run') as run:
            case.run(result)
        self.assertTrue(result.wasSuccessful(), (result.errors, result.failures))
        self.assertEqual(result.skipped, [])
        run.assert_not_called()

    def test_combined_wire_skips_missing_prerequisites_and_runs_when_present(self):
        modules = ('apps/proxy/product/owner-wire-codec.mjs',
                   'apps/gateway/model-proxy/product-boundary-codec.mjs',
                   'apps/gateway/model-proxy/product-envelope.mjs')
        for missing in ('node', 'node_modules', *modules, None):
            with self.subTest(missing=missing):
                root = self.workspace(modules, missing=missing)
                node = None if missing == 'node' else '/synthetic/node'
                case = wire.OwnerWireEnvelopeTests('test_combined_python_frames_cross_actual_versioned_owner_decoders')
                result = unittest.TestResult()
                with patch.object(wire, 'ROOT', root), patch.object(wire.shutil, 'which', return_value=node), \
                        patch.object(wire.subprocess, 'run', side_effect=RuntimeError('NODE_SUBPROCESS_REACHED')) as run:
                    case.run(result)
                if missing is not None:
                    self.assertEqual(result.errors, [])
                    self.assertEqual(len(result.skipped), 1)
                    self.assertIn('Node.js' if missing == 'node' else missing, result.skipped[0][1])
                    run.assert_not_called()
                else:
                    self.assertEqual(result.skipped, [])
                    self.assertEqual(len(result.errors), 1)
                    self.assertIn('NODE_SUBPROCESS_REACHED', result.errors[0][1])
                    run.assert_called_once()
                    self.assertEqual(run.call_args.args[0][0], node)
