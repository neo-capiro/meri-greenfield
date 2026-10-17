"""Closed data/file/environment controls; no native dependencies or credentials."""
import copy
import hashlib
import json
import os
from pathlib import Path
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from apps.proxy.product.startup_config import parse_product_proxy_startup, read_reviewed_file, _environment
from apps.proxy.qualification.state.pricing import PRICING_REVISION


def configuration():
    def ref(name):
        return {"path": "/run/meri/"+name, "sha256": "a"*64}
    return {"schemaVersion": 1, "enabled": True, "deploymentRevision": "reviewed-v1",
        "expiresAtMs": time.time_ns()//1000000+60000, "pricingRevision": PRICING_REVISION,
        "serverTls": {"certificateFile": ref("server.pem"), "privateKeyFile": ref("server.key"),
                      "certificateSha256": "4"*64},
        "ownerPeer": {"origin": "https://owner.invalid:8444", "server_name": "owner.invalid",
            "owner_task_arn": "owner-task", "proxy_task_arn": "proxy-task", "server_cert_sha256": "1"*64,
            "server_issuer_sha256": "2"*64, "client_cert_sha256": "3"*64,
            "client_subject": "proxy-subject", "max_exchange_ms": 3000},
        "ownerTls": {"caFile": ref("ca.pem"), "certificateFile": ref("client.pem"),
                     "privateKeyFile": ref("client.key")},
        "ownerIpv4": "10.1.2.3", "proxyIpv4": "10.1.2.4"}


def parse(value):
    raw = json.dumps(value).encode()
    return parse_product_proxy_startup(raw, hashlib.sha256(raw).hexdigest())


class ConfigurationTests(unittest.TestCase):
    def test_closed_configuration_snapshot_cannot_be_changed_by_caller(self):
        value = configuration()
        accepted = parse(value)
        read = accepted.value
        read["ownerPeer"]["server_name"] = "foreign"
        self.assertEqual(accepted.value, value)

    def test_unknown_callback_module_credentials_bad_refs_and_expired_settings_refuse(self):
        for mutate in (lambda v: v.update(callback="arbitrary.module"),
                lambda v: v.update(enabled=False), lambda v: v.update(expiresAtMs=True),
                lambda v: v.update(expiresAtMs=1), lambda v: v.update(pricingRevision="f"*64),
                lambda v: v["ownerPeer"].update(origin="http://owner.invalid:8444"),
                lambda v: v["ownerPeer"].update(max_exchange_ms=3001),
                lambda v: v.update(proxyIpv4=v["ownerIpv4"]),
                lambda v: v.update(ownerIpv4="127.0.0.1"),
                lambda v: v["ownerTls"].update(password="secret"),
                lambda v: v["ownerTls"]["privateKeyFile"].update(path="/run/../outside")):
            value = configuration(); mutate(value)
            with self.assertRaises(Exception):
                parse(value)

    def test_hash_duplicate_nonfinite_and_safe_integer_guards(self):
        raw = json.dumps(configuration()).encode()
        with self.assertRaises(Exception):
            parse_product_proxy_startup(raw, "0"*64)
        for raw in (b'{"schemaVersion":1,"schemaVersion":1}', b'{"expiresAtMs":NaN}'):
            with self.assertRaises(Exception):
                parse_product_proxy_startup(raw, hashlib.sha256(raw).hexdigest())

    def test_read_exact_task_file_and_reject_hash_drift_or_oversize(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)/"reviewed-data.json"
            path.write_bytes(b'{"synthetic":true}')
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            self.assertEqual(read_reviewed_file(path, digest), path.read_bytes())
            with self.assertRaises(Exception):
                read_reviewed_file(path, "0"*64)
            with self.assertRaises(Exception):
                read_reviewed_file(path, digest, maximum=2)

    def test_only_relative_ecs_task_role_environment_is_accepted(self):
        base = {"MERI_PRODUCT_PROXY_REQUIRED": "1",
                "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI": "/v2/credentials/synthetic-task"}
        with patch.dict(os.environ, base, clear=True):
            _environment()
        with patch.dict(os.environ, {**base, "LITELLM_LOCAL_MODEL_COST_MAP": "True"}, clear=True):
            _environment()
        for key, value in {"AWS_ACCESS_KEY_ID": "synthetic", "AWS_PROFILE": "host",
                "AWS_CONTAINER_CREDENTIALS_FULL_URI": "http://foreign.invalid",
                "HTTP_PROXY": "http://foreign.invalid", "LITELLM_MASTER_KEY": "synthetic",
                "DATABASE_URL": "synthetic", "ANTHROPIC_AUTH_TOKEN": "synthetic",
                "WORKER_CONFIG": "synthetic"}.items():
            with patch.dict(os.environ, {**base, key: value}, clear=True), self.assertRaises(Exception):
                _environment()
        for value in ("true", "False", "", "1"):
            with patch.dict(os.environ, {**base, "LITELLM_LOCAL_MODEL_COST_MAP": value}, clear=True), self.assertRaises(Exception):
                _environment()
        for change in ({"MERI_PRODUCT_PROXY_REQUIRED": "0"},
                       {"AWS_CONTAINER_CREDENTIALS_RELATIVE_URI": "/../outside"}):
            with patch.dict(os.environ, {**base, **change}, clear=True), self.assertRaises(Exception):
                _environment()

    def test_special_file_open_is_nonblocking_and_type_rejected_before_read(self):
        # Linux FIFO execution is unrun here. Verify the actual open flags and
        # fstat-before-read boundary without creating a pipe/device or listener.
        import stat
        import apps.proxy.product.startup_config as startup
        with patch.object(startup.os, "open", return_value=99) as opened, \
             patch.object(startup.os, "O_NONBLOCK", 0x800, create=True), \
             patch.object(startup.os, "fstat", return_value=SimpleNamespace(st_mode=stat.S_IFIFO)), \
             patch.object(startup.os, "read") as read, patch.object(startup.os, "close") as close:
            with self.assertRaises(Exception):
                read_reviewed_file(Path.cwd()/"synthetic_fifo", "a"*64)
            self.assertTrue(opened.call_args.args[1] & 0x800)
            read.assert_not_called(); close.assert_called_once_with(99)


if __name__ == "__main__":
    unittest.main()
