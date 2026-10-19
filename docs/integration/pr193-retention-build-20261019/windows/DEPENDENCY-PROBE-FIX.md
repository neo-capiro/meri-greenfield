# Canonical dependency probe fix

The public preparation refusal was reproduced on Windows PowerShell
5.1.26100.33451 with Node v24.19.0 against exact source
`5b395d4ce9218b872b21c420dc00a3af31739824`.

## Cause and change

With `node --input-type=module --eval CODE MODULE_A MODULE_B`, Node sets
`process.argv[1]` to `MODULE_A`. The canonical renderer checks whether its
`import.meta.url` equals the file URL of that argument before running its CLI.
The old dependency probe therefore ran the renderer's CLI while importing it.
The incomplete CLI arguments set exit code 2, despite successful imports. The
probe's stdout was empty, so its dependency-owner selection correctly refused.

`Pr193PublicInputs.ps1` now passes the inert argument
`pr193-dependency-probe` before the two module paths and imports argv entries
2 and 3. That entry identity cannot equal either canonical module path. The
canonical modules and their entry guards remain unchanged. Missing-dependency
owner selection, lockfile requirements, bounded `npm ci --ignore-scripts`, and
exact source checks remain unchanged.

## Verification

The actual old and fixed Node probes against the public source produced:

```text
oldExit=2 oldStdoutBytes=0 newExit=0 newStdoutBytes=0
```

`Test-Pr193CanonicalDependenciesOffline.ps1` runs the exported initializer
against an existing public source checkout with dependencies already installed.
It delegates to the real captured Node/Git adapter, forbids any npm installation,
and retains the real `Assert-Pr193Source` commit, tracked-diff, and raw Git byte
checks for the public-source run. Its prior-function reproduction changes only
the probe's two argument indices and removes the sentinel, restoring the exact
previous argument behavior. A separate small public fixture uses the canonical
CLI guard shape and fails if the import invokes the CLI.

Actual PowerShell 5.1 run, all three checks passed:

```text
PR193_CANONICAL_PREVIOUS_INITIALIZER_REFUSAL_PASS exact prior argv behavior
PR193_CANONICAL_EXPORTED_INITIALIZER_PASS exact source/raw-byte checks retained; no installs
PR193_CANONICAL_CLI_GUARD_PASS imports never invoke CLI; source gate called
```

Reproduce using an already prepared public source checkout and an existing Node
24 executable:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Test-Pr193CanonicalDependenciesOffline.ps1 `
  -NodePath '<EXISTING_NODE24_EXE>' `
  -SourceRoot '<EXISTING_EXACT_PUBLIC_SOURCE_CHECKOUT>'
```

This verifies the installed-dependency path. Fresh dependency installation and
Neo's private render were not exercised. No private inputs, network installs,
AWS calls, uploads, or deployment were involved.

## Frozen files

| File | SHA256 |
| --- | --- |
| `Pr193PublicInputs.ps1` | `e5cb0a8dfde462a23246966cb6b79b2c549f71952417279b0e99229026febb40` |
| `Test-Pr193CanonicalDependenciesOffline.ps1` | `1be6f03e82f7a69ae17abdbfa768f5883efbda389c7db656e7a445a30a803cd4` |

LocalRender, Common, private upload, and Bind were not changed for this fix.
