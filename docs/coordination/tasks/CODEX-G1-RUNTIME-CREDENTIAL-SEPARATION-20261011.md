# Native recovery runtime — credential separation repair

Base: `7e4e3f8579b716148ce9c4d67e47fc497356e49e`.
Branch: `task/codex-g1-runtime-wiring-20261011`.
Source-only continuation after the human confirmed the imported bundle is
not deployed and the published image retains five critical/seventeen high
findings. No AWS command, build, provider call, deployment, customer source
or remote write belongs to this allocation.

## Problem and intended behavior

The resume driver currently uses B's gateway for a stale A authorization
challenge. Canonical certificate resolution grants each credential only
its own audience, so a B-certificate/A-context request must be refused,
not interpreted as a typed A revocation result. Preserve that boundary.

Move the stale-A qualification into a separately admitted owner port. The
owner uses A's original credential outside B; B gets no A key, privileged
transport or S3 capability. The phase driver must refuse a missing,
foreign or uncertain stale challenge before transcript restore/SDK spawn.
Do not invent a fifth ingress endpoint or a second authorization system.
The exact source port is an injected trusted dependency; its real remote
placement/provenance remains an explicit unqualified runtime dependency.

## Ownership and checks

One bounded Codex writer owns `probes/sdk-interruption.mjs` and its focused
tests under `apps/worker/qualification`; a narrowly scoped owner adapter
and tests may be added only after the parent approves the proposed port.
The writer first proposes exact signature/paths before editing. Parent
owns source-context and pin generators, package registrations and reports.
No schema, registry audience, shared authorization or certificate rule may
be weakened. Keep the 28 prior source/capture behavior assertions and
meaningful negative cases. Preserve D720/C900 and partial flags.

Test distinct A/B authenticated loopback transports with separately scoped
audiences, missing/uncertain/foreign owner results and no restoration or
spawn on refusal. Retain all original assertions; adjust fixtures only to
make the explicitly separated dependency visible. Source review and
relevant suites are required before committing. Actual PostgreSQL/ECS
identity, signer placement, signed-byte delivery, physical sentinel,
native A/B recovery and image admission remain open. No local callback
can prove an actual native stale request by itself.

Bound the writer to 20 minutes, the allocated paths and no recursive work.
Codex independently reviews the exact source and prepares a separate
importable delta if GitHub publishing remains unavailable.

## Admitted interface after review

Resume requires public admitted `producer`/`current` metadata and a borrowed
`staleWorkerChallenge.verify` owner port. The worker admission helper creates
the exact existing `authorizeFixturePhase` request/correlation, validates the
returned existing response with the canonical private validator, requires
typed stale denial and exact admitted B context. No new receipt vocabulary,
schema, network endpoint or authorization system is introduced. A's borrowed
transport belongs solely to `scripts/qualification/sdk-stale-worker-challenge.mjs`,
which is excluded from the worker context.

Allocated modules/tests: `checkpoint/resume-admission.mjs` and its test,
the scripts owner adapter and its test, plus the driver pair already named.
Root exposes the existing private replacement validator as
`assertFixtureReplacement`, preserving its body and all original call
arguments, so full tenant/namespace/pin/replacement metadata is refused
before any owner dispatch without duplicating domain rules. Root owns that
private contract edit; the separate sentinel writer owns its own small
export in the same file. No public contract change is allocated.
