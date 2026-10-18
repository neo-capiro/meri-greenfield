"""Proxy Wolfi runtime lock, retained snapshot and installed-set verifier controls."""
import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from apps.proxy.product import runtime_packages as rp

HERE = Path(__file__).resolve().parents[1]
LOCK = HERE / "runtime-packages.lock.json"
SNAPSHOT = HERE / "runtime-packages"


class SnapshotTests(unittest.TestCase):
    def test_retained_snapshot_matches_lock_and_sums_exactly(self):
        lock = json.loads(LOCK.read_text())
        files = sorted(p.name for p in (SNAPSHOT / "x86_64").iterdir())
        self.assertEqual(files, sorted(["APKINDEX.tar.gz"] + [p["file"] for p in lock["additionalPackages"]]))
        for p in lock["additionalPackages"]:
            data = (SNAPSHOT / "x86_64" / p["file"]).read_bytes()
            self.assertEqual((len(data), hashlib.sha256(data).hexdigest()), (p["bytes"], p["sha256"]), p["file"])
        index = (SNAPSHOT / "x86_64" / "APKINDEX.tar.gz").read_bytes()
        self.assertEqual(hashlib.sha256(index).hexdigest(), lock["repositoryIndex"]["sha256"])
        sums = dict(reversed(line.split("  ")) for line in (SNAPSHOT / "SHA256SUMS").read_text().splitlines())
        self.assertEqual(sums, {"APKINDEX.tar.gz": lock["repositoryIndex"]["sha256"],
                                **{p["file"]: p["sha256"] for p in lock["additionalPackages"]}})
        node = json.loads((HERE.parents[2] / "infra/product-preview/runtime-packages.lock.json").read_text())
        self.assertEqual((lock["runtimeImageUri"], lock["basePackages"]), (node["runtimeImageUri"], node["basePackages"]))


class VerifyTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="proxy-rt-"))
        self.addCleanup(shutil.rmtree, self.root, True)
        self.lock = json.loads(LOCK.read_text())
        self.rows = [(p["name"], p["version"]) for p in self.lock["basePackages"] + self.lock["additionalPackages"]]
        for path in self.lock["requiredPaths"]:
            f = self.root / path.lstrip("/"); f.parent.mkdir(parents=True, exist_ok=True); f.write_text("x")

    def db(self, rows):
        f = self.root / "usr/lib/apk/db/installed"; f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text("\n\n".join(f"C:Q1x\nP:{n}\nV:{v}\nA:x86_64" for n, v in rows) + "\n")

    def test_exact_installed_set_and_minor_version_verify(self):
        self.db(self.rows)
        r = rp.verify(LOCK, self.root, version_info=(3, 13, 16))
        self.assertEqual((r["status"], r["packageCount"], r["pythonVersion"]), ("PROXY_RUNTIME_PACKAGES_VERIFIED", len(self.rows), "3.13.16"))

    def test_extra_missing_changed_duplicate_or_wrong_interpreter_refuse(self):
        cases = [self.rows + [("bash", "5.3-r14")], self.rows[1:],
                 [(n, v + "x") if n == "python-3.13" else (n, v) for n, v in self.rows], self.rows + [self.rows[0]]]
        for rows in cases:
            with self.subTest(n=len(rows)):
                self.db(rows)
                with self.assertRaises(rp.RuntimePackagesRefused):
                    rp.verify(LOCK, self.root, version_info=(3, 13, 16))
        self.db(self.rows)
        with self.assertRaises(rp.RuntimePackagesRefused):
            rp.verify(LOCK, self.root, version_info=(3, 12, 9))
        (self.root / "usr/lib/libssl.so.3").unlink()
        with self.assertRaises(rp.RuntimePackagesRefused):
            rp.verify(LOCK, self.root, version_info=(3, 13, 16))

    def test_cli_is_closed_and_content_free_on_refusal(self):
        self.assertEqual(rp.main(["verify"]), 2)
        self.assertEqual(rp.main(["verify", "--lock", str(LOCK), "--root", str(self.root)]), 2)


if __name__ == "__main__":
    unittest.main()
