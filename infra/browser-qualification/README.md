# Browser qualification source and support closure

This source candidate implements D006 v2 for all **fourteen raw payloads**.
It is **NO-BUILD / NO-HOST** pending independent owner review. Offline source
coverage is distinct from native/security/G1 admission; current Meri is untouched.

`app.mjs` remains a small direct-export entry. The JS modules separate pinned
configuration, raw source reads, loader assembly, the finite installation verifier,
compression/metadata, CDK stack and CLI. The legacy JS classifier is UNQUALIFIED.
Python keeps collection, classification, admission, export, source binding and CLI
in their focused modules. The executable entry contains only the stdlib pre-import
gate, direct aliases and CLI guard; named fixture imports stay inert.

The source payload is bootstrap, observer entry, eleven literal `host_evidence`
modules and the derived profile mapped to `seccomp.json`. There are no globs or
basename collapse. The support image contains only those fourteen source files;
`source-manifest.v2.json` is separately generated DATA. The loader checks the exact
finite layout, root ownership/modes, regular files/no links, full raw lengths and
hashes with descriptor/path identity checks. It installs directories0700/files0600,
creates manifest DATA exclusively, reopens it and rechecks every payload. The real
entry gates before any package import under `python3 -I -B`; all bootstrap and
loader Python calls use those flags. The source API also requires the finalized
tree, and context validation rejects malformed/v1/mixed data.

The manifest is duplicate-free canonical ASCII JSON (sorted keys, compact, one LF)
with `{schema:"meri-browser-source/2",assets:[{path,bytes,sha256},...14]}`. Limits:
manifest32768B, each asset2097152B, total29360128B; actual reads use each reviewed
record's exact size. Commit/image/config/template/run identities remain external.
The outer context still has exactly run/supportImage/workerImage/profileSha/source.
An uncompromised privileged loader and protected installation are prerequisites;
root0600 is not an immutable mount or hostile-root defense. Self-checks cannot
authenticate a replaced owner's expectation.

Run these source-only checks from the repository root using the existing runtimes:

```text
python -I -B infra/browser-qualification/asset-binding-regressions.py
node --test infra/browser-qualification/asset-protocol.test.mjs
node --test infra/browser-qualification/security.test.mjs
```

On Windows set test-only `MERI_TEST_PYTHON` to the bundled Python3.12.14 and
`MERI_TEST_BASH` to `C:/Program Files/Git/bin/bash.exe`; no machine PATH/install
change is needed. Python3.9 grammar is checked; actual AL2023 Python3.9 is unrun.
Windows raw files and main-path import sentinels are real fixtures; uid/mode facts
in the main/loader checks are explicitly FAKE. Windows readers compare consistent
birthtime; Linux compares ctime. No Windows result proves Linux/root permissions.

The canonical suite needs the three immutable owner-supplied ignored fixtures in
`.task-inputs`: codex-observer-checkpoint-audit.py (`d1900a59…275e2`),
owner-regressions-adapted.py (`383360dd…1c528`) and observer-before-4863878.py
(`cbfd952e…7f471`). The harness verifies their full hashes before adapting test
loading/routing. The fixed W20 maps also remain unchanged. Results retain23 direct
+23 repeated embedded codex cases and33 owner cases separately. V2 test names
explicitly replace the historical fallback positive with refusal; old raw oracle
bytes are preserved. No original observation is relabelled as native qualification.
W21's historical frozen-W17 focused suite is not a current-v2 suite.

`component-pins.json` binds all fourteen current raw source bytes. The worker tuple
is unchanged: immutable bf55… image/config6f313…/source0be04…. The original39 bodies
and21 other deferred bodies stay raw-identical; only source_manifest/_context_ok
and the adopted inspect source/fallback portion change. Original38 assignment ASTs
and per-module order,48 names,63 direct aliases and shared cancellation/cache
identity are preserved. New gate/source helpers/constants are inventoried separately.

The scratch support recipe never starts its container. The buildspec requires NEW
`meri-host-assets-build-input/2`, not the legacy flat-three archive helper. Owner
must freeze exact sourceCommit plus sourceFiles14 (path/assetPath/bytes/sha256),
ownerFiles10 (app, eight JS modules including asset-verifier, component pins), and
Dockerfile/buildspec/builderAuthority records. Source order follows runtime-path
lexicographic order; owner order is the explicit buildspec list. Packaging verifies
all inputs before Docker, copies/compares the entire finite payload tree, proves
owned container removal, pushes/reads back ECR and purges its private auth directory
before publishing the result. Failure after push leaves an UNADMITTED image.
This buildspec has not run; an independently reviewed archive/helper, IAM authority,
immutable image/config/source readback and cleanup evidence remain owner gates.

The original900s timer, bootstrap deadlines, worker provenance guard, browser
sandbox settings and cleanup responsibilities remain. Loader poweroff is still an
unbounded native limitation; offline syntax/success-path fixtures do not prove every
failure cleanup path or process descendants. Owner controller must independently
prove termination and root-volume deletion. Native AL2023/Docker/systemd/browser
and renderer sandbox, network/metadata denial, complete log transport/reconstruction,
source walls, durable recovery and G1 remain open.49 findings/22 severe remain OPEN,
Office DEFERRED, paid Bedrock0, sources disabled. No cutover or cloud launch occurs
in this source task.
