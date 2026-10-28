"""Narrow qualification checks for the retained vendor-signed native apk repository.

These assert the mechanism the three native layers depend on: the verbatim vendor-signed index is retained in the source
tree, every locked native archive is staged beside it as the local apk repository, and the native layers install from
that repository with no network and no untrusted-file exception. They do not build an image and do not execute ARM code.
"""
import hashlib
import json
import re
import unittest
from pathlib import Path


def _repo_root():
    path = Path(__file__).resolve().parent
    while path != path.parent:
        if (path / "apps" / "runtime" / "Dockerfile").is_file():
            return path
        path = path.parent
    raise RuntimeError("repository root not found")


ROOT = _repo_root()
LOCK = json.loads((ROOT / "infra" / "product-preview" / "runtime-packages.lock.json").read_text(encoding="utf-8"))
DOCKERFILE = (ROOT / "apps" / "runtime" / "Dockerfile").read_text(encoding="utf-8")
DOCKERIGNORE = ROOT / ".dockerignore"
REPO_DIR = "/tmp/meri-native-repo"
STAGED = {name: sha for sha, name in
          re.findall(r"ADD --checksum=sha256:([0-9a-f]{64}) \S+/aarch64/([A-Za-z0-9_.+-]+\.apk) ", DOCKERFILE)}
STAGED_NAMES = [(src, dest) for src, dest in
                re.findall(r"ADD --checksum=sha256:[0-9a-f]{64} (\S+\.apk) (\S+\.apk)", DOCKERFILE)]
INSTALLS = [line for line in DOCKERFILE.split("\n")
            if "apk add --no-cache --no-network --repository %s" % REPO_DIR in line]


def _ignore_rules(text):
    """Ordered .dockerignore rules as Docker reads them: cleaned pattern, negation flag.

    Docker strips surrounding whitespace, skips blank lines and '#' comments, treats a
    leading '!' as "exclude from the ignore list", and ignores a trailing slash.
    """
    rules = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        negated = stripped.startswith("!")
        pattern = (stripped[1:] if negated else stripped).strip().replace("\\", "/")
        while pattern.startswith("./"):
            pattern = pattern[2:]
        pattern = pattern.rstrip("/")
        if pattern:
            rules.append((pattern, negated))
    return rules


def _pattern_matches(pattern, path):
    """Docker's dockerignore pattern semantics: '**' spans separators, '*' and '?' do not."""
    regex, index = "^", 0
    while index < len(pattern):
        if pattern.startswith("**/", index):
            regex += "(?:.*/)?"
            index += 3
        elif pattern.startswith("**", index):
            regex += ".*"
            index += 2
        elif pattern[index] == "*":
            regex += "[^/]*"
            index += 1
        elif pattern[index] == "?":
            regex += "[^/]"
            index += 1
        else:
            regex += re.escape(pattern[index])
            index += 1
    return re.match(regex + "$", path) is not None


def _deciding_rule(rules, path):
    """Last rule matching the path or one of its parent directories wins, as in Docker."""
    parents = ["/".join(path.split("/")[:depth])
               for depth in range(1, path.count("/") + 1)]
    winner = None
    for pattern, negated in rules:
        if _pattern_matches(pattern, path) or any(_pattern_matches(pattern, parent) for parent in parents):
            winner = (pattern, negated)
    return winner


def _local_copy_sources():
    """Every local COPY/ADD source in the runtime Dockerfile, as Docker resolves it from the context."""
    sources = []
    for number, line in enumerate(DOCKERFILE.splitlines(), 1):
        stripped = line.strip()
        if not re.match(r"^(COPY|ADD)\s", stripped) or "--checksum" in stripped or "--from" in stripped:
            continue
        arguments = [token for token in stripped.split()[1:] if not token.startswith("--")]
        if len(arguments) < 2:
            continue
        for source in arguments[:-1]:
            sources.append((number, source))
    return sources


class RetainedNativeApkIndex(unittest.TestCase):
    def test_retained_index_is_verbatim_and_matches_the_lock(self):
        prov = LOCK["uploadNativeProvenance"]["retainedSignedIndex"]
        artifact = ROOT / prov["path"]
        self.assertTrue(artifact.is_file(), "retained index artifact missing: %s" % artifact)
        payload = artifact.read_bytes()
        self.assertEqual(hashlib.sha256(payload).hexdigest(), prov["sha256"])
        self.assertEqual(len(payload), prov["bytes"])
        self.assertEqual(prov["path"].rsplit("-", 1)[-1][: -len(".tar.gz")], prov["sha256"])

    def test_dockerfile_stages_that_exact_index_as_the_repository_index(self):
        prov = LOCK["uploadNativeProvenance"]["retainedSignedIndex"]
        self.assertIn("COPY %s %s/aarch64/APKINDEX.tar.gz" % (prov["path"], REPO_DIR), DOCKERFILE)

    def test_every_locked_native_archive_is_staged_with_its_locked_checksum(self):
        self.assertTrue(STAGED, "no staged native archives found in the Dockerfile")
        for package in LOCK["systemPackages"]:
            filename = "%s-%s.apk" % (package["name"], package["version"])
            self.assertIn(filename, STAGED, "locked archive is not staged by the Dockerfile: %s" % filename)
            self.assertEqual(STAGED[filename], package["sha256"],
                             "staged checksum differs from the lock for %s" % filename)

    def test_every_staged_archive_keeps_its_index_filename(self):
        self.assertEqual(len(STAGED_NAMES), len(STAGED),
                         "staged ADD lines parsed inconsistently: %d with a source vs %d staged archives"
                         % (len(STAGED_NAMES), len(STAGED)))
        for source, dest in STAGED_NAMES:
            self.assertEqual(dest.rsplit("/", 1)[-1], source.rsplit("/", 1)[-1],
                             "staged archive is not written under the filename the signed index requests, "
                             "so apk cannot open it in the repository: %s staged as %s" % (source, dest))
            self.assertTrue(dest.startswith("%s/aarch64/" % REPO_DIR),
                            "staged archive is outside the local repository: %s" % dest)

    def test_native_layers_install_from_the_local_signed_repository(self):
        self.assertEqual(len(INSTALLS), 3, "expected the python, renderer and upload native layers, found %r" % INSTALLS)
        for line in INSTALLS:
            self.assertIn("--repository %s " % REPO_DIR, line)
            self.assertIn("--no-network", line)
            self.assertNotIn(".apk", line, "a native layer still passes an archive path to apk: %s" % line)
        self.assertNotIn("--allow-untrusted", DOCKERFILE)

    def test_dockerignore_keeps_the_retained_index_in_the_build_context(self):
        """The staged index must survive .dockerignore; neighbouring unrelated files must not.

        The first real ARM build failed only here: Dockerfile:67 COPY reported the retained
        index "not found" because .dockerignore excluded the whole infra/product-preview tree
        without a native-apk-index whitelist. This evaluates the shipped .dockerignore with
        Docker's own matching rules (ordered patterns, '**' spanning separators, '*' not,
        last rule matching the path or a parent directory wins) so a regression fails offline
        without a build. A bounded FROM-scratch Docker COPY probe confirms the same verdict.
        """
        prov = LOCK["uploadNativeProvenance"]["retainedSignedIndex"]
        index = prov["path"]
        rules = _ignore_rules(DOCKERIGNORE.read_text(encoding="utf-8"))

        # 1. The whole local COPY closure must be in the Docker build context. Docker fails the
        #    build on the first excluded source, so one exclusion is already fatal.
        sources = _local_copy_sources()
        self.assertIn(index, [source for _, source in sources],
                      "the Dockerfile no longer stages the retained index at %s" % index)
        excluded = []
        for number, source in sources:
            if not (ROOT / source).exists():
                continue
            rule = _deciding_rule(rules, source)
            if rule is not None and not rule[1]:
                excluded.append("line %d %s (deciding rule %r)" % (number, source, rule[0]))
        self.assertEqual(excluded, [], "local COPY sources excluded from the Docker build context: %r" % excluded)
        absent = [source for _, source in sources if not (ROOT / source).exists()]
        self.assertEqual(absent, [], "local COPY sources missing from the source tree: %r" % absent)

        # 2. The re-include is exactly the vendor-index directory plus the one retained archive,
        #    not a broad infra/product-preview or *.tar.gz allowance.
        native = [(pattern, negated) for pattern, negated in rules if "native-apk-index" in pattern]
        self.assertEqual(native, [("infra/product-preview/native-apk-index", True),
                                  ("infra/product-preview/native-apk-index/*", False),
                                  (index, True)],
                         "native-apk-index .dockerignore rules are not the narrow expected set: %r" % native)
        self.assertEqual(_deciding_rule(rules, index), (index, True),
                         "the deciding .dockerignore rule for the retained index is not its own negation")
        position = rules.index((index, True))
        shadowing = [(pattern, negated) for pattern, negated in rules[position + 1:]
                     if _pattern_matches(pattern, index)
                     or any(_pattern_matches(pattern, parent)
                            for parent in ["infra", "infra/product-preview", "infra/product-preview/native-apk-index"])]
        self.assertEqual(shadowing, [], "a later .dockerignore rule re-excludes the retained index: %r" % shadowing)
        self.assertFalse(_pattern_matches("**/*.tar", "x.tar.gz"),
                         "Docker's '**/*.tar' rule would shadow the retained *.tar.gz index")

        # 3. Negative controls: real neighbouring files and a same-directory sibling stay excluded,
        #    so the matcher has teeth and the whitelist did not widen the context.
        for neighbour in ["infra/product-preview/agentcore-runtime.mjs",
                          "apps/worker/qualification/vendor/capiro-meri-contracts-0.1.0.tgz",
                          "infra/product-preview/native-apk-index/aarch64-APKINDEX-0000000000000000000000000000000000000000000000000000000000000000.tar.gz"]:
            self.assertIsNotNone(_deciding_rule(rules, neighbour),
                                 "neighbouring unrelated file is now in the Docker build context: %s" % neighbour)


if __name__ == "__main__":
    unittest.main()
