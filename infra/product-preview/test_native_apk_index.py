"""Narrow qualification checks for the retained vendor-signed native apk repository.

These assert the mechanism the three native layers depend on: the verbatim vendor-signed index is retained in the source
tree, every locked native archive is staged beside it as the local apk repository, and the native layers install from
that repository with no network and no untrusted-file exception. They do not build an image and do not execute ARM code.
"""
import hashlib
import json
import re
import sys
import tarfile
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
    loop = None
    for candidate in re.finditer(r"for p in (.+?); do", DOCKERFILE):
        if "unexpected native dependency" in DOCKERFILE[candidate.end():candidate.end() + 400]:
            loop = candidate if loop is None else loop
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


def _staged_archives_by_stage(prefix=None):
    """filename -> (checksum, stage) for every archive the Dockerfile stages into a local repository."""
    staged = {}
    for stage in _dockerfile_stages():
        if prefix is not None and not (stage["name"] or "").startswith(prefix):
            continue
        for instruction in stage["instructions"]:
            match = re.match(r"ADD --checksum=sha256:([0-9a-f]{64}) (\S+) (\S+)$", instruction)
            if match and match.group(3).endswith(".apk"):
                staged[match.group(3).rsplit("/", 1)[-1]] = (match.group(1), stage["name"])
    return staged


_INDEX_CACHE = {}


def _retained_index():
    """The retained vendor-signed index parsed into entries and the capabilities their provides lines advertise.

    Provides are whitespace-separated tokens, and a shared-library dependency is advertised as so-ver:<soname>
    while a dependency names it as so:<soname>, so both spellings are indexed here.
    """
    if _INDEX_CACHE:
        return _INDEX_CACHE["entries"], _INDEX_CACHE["provides"]
    path = ROOT / LOCK["uploadNativeProvenance"]["retainedSignedIndex"]["path"]
    with tarfile.open(path) as tar:
        member = [item for item in tar.getmembers() if item.name.endswith("APKINDEX")][0]
        text = tar.extractfile(member).read().decode("utf-8", "replace")
    entries, provides = {}, {}
    for chunk in text.split("\n\n"):
        fields = {}
        for line in chunk.splitlines():
            if len(line) > 2 and line[1] == ":":
                fields.setdefault(line[0], []).append(line[2:])
        if "P" not in fields or "V" not in fields:
            continue
        name, version = fields["P"][0], fields["V"][0]
        entry = {"name": name, "version": version, "id": "%s-%s" % (name, version),
                 "depends": [dep for dep in fields.get("D", [""])[0].split(" ") if dep],
                 "provides": [token for raw in fields.get("p", []) for token in raw.split() if token]}
        entries[entry["id"]] = entry
        for token in entry["provides"]:
            key = token.split("=")[0]
            for spelling in {key, key.replace("so-ver:", "so:")}:
                provides.setdefault(spelling, []).append(entry)
    _INDEX_CACHE["entries"], _INDEX_CACHE["provides"] = entries, provides
    return entries, provides


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
        """Both staging families write every archive under the filename its signed index requests.

        The distribution closure and the development closure are staged into two different local
        repositories, so a filename may legitimately appear once in each; the invariant checked here is
        that every staged line is parsed, keeps its source filename, stays inside a local repository, and
        that any repeated filename carries one identical checksum rather than two different archives.
        """
        add_lines = [line.strip() for line in DOCKERFILE.splitlines()
                     if line.strip().startswith("ADD --checksum=") and line.strip().endswith(".apk")]
        self.assertEqual(len(STAGED_NAMES), len(add_lines),
                         "staged ADD lines parsed inconsistently: %d parsed vs %d archive ADD lines present"
                         % (len(STAGED_NAMES), len(add_lines)))
        checksums = {}
        for checksum, source, dest in [(match.group(1), match.group(2), match.group(3))
                                       for match in re.finditer(
                                           r"ADD --checksum=sha256:([0-9a-f]{64}) (\S+\.apk) (\S+\.apk)",
                                           DOCKERFILE)]:
            filename = source.rsplit("/", 1)[-1]
            self.assertEqual(checksums.setdefault(filename, checksum), checksum,
                             "the same staged archive filename carries two different checksums: %s" % filename)
        for source, dest in STAGED_NAMES:
            self.assertEqual(dest.rsplit("/", 1)[-1], source.rsplit("/", 1)[-1],
                             "staged archive is not written under the filename the signed index requests, "
                             "so apk cannot open it in the repository: %s staged as %s" % (source, dest))
            self.assertTrue(dest.startswith("%s/aarch64/" % REPO_DIR)
                            or dest.startswith("/tmp/meri-native-dev-repo/aarch64/"),
                            "staged archive is outside the local repositories: %s" % dest)

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
        nothing asks apk to upgrade it. All 14 names in the failing assertion block are checked at once, so the next
        build cannot fail serially on the next one of them.
        """
        self.assertEqual(len(ASSERTED), 14,
                         "the native assertion block no longer declares the 14 distribution packages it still "
                         "installs: %r" % ASSERTED)
        removed = ["clamav-1.5-scanner=1.5.2-r0", "clamav-1.5-freshclam=1.5.2-r0", "clamav-1.5=1.5.2-r7"]
        still_requested = [pin for pin in removed if pin in INSTALL_REQUESTS]
        self.assertEqual(still_requested, [],
                         "the vulnerable Wolfi ClamAV packages are still installed from the retained repository: %r"
                         % still_requested)
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
                   if stage["name"] and (stage["name"].startswith("native-repo-")
                                         or stage["name"].startswith("native-dev-repo-"))]
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
        build_closure = LOCK["uploadNativeProvenance"]["clamavSourcePreparation"]["buildClosure"]
        expected_archives = len(LOCK["systemPackages"]) + len(build_closure["members"])
        self.assertEqual(len(grouped), expected_archives,
                         "staged archive count %d differs from the lock's pinned closures (%d distribution + %d "
                         "development)" % (len(grouped), len(LOCK["systemPackages"]), len(build_closure["members"])))

        # The repository is assembled in a build-only stage: the retained vendor-signed index and every
        # staging partition are taken exactly once, in order, in a stage that is not the exported one.
        index_copy = "COPY %s %s/aarch64/APKINDEX.tar.gz" % (
            LOCK["uploadNativeProvenance"]["retainedSignedIndex"]["path"], REPO_DIR)
        dev_repo_dir = "/tmp/meri-native-dev-repo"
        dev_index_copy = "COPY %s %s/aarch64/APKINDEX.tar.gz" % (
            LOCK["uploadNativeProvenance"]["retainedSignedIndex"]["path"], dev_repo_dir)
        self.assertEqual([stage["name"] for stage in stages if dev_index_copy in stage["instructions"]],
                         ["native-dev-repository"],
                         "the development repository does not stage the retained signed index exactly once: %r"
                         % names)
        repository = [stage for stage in stages if index_copy in stage["instructions"]]
        self.assertEqual(sorted(stage["name"] for stage in repository),
                         ["native-repository"],
                         "expected exactly the runtime repository stage to assemble the distribution repository, "
                         "found %r" % names)
        assemblies = {stage["name"]: stage for stage in repository}
        assemblies["native-dev-repository"] = [stage for stage in stages
                                              if stage["name"] == "native-dev-repository"][0]
        self.assertNotIn("runtime", assemblies,
                         "the retained index and the staged archives are assembled in the runtime stage, "
                         "so the build-only repository payload becomes image content")
        distribution = assemblies["native-repository"]
        self.assertEqual(distribution["instructions"],
                         [index_copy] + ["COPY --from=%s %s %s" % (name, REPO_DIR, REPO_DIR)
                                         for name in staging if name.startswith("native-repo-")],
                         "the runtime repository stage does not assemble the retained index and each distribution "
                         "staging partition exactly once in order: %r" % distribution["instructions"])
        development = assemblies["native-dev-repository"]
        self.assertEqual(development["instructions"],
                         [dev_index_copy] + ["COPY --from=%s %s %s" % (name, dev_repo_dir, dev_repo_dir)
                                             for name in staging if name.startswith("native-dev-repo-")]
                         + ["COPY --from=native-source-inputs /tmp/meri-native-source /tmp/meri-native-source"],
                         "the development repository stage does not assemble the retained index, each development "
                         "staging partition and the authenticated source inputs exactly once in order: %r"
                         % development["instructions"])
        for name in ("native-repository", "native-dev-repository", "clamav-source-build"):
            self.assertLess(names.index(name), names.index("runtime"),
                            "the %s stage is not declared before the exported runtime stage: %r" % (name, names))

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
                 % ("native-repository", REPO_DIR.lstrip("/"), REPO_DIR))
        for instruction in installs:
            self.assertIn(mount, instruction,
                          "a native install does not mount the assembled repository read-only, so it would "
                          "need the repository as image content: %s" % instruction)


class SourceBuiltClamavPayload(unittest.TestCase):
    """SCRUM-197: the vulnerable Wolfi ClamAV payload is removed and replaced by a source-built one.

    These are text and record checks over the frozen source, the lock and the retained advisory table. They are not
    proof that the built payload installs or scans clean: that remains ARM-build, probe and scan evidence.
    """

    PREP = LOCK["uploadNativeProvenance"]["clamavSourcePreparation"]
    STAGES = {stage["name"]: stage for stage in _dockerfile_stages() if stage["name"]}

    def test_the_vulnerable_wolfi_install_requests_are_gone_and_nothing_shadows_them(self):
        for request in self.PREP["replacedPayload"]["distributionInstallRequestsRemoved"]:
            self.assertNotIn(request, INSTALL_REQUESTS,
                             "the vulnerable Wolfi ClamAV package is still requested by a native install: %s" % request)
        self.assertNotIn("clamav", " ".join(
            instruction for instruction in self.STAGES["runtime"]["instructions"]
            if instruction.startswith("apk add")),
            "a runtime install still names a ClamAV distribution package")
        self.assertIn("if apk info -v | grep -q '^clamav-1.5'; then", DOCKERFILE,
                      "the runtime stage no longer asserts that no clamav-1.5 distribution package is installed")
        self.assertIn("unexpected clamav-1.5 distribution package installed", DOCKERFILE,
                      "the clamav-1.5 absence check does not report the offending package")
        self.assertIn("apk info -v | grep '^clamav-1.5'; exit 1; fi", DOCKERFILE,
                      "the clamav-1.5 absence check does not fail closed")
        for archive in self.PREP["replacedPayload"]["archivesStillStagedByteForByte"]:
            filename = "%s-%s.apk" % (archive["name"], archive["version"])
            self.assertEqual(STAGED.get(filename), archive["sha256"],
                             "the preserved staging closure no longer carries %s at its pinned checksum" % filename)

    def test_the_payload_is_installed_from_the_build_only_stage_into_the_sandbox_paths(self):
        runtime = self.STAGES["runtime"]
        self.assertIn("COPY --from=clamav-source-build /tmp/meri-clamav-out/ /", runtime["instructions"],
                      "the runtime stage does not take the built payload from the build-only stage")
        stage_names = [stage["name"] for stage in _dockerfile_stages()]
        self.assertEqual(stage_names[-1], "runtime",
                         "the exported stage is no longer the runtime stage: %r" % stage_names[-3:])
        self.assertEqual(stage_names[-2], "clamav-source-build",
                         "the compiler stage is not the stage immediately before the exported runtime stage")
        self.assertIn("sha256sum -c /usr/share/meri/clamav-component-inventory.txt", DOCKERFILE,
                      "the installed bytes are not re-checked against the recorded inventory")
        for tool in self.PREP["install"]["toolSurface"]:
            self.assertIn(tool, DOCKERFILE, "the installed payload's tool surface does not name %s" % tool)
        runtime_text = " ".join(runtime["instructions"])
        for pattern in (r"\bgcc=", r"\bg\+\+=", r"\bcmake=", r"\brustc\b", r"\bcargo\b", r"/opt/rust", r"\bclang\b"):
            self.assertIsNone(re.search(pattern, runtime_text),
                              "the exported runtime stage carries compiler material matching %s" % pattern)

    def test_the_build_stage_installs_the_pinned_closure_offline(self):
        build = " ".join(self.STAGES["clamav-source-build"]["instructions"])
        self.assertIn("apk add --no-cache --no-network --repository /tmp/meri-native-dev-repo", build)
        self.assertIn("--repositories-file /dev/null", build)
        self.assertNotIn("--allow-untrusted", DOCKERFILE)
        self.assertNotIn("http://", build.replace("/tmp/meri-native-dev-repo", ""))
        for member in self.PREP["buildClosure"]["members"]:
            self.assertIn("ADD --checksum=sha256:%s %s /tmp/meri-native-dev-repo/aarch64/%s-%s.apk" % (
                member["sha256"], member["url"], member["name"], member["version"]), DOCKERFILE,
                          "the development closure member %s is not staged at its pinned checksum" % member["name"])

    def test_the_ctest_gate_keeps_every_registered_suite_and_no_selection(self):
        """The gate is the upstream suite itself: build 75b91bdb failed on missing test dependencies, not on bad tests.

        It ran ctest over the pinned tree and reported two failures - four iconv codepage checks and a clamscan
        suite that collected nothing - because this stage lacked the gconv converters and pytest. The correction
        supplies both, so the guard here is the property it must preserve: ENABLE_TESTS stays on and the ctest
        invocation still selects every registered suite, with no exclusion, regex or no-tests escape.
        """
        build = " ".join(self.STAGES["clamav-source-build"]["instructions"])
        self.assertIn("-D ENABLE_TESTS=ON", build, "the upstream test suites are no longer configured")
        self.assertEqual(build.count("ctest --test-dir /tmp/clamav-build"), 1,
                         "the ClamAV ctest gate is missing or duplicated")
        command = build[build.index("ctest --test-dir /tmp/clamav-build"):].split(" && ")[0]
        self.assertIn("--output-on-failure", command)
        for escape in (" -E ", "--exclude", "-R ", "--tests-regex", "--rerun-failed", "--no-tests", "--skip"):
            self.assertNotIn(escape, command, "the ctest gate selects or skips tests now: %s" % command)

    def test_the_charset_modules_and_the_test_runner_are_pinned_and_installed(self):
        """Both observed ctest failures were dependency gaps in this stage, so both dependencies are pinned here.

        glibc-2.44-iconv carries the gconv converters the four SHIFT_JIS/UTF-16 checks call through iconv, and
        pytest is the runner CMake selects for the directory-shaped clamscan suite. Every archive is staged at its
        locked checksum, requested by exact version and asserted after installation, and pytest is installed only
        after the interpreter it runs on.
        """
        build = " ".join(self.STAGES["clamav-source-build"]["instructions"])
        correction = self.PREP["buildClosure"]["ctestGateCorrection"]
        members = {member["name"]: member for member in self.PREP["buildClosure"]["members"]}
        self.assertIn("glibc-2.44-iconv", correction["members"])
        for name in correction["members"]:
            member = members[name]
            self.assertIn("%s=%s" % (name, member["version"]), build,
                          "the correction's archive %s is not requested by exact version" % name)
            self.assertIn("%s-%s" % (name, member["version"]), build,
                          "the installed archive %s is not verified after installation" % name)
            self.assertEqual(STAGED.get("%s-%s.apk" % (name, member["version"])), member["sha256"],
                             "the correction's archive %s is not staged at its locked checksum" % name)
        self.assertIn("python3.13 -m pytest --version", build, "the test runner is not exercised after installation")
        self.assertLess(build.index("python-3.13=3.13.16"), build.index("py3.13-pytest="),
                        "pytest is requested before the interpreter it must run on")

    def test_the_runtime_image_carries_the_converters_the_delivered_scanner_uses(self):
        """The compiler-stage converters alone do not reach the scanner: the runtime copies that same libclamav.

        libclamav converts through the system iconv when HAVE_ICONV is set (libclamav/entconv.c 1046/1050 iconv_open,
        1057 iconv), and Wolfi splits the gconv modules out of libc, so the archive has to be staged in the runtime
        repository and installed in the runtime image as well. This guards that runtime closure entry, its offline
        request and assertion, the absence of compiler/test packages from the runtime layer, and the real conversion
        probe the next build runs against the built image.
        """
        iconv = [package for package in LOCK["systemPackages"] if package["name"] == "glibc-2.44-iconv"]
        self.assertEqual(len(iconv), 1, "the runtime system closure does not carry glibc-2.44-iconv exactly once")
        iconv = iconv[0]
        self.assertEqual(iconv["version"], "2.44-r10")
        self.assertEqual(iconv["sha256"], "706b29d19e1b45086515d6ecfa7b9adb2c0add5a08d29e83cdd047d2e52cab9d")
        self.assertEqual(iconv["bytes"], 3856747)
        self.assertEqual(STAGED.get("glibc-2.44-iconv-2.44-r10.apk"), iconv["sha256"],
                         "the runtime converter archive is not staged in the pinned repository at its locked checksum")
        self.assertIn("ADD --checksum=sha256:%s %s /tmp/meri-native-repo/aarch64/glibc-2.44-iconv-2.44-r10.apk"
                      % (iconv["sha256"], iconv["source"]), DOCKERFILE,
                      "the runtime converter archive is not staged into the runtime repository")
        runtime = " ".join(self.STAGES["runtime"]["instructions"])
        self.assertIn("glibc-2.44-iconv=2.44-r10", runtime,
                      "the runtime install does not request the converters the delivered scanner converts through")
        self.assertIn("glibc-2.44-iconv-2.44-r10", runtime,
                      "the runtime install does not verify the converter archive after installation")
        for module in ("gconv-modules", "/usr/lib/gconv/$module.so", "for module in SJIS UTF-16 UTF-32"):
            self.assertIn(module, runtime, "the runtime install no longer asserts the %s converter" % module)
        self.assertNotIn("py3.13-pytest", runtime,
                         "a compiler/test-runner package leaked into the runtime image")
        compiler = {member["name"] for member in self.PREP["buildClosure"]["members"]}
        self.assertIn("glibc-2.44-iconv", compiler,
                      "the compiler-stage converter installation was dropped while adding the runtime one")
        hook = (ROOT / "infra" / "product-preview" / "image-build.sh").read_text(encoding="utf-8")
        for expected in ("e38193e38293e381abe381a1e381af", "48656c6c6f20776f726c6421", "SHIFT_JIS", "UTF-16BE",
                         "UTF-16LE", "/usr/bin/iconv"):
            self.assertIn(expected, hook,
                          "the final-image probe no longer converts the real codepages through system iconv")
        self.assertIn("runtimeIconvClosure", LOCK["uploadNativeProvenance"],
                      "the lock does not record why the converters are part of the runtime closure")

    def test_the_clamav_install_layout_is_pinned_to_usr_lib(self):
        """The install directory is part of the contract, not a toolchain default.

        Build 62f70432 compiled and passed all six ctest suites, then installed the libraries into usr/lib64 while the
        recipe's inventory step, its provenance record and the runtime loader assertions all name usr/lib, so the stage
        aborted on its own presence check. Upstream CMakeLists.txt 182 includes GNUInstallDirs, 185-186 derive the RPATH
        from CMAKE_INSTALL_FULL_LIBDIR, and every library install names ${CMAKE_INSTALL_LIBDIR} (libclamav 521,
        libfreshclam 108, libclamunrar 112, libclamunrar_iface 86, libclammspack 86, libclamav_rust 60). The configure
        step therefore pins both halves of that pair, and the collectors keep reading usr/lib rather than following the
        installed directory wherever it goes.
        """
        build = " ".join(self.STAGES["clamav-source-build"]["instructions"])
        self.assertIn("-D CMAKE_INSTALL_PREFIX=/usr", build,
                      "the ClamAV install prefix is no longer pinned to /usr")
        self.assertIn("-D CMAKE_INSTALL_LIBDIR=lib", build,
                      "the ClamAV library directory is left to the GNUInstallDirs default instead of /usr/lib")
        self.assertIn("-D CMAKE_INSTALL_SYSCONFDIR=/etc", build,
                      "the ClamAV sysconf directory pin was dropped")
        self.assertNotIn("lib64", build, "the compiler stage now tolerates or expects a lib64 layout")
        self.assertIn("find usr/lib -maxdepth 1 -type f", DOCKERFILE,
                      "the installed-payload inventory no longer collects the libraries from usr/lib")
        self.assertIn("grep -q ' usr/lib/libclamav\\.so'", DOCKERFILE,
                      "the inventory presence check no longer requires usr/lib/libclamav.so")
        runtime = " ".join(self.STAGES["runtime"]["instructions"])
        for library in ("/usr/lib/libclamav.so.*", "/usr/lib/libfreshclam.so.*", "/usr/lib/libclamunrar.so.*"):
            self.assertIn(library, runtime,
                          "the runtime loader assertion no longer expects %s" % library)
        self.assertNotIn("lib64", runtime, "a runtime loader assertion now accepts a lib64 layout")

    def test_the_clamav_sbin_binaries_install_into_bin_for_the_merged_layout(self):
        """The base image exposes /usr/sbin as a merged link, so sbin binaries must install into bin.

        Build 1f46fbbe compiled, passed all six suites and installed the libraries to /usr/lib, then failed at
        `COPY --from=clamav-source-build /tmp/meri-clamav-out/ /` with `cannot copy to non-directory:
        .../merged/usr/sbin`. The pinned Wolfi base provides merged-sbin and merged-usrsbin virtuals, so /usr/sbin
        is a link rather than a directory and a payload that contains a usr/sbin directory cannot be applied to it.
        Upstream ClamAV installs its sbin binaries through CMAKE_INSTALL_SBINDIR, so the recipe pins that to bin: the
        payload then carries no usr/sbin entry, the preserved /usr/sbin -> bin link still resolves the public path,
        and the inventory, provenance and runtime guards describe the actual delivered usr/bin paths.
        """
        build = " ".join(self.STAGES["clamav-source-build"]["instructions"])
        self.assertIn("-D CMAKE_INSTALL_SBINDIR=bin", build,
                      "the ClamAV sbin binaries are not pinned into bin, so a usr/sbin directory re-enters the payload")
        self.assertNotIn("-D CMAKE_INSTALL_SBINDIR=sbin", build,
                         "the ClamAV sbin binaries are pinned back onto the merged /usr/sbin link")
        self.assertNotIn("find usr/bin usr/sbin", DOCKERFILE,
                         "the inventory collector still names usr/sbin, which the payload no longer contains")
        self.assertIn("find usr/bin -type f", DOCKERFILE,
                      "the inventory collector does not collect the executables from usr/bin")
        self.assertIn('"installedInventoryCovers":"usr/bin/*, usr/lib', DOCKERFILE,
                      "the Dockerfile provenance does not describe the actual usr/bin surface")
        self.assertNotIn('"installedInventoryCovers":"usr/bin/*, usr/sbin/*', DOCKERFILE,
                         "the Dockerfile provenance still claims a usr/sbin surface the payload does not carry")
        covers = self.PREP["authentication"]["imageProvenance"]["installedInventoryCovers"]
        self.assertNotIn("usr/sbin", covers,
                         "the lock provenance still claims a usr/sbin surface the payload does not carry")
        self.assertIn("usr/bin/*", covers,
                      "the lock provenance does not describe the actual usr/bin surface")
        runtime = " ".join(self.STAGES["runtime"]["instructions"])
        for name in ("clamd", "clamav-milter", "clamonacc"):
            self.assertIn("/usr/bin/%s" % name, runtime,
                          "the runtime guard does not check the delivered /usr/bin/%s path" % name)
            self.assertIn("/usr/sbin/%s" % name, runtime,
                          "the runtime guard does not prove the public /usr/sbin/%s path still resolves "
                          "through the preserved merged link" % name)

    def test_the_runtime_version_probe_preserves_tool_output_and_the_loader_dependency(self):
        """Build 2066e603 installed the payload but clamscan reported an unexpected version.

        The old loop piped `--version` into `grep -q`, so it saw only whether the banner was present and discarded
        the tool's stdout/stderr and exit status. A missing linked library (libclamav links JSONC::jsonc; json-c is
        staged and in the runtime closure but was never installed) therefore surfaced as "unexpected ClamAV
        version" with no cause. The probe now prints each tool's actual output and status, fails closed on a
        nonzero status before checking the banner, and still requires the exact ClamAV 1.5.4 version. json-c is
        named in the upload layer install so the linked soname is actually present.
        """
        runtime = " ".join(self.STAGES["runtime"]["instructions"])
        self.assertNotIn("\"$tool\" --version 2>&1 | grep -q 'ClamAV 1.5.4'", runtime,
                         "the version probe still discards the tool's status behind a pipeline")
        self.assertIn('tool_out=$("$tool" --version 2>&1); tool_status=$?', runtime,
                      "the version probe does not capture the tool's output and exit status")
        self.assertIn("printf '%s --version exit=%s output=%s", runtime,
                      "the version probe does not print the actual banner and status")
        self.assertIn('if [ "$tool_status" -ne 0 ]; then echo "tool failed to execute: $tool"; exit 1; fi', runtime,
                      "the version probe does not fail closed on a nonzero tool status")
        self.assertIn('case "$tool_out" in *"ClamAV 1.5.4"*)', runtime,
                      "the version probe no longer requires the exact ClamAV 1.5.4 banner")
        self.assertIn("sigtool --md5 /tmp/meri-sigtool-probe > /tmp/meri-sigtool-out 2> /tmp/meri-sigtool-err",
                      runtime, "the signature probe does not preserve sigtool's stdout and stderr")
        self.assertIn('if [ "$sigtool_status" -ne 0 ]; then echo "sigtool failed to execute"; exit 1; fi', runtime,
                      "the signature probe does not fail closed on a nonzero sigtool status")
        ocr = [statement for statement in INSTALL_STATEMENTS if "tesseract=5.5.0-r2" in statement]
        self.assertEqual(len(ocr), 1, "the upload layer install request is not identifiable")
        self.assertIn("json-c=0.19-r2", ocr[0],
                      "the upload layer does not install the json-c library libclamav links")
        self.assertIn("json-c-0.19-r2", ocr[0],
                      "the upload layer no longer asserts the installed json-c version")
        jsonc = {package["name"]: package for package in LOCK["systemPackages"]}["json-c"]
        self.assertEqual(jsonc["sha256"], "ed8464ea37ad9d4f008c17864a5b97bbe1b41969c79b4c9913921eb965db267e")
        self.assertIn("ADD --checksum=sha256:%s %s /tmp/meri-native-repo/aarch64/json-c-%s.apk"
                      % (jsonc["sha256"], jsonc["source"], jsonc["version"]), DOCKERFILE,
                      "the runtime-staged json-c archive is not pinned at the closure checksum")

    def test_the_authenticated_source_and_toolchain_inputs_are_pinned(self):
        auth = self.PREP["authentication"]
        for url, digest, label in ((auth["tarballUrl"], auth["tarballSha256"], "release asset"),
                                   (auth["signatureUrl"], auth["signatureSha256"], "detached signature"),
                                   (auth["keyUrl"], auth["keySha256"], "Cisco Talos public key")):
            self.assertIn("ADD --checksum=sha256:%s %s" % (digest, url), DOCKERFILE,
                          "the authenticated %s is not staged at its verified checksum" % label)
        toolchain = self.PREP["rustToolchain"]
        self.assertIn("ADD --checksum=sha256:%s %s" % (toolchain["sha256"], toolchain["url"]), DOCKERFILE,
                      "the Rust toolchain input is not staged at its signature-verified checksum")
        self.assertIn(auth["keyFingerprint"], DOCKERFILE + json.dumps(self.PREP),
                      "the verified signing-key fingerprint is not recorded anywhere")
        keyring = self.PREP["authentication"]["keyring"]
        rust_keyring = self.PREP["authentication"]["rustKeyring"]
        for entry, name in ((keyring, "cisco-talos-keyring.gpg"), (rust_keyring, "rust-release-keyring.gpg")):
            self.assertIn("COPY infra/product-preview/native-clamav-keys/%s /tmp/meri-native-source/%s" % (name, name),
                          DOCKERFILE, "the dearmored %s is not copied into the source stage" % name)
            self.assertIn("%s  /tmp/meri-native-source/%s" % (entry["sha256"], name), DOCKERFILE,
                          "the dearmored %s is not pinned by sha256 inside the build" % name)
        self.assertIn("gpgv --keyring /tmp/meri-native-source/cisco-talos-keyring.gpg", DOCKERFILE,
                      "the build stage no longer verifies the detached signature with the pinned vendor keyring")
        self.assertIn("VALIDSIG %s" % self.PREP["authentication"]["keyFingerprint"], DOCKERFILE,
                      "the build stage no longer asserts the ClamAV signing fingerprint")
        self.assertIn("VALIDSIG %s" % self.PREP["authentication"]["rustKeyFingerprint"], DOCKERFILE,
                      "the build stage no longer asserts the Rust toolchain signing fingerprint")
        self.assertNotIn("gpg --homedir", DOCKERFILE,
                         "the build stage calls a gpg binary the pinned development closure does not carry")
        self.assertEqual(auth["verificationExit"], 0)
        self.assertIn("GOODSIG", " ".join(auth["verificationStatus"]))

    def test_the_openssl4_compatibility_patch_is_pinned_and_applied_after_the_verified_source(self):
        # ClamAV 1.5.4's cl_ASN1_GetTimeT reads ASN1_TIME's struct directly, and the 4.0.3 headers this closure installs
        # make ASN1_TIME opaque, so that object file cannot compile without this bounded compatibility patch.
        patches = ROOT / "infra" / "product-preview" / "native-clamav-patches"
        patch_path = patches / "clamav-1.5.4-openssl4-asn1-time.patch"
        applier_path = patches / "apply-pinned-patch.py"
        self.assertTrue(patch_path.is_file(), "the compatibility patch is not in the source tree")
        self.assertTrue(applier_path.is_file(), "the pinned-patch applier is not in the source tree")
        self.assertIn('echo "%s  /tmp/meri-clamav-patches/clamav-1.5.4-openssl4-asn1-time.patch"'
                      % hashlib.sha256(patch_path.read_bytes()).hexdigest(), DOCKERFILE,
                      "the build does not pin the compatibility patch by its current bytes")
        self.assertIn('echo "%s  /tmp/meri-clamav-patches/apply-pinned-patch.py"'
                      % hashlib.sha256(applier_path.read_bytes()).hexdigest(), DOCKERFILE,
                      "the build does not pin the applier by its current bytes")
        self.assertIn("sha256sum -c /tmp/clamav-compat.sha256", DOCKERFILE)
        text = patch_path.read_text(encoding="utf-8")
        before_all = re.findall(r"^target-sha256-before  ([0-9a-f]{64})$", text, re.M)
        after_all = re.findall(r"^target-sha256-after   ([0-9a-f]{64})$", text, re.M)
        self.assertEqual(len(before_all), 1, "the patch must record exactly one upstream file hash")
        self.assertEqual(len(after_all), 1, "the patch must record exactly one resulting file hash")
        self.assertIn("apply-pinned-patch.py /tmp/meri-clamav-patches/clamav-1.5.4-openssl4-asn1-time.patch "
                      "/usr/src/clamav-1.5.4/libclamav/crypto.c %s %s" % (before_all[0], after_all[0]), DOCKERFILE,
                      "the build does not apply that patch to that file between those exact recorded hashes")
        body = text[text.index("--- a/"):]
        self.assertEqual(re.findall(r"^(?:---|\+\+\+) (\S+)$", body, re.M),
                         ["a/libclamav/crypto.c", "b/libclamav/crypto.c"],
                         "the patch must touch exactly one upstream source file")
        removed = [line[1:] for line in body.splitlines() if line.startswith("-") and not line.startswith("---")]
        self.assertEqual(sum("timeobj->" in line for line in removed), 4,
                         "the patch must replace exactly the four direct ASN1_TIME struct reads and nothing else")
        for accessor in ("ASN1_STRING_length(timeobj)", "ASN1_STRING_get0_data(timeobj)", "ASN1_STRING_type(timeobj)"):
            self.assertIn(accessor, text, "the patch does not use the public accessor %s" % accessor)
        # The parser must keep the recorded value's full length: OpenSSL 4.0.3 accepts GeneralizedTime with any number
        # of fractional digits, and the old parser read the 14-digit prefix of such a value. A buffer-size cap here
        # would reject inputs the old code accepted.
        self.assertNotIn("strbuf", text, "the patch reintroduced a fixed-size buffer (an input-domain restriction)")
        self.assertNotIn("(size_t)strlength >=", text, "the patch refuses values longer than some buffer again")
        self.assertIn("malloc((size_t)strlength + 1)", text, "the patch does not copy the whole recorded value")
        self.assertEqual(text.count("free(str);"), 5,
                         "the private copy is not released on every exit path (five exits expected)")
        # The opacity claim is part of the provenance and was wrong in the first revision: ASN1_STRING/ASN1_TIME were
        # public structs through 3.x and became opaque in 4.0.
        self.assertIn("became opaque in OpenSSL 4.0", text)
        self.assertNotIn("since OpenSSL 1.1.0", text, "the patch still claims OpenSSL 1.1.0 made ASN1_TIME opaque")
        self.assertNotIn("since OpenSSL 1.1.0", DOCKERFILE, "the build comment still makes that claim")
        stage = DOCKERFILE.index("AS clamav-source-build")
        next_stage = DOCKERFILE.index("\nFROM ", stage)
        outside_code = "\n".join(line for line in (DOCKERFILE[:stage] + DOCKERFILE[next_stage:]).splitlines()
                                 if not line.lstrip().startswith("#"))
        self.assertNotIn("native-clamav-patches", outside_code,
                         "the patch inputs must stay inside the build-only source stage")
        order = [DOCKERFILE.index("COPY infra/product-preview/native-clamav-patches", stage),
                 DOCKERFILE.index("RUN --network=none", stage),
                 DOCKERFILE.index("sha256sum -c /tmp/clamav.sha256", stage),
                 DOCKERFILE.index("gpgv --keyring /tmp/meri-native-source/cisco-talos-keyring.gpg", stage),
                 DOCKERFILE.index("tar -xzf /tmp/meri-native-source/clamav-1.5.4.tar.gz", stage),
                 DOCKERFILE.index("apply-pinned-patch.py /tmp/meri-clamav-patches", stage),
                 DOCKERFILE.index("cmake -S /usr/src/clamav-1.5.4", stage)]
        self.assertEqual(order, sorted(order),
                         "the patch must be applied only after the archive checksum, the signature and the extraction")

    def test_the_coverage_check_recognises_the_installed_version_and_flags_the_old_ones(self):
        sys.path.insert(0, str(ROOT / "infra" / "product-preview"))
        try:
            import clamav_component_coverage as coverage
        finally:
            sys.path.pop(0)
        table = json.loads((ROOT / "infra" / "product-preview" / "clamav-source-advisories.json")
                           .read_text(encoding="utf-8"))
        self.assertEqual(len(table["advisories"]), 7,
                         "the retained advisory table no longer covers all seven advisories")
        self.assertEqual(sorted(row["id"] for row in table["advisories"]),
                         sorted(["CVE-2026-20337", "CVE-2026-20338", "CVE-2026-20339", "CVE-2026-20345",
                                 "CVE-2026-20346", "CVE-2026-20347", "CVE-2026-20348"]))
        installed = coverage.summarise(coverage.coverage(self.PREP["coverage"]["installedVersion"]))
        self.assertEqual(installed["flagged"], [],
                         "the pinned source-built version is not recognised as fixed for every advisory: %r" % installed)
        for vulnerable in ("1.5.2-r0", "1.5.2-r7"):
            flagged = coverage.summarise(coverage.coverage(vulnerable))
            self.assertEqual(len(flagged["flagged"]), 7,
                             "the coverage check does not flag all seven advisories for the removed payload %s: %r"
                             % (vulnerable, flagged))
        self.assertEqual(coverage.selftest(), 0, "the bounded vulnerable/fixed controls no longer pass")
        recognised = coverage.summarise(coverage.coverage("1.4.6"))
        self.assertEqual(len(recognised["outcomes"]["fixed"]), 5,
                         "the 1.4 fixed state is not recorded as fixed for the five the 1.4.6 notes name: %r"
                         % recognised)
        self.assertEqual(len(recognised["outcomes"]["not-affected"]), 2,
                         "CVE-2026-20337/20338 are not distinguished from a fixed state for a 1.4 build: %r"
                         % recognised)
        self.assertEqual(recognised["outcomes"]["unknown"], [],
                         "the two 1.5-only advisories are reported as unknown for the 1.4 series")
        older = coverage.summarise(coverage.coverage("1.4.5"))
        self.assertEqual(sorted(older["flagged"]),
                         ["CVE-2026-20339", "CVE-2026-20345", "CVE-2026-20346", "CVE-2026-20347",
                          "CVE-2026-20348"],
                         "the 1.4 LTS is not flagged for exactly the five advisories it is documented as"
                         " affected by: %r" % older)

    def test_the_advisory_table_records_the_seven_documented_affected_ranges(self):
        documented = {"CVE-2026-20337": ["1.5.0"], "CVE-2026-20338": ["1.5.0"], "CVE-2026-20339": ["0.90"],
                      "CVE-2026-20345": ["0.98.2"], "CVE-2026-20346": ["0.0.0", "1.5.0"],
                      "CVE-2026-20347": ["0.0.0", "1.5.0"], "CVE-2026-20348": ["0.98.1"]}
        table = json.loads((ROOT / "infra" / "product-preview" / "clamav-source-advisories.json")
                           .read_text(encoding="utf-8"))
        self.assertIn("never used", table["outcomeSemantics"],
                      "the table no longer states that an absent release note is not evidence of absence")
        for advisory in table["advisories"]:
            self.assertEqual([entry["from"] for entry in advisory["affectedRanges"]], documented[advisory["id"]],
                             "the documented affected range of %s is not retained" % advisory["id"])
            self.assertTrue(all(entry.get("to") for entry in advisory["affectedRanges"]),
                            "%s records an affected range with no upper bound" % advisory["id"])
        by_id = {advisory["id"]: advisory for advisory in table["advisories"]}
        for cve in ("CVE-2026-20337", "CVE-2026-20338"):
            self.assertEqual(by_id[cve]["documentedUnaffectedSeries"], ["1.4"],
                             "%s no longer records the 1.4 series as outside its affected range" % cve)
            self.assertNotIn("do not name this advisory", json.dumps(by_id[cve]),
                             "%s still treats the absent 1.4 note as the basis of its 1.4 state" % cve)
        self.assertEqual(by_id["CVE-2026-20346"]["affectedRanges"][0]["to"], "1.4.5",
                         "the '1.4.5 and earlier' range is no longer recorded as documented")

    def test_the_compiler_stage_is_enforced_offline(self):
        build = " ".join(self.STAGES["clamav-source-build"]["instructions"])
        self.assertIn("--network=none", build,
                      "the compiler stage can reach the network across configure, cargo, the build or ctest")
        for option in ("-D CMAKE_BUILD_TYPE=RelWithDebInfo",
                       "-D RUST_COMPILER_TARGET=aarch64-unknown-linux-gnu",
                       "ctest --test-dir /tmp/clamav-build --output-on-failure",
                       "cmake --build /tmp/clamav-build"):
            self.assertIn(option, build, "the compiler stage no longer runs %s" % option)
        runtime = " ".join(self.STAGES["runtime"]["instructions"])
        self.assertIn("--network=none", runtime, "the runtime pip install no longer runs without network")

    def test_the_compiler_stage_installs_a_signed_pinned_interpreter_for_the_upstream_tests(self):
        """ENABLE_TESTS=ON makes the upstream build require an interpreter, and the development closure carries none.

        clamav-1.5.4/CMakeLists.txt 219-231 requires find_package(Libcheck REQUIRED) and find_package(Python3 REQUIRED),
        or EXACT when PYTHON_FIND_VERSION is defined, and 256-277 runs the unit-test input generators with
        ${Python3_EXECUTABLE} at build time; the same block requires `${Python3_EXECUTABLE} -m unittest --help` to
        exit 0 or configure stops with FATAL_ERROR. The development closure was resolved for the toolchain and
        carries no interpreter at all, and the interpreter the
        exported runtime stage installs is in a later stage, so it cannot supply this one. The correction reuses the
        retained runtime staging set - the same vendor-signed index and the same authenticated archives the runtime
        stage already installs python-3.13 from - through a read-only bind mount at its own path, installs the
        interpreter and its standard library from that one repository with --repositories-file /dev/null and
        --no-network, asserts the version, the stdlib imports the upstream suite uses and the exact unittest entry
        point the upstream check names, and leaves the development closure's own assertion loop running after the
        install so a drifting package would still fail the build. This is a text and record check: it is not proof
        that apk resolves or that the interpreter runs, which remains ARM-build evidence.
        """
        build = " ".join(self.STAGES["clamav-source-build"]["instructions"])
        interpreter = self.PREP["compilerInterpreter"]
        self.assertIn("CMakeLists.txt", interpreter["requiredBy"])
        self.assertIn("ENABLE_TESTS", " ".join(self.STAGES["clamav-source-build"]["instructions"]))
        self.assertIn("--mount=type=bind,from=native-repository,source=tmp/meri-native-repo,target=%s,readonly"
                      % interpreter["repositoryPath"], build,
                      "the compiler stage does not read the retained runtime staging set through a read-only mount, so "
                      "the interpreter could only come from an unauthenticated or unreviewed source")
        installs = re.findall(r"apk add --no-cache --no-network --repository %s "
                              r"--repositories-file /dev/null --update-cache [^&]+"
                              % re.escape(interpreter["repositoryPath"]), build)
        self.assertEqual(len(installs), 1,
                         "expected exactly one interpreter install in the compiler stage, found %r" % installs)
        install = installs[0]
        self.assertEqual(install.count("--repository "), 1,
                         "the interpreter install names more than one repository: %s" % install)
        self.assertIn("--repository %s " % interpreter["repositoryPath"], install)
        self.assertIn("--repositories-file /dev/null", install,
                      "the interpreter install does not override the base's repositories, so a configured "
                      "repository stays in apk's set")
        self.assertIn("--no-network", install)
        self.assertNotIn("--allow-untrusted", install)
        self.assertNotIn("http://", install)
        self.assertNotIn("https://", install)
        for package in interpreter["requested"]:
            self.assertIn("%s=%s" % (package["name"], package["version"]), install,
                          "the interpreter install leaves %s to apk's resolution instead of naming its signed "
                          "revision" % package["name"])
        staged = _staged_archives_by_stage("native-repo-")
        for package in interpreter["requested"] + interpreter["resolvedFromTheRuntimeRepository"]:
            filename = "%s-%s.apk" % (package["name"], package["version"])
            self.assertIn(filename, staged, "the interpreter package %s is not staged at all" % filename)
            self.assertEqual(staged[filename][0], package["sha256"],
                             "%s is staged at a different checksum than the lock records" % filename)
            self.assertTrue(staged[filename][1].startswith("native-repo-"),
                            "%s is not part of the retained runtime staging set the compiler stage mounts: %s"
                            % (filename, staged[filename][1]))
        for field in ("versionAssertion", "unittestAssertion", "moduleAssertion"):
            self.assertIn(interpreter[field], build,
                          "the compiler stage no longer asserts %s before configure and test execution" % field)
        for module in interpreter["stdlibModules"]:
            self.assertIn(module, interpreter["moduleAssertion"],
                          "the recorded import assertion does not cover %s, which the upstream suite imports" % module)
        configure = build.index("-D CMAKE_BUILD_TYPE=RelWithDebInfo")
        for field in ("versionAssertion", "unittestAssertion", "moduleAssertion"):
            self.assertLess(build.index(interpreter[field]), configure,
                            "%s runs after configure starts" % field)
        self.assertLess(build.index(interpreter["versionAssertion"]),
                        build.index("ctest --test-dir /tmp/clamav-build"),
                        "the interpreter is asserted after the test suite runs")
        self.assertLess(build.index(interpreter["versionAssertion"]),
                        build.index("unexpected native development dependency"),
                        "the development closure's own version assertions no longer run after the interpreter "
                        "install, so an interpreter install that replaced a pinned development package would pass")
        runtime = " ".join(self.STAGES["runtime"]["instructions"])
        self.assertIn("python-3.13=3.13.16_git20261016-r2", runtime,
                      "the exported runtime stage lost its own pinned interpreter install")
        self.assertNotIn(interpreter["repositoryPath"], runtime,
                         "the compiler stage's interpreter repository reaches the exported runtime stage")
        self.assertNotIn("meri-native-runtime-repo", runtime,
                         "the exported runtime stage names the compiler stage's interpreter repository")
        self.assertIn("Unqualified", interpreter["notProven"])

    def test_the_pinned_interpreter_closure_resolves_inside_the_staged_repositories(self):
        """Every dependency of the pinned interpreter resolves from the two staged repositories, with no new source.

        The interpreter is a signed pair of archives plus the libraries it loads, so reusing the interpreter without
        its closure would leave the stage with a binary it cannot run. This walks the retained vendor-signed index
        from the pinned interpreter packages, resolves every capability dependency through the index's own provides
        list, and requires each one to be either already installed by the development closure or staged in the
        runtime partitions the compiler stage mounts. The packages the compiler stage must take from the runtime
        staging set are asserted to be exactly the set the lock records, so the correction cannot silently widen.
        """
        interpreter = self.PREP["compilerInterpreter"]
        entries, provides = _retained_index()
        staged = _staged_archives_by_stage("native-repo-")
        installed = {"%s-%s" % (member["name"], member["version"])
                     for member in self.PREP["buildClosure"]["members"]}
        runtime_staged = {filename[:-4] for filename, (_, stage) in staged.items()
                          if stage.startswith("native-repo-")}
        virtual = set(self.PREP["buildClosure"]["unresolvedVirtualProviders"])
        self.assertTrue(installed and runtime_staged, "the staging records are absent: %d installed, %d staged"
                        % (len(installed), len(runtime_staged)))
        seen, queue, from_runtime, unsatisfied = set(), [], set(), []
        for package in interpreter["requested"]:
            queue.append("%s-%s" % (package["name"], package["version"]))
        while queue:
            package_id = queue.pop(0)
            if package_id in seen:
                continue
            seen.add(package_id)
            entry = entries.get(package_id)
            if entry is None:
                unsatisfied.append("%s is not in the retained signed index" % package_id)
                continue
            if package_id not in installed:
                if package_id in runtime_staged:
                    from_runtime.add(package_id)
                else:
                    unsatisfied.append("%s is neither installed by the development closure nor staged in the "
                                       "runtime partitions" % package_id)
            for dependency in entry["depends"]:
                if dependency.startswith("!"):
                    continue
                if dependency.startswith(("so:", "cmd:", "pc:", "so-ver:")):
                    candidates = provides.get(dependency.split("=")[0], [])
                    chosen = ([candidate for candidate in candidates if candidate["id"] in installed]
                              or [candidate for candidate in candidates if candidate["id"] in runtime_staged])
                    if chosen:
                        queue.append(chosen[0]["id"])
                    elif dependency.split("=")[0] not in virtual:
                        unsatisfied.append("no staged provider satisfies %s" % dependency)
                    continue
                name = re.split(r"[=<>~]", dependency)[0]
                if "=" in dependency:
                    queue.append("%s-%s" % (name, dependency.split("=", 1)[1]))
                    continue
                named = [entry for entry in entries.values() if entry["name"] == name]
                if name in provides:
                    named = named + [entry for entry in provides[name] if entry not in named]
                chosen = ([candidate for candidate in named if candidate["id"] in installed]
                          or [candidate for candidate in named if candidate["id"] in runtime_staged])
                if chosen:
                    queue.append(chosen[0]["id"])
                elif name not in virtual:
                    unsatisfied.append("%s names no staged package" % dependency)
        self.assertEqual(unsatisfied, [],
                         "the pinned interpreter's closure does not resolve from the staged repositories: %r"
                         % unsatisfied)
        recorded = sorted("%s-%s" % (package["name"], package["version"])
                          for package in interpreter["resolvedFromTheRuntimeRepository"])
        self.assertEqual(sorted(from_runtime), recorded,
                         "the packages the compiler stage must take from the runtime staging set are not exactly the "
                         "recorded ones")
        for package_id in sorted(from_runtime):
            filename = package_id + ".apk"
            self.assertIn(filename, staged)
            locked = {package["sha256"] for package in LOCK["systemPackages"]
                      if "%s-%s" % (package["name"], package["version"]) == package_id}
            self.assertEqual(locked, {staged[filename][0]},
                             "%s is reused without matching the authenticated checksum the lock records for it"
                             % filename)

    def test_the_component_inventory_covers_both_library_families(self):
        self.assertIn("-name 'libclam*' -o -name 'libfreshclam*'", DOCKERFILE,
                      "the recorded inventory still omits the freshclam library family")
        self.assertIn("grep -q ' usr/lib/libfreshclam\\.so'", DOCKERFILE,
                      "the build stage does not assert that the freshclam library is recorded")
        self.assertIn("find usr/bin -type f -exec sha256sum {} +", DOCKERFILE,
                      "the recorded inventory no longer covers the installed executables")
        self.assertNotIn("sha256 of every installed file", DOCKERFILE)
        self.assertNotIn("sha256 of every installed file", json.dumps(self.PREP))
        self.assertIn('"installedInventorySha256":"INSTALLED-INVENTORY-SHA256-PLACEHOLDER"', DOCKERFILE,
                      "the provenance does not carry a placeholder for the inventory's own sha256")
        self.assertIn('grep -q \'"installedInventorySha256":"[0-9a-f]\\{64\\}"\'', DOCKERFILE,
                      "the build stage does not assert that the inventory hash was recorded")
        self.assertIn("libfreshclam", self.PREP["install"]["componentInventory"],
                      "the lock still describes the inventory without the freshclam library family")

    def test_the_existing_image_build_hook_binds_the_coverage_check(self):
        hook = (ROOT / "infra" / "product-preview" / "image-build.sh").read_text(encoding="utf-8")
        self.assertIn('run 60 clamav-component-binding.log "${common[@]}" --entrypoint python3.13 '
                      '"$image" -I -B /usr/share/meri/clamav_component_coverage.py --bind', hook,
                      "the retained image build does not bind the coverage check to the built image")
        self.assertIn("--network none", hook,
                      "the common probe array is no longer network-isolated")
        self.assertIn("0<v['Size']<=3*1024**3", hook,
                      "the retained 3 GiB image ceiling assertion is no longer in the build hook")
        self.assertIn("counts.get('HIGH',0)==counts.get('CRITICAL',0)==0", hook,
                      "the retained HIGH==0 CRITICAL==0 scan gate is no longer in the build hook")
        self.assertIn("COPY infra/product-preview/clamav_component_coverage.py "
                      "infra/product-preview/clamav-source-advisories.json /usr/share/meri/", DOCKERFILE,
                      "the checker is not carried in the image that the probe measures")
        self.assertIn("$evidence/result.json", hook,
                      "a failing probe can no longer fail the existing build result")
        self.assertIn("binding", self.PREP["coverage"],
                      "the lock does not record how the coverage result is bound to the built image")

    def test_the_scan_gap_and_the_unqualified_state_are_recorded(self):
        coverage = self.PREP["coverage"]
        self.assertIn("no fixed-version", coverage["scannerFeedGap"])
        self.assertIn("HIGH==0 CRITICAL==0", coverage["method"],
                      "the coverage method no longer states that it does not weaken the retained gate")
        self.assertIn("source-range", coverage["method"])
        self.assertIn("no fixed-version", coverage["method"] + coverage["scannerFeedGap"])
        self.assertIn("Unqualified", self.PREP["qualification"])
        self.assertIn("Unqualified", LOCK["uploadNativeProvenance"]["qualification"])



if __name__ == "__main__":
    unittest.main()
