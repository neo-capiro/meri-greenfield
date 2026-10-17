"""Two narrow, hash-guarded LiteLLM 1.104.2 custom-auth compatibility gates.

The pinned upstream gates omit configured custom auth from their definition
of authenticated startup. This module recognizes only this product's exact
fixed config/hook. It does not enable anonymous/JWT/admin-key authentication,
set the dangerous override, change native common checks, or patch disk source.
Native installed-package qualification remains required.
"""
import hashlib
from importlib import import_module, metadata
import inspect
import os
from pathlib import Path

from ..qualification.state.pricing import StateDenied
from .native_auth import HOOK, authenticate_product_request


VERSION = "1.104.2"
UPSTREAM_COMMIT = "fc3920bf403124ad075bc04990f999f7e0612e12"
AUTH_SOURCE_SHA256 = "c1d3372bff29536e18c83493b6a258592e01cbe97cf1363299b6a6eecf545682"
BOOT_SOURCE_SHA256 = "5a1552faf88a46949806a75950be1cb505a57c4ac15f38ee4bf54843c12d020b"
FIXED_CONFIG_SHA256 = "64860d829d7c022f6640b1a75eb48ad05dc2421d8e5e2bcdfdda50b421754d19"
_CONFIG = Path(__file__).with_name("litellm-product-config.yaml")
_SETTINGS = {"custom_auth": HOOK, "custom_auth_run_common_checks": True,
             "fail_closed_budget_enforcement": True, "disable_budget_reservation": False}
_installed = False


def _deny():
    raise StateDenied("PRODUCT_NATIVE_COMPATIBILITY_DENIED")


def _pin(function, module_name, name, digest):
    if (not inspect.isfunction(function) or function.__module__ != module_name
            or function.__name__ != name
            or hashlib.sha256(inspect.getsource(function).strip().encode("utf-8")).hexdigest() != digest):
        _deny()


class _Compatibility:
    def __init__(self, native, auth, boot, old_auth, old_boot, settings_type):
        self.native, self.auth, self.boot = native, auth, boot
        self.old_auth, self.old_boot = old_auth, old_boot
        self.settings_type = settings_type
        self.closed = False

        def configured_auth(master_key, general_settings):
            self._context(general_settings)
            if master_key is not None:
                _deny()
            # Existing centralized common_checks now runs with its actual
            # builder/router/request context. No checks are reimplemented.
            return False

        def configured_boot(**kwargs):
            if set(kwargs) != {"master_key", "environment_master_key", "general_settings",
                    "config_file_path", "override_env_is_on", "salt_key_is_set", "database_is_configured"}:
                _deny()
            self._context(kwargs["general_settings"])
            if (kwargs["master_key"] is not None or kwargs["environment_master_key"] is not None
                    or kwargs["config_file_path"] != str(_CONFIG)
                    or kwargs["override_env_is_on"] is not False
                    or kwargs["salt_key_is_set"] is not False
                    or kwargs["database_is_configured"] is not False):
                _deny()
            # Native startup's success type; this creates no native key or
            # alternate auth principal. The custom hook is already loaded.
            return boot.SafeMasterKey()

        self.auth_gate, self.boot_gate = configured_auth, configured_boot
        auth.is_no_auth_dev_mode = configured_auth
        boot.master_key_boot_verdict = native.master_key_boot_verdict = configured_boot

    def _context(self, settings):
        if (self.closed or self.auth.is_no_auth_dev_mode is not self.auth_gate
                or self.boot.master_key_boot_verdict is not self.boot_gate
                or self.native.master_key_boot_verdict is not self.boot_gate
                or settings is not self.native.general_settings
                or type(settings) is not self.settings_type
                or settings is not self.native.proxy_config.settings
                or set(settings)-set(_SETTINGS)-{"store_model_in_db"}
                or any(type(settings.get(key)) is not type(value) or settings.get(key) != value
                       for key, value in _SETTINGS.items())
                or settings.get("store_model_in_db", False) is not False
                or self.native.user_custom_auth is not authenticate_product_request
                or self.native.master_key is not None or self.native.prisma_client is not None
                or getattr(self.native, "user_config_file_path", None) != str(_CONFIG)
                or os.environ.get("CONFIG_FILE_PATH") != str(_CONFIG)):
            _deny()
        forbidden = {"LITELLM_MASTER_KEY", "LITELLM_SALT_KEY", "LITELLM_MIGRATE_FROM_MASTER_KEY",
                     "LITELLM_DANGEROUSLY_PERMIT_WEAK_OR_UNSET_MASTER_KEY", "DATABASE_URL",
                     "LITELLM_DATABASE_URL", "WORKER_CONFIG"}
        if any(key in os.environ for key in forbidden):
            _deny()
        try:
            if hashlib.sha256(_CONFIG.read_bytes()).hexdigest() != FIXED_CONFIG_SHA256:
                _deny()
        except (OSError, ValueError):
            _deny()

    def check_loaded(self):
        self._context(self.native.general_settings)

    def close(self):
        # Startup is single-use. Do not restore/re-enable a retired shared app.
        self.closed = True


def install_native_compatibility(native):
    global _installed
    if _installed:
        _deny()
    try:
        if metadata.version("litellm") != VERSION or native.__name__ != "litellm.proxy.proxy_server":
            _deny()
        auth = import_module("litellm.proxy.auth.user_api_key_auth")
        boot = import_module("litellm.proxy.auth.master_key_boot_check")
        settings_type = import_module("litellm.proxy.config_resolvers").SettingsStore
        old_auth, old_boot = auth.is_no_auth_dev_mode, boot.master_key_boot_verdict
        _pin(old_auth, auth.__name__, "is_no_auth_dev_mode", AUTH_SOURCE_SHA256)
        _pin(old_boot, boot.__name__, "master_key_boot_verdict", BOOT_SOURCE_SHA256)
        if (native.master_key_boot_verdict is not old_boot
                or not callable(boot.SafeMasterKey) or native.master_key is not None
                or native.prisma_client is not None):
            _deny()
        # Stop if a caller tries to load another config before native lifespan.
        if (os.environ.get("CONFIG_FILE_PATH") != str(_CONFIG)
                or hashlib.sha256(_CONFIG.read_bytes()).hexdigest() != FIXED_CONFIG_SHA256):
            _deny()
        _installed = True
        return _Compatibility(native, auth, boot, old_auth, old_boot, settings_type)
    except StateDenied:
        raise
    except Exception:
        _deny()
