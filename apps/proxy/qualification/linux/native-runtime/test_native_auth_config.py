"""Pure configuration controls; no native package, app, pool or auth simulation."""
import dataclasses
import hashlib
import json
import contextlib
import io
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from urllib.parse import urlencode

import native_auth_probe as probe
from _meri_native_auth_fixture_config import ENGINE, TLS_DISCOVERY, MOUNT_NAMES, PREREQUISITES, HOST, NATIVE_USER, PG_IMAGE, PROXY_IMAGE, NativeFixture, Refused, bind_native_url, parse_config, proxy_config, validate_activation, validate_mounts

RUN = "14f49724-7c22-4923-94d8-40d878d06bf4"
URL = ("postgresql://" + NATIVE_USER + ":synthetic-password@" + HOST + ":5432/meri_native_auth_" + RUN.replace("-", "")).encode()

def data(**changes):
    value = {"schema": "meri.native-auth.fixture/1", "runId": RUN,
        "postgresImage": PG_IMAGE, "proxyImage": PROXY_IMAGE,
        "nativeUrlSha256": hashlib.sha256(URL).hexdigest(), "workSeconds": 300, "cleanupSeconds": 30}
    value.update(changes)
    return json.dumps(value).encode()


class Configuration(unittest.TestCase):
    def test_exact_artifact_and_distinct_native_state_databases(self):
        config = parse_config(data())
        self.assertEqual(config.native_database, "meri_native_auth_14f497247c22492394d840d878d06bf4")
        self.assertNotEqual(config.native_database, config.state_database)
        self.assertEqual(str(config.root).replace("\\", "/"), "/run/meri-native-auth/" + RUN)

    def test_both_artifacts_refuse_drift(self):
        # Intentional change: owner-supplied exact future image is valid DATA;
        # PostgreSQL stays fixed, and image authority comes from activation.
        with self.assertRaisesRegex(Refused, "FIXED_ARTIFACTS"):
            parse_config(data(postgresImage="sha256:" + "0" * 64))
        self.assertEqual(parse_config(data(proxyImage="sha256:" + "a" * 64)).proxy_image, "sha256:" + "a" * 64)
        with self.assertRaisesRegex(Refused, "IMAGE_DIGEST"):
            parse_config(data(proxyImage="latest"))

    def test_duplicate_unknown_missing_and_nonobject(self):
        for raw in (data()[:-1] + b',"runId":"' + RUN.encode() + b'"}', data(extra=True), b"{}", b"[]"):
            with self.subTest(raw=raw[:20]), self.assertRaises(Refused):
                parse_config(raw)

    def test_strict_encoding_and_size(self):
        for raw in (b"\xff", b" " * 4097, b"{", "not bytes"):
            with self.subTest(raw=type(raw)), self.assertRaises(Refused):
                parse_config(raw)

    def test_budget_bool_float_nonfinite_outside_bounds(self):
        for field in ("workSeconds", "cleanupSeconds"):
            for value in (True, False, 0, -1, 301, 1.5, float("inf"), None):
                with self.subTest(field=field, value=value), self.assertRaises(Refused):
                    parse_config(data(**{field: value}))

    def test_identity_and_pin_are_canonical(self):
        for update in ({"runId": RUN.upper()}, {"runId": "../x"}, {"runId": RUN.replace("-", "")}, {"nativeUrlSha256": "F" * 64}, {"nativeUrlSha256": "0" * 63}):
            with self.subTest(update=update), self.assertRaises(Refused):
                parse_config(data(**update))

    def test_direct_dataclass_construction_cannot_bypass_bounds(self):
        for args in (("../bad", "0" * 64, 1, 1), (RUN, "bad", 1, 1), (RUN, "0" * 64, True, 1), (RUN, "0" * 64, 1, 31)):
            with self.subTest(args=args), self.assertRaises(Refused):
                NativeFixture(*args)

    def test_raw_url_exact_hash_no_transcoding(self):
        config = parse_config(data())
        self.assertEqual(bind_native_url(URL, config), URL.decode())
        with self.assertRaisesRegex(Refused, "URL_DRIFT"):
            bind_native_url(URL + b"\n", config)

    def test_url_foreign_host_database_role_port_and_fragment(self):
        for raw in (URL.replace(HOST.encode(), b"foreign"), URL.replace(NATIVE_USER.encode(), b"postgres"), URL.replace(b":5432/", b":5433/"), URL.replace(b"meri_native_auth_", b"meri_qualification_"), URL + b"#anything"):
            config = dataclasses.replace(parse_config(data()), native_url_sha256=hashlib.sha256(raw).hexdigest())
            with self.subTest(raw=raw[-20:]), self.assertRaises(Refused):
                bind_native_url(raw, config)

    def test_duplicate_native_query_refuses_not_silent_prisma_policy(self):
        raw = URL + b"?sslmode=require&sslmode=prefer"
        config = dataclasses.replace(parse_config(data()), native_url_sha256=hashlib.sha256(raw).hexdigest())
        with self.assertRaisesRegex(Refused, "AMBIGUOUS_NATIVE_QUERY"):
            bind_native_url(raw, config)

    def test_query_parsing_is_not_tls_approval(self):
        raw = URL + b"?sslmode=verify-full&sslrootcert=wrong"
        config = dataclasses.replace(parse_config(data()), native_url_sha256=hashlib.sha256(raw).hexdigest())
        self.assertEqual(bind_native_url(raw, config), raw.decode())
        self.assertEqual(probe.activation_status(config)["status"], probe.ACTIVATION)
        with self.assertRaisesRegex(Refused, probe.ACTIVATION):
            probe._genuine_native_probe(config).send(None)

    def test_prisma_effective_host_override_refuses(self):
        raw = URL + b"?host=foreign"
        config = dataclasses.replace(parse_config(data()), native_url_sha256=hashlib.sha256(raw).hexdigest())
        with self.assertRaisesRegex(Refused, "EFFECTIVE_HOST_OVERRIDE"):
            bind_native_url(raw, config)

    def test_fixed_mount_members_and_immutable_config(self):
        config = parse_config(data())
        with self.assertRaisesRegex(Refused, "FIXED_MOUNT_MEMBER"):
            config.path("../../credentials")
        with self.assertRaises(dataclasses.FrozenInstanceError):
            config.work_seconds = 999

    def test_no_native_upstream_imported_and_no_model_health_route(self):
        self.assertFalse(any(name == "litellm" or name.startswith("litellm.") or name == "prisma" for name in sys.modules))
        self.assertEqual(probe.ROUTES, (("GET", "/health/liveliness"), ("GET", "/health/readiness"), ("POST", "/key/generate"), ("GET", "/key/info"), ("POST", "/key/delete"), ("GET", "/key/info")))
        self.assertNotIn(("GET", "/health"), probe.ROUTES)

    def test_upstream_config_contains_only_empty_auth_fixture_model_list(self):
        config = proxy_config()
        self.assertEqual(config["model_list"], [])
        self.assertEqual(config["general_settings"]["database_url"], "os.environ/DATABASE_URL")
        self.assertTrue(config["general_settings"]["disable_model_info_refresh"])
        self.assertEqual(config["litellm_settings"]["callbacks"], [])

    def test_discarded_upstream_text_is_bounded_and_not_retained(self):
        sink = probe._DiscardUpstreamOutput()
        self.assertEqual(sink.write("synthetic private text"), 22)
        self.assertEqual(set(vars(sink)), {"count"})
        with self.assertRaisesRegex(Refused, "UPSTREAM_LOG_BOUND"):
            sink.write("x" * (2 * 1024 * 1024))


def activation_fixture():
    ca_path = "/run/meri-native-auth/" + RUN + "/ca.pem"
    url = URL + b"?" + urlencode([("sslmode", "require"), ("sslaccept", "strict"), ("sslcert", ca_path)]).encode()
    config_raw = data(nativeUrlSha256=hashlib.sha256(url).hexdigest(), proxyImage="sha256:" + "a" * 64)
    mounted = {"database-url": url, "master-key": b"sk-" + b"s" * 40,
        "salt-key": b"t" * 40, "ca.pem": b"-----BEGIN CERTIFICATE-----\nSYNTHETIC-DATA-NOT-A-CERT\n-----END CERTIFICATE-----\n",
        "config.yaml": (json.dumps(proxy_config(), sort_keys=True, separators=(",", ":")) + "\n").encode()}
    value = {"schema": "meri.native-auth.activation/1", "decision": "ADMIT_ONE_SYNTHETIC_NATIVE_AUTH_PROBE",
        "runId": RUN, "configSha256": hashlib.sha256(config_raw).hexdigest(), "imageSha256": "sha256:" + "a" * 64,
        "sourceSha256": {"fixture_config.py": "1" * 64, "native_auth_probe.py": "2" * 64}, "linuxUid": 10001,
        "notBeforeUnixMs": 1000000, "startDeadlineUnixMs": 1030000, "workDeadlineUnixMs": 1300000, "cleanupDeadlineUnixMs": 1330000,
        "mountedSha256": {k: hashlib.sha256(v).hexdigest() for k, v in mounted.items()},
        "tls": {"engineCommit": ENGINE, "discoveryCommit": TLS_DISCOVERY, "sslmode": "require", "sslaccept": "strict", "sslcert": ca_path, "host": HOST, "serverMinimumProtocol": "TLSv1.2"},
        "prerequisiteEvidenceSha256": {k: "3" * 64 for k in PREREQUISITES}}
    return config_raw, value, mounted


class Activation(unittest.TestCase):
    def checked(self, value=None, **kwargs):
        config_raw, v, _ = activation_fixture()
        if value is not None:
            v = value
        raw = json.dumps(v).encode()
        options = {"sources": {"fixture_config.py": "1" * 64, "native_auth_probe.py": "2" * 64}, "now_ms": 1000100, "uid": 10001, "platform": "linux"}
        options.update(kwargs)
        return validate_activation(config_raw, raw, hashlib.sha256(raw).hexdigest(), **options)

    def test_explicit_owner_data_accepts_new_image_not_old_e4(self):
        config, value = self.checked()
        self.assertEqual(config.proxy_image, "sha256:" + "a" * 64)
        self.assertEqual(value["mountedSha256"]["database-url"], config.native_url_sha256)
        # This is synthetic DATA, not successful prerequisite evidence.

    def test_config_image_run_and_source_drift_refuse(self):
        for key, changed in (("configSha256", "f" * 64), ("imageSha256", PROXY_IMAGE), ("runId", "foreign"), ("sourceSha256", {"fixture_config.py": "f" * 64, "native_auth_probe.py": "2" * 64})):
            _, value, _ = activation_fixture(); value[key] = changed
            with self.subTest(key=key), self.assertRaises(Refused):
                self.checked(value)

    def test_external_raw_activation_sha_duplicate_and_unknown_refuse(self):
        config_raw, value, _ = activation_fixture()
        raw = json.dumps(value).encode()
        for candidate, pin in ((raw, "0" * 64), (raw[:-1] + b',"linuxUid":10001}', None), (raw[:-1] + b',"extra":true}', None)):
            with self.subTest(pin=pin), self.assertRaises(Refused):
                validate_activation(config_raw, candidate, pin or hashlib.sha256(candidate).hexdigest(), sources=value["sourceSha256"], now_ms=1000100, uid=10001, platform="linux")

    def test_uid_platform_and_boolean_refuse(self):
        for options in ({"uid": 0}, {"uid": True}, {"platform": "win32"}):
            with self.subTest(options=options), self.assertRaisesRegex(Refused, "LINUX_UID"):
                self.checked(**options)
        _, value, _ = activation_fixture();value["linuxUid"] = True
        with self.assertRaisesRegex(Refused, "LINUX_UID"):
            self.checked(value)

    def test_original_deadline_expired_future_extended_or_bool_refuse(self):
        for options in ({"now_ms": 999999}, {"now_ms": 1030001}):
            with self.subTest(options=options), self.assertRaises(Refused):
                self.checked(**options)
        for key, changed in (("workDeadlineUnixMs", 1300001), ("cleanupDeadlineUnixMs", 1330001), ("notBeforeUnixMs", True), ("startDeadlineUnixMs", 1060001)):
            _, value, _ = activation_fixture();value[key] = changed
            with self.subTest(key=key), self.assertRaises(Refused):
                self.checked(value)

    def test_every_prerequisite_evidence_is_mandatory_but_not_proof(self):
        for name in PREREQUISITES:
            _, value, _ = activation_fixture();del value["prerequisiteEvidenceSha256"][name]
            with self.subTest(name=name), self.assertRaisesRegex(Refused, "PREREQUISITE_EVIDENCE"):
                self.checked(value)

    def test_native_tls_mode_accept_ca_host_and_protocol_exact(self):
        for key, changed in (("sslmode", "verify-full"), ("sslaccept", "accept_invalid_certs"), ("sslcert", "relative.pem"), ("host", "foreign"), ("engineCommit", "0" * 40), ("serverMinimumProtocol", "TLSv1")):
            _, value, _ = activation_fixture();value["tls"][key] = changed
            with self.subTest(key=key), self.assertRaisesRegex(Refused, "PINNED_NATIVE_TLS"):
                self.checked(value)

    def test_mounted_bytes_must_all_match_before_native_import(self):
        config, value = self.checked();_, _, mounted = activation_fixture()
        self.assertEqual(validate_mounts(config, value, mounted)[0], mounted["database-url"].decode())
        for name in MOUNT_NAMES:
            bad = dict(mounted);bad[name] += b"x"
            with self.subTest(name=name), self.assertRaisesRegex(Refused, "MOUNT_DRIFT"):
                validate_mounts(config, value, bad)

    def test_tls_url_has_no_libpq_or_duplicate_or_host_fallback(self):
        config, value = self.checked();_, _, mounted = activation_fixture()
        for suffix in (b"?sslmode=verify-full&sslrootcert=ca.pem", b"?sslmode=require&sslaccept=strict&sslcert=wrong", b"?host=foreign", b"?sslmode=require&sslmode=prefer"):
            bad = dict(mounted);bad["database-url"] = URL + suffix
            c = dataclasses.replace(config, native_url_sha256=hashlib.sha256(bad["database-url"]).hexdigest())
            v = dict(value, mountedSha256={k: hashlib.sha256(b).hexdigest() for k,b in bad.items()})
            with self.subTest(suffix=suffix), self.assertRaises(Refused):
                validate_mounts(c, v, bad)

    def test_source_preflight_and_environment_are_inert(self):
        self.assertEqual(set(probe.source_pins()), {"fixture_config.py", "native_auth_probe.py"})
        probe.validate_environment({"LITELLM_LOCAL_MODEL_COST_MAP": "True", "HOME": "/tmp/meri-home"})
        for environment in ({"AWS_PROFILE": "anything"}, {"LITELLM_WORKER_STARTUP_HOOKS": "anything"}, {"DATABASE_URL": "private"}, {"CONFIG_FILE_PATH": "wrong"}):
            with self.subTest(environment=environment), self.assertRaises(Refused):
                probe.validate_environment(environment)

    def test_no_activation_missing_source_never_reads_mount_or_imports(self):
        with patch.object(probe, "read_mounted", side_effect=AssertionError("unexpected mount read")):
            with self.assertRaises(Refused):
                probe.prepare_probe(data(), b"{}", "0" * 64)
        self.assertNotIn("litellm", sys.modules)

    def test_preflight_reads_all_mounts_before_event_loop_and_keeps_original_budget(self):
        config_raw, value, mounted = activation_fixture()
        raw = json.dumps(value).encode();events=[]
        def read(config, name, **kwargs):
            events.append(name)
            return mounted[name]
        with patch.object(probe, "source_pins", return_value=value["sourceSha256"]), patch.object(probe.os, "getuid", return_value=10001, create=True), patch.object(probe.sys, "platform", "linux"), patch.object(probe.os, "environ", {}), patch.object(probe.time, "time", return_value=1000.1), patch.object(probe.time, "monotonic", return_value=50.0), patch.object(probe, "read_mounted", side_effect=read), patch.object(probe.asyncio, "run", side_effect=AssertionError("event loop must not allocate")):
            prepared = probe.prepare_probe(config_raw, raw, hashlib.sha256(raw).hexdigest())
        self.assertEqual(events, list(MOUNT_NAMES))
        self.assertAlmostEqual(prepared.deadline, 349.9)
        self.assertAlmostEqual(prepared.cleanup_deadline, 379.9)
        self.assertNotIn("sk-", repr(prepared))
        self.assertIsInstance(prepared.sources, tuple)
        self.assertNotIn("litellm", sys.modules)

    def test_run_without_explicit_activation_denies_before_config_io(self):
        with patch.object(probe, "_read_data", side_effect=AssertionError("unexpected IO")), contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(probe.main(["--run", "--config", "/nonexistent"]), 2)
        self.assertEqual(json.loads(output.getvalue())["cleanupPassed"], False)

    def test_native_output_descriptor_ownership_restores_on_failure(self):
        duplicated=[];closed=[]
        with patch.object(probe.os, "dup", side_effect=[31,32]), patch.object(probe.os, "open", return_value=33), patch.object(probe.os, "dup2", side_effect=lambda source,target: duplicated.append((source,target))), patch.object(probe.os, "close", side_effect=closed.append):
            with self.assertRaisesRegex(RuntimeError, "synthetic failure"):
                with probe._discard_native_output():
                    print("synthetic private text discarded")
                    raise RuntimeError("synthetic failure")
        self.assertEqual(duplicated, [(33,1),(33,2),(31,1),(32,2)])
        self.assertEqual(closed, [31,32,33])


if __name__ == "__main__":
    unittest.main(verbosity=2)
