# Image source-context author result: HOLD

Base source: `90b4dc8472da13cdee9f49cdc0b4c8306ecbdc73`.
Base tree: `1f6ac35ad37531e790c2a19c9e310c7e618e6522`.
Owner: gateway_author; independent reviewer: gateway_reviewer; integration owner:
root. Recipe, pins, dependency locks, assembler, collector, runner and original
tests are unchanged. No coherent supported patched dependency set was established
within this task. The retained context is an executable offline source assembly,
not a patched image, authorized build, security waiver or runtime acceptance.

## Reproducible source-context artifact

The existing canonical assembler produced two fresh outputs at
`/tmp/meri-image-patch-20261012-context-a` and
`/tmp/meri-image-patch-20261012-context-b`. Both were independently re-read through
its existing `verify_context` function. Each contains exactly 53 regular source
files totaling 994,568 bytes. Both canonical manifests have SHA-256:

`94216667decf5e4feed05914b3f295148d9437ee1c00b224ca4e92625b5b876f`

Both complete manifests and the verification receipt are retained under
`docs/qualification/candidates/image-patch-20261012/author/`. Their records bind
each source path, context path, byte count and SHA-256. The manifest retains
`SOURCE_ONLY` and `commitAuthority: false`; no current or historical image digest
is assigned to it. Reproduction uses the unchanged existing CLI with a fresh
absolute output path:

```
python3 scripts/qualification/worker_context.py --output <fresh-absolute-directory>
```

Only selected qualification files enter this context. The existing read/write
checks enforce plain regular files, exact membership, size/time bounds, no
links, source/context byte equality and retained partial output on failure.
Repeated source assembly establishes equality of these source bytes. It does not
establish reproducible OCI layers, installed dependency resolution, binary
support, signature verification, complete notices or scan results.

## Checks and actual failures

- Context tests: 17 passed; exit 0.
- Original build/runner guard tests: 34 passed, 1 failed, 1 error; exit 1.
- Original worker package test suite: final 197 passed; exit 0. The first run
  passed its 93 static cases and failed four checkpoint module loads because the
  root canonical contract dependencies were absent. That failure remains raw.
  Installing the unchanged root lock resolved those imports; no source or test
  change was needed. Both root and nested `npm ci` used `--ignore-scripts`,
  `--no-audit`, `--no-fund`, `--include=optional` and task-owned temporary caches;
  both installs exited 0 and both locks remain unchanged.
- Repeated baseline assembly and verification: both passed; identical manifests.
- Packaging records: all 22 source hashes and sizes match current pins.
- Nested npm package/root-lock agreement: passed; 147 package entries plus root.
  All package entries include integrity; the sole nonregistry dependency remains
  the exact existing local public contracts archive. No lifecycle-script flags
  appear in this lock. These facts do not establish a complete license audit.
- Direct recipe pins: all 35 OS versions and all seven Python version/hash pairs
  agree with component pins; the recipe base image reference agrees as well.

The original build suite fails its context assertion because the collector pins
`18836912a03fc035d69c0cfc57d1f407e5c46af1bdd37c21a761f5d42dc84dda`,
while actual current assembly produces the `94216667...` manifest above. The
current assembler itself has SHA-256
`48f065d0ad61f98ba571c89dcd62141e6f8c9b272f0d371331d74a0dabf87851`,
while the collector pins
`67c1cf554e80c62eeb56b6dcb9be00106adf9b1b8b40beba85249de662b835eb`.
Changing those checksums alone would not authorize the source or a build. No
guard was weakened or updated.

The separate error is `fixed owner Python runtime`: the runner deliberately
requires its historical exact Windows executable, even though this Linux
environment also reports Python 3.12.14. Fresh Linux runner authority and closure
review are separate work. The unchanged Windows guard remains effective.

Raw successful and failed stdout/stderr remain byte-preserved in author evidence.
Tests created no Docker, AWS, browser, provider, SDK-model or customer operation.
All started local test processes exited; context directories remain retained.

## Packaging observations and boundaries

An explicit static model of the existing simple COPY instructions maps 49 of the
53 context files into the image. Materializing those copied bytes into a fresh
temporary layout and checking all 32 identified static-suite data dependencies
confirmed all 22 dynamic pinned source records and the public archive were
present and exact. Three dependency metadata reads belong to npm installation,
which that COPY-only model deliberately does not simulate. The collector classifies
Dockerfile, .dockerignore, README and component-pins.json as build-only. The
installed static test source nevertheless reads component-pins.json, Dockerfile
and .dockerignore. Thus its installed-path branch lacks three recipe-supplied
metadata files. This is a source packaging inconsistency for running the offline
suite at that installed path, not an observed runtime probe failure. Repair would
require deliberate recipe/ignore/collector coordination; none was made here.

The recipe records only some expected installed browser and SDK binary hashes;
the full final filesystem inventory and fresh scan remain prospective. The
Playwright install and signed-snapshot apt resolution were not run. A source
manifest cannot supply their missing installed evidence. All required packages,
non-root identity, browser helper permissions, sandbox requirements, source-disabled
configuration, byte guards and historical negative controls remain intact.
The actually installed locked Playwright metadata includes Chromium and its
headless shell at revision 1247/version 155.0.8059.12, plus FFmpeg revision 1011.
Their archive/notice closure must be considered alongside Chrome/helper pins;
this task downloaded no browser archive and independently verified no browser
archive hash. That metadata is retained separately without a support or scan claim.

Root retains the 47 held scan findings and the 54-obligation union; this author
does not replace that map. The upstream owner reported unresolved supported-suite
security blockers, and the dependency owner reported outstanding SDK/commercial
and native notice closure. Those independently owned reports supply their exact
primary-source evidence; no version was selected based merely on a newer number,
an unstable distribution, or a registry license label. The held image
`sha256:8d1ec09aa78f47a11019089dacde93289fc66a39f55bd4357e59eeb25d9b52ac`
was never launched.

HOLD remains for the supported patched set, complete licensing/distribution
review, current source/runner binding, separately authorized build and spend,
actual installed inventory, fresh full scan and all native/G1 runtime gates.
No Docker invocation/build/push, cloud resource change, paid-model call or
external provider/customer action occurred.
