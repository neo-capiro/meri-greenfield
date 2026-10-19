# Canonical dependency preparation from a fresh checkout

Source remains `5b395d4ce9218b872b21c420dc00a3af31739824`. This change is confined
to the public Windows preparation wrapper; no product source or lockfile changes.

## Confirmed failure

The earlier import-identity fix prevented accidental CLI execution, but its test
used existing dependencies and did not prove fresh-checkout preparation. That
checkout also had a root `@capiro/meri-contracts` junction.

The operator reproduced the later refusal on real Windows PowerShell 5.1 and
Node v24.19.0 in a fresh public checkout with no dependency directories or
ancestor dependency directories. The first missing package was `ajv`, imported
by `packages/contracts/validate.mjs`. After the exact root lock installation
succeeded, the next missing package was `@capiro/meri-contracts`, imported by
`apps/worker/qualification/checkpoint/bound-session-store.mjs`. The previous
importer-substring allowlist did not include that package's qualification owner.

## Bounded preparation

`Pr193DependencyProbe.mjs` is the child entrypoint and imports the two canonical
modules. Its entry identity cannot match either canonical CLI guard. It returns
only a bounded structured result; exception messages, paths, and stacks are not
returned. Native Windows and file-URL importer paths are normalized and resolved
to an existing file inside the source checkout.

The probe selects only these owners:

| Fixed diagnostic token | Existing lock owner |
| --- | --- |
| `ROOT` | repository root |
| `RUNTIME` | `apps/runtime` |
| `CONVERSATION` | `apps/worker/conversation` |
| `CONTROL_CONVERSATIONS` | `apps/control/conversations` |
| `QUALIFICATION` | `apps/worker/qualification` |
| `ARTIFACT_STORAGE` | `apps/artifacts/storage` |

Selection requires the importer to be inside that owner and the missing package
to be declared consistently in its package manifest and lock. Shared contract
dependencies select the root when declared there. Root dependencies imported by
runtime or worker files also select the declaring root owner. Installed
transitive imports require an exact declaring entry in the enclosing owner's
lock. Unknown ancestry, undeclared dependencies, and lock disagreements refuse.

`Initialize-Pr193CanonicalDependencies` accepts only the closed diagnostic shape
and fixed owner/reason tokens. It uses the existing locked command:

```text
node <existing npm-cli.js> ci --prefix <verified owner> --ignore-scripts --no-audit --no-fund --loglevel=error --progress=false
```

Each owner is installed at most once per invocation; a successful existing
dependency graph performs no installation. There are at most six installs and
seven probes. Repeated missing owners refuse with
`PR193_DEPENDENCY_STILL_MISSING_<OWNER>`. An install failure reports
`PR193_DEPENDENCY_INSTALL_FAILED_<OWNER>`. Other failures have fixed reasons
distinguishing missing/unmapped dependencies, unverified ancestry, lock
disagreement, native loading, package exports, and other import failures.
Captured subprocess output is not printed. Exact source checks remain required
before preparation by the public-input path and after successful preparation.

## Offline checks completed

- Node 24: **13/13** attribution and refusal tests passed, covering all six
  owners, shared root declarations, Windows/native and encoded file URLs,
  outside/misleading ancestry, declared CJS transitive imports, lock disagreement,
  safe failure categories, and actual helper entry with both canonical CLI guards.
- Actual PowerShell 5.1: **5/5** checks passed: real exported initialization on
  existing dependencies with real Node/Git and exact source checks; CLI guard
  fixture; six-owner/seven-probe bound with fixed locked argv; repeated-owner
  refusal; and owner-specific install failure without child-output disclosure.

The offline PowerShell adapter forbids real npm execution. Its bounds and failure
cases use public fixtures. These results do not substitute for the cold run.

## Operator-owned cold run

**PASS, process exit 0.** The real second checkout began with zero `node_modules`
directories and no ancestor dependency directory. Windows PowerShell
5.1.26100.33451, Node v24.19.0, and stock npm10.9.9 ran the exported initializer
with real subprocesses and locked installs. The npm download cache could be
warm; no installed package directory or dependency junction supplied imports.
Exact commit, tracked diff, and raw Git file bytes passed before preparation
and again on successful completion, including all unchanged lockfiles.

```text
PR193_COLD_START PS=5.1.26100.33451 NODE=v24.19.0 SOURCE=5b395d4ce9218b872b21c420dc00a3af31739824
PR193_DEPENDENCY_INSTALL_ROOT
PR193_DEPENDENCY_INSTALL_QUALIFICATION
PR193_DEPENDENCY_INSTALL_RUNTIME
PR193_DEPENDENCY_INSTALL_CONTROL_CONVERSATIONS
PR193_COLD_CANONICAL_DEPENDENCIES_COMPLETE
```

The existing process was checked after the usage interruption and was confirmed
complete; it was not restarted. The exact executed driver is retained as
`Test-Pr193CanonicalDependenciesCold.ps1`. The sanitized operator receipt is
`COLD-DEPENDENCY-RESULT.json`; it records source/helper/driver/lock hashes and
the observed sequence. No branch or source substitution was used.

Two preparation failures remain recorded: the first diagnostic checkout's
unprivileged npm call refused; the scoped public root-lock install then passed.
The second checkout's initial verification was stopped by Git ownership checks
before dependency installation. The test process explicitly trusted only that
disposable checkout and then completed the cold run above. No global Git or
operator configuration changed.

Reproduce on a new exact public checkout with no dependency directories:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Test-Pr193CanonicalDependenciesCold.ps1 `
  -SourceRoot '<FRESH_EXACT_PUBLIC_SOURCE_CHECKOUT>' `
  -OperatorsRoot '<THIS_PUBLISHED_WINDOWS_DIRECTORY>' `
  -NodePath '<EXISTING_NODE_24_19_0_EXE>'
```

No private render, private file access, AWS call, upload, or deployment is part
of these preparation checks.

## Frozen implementation and offline-test hashes

| File | SHA256 |
| --- | --- |
| `Pr193DependencyProbe.mjs` | `7ac62ebd3324c31b551b3fa75a450ad122fd54de8fe2351bc29d678ad6545f1a` |
| `Pr193PublicInputs.ps1` | `01ca154e42609bf3327e0947fc2d61d9a3660d8b18af7a4326c57cc188d38889` |
| `Pr193DependencyProbe.test.mjs` | `f9ccd79bc4f193f79057663cb65d691868a0312c791dda39f192857f2018d4f4` |
| `Test-Pr193CanonicalDependenciesOffline.ps1` | `3bcd347fbcd1c3338709631afec3782976c36448aeffbc2b1b5f193768b2c899` |
