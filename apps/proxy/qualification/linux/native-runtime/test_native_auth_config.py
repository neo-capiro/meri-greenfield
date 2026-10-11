"""Pure configuration controls; no native package, app, pool or auth simulation."""
import dataclasses
import hashlib
import json
from pathlib import Path
import sys
import unittest

from fixture_config import HOST, NATIVE_USER, PG_IMAGE, PROXY_IMAGE, NativeFixture, Refused, bind_native_url, parse_config, proxy_config
import native_auth_probe as probe

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
        for field in ("postgresImage", "proxyImage"):
            with self.subTest(field=field), self.assertRaisesRegex(Refused, "FIXED_ARTIFACTS"):
                parse_config(data(**{field: "sha256:" + "0" * 64}))

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


if __name__ == "__main__":
    unittest.main(verbosity=2)
