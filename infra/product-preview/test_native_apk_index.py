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
# The same three installs as complete logical instructions (line continuations joined), so the whole request list of a
# layer is visible on one line. INSTALLS keeps its historical meaning: the head line of each install.
INSTALL_STATEMENTS = [line for line in DOCKERFILE.replace("\\\n", " ").split("\n")
                      if "apk add --no-cache --no-network --repository %s" % REPO_DIR in line]
INSTALL_REQUESTS = " ".join(INSTALL_STATEMENTS)
def _asserted_pins():
    """The (name, version) pairs the Dockerfile's own assertion loop requires, read from that loop.

    The loop asserts installed name-version strings; the installs must request those same pairs by name.
    """
    loop = re.search(r"for p in (.+?); do", DOCKERFILE)
    if loop is None:
        raise RuntimeError("the native install assertion loop is missing from the Dockerfile")
    return [(pin.rsplit("-", 2)[0], "%s-%s" % (pin.rsplit("-", 2)[1], pin.rsplit("-", 2)[2]))
            for pin in loop.group(1).split()]


ASSERTED = _asserted_pins()


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


_FROM_RE = re.compile(r"^FROM\s+(?:--\S+\s+)*(\S+)(?:\s+AS\s+(\S+))?$", re.IGNORECASE)
_LAYER_INSTRUCTIONS = ("ADD", "COPY", "RUN")


def _dockerfile_stages():
    """The Dockerfile's stages in order, each with the instructions its builder executes.

    Continuation lines are joined first so one multi-line RUN counts once, and comments/blank
    lines are dropped, matching what Docker's builder actually runs per stage.
    """
    instructions = []
    pending = ""
    for line in DOCKERFILE.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        pending = stripped if not pending else "%s %s" % (pending, stripped)
        if pending.endswith("\\"):
            pending = pending[:-1].strip()
            continue
        instructions.append(pending)
        pending = ""
    if pending:
        instructions.append(pending)

    stages = []
    for instruction in instructions:
        match = _FROM_RE.match(instruction)
        if match:
            stages.append({"base": match.group(1), "name": match.group(2), "instructions": []})
        elif stages:
            stages[-1]["instructions"].append(instruction)
    return stages


def _layer_chain(stage):
    """Instructions in one stage that each append a layer to that stage's own chain.

    The base image's layer count is not observable offline, so it is not included here; the
    depth bound in the test leaves headroom for it against the ~120-layer chain the real build
    exhausted. FROM contributes the base, not an instruction layer.
    """
    return [instruction for instruction in stage["instructions"]
            if instruction.split(" ", 1)[0].upper() in _LAYER_INSTRUCTIONS]


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

    def test_native_installs_name_every_asserted_archive_instead_of_a_provide_resolution(self):
        """The failed ARM build installed libxml2 2.15.0-r0 while the block requires libxml2-16 2.15.4-r1.

        libxml2 2.15.0-r0 and libxml2-16 2.15.4-r1 both provide so:libxml2.so.16, so a renderer layer that named only
        the dependent left apk free to choose the provider: the build's own plan chose the predecessor and the upload
        assertion then failed on the name it declares. The same hole covers a final version that the base or an
        earlier layer already satisfies at an older revision (libstdc++ 16.2.0-r1, libgcc 16.2.0-r1, glibc 2.44-r9):
        nothing asks apk to upgrade it. All 16 names in the failing assertion block are checked at once, so the next
        build cannot fail serially on the next one of them.
        """
        self.assertEqual(len(ASSERTED), 16,
                         "the native assertion block no longer declares 16 packages: %r" % ASSERTED)
        unnamed = ["%s=%s" % pair for pair in ASSERTED if "%s=%s" % pair not in INSTALL_REQUESTS]
        self.assertEqual(unnamed, [],
                         "native installs leave %d asserted archive(s) to apk's provide resolution instead of "
                         "naming them: %s" % (len(unnamed), " ".join(unnamed)))

    def test_native_install_repository_selection_stays_exclusive(self):
        """Each native install overrides the base's repositories, leaving the staged directory as its only source.

        Three facts documented for the pinned apk 2.14.12 govern this guard: -X/--repository is additive ("can be
        specified multiple times") and does not replace the configured set; --no-network only stops fetching ("the
        cache is still used when possible"), so a configured repository stays in the set and its cached index would
        still be consulted; --repositories-file "overrides the normal repositories file and repositories.d directory
        processing". The pinned base configures a Chainguard repository and the failed 319cb785 build shows apk
        opening it from cache even with --no-network, so --repositories-file /dev/null is the documented way to make
        the staged signed index the only possible source. A second --repository or any URL would add a source, and
        this test is a text guard only: it is not proof that apk installs from the staged bytes, which remains ARM-only.
        """
        self.assertEqual(len(INSTALL_STATEMENTS), 3,
                         "expected the python, renderer and upload native installs, found %r" % INSTALL_STATEMENTS)
        for statement in INSTALL_STATEMENTS:
            self.assertEqual(statement.count("--repository "), 1,
                             "a native install does not name exactly one repository: %s" % statement)
            self.assertIn("--repository %s " % REPO_DIR, statement)
            self.assertIn("--repositories-file /dev/null", statement,
                          "a native install does not override the base's repositories, so the configured repository "
                          "stays in apk's repository set: %s" % statement)
            self.assertIn("--no-network", statement)
            self.assertNotIn("http://", statement)
            self.assertNotIn("https://", statement)

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

    def test_apk_archive_staging_stays_within_the_layer_depth_limit(self):
        """The pinned archives must not chain one layer per archive inside a single stage, and the staged repository must not become image content.

        The first real ARM build of 5d2bb93d (1609f5c6) died at [runtime 120/208] with
        "failed to prepare ...: max depth exceeded": ~120 chained apk ADD layers exhausted the
        builder's layer depth. Every archive keeps its exact ADD --checksum instruction, URL,
        checksum and order; this asserts the layer/stage organization that keeps each stage's
        chain inside the bound. The second complete ARM build (5d3f366f, c7c101e2) ran all 22
        runtime steps and was rejected by the retained post-build size gate alone: the runtime
        stage COPYed the assembled repository into its own layers, so the staged archives and the
        vendor-signed index - bytes apk only reads - were part of the exported image. This
        therefore also asserts the boundary that keeps them out: the repository is assembled in a
        build-only stage that is not the exported stage, no runtime instruction may place those
        bytes in a layer, and each native install RUN reads the repository through a read-only
        bind mount that is released with that RUN. The depth bound is set below half of the
        ~120-layer chain the real build died on, leaving headroom for base-image layers.
        """
        depth_bound = 64
        stages = _dockerfile_stages()
        names = [stage["name"] for stage in stages]

        chains = {stage["name"]: len(_layer_chain(stage)) for stage in stages if stage["name"]}
        deep = {name: count for name, count in chains.items() if count >= depth_bound}
        self.assertEqual(deep, {}, "stage layer chains reach the builder's layer-depth limit: %r" % deep)

        runtime = [stage for stage in stages if stage["name"] == "runtime"]
        self.assertEqual(len(runtime), 1, "expected exactly one runtime stage, found %r" % names)
        runtime = runtime[0]
        self.assertIs(runtime, stages[-1],
                      "the runtime stage is no longer the last stage, so the build exports an image other "
                      "than the one the retained probes and gates are written for: %r" % names)

        runtime_archives = [instruction for instruction in runtime["instructions"]
                            if instruction.startswith("ADD --checksum=")]
        self.assertEqual(runtime_archives, [],
                         "the runtime stage still chains %d archive layers of its own"
                         % len(runtime_archives))

        staging = [stage["name"] for stage in stages
                   if stage["name"] and stage["name"].startswith("native-repo-")]
        self.assertTrue(staging, "no native-repo staging stages found: %r" % names)
        staging_instructions = [instruction for stage in stages if stage["name"] in staging
                                for instruction in stage["instructions"]]
        for instruction in staging_instructions:
            self.assertTrue(instruction.startswith("ADD --checksum="),
                            "a staging stage does more than stage pinned archives: %s" % instruction)

        grouped = [instruction for instruction in staging_instructions
                   if instruction.startswith("ADD --checksum=")]
        ordered = [line.strip() for line in DOCKERFILE.splitlines()
                   if line.strip().startswith("ADD --checksum=") and line.strip().endswith(".apk")]
        self.assertEqual(grouped, ordered,
                         "the grouped staging instructions are not the Dockerfile's pinned "
                         "archive lines in their original order")
        self.assertEqual(len(grouped), len(LOCK["systemPackages"]),
                         "staged archive count %d differs from the lock's native closure %d"
                         % (len(grouped), len(LOCK["systemPackages"])))

        # The repository is assembled in a build-only stage: the retained vendor-signed index and every
        # staging partition are taken exactly once, in order, in a stage that is not the exported one.
        index_copy = "COPY %s %s/aarch64/APKINDEX.tar.gz" % (
            LOCK["uploadNativeProvenance"]["retainedSignedIndex"]["path"], REPO_DIR)
        repository = [stage for stage in stages if index_copy in stage["instructions"]]
        self.assertEqual(len(repository), 1,
                         "expected the retained index to be staged in exactly one stage, found %r" % names)
        repository = repository[0]
        self.assertIsNot(repository, runtime,
                         "the retained index and the staged archives are assembled in the runtime stage, "
                         "so the build-only repository payload becomes image content")
        self.assertEqual(repository["instructions"],
                         [index_copy] + ["COPY --from=%s %s %s" % (name, REPO_DIR, REPO_DIR)
                                         for name in staging],
                         "the repository stage does not assemble the retained index and each staging "
                         "partition exactly once in order: %r" % repository["instructions"])
        self.assertLess(names.index(repository["name"]), names.index("runtime"),
                        "the repository stage is not declared before the runtime stage: %r" % names)

        # No runtime layer may carry those bytes, and every native install must read them through a
        # read-only mount that BuildKit releases with that RUN instead of a COPY that persists.
        persisted = [instruction for instruction in runtime["instructions"]
                     if instruction.split(" ", 1)[0].upper() in ("ADD", "COPY") and REPO_DIR in instruction]
        self.assertEqual(persisted, [],
                         "the runtime stage copies repository bytes into an image layer: %r" % persisted)
        installs = [instruction for instruction in runtime["instructions"]
                    if "apk add --no-cache --no-network --repository %s" % REPO_DIR in instruction]
        self.assertEqual(len(installs), 3,
                         "expected the python, renderer and upload native installs, found %r" % installs)
        self.assertEqual([instruction for instruction in runtime["instructions"] if REPO_DIR in instruction],
                         installs,
                         "the runtime stage touches the repository path outside the three native installs")
        mount = ("--mount=type=bind,from=%s,source=%s,target=%s,readonly"
                 % (repository["name"], REPO_DIR.lstrip("/"), REPO_DIR))
        for instruction in installs:
            self.assertIn(mount, instruction,
                          "a native install does not mount the assembled repository read-only, so it would "
                          "need the repository as image content: %s" % instruction)


if __name__ == "__main__":
    unittest.main()
