"""Offline input/archive/source checks; never native generation or app import."""
import ast
import copy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest import mock

HERE = Path(__file__).parent
def deny_effects(event, args):
    if event.startswith("socket.") or event in {"subprocess.Popen", "os.system", "os.exec", "os.posix_spawn"}:
        raise AssertionError("OFFLINE_SUITE_EXTERNAL_EFFECT")


sys.addaudithook(deny_effects)
spec = importlib.util.spec_from_file_location("meri_prisma_build", HERE / "prisma-build.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)  # Safe stdlib-only build owner, no action on import.
PINS = json.loads((HERE / "assembly-pins.json").read_bytes())
TMP = Path(os.environ.get("MERI_ASSEMBLY_TEST_TMP", str(Path.cwd() / ".task-inputs/linux-assembly-tests")))
if os.name == "nt":
    TMP = Path("\\\\?\\" + str(TMP.resolve()))  # Fixed Linux cache layout exceeds Windows MAX_PATH in deep test scratch.


def archive(entries):
    stream = io.BytesIO()
    with tarfile.open(fileobj=stream, mode="w:gz") as tar:
        for name, content, kind in entries:
            info = tarfile.TarInfo(name)
            info.mode = 0o644
            if kind == "link":
                info.type = tarfile.SYMTYPE
                info.linkname = "outside"
                tar.addfile(info)
            else:
                info.size = len(content)
                tar.addfile(info, io.BytesIO(content))
    stream.seek(0)
    return tarfile.open(fileobj=stream, mode="r:gz")


class AssemblyInputs(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=TMP)
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)

    def pins(self, value):
        path = self.directory / "pins.json"
        path.write_text(json.dumps(value), encoding="utf-8")
        return build.load_pins(path)

    def test_actual_complete_candidate_is_inert(self):
        result = build.load_pins(HERE / "assembly-pins.json")
        self.assertFalse(result["runtimeAdmitted"])
        self.assertEqual(len(result["wheels"]), 124)
        self.assertEqual(result["metadataValidation"]["satisfied"], 210)
        self.assertEqual(result["metadataValidation"]["explicitEnterpriseExclusions"], 1)

    def test_missing_artifact_hold_is_refused(self):
        p = copy.deepcopy(PINS); p["artifactHolds"] = ["missing engine"]
        with self.assertRaises(build.BuildRefused): self.pins(p)

    def test_runtime_admission_cannot_be_claimed(self):
        p = copy.deepcopy(PINS); p["runtimeAdmitted"] = True
        with self.assertRaises(build.BuildRefused): self.pins(p)

    def test_unknown_target_or_removed_five_target_schema_refused(self):
        for targets in ([], ["native"], ["native", "made-up"]):
            p = copy.deepcopy(PINS); p["prisma"]["schemaTargets"] = targets
            with self.assertRaises(build.BuildRefused): self.pins(p)

    def test_duplicate_json_and_overflow_refused(self):
        for raw in (b'{"x":1,"x":2}', b'{"x":1e309}', b'{"x":NaN}'):
            path = self.directory / "raw.json"; path.write_bytes(raw)
            with self.assertRaises(build.BuildRefused): build.load_pins(path)

    def test_unsafe_or_duplicate_artifact_paths_refused(self):
        for name in ("../outside", "/absolute", "wheels/../x", "wheels\\x", "wheels//x"):
            p = copy.deepcopy(PINS); p["artifacts"][0]["path"] = name
            with self.assertRaises(build.BuildRefused): self.pins(p)
        p = copy.deepcopy(PINS); p["artifacts"].append(p["artifacts"][0])
        with self.assertRaises(build.BuildRefused): self.pins(p)

    def test_boolean_and_oversized_artifact_lengths_refused(self):
        for value in (True, -1, build.FILE_LIMIT + 1):
            p = copy.deepcopy(PINS); p["artifacts"][0]["bytes"] = value
            with self.assertRaises(build.BuildRefused): self.pins(p)

    def test_enterprise_and_wrong_version_refused(self):
        for name, version in (("litellm-enterprise", "1"), ("litellm", "1.104.3")):
            p = copy.deepcopy(PINS)
            item = next(x for x in p["wheels"] if x["name"] == "litellm")
            item.update(name=name, version=version)
            with self.assertRaises(build.BuildRefused): self.pins(p)

    def test_exact_lock_matches_selected_uv_artifacts(self):
        expected = {r["name"] + "==" + r["version"] + " --hash=sha256:" + r["sha256"] for r in PINS["wheels"]}
        actual = [line for line in (HERE / "requirements.lock").read_text().splitlines() if line and not line.startswith("#")]
        self.assertEqual(len(actual), 124)
        self.assertEqual(set(actual), expected)
        self.assertNotIn("litellm-enterprise", "\n".join(actual))
        polars = [r for r in PINS["wheels"] if r["name"].startswith("polars")]
        self.assertTrue(polars)
        self.assertGreater(max(r["largestMember"]["bytes"] for r in polars), 128 * 1024 * 1024)

    def test_safe_archive_positive_and_malicious_members(self):
        with archive([("package/package.json", b"{}", "file")]) as tar:
            self.assertEqual(len(build._npm_members(tar)), 1)
        for name, kind in (("../escape", "file"), ("package/../escape", "file"),
                           ("package/link", "link"), ("package\\bad", "file")):
            with archive([(name, b"bad", kind)]) as tar:
                with self.assertRaises(build.BuildRefused): build._npm_members(tar)
        with archive([("package/a", b"a", "file"), ("package/a", b"a", "file")]) as tar:
            with self.assertRaises(build.BuildRefused): build._npm_members(tar)

    def test_streaming_file_above_old_128mib_limit(self):
        path = self.directory / "large"
        block = b"synthetic-streaming-check" * 4096
        expected = hashlib.sha256(); length = 0
        with path.open("xb") as out:
            while length <= 128 * 1024 * 1024:
                out.write(block); expected.update(block); length += len(block)
        self.assertEqual(build.hash_file(path), {"bytes": length, "sha256": expected.hexdigest()})
        with self.assertRaises(build.BuildRefused): build.hash_file(path, 128 * 1024 * 1024)

    def test_hardlink_refused(self):
        path = self.directory / "original"; path.write_bytes(b"fixture")
        linked = self.directory / "linked"
        try: os.link(path, linked)
        except OSError as error: self.skipTest("hardlink unavailable: " + type(error).__name__)
        with self.assertRaises(build.BuildRefused): build.hash_file(linked)

    def test_same_api_metadata_drift_refused(self):
        path = self.directory / "fixture"; path.write_bytes(b"fixture")
        actual = build.os.fstat
        def changed(fd):
            value = actual(fd)
            changed.calls += 1
            if changed.calls == 2:
                class Drift:
                    def __getattr__(self, name):
                        return value.st_ctime_ns + 1 if name == "st_ctime_ns" else getattr(value, name)
                return Drift()
            return value
        changed.calls = 0
        with mock.patch.object(build.os, "fstat", side_effect=changed):
            with self.assertRaises(build.BuildRefused): build.hash_file(path)

    def test_artifact_unlisted_and_hash_drift_refused(self):
        root = self.directory / "artifacts"; root.mkdir()
        file = root / "schema.prisma"; file.write_bytes(b"changed")
        pins = {"artifacts": [{"path": "schema.prisma", "bytes": 0, "sha256": "0" * 64}]}
        with self.assertRaises(build.BuildRefused): build.verify_artifacts(root, pins)
        (root / "extra").write_bytes(b"x")
        with self.assertRaises(build.BuildRefused): build.verify_artifacts(root, {"artifacts": []})

    def test_docker_trust_and_actual_build_observations(self):
        source = (HERE / "Dockerfile").read_text()
        self.assertIn(PINS["base"]["reference"], source)
        self.assertEqual(source.count("RUN --network=none"), 3)
        for wanted in ("Signed-By:", "ca-certificates=20250419", "python3=3.13.5-1", "python3-venv=3.13.5-1",
                       "--require-hashes", "--no-deps", "dist-upgrade", "dpkg-query", "m.distributions()",
                       "generated-client.json", "USER 10001:10001"):
            self.assertIn(wanted, source)
        for forbidden in ("trusted=yes", "--allow-unauthenticated", "--trusted-host", "curl -k", "npm install"):
            self.assertNotIn(forbidden, "\n".join(x for x in source.splitlines() if not x.startswith("#")))

    def test_entrypoints_safe_import_and_guard_order(self):
        for name in ("prisma-build.py", "import-probe.py"):
            tree = ast.parse((HERE / name).read_text())
            topcalls = [node for node in tree.body if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call)]
            self.assertEqual(topcalls, [])
        source = (HERE / "import-probe.py").read_text()
        self.assertLess(source.index("parser.parse_args(argv)"), source.index("os.getuid()"))
        self.assertLess(source.index("sys.addaudithook(audit)"), source.index("import litellm.proxy.proxy_server"))
        self.assertIn("signal.alarm(45)", source)
        self.assertIn('"databaseConnected": False', source)
        self.assertNotIn(".connect(", source)

    def test_no_cross_platform_engine_override_or_schema_mutation(self):
        source = (HERE / "prisma-build.py").read_text()
        self.assertNotIn('"PRISMA_QUERY_ENGINE_BINARY":', source)
        self.assertNotIn('"PRISMA_SCHEMA_ENGINE_BINARY":', source)
        self.assertIn('"UNQUALIFIED_GENERATED_TARGETS"', source)
        self.assertIn('"engines/query-engine-debian-openssl-3.0.x"', source)
        self.assertIn('out.write((root / "schema.prisma").read_bytes())', source)

    def test_import_audit_records_bounded_names_and_denies_effects(self):
        probe_spec = importlib.util.spec_from_file_location("meri_import_probe", HERE / "import-probe.py")
        probe = importlib.util.module_from_spec(probe_spec)
        probe_spec.loader.exec_module(probe)
        for event in ("socket.__new__", "socket.getaddrinfo", "subprocess.Popen", "os.system", "os.posix_spawn"):
            with self.assertRaises(PermissionError): probe.audit(event, ("NEVER_RETAIN_THIS_ARGUMENT",))
        for _ in range(100):
            with self.assertRaises(PermissionError): probe.audit("socket.connect", ("NOT_A_REAL_ADDRESS",))
        self.assertEqual(len(probe.DENIED), 64)
        self.assertNotIn("NEVER_RETAIN", json.dumps(probe.DENIED))
        self.assertIsNone(probe.audit("import", ("stdlib",)))
        self.assertNotIn("ARBITRARY_UPSTREAM_ERROR_WITH_VALUES", probe.REFUSAL_REASONS)

    def engine_fixture(self):
        root = self.directory / "inputs"
        root.mkdir()
        bodies = {"debian-openssl-1.1.x": b"distinct-debian11",
                  "debian-openssl-3.0.x": b"distinct-debian3",
                  "linux-musl": b"distinct-musl",
                  "linux-musl-openssl-3.0.x": b"distinct-musl3"}
        literal_paths = {
            "debian-openssl-1.1.x": "engines/debian-openssl-1.1.x/query-engine",
            "debian-openssl-3.0.x": "engines/query-engine-debian-openssl-3.0.x",
            "linux-musl": "engines/linux-musl/query-engine",
            "linux-musl-openssl-3.0.x": "engines/linux-musl-openssl-3.0.x/query-engine"}
        contents = {}
        for target, content in bodies.items():
            path = literal_paths[target]
            stem = path if target != "debian-openssl-3.0.x" else "engines/query-engine"
            contents[path] = content
            contents[stem + ".sha256"] = hashlib.sha256(content).hexdigest().encode()
            contents[stem + ".gz.sha256"] = b"1" * 64
        contents["engines/schema-engine-debian-openssl-3.0.x"] = b"only-native-schema"
        contents["engines/schema-engine.sha256"] = hashlib.sha256(b"only-native-schema").hexdigest().encode()
        contents["engines/schema-engine.gz.sha256"] = b"2" * 64
        p = copy.deepcopy(PINS)
        for name, content in contents.items():
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            row = next(row for row in p["artifacts"] if row["path"] == name)
            row.update(bytes=len(content), sha256=hashlib.sha256(content).hexdigest())
        return root, p, bodies, literal_paths

    def test_target_mapping_requires_four_concrete_keys_no_native_alias(self):
        self.assertEqual(set(build.query_engine_inputs(PINS)),
                         {"debian-openssl-1.1.x", "debian-openssl-3.0.x", "linux-musl", "linux-musl-openssl-3.0.x"})
        for operation in ("missing", "duplicate", "unknown", "alias", "foreignpath"):
            p = copy.deepcopy(PINS)
            rows = p["prisma"]["queryEngineMappings"]
            if operation == "missing": rows.pop()
            elif operation == "duplicate": rows[-1] = copy.deepcopy(rows[0])
            elif operation == "unknown": rows[-1]["target"] = "foreign"
            elif operation == "alias": rows[-1]["target"] = "native"
            else: rows[0]["body"] = "engines/query-engine-debian-openssl-3.0.x"
            with self.subTest(operation=operation), self.assertRaises(build.BuildRefused):
                self.pins(p)

    def test_target_hash_and_checksum_relation_refuse_before_cache(self):
        root, p, _, paths = self.engine_fixture()
        target = root / paths["linux-musl"]
        target.write_bytes(b"native substitution")
        with self.assertRaisesRegex(build.BuildRefused, "QUERY_TARGET_HASH"):
            build.verify_query_engines(root, p)
        cache = self.directory / "prisma/binaries"
        with mock.patch.object(build, "CACHE", cache):
            with self.assertRaises(build.BuildRefused): build.assemble_engine_cache(root, p)
        self.assertFalse(cache.exists())

    def test_checksum_sidecars_are_not_merely_unrelated_pinned_text(self):
        root, p, _, _ = self.engine_fixture()
        row = next(row for row in p["artifacts"] if row["path"] == "engines/linux-musl/query-engine.sha256")
        (root / row["path"]).write_bytes(b"0" * 64)
        row["sha256"] = hashlib.sha256(b"0" * 64).hexdigest()
        with self.assertRaisesRegex(build.BuildRefused, "QUERY_TARGET_CHECKSUM"):
            build.verify_query_engines(root, p)

    def test_exact_target_cache_layout_preserves_distinct_bytes(self):
        root, p, bodies, _ = self.engine_fixture()
        cache = self.directory / "prisma/binaries"
        (cache / "node_modules/@prisma/engines").mkdir(parents=True)
        with mock.patch.object(build, "CACHE", cache):
            build.assemble_engine_cache(root, p)
        base = cache.parent / ".cache/prisma/master/ac9d7041ed77bcc8a8dbd2ab6616b39013829574"
        for target, expected in bodies.items():
            self.assertEqual((base / target / "query-engine").read_bytes(), expected)
            self.assertEqual((base / target / "query-engine.sha256").read_bytes(), hashlib.sha256(expected).hexdigest().encode())
            self.assertEqual((base / target / "query-engine.gz.sha256").read_bytes(), b"1" * 64)
        self.assertEqual((base / "debian-openssl-3.0.x/schema-engine").read_bytes(), b"only-native-schema")
        self.assertEqual(len([p for p in base.rglob("*") if p.is_file()]), 15)
        self.assertFalse((base / "linux-musl/schema-engine").exists())

    def test_preexisting_cache_namespace_is_refused(self):
        root, p, _, _ = self.engine_fixture()
        cache = self.directory / "prisma/binaries"
        (cache.parent / ".cache").mkdir(parents=True)
        with mock.patch.object(build, "CACHE", cache):
            with self.assertRaisesRegex(build.BuildRefused, "ENGINE_CACHE_ALREADY_EXISTS"):
                build.assemble_engine_cache(root, p)

    def test_generated_four_platform_paths_and_exact_bodies(self):
        _, p, bodies, _ = self.engine_fixture()
        cache = self.directory / "prisma/binaries"
        paths = {}
        for target, content in bodies.items():
            path = cache / "node_modules/prisma" / ("query-engine-" + target)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            paths[target] = str(path)
        with mock.patch.object(build, "CACHE", cache):
            self.assertEqual(set(build.validate_generated_engines(paths, p)), set(bodies))
            for bad in ({}, {**paths, "native": next(iter(paths.values()))}, {**paths, "foreign": "x"}):
                with self.assertRaisesRegex(build.BuildRefused, "UNQUALIFIED_GENERATED_TARGETS"):
                    build.validate_generated_engines(bad, p)
            wrong = dict(paths); wrong["linux-musl"] += "/../query-engine-linux-musl"
            with self.assertRaisesRegex(build.BuildRefused, "GENERATED_ENGINE_PATHS"):
                build.validate_generated_engines(wrong, p)
            # A body from another accepted platform must still be refused.
            Path(paths["linux-musl"]).write_bytes(bodies["debian-openssl-3.0.x"])
            with self.assertRaisesRegex(build.BuildRefused, "GENERATED_ENGINE_NOT_PINNED"):
                build.validate_generated_engines(paths, p)


if __name__ == "__main__":
    TMP.mkdir(parents=True, exist_ok=True)
    unittest.main(verbosity=2)
