"""Product compatibility denials with synthetic upstream bindings, never native proof."""
import hashlib
import inspect
import os
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from apps.proxy.product import native_compatibility as compat
from apps.proxy.product.native_auth import authenticate_product_request


def synthetic_gate():
    return None


class SyntheticSettingsStore(dict):
    """Only an external constructor stand-in, not native installed-package proof."""


class CompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.auth = SimpleNamespace(is_no_auth_dev_mode=synthetic_gate)
        self.boot = SimpleNamespace(master_key_boot_verdict=synthetic_gate, SafeMasterKey=type("Safe", (), {}))
        self.settings = SyntheticSettingsStore(compat._SETTINGS)
        self.native = SimpleNamespace(__name__="litellm.proxy.proxy_server", master_key=None, prisma_client=None,
            general_settings=self.settings, user_custom_auth=authenticate_product_request,
            proxy_config=SimpleNamespace(settings=self.settings),
            user_config_file_path=str(compat._CONFIG), master_key_boot_verdict=synthetic_gate)
        self.env = patch.dict(os.environ, {"CONFIG_FILE_PATH": str(compat._CONFIG)}, clear=True)
        self.env.start()
        self.gate = compat._Compatibility(self.native, self.auth, self.boot,
                                          synthetic_gate, synthetic_gate, SyntheticSettingsStore)
        self.kwargs = dict(master_key=None, environment_master_key=None, general_settings=self.settings,
            config_file_path=str(compat._CONFIG), override_env_is_on=False,
            salt_key_is_set=False, database_is_configured=False)

    def tearDown(self):
        self.gate.close()
        self.env.stop()

    def test_configured_auth_runs_existing_gate_and_native_boot_type_without_key(self):
        self.assertFalse(self.auth.is_no_auth_dev_mode(None, self.settings))
        self.assertIs(type(self.boot.master_key_boot_verdict(**self.kwargs)), self.boot.SafeMasterKey)
        self.gate.check_loaded()
        self.assertIsNone(self.native.master_key)
        self.assertIsNone(self.native.prisma_client)

    def test_every_boot_credential_database_salt_override_and_config_exception_refuses(self):
        changes = {"master_key": "synthetic", "environment_master_key": "synthetic",
            "override_env_is_on": True, "salt_key_is_set": True, "database_is_configured": True,
            "config_file_path": "/foreign.json", "general_settings": dict(self.settings)}
        for key, value in changes.items():
            with self.subTest(key=key), self.assertRaises(Exception):
                self.boot.master_key_boot_verdict(**{**self.kwargs, key: value})
        with self.assertRaises(Exception):
            self.boot.master_key_boot_verdict(**{**self.kwargs, "unexpected": False})

    def test_alternate_auth_flags_commoncheck_off_danger_mode_or_unknown_setting_refuses(self):
        changes = {"custom_auth": "foreign.function", "custom_auth_run_common_checks": False,
            "disable_budget_reservation": True, "fail_closed_budget_enforcement": False,
            "enable_jwt_auth": True, "enable_oauth2_auth": True, "enable_oauth2_proxy_auth": True,
            "dangerously_permit_weak_or_unset_master_key": True, "store_model_in_db": True,
            "unknown": True}
        for key, value in changes.items():
            with patch.dict(self.settings, {key: value}), self.subTest(key=key), self.assertRaises(Exception):
                self.gate.check_loaded()
        with patch.dict(self.settings, {"custom_auth_run_common_checks": 1}), self.assertRaises(Exception):
            self.gate.check_loaded()

    def test_environment_native_hook_key_db_file_or_function_binding_drift_refuses(self):
        for key in ("LITELLM_MASTER_KEY", "LITELLM_SALT_KEY", "LITELLM_MIGRATE_FROM_MASTER_KEY",
                    "LITELLM_DANGEROUSLY_PERMIT_WEAK_OR_UNSET_MASTER_KEY", "DATABASE_URL",
                    "LITELLM_DATABASE_URL", "WORKER_CONFIG"):
            with patch.dict(os.environ, {key: "synthetic"}), self.subTest(key=key), self.assertRaises(Exception):
                self.gate.check_loaded()
        for key, value in {"user_custom_auth": lambda: None, "master_key": "synthetic",
                "prisma_client": object(), "user_config_file_path": "/foreign"}.items():
            with patch.object(self.native, key, value), self.assertRaises(Exception):
                self.gate.check_loaded()
        with patch.object(compat._CONFIG.__class__, "read_bytes", return_value=b"drift"), self.assertRaises(Exception):
            self.gate.check_loaded()
        with patch.object(self.auth, "is_no_auth_dev_mode", synthetic_gate), self.assertRaises(Exception):
            self.gate.check_loaded()
        self.gate.close()
        with self.assertRaises(Exception):
            self.gate.check_loaded()

    def test_exact_function_source_name_module_and_digest_are_checked(self):
        digest = hashlib.sha256(inspect.getsource(synthetic_gate).strip().encode()).hexdigest()
        compat._pin(synthetic_gate, __name__, "synthetic_gate", digest)
        for module, name, sha in (("foreign", "synthetic_gate", digest),
                (__name__, "foreign", digest), (__name__, "synthetic_gate", "0"*64)):
            with self.assertRaises(Exception):
                compat._pin(synthetic_gate, module, name, sha)

    def test_install_rejects_version_and_import_binding_drift_before_replacement(self):
        native = SimpleNamespace(__name__="litellm.proxy.proxy_server", master_key=None, prisma_client=None,
                                 master_key_boot_verdict=object())
        auth = SimpleNamespace(__name__="litellm.proxy.auth.user_api_key_auth", is_no_auth_dev_mode=synthetic_gate)
        boot = SimpleNamespace(__name__="litellm.proxy.auth.master_key_boot_check",
                               master_key_boot_verdict=synthetic_gate, SafeMasterKey=type("Safe", (), {}))
        with patch.object(compat, "_installed", False), \
             patch.object(compat.metadata, "version", return_value="foreign"), self.assertRaises(Exception):
            compat.install_native_compatibility(native)
        with patch.object(compat, "_installed", False), \
             patch.object(compat.metadata, "version", return_value="1.104.2"), \
             patch.object(compat, "import_module", side_effect=[auth, boot, SimpleNamespace(SettingsStore=SyntheticSettingsStore)]), \
             patch.object(compat, "_pin") as pin, self.assertRaises(Exception):
            compat.install_native_compatibility(native)
        self.assertEqual(pin.call_count, 2)
        self.assertIs(auth.is_no_auth_dev_mode, synthetic_gate)


if __name__ == "__main__":
    unittest.main()
