# Objective candidate source recovery at the Meri Q pin

The 28-file `strategy-candidate/20261015.2` closure was recovered from immutable
`neo-capiro/meri-greenfield` commit
`4d8bd8ee3d3c6f0c5e1c91edbfebe44598dcf7af`. All candidate source modules,
generated schema, fixtures, tests, README, and the original distribution manifest
matched their published Git blobs before the integration adjustment below.

This checkout retains every published source and generated artifact byte. Its
`packages/contracts/package.json` is version 0.1.7; the source pickup used 0.1.5.
The later package adds conversation history and input exports, generators, and
checks while preserving the candidate's existing exports and dependency versions.
`distribution.json` therefore changes only `localDependencies["../package.json"]`
from the published SHA-256 `55630bf40a4b372259a00ba531b2cc041dd0ccebcdd52de64536a1020f9d0c0b`
to the current package SHA-256
`07a14262720d14d4adab4945014d8123298370b359d798b3b7a14308841ad49c`.
The immutable pickup remains the reference for the original manifest. The
preexisting package lock still identifies the package as 0.1.5; this recovery
does not change public package metadata or its locked dependency versions.
The isolated dependency test also accepts the repository's hoisted `node_modules`
layout in addition to a package-local install. Neither adjustment changes the
seven source modules or generated artifacts.

This is source recovery and local conformance only. The candidate is neither a
frozen public wire nor proof of authenticated Core authority, durable acceptance,
or live model behavior. Current Objective runtime pins `.2`; the newer `.3`
candidate at `02f37f6400824944c44f3579f31bd1024b0478f9` needs a separate
runtime compatibility review before adoption.
