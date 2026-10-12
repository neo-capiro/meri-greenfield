# Physical qualification sentinel

Base: `7e4e3f8579b716148ce9c4d67e47fc497356e49e`.
Branch: `task/codex-g1-runtime-wiring-20261011`.
Source-only continuation. No AWS, image build, model/provider invocation,
native SDK launch, customer data or remote write is allocated.

## Outline and ownership

The existing channel validates and stores a fixed `Sentinel` DTO, but the
phase driver does not materialize the file. Add one cohesive Linux-only
filesystem adapter, `checkpoint/fixture-sentinel.mjs`, and its focused test.
The borrowed workspace root and its ancestors must be exclusively owned
and quiesced by the caller. The adapter never removes borrowed roots.

Reuse the private canonical `Sentinel` grammar and byte/hash validation via
a small `assertFixtureSentinelPayload` export in the existing private
qualification validator; no public API or schema revision is allocated.
The sentinel writer owns that export and focused contract tests only.
The credential writer owns the driver; root coordinates its integration
after both modules are reviewable. Root owns context/pin generation,
test registration, reports, verification and final packaging.

Write/restore only `qualification/continuity.txt`, refuse existing paths,
links, aliases, hardlinks and nonregular objects, enforce the existing
65,536-byte ceiling before filesystem effects, fsync and verify readback.
Anchor descriptors on Linux; do not claim the adapter establishes remote
namespace exclusivity or a general workspace checkpoint. Honor the same
absolute phase deadlines and never extend D720/C900.

## Required checks and limits

Exercise physical writes in two fresh borrowed roots, stable capture,
restoration/hash equality, tamper, existing files, hostile path types,
malformed payloads before allocation and expired deadlines. Keep original
assertions. A creates and checks the file before query, then verifies it
after observed child exit/drain before evidence/commit. B restores only
checkpoint-verified sentinel data before native query, then reauthorizes.
Both recovery-completeness flags remain false.

One bounded Codex writer, twenty-minute allocation, no recursive delegation
or commit before root review. Native process/IAM/isolation, trusted signer
placement, S3/DB, remote owner delivery and physical A/B task replacement
remain unqualified. Independently review exact source and integrated checks.
