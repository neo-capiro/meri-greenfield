# Frozen reviewed worker-build tooling

These four files preserve, byte-for-byte, the Codex owner tooling reviewed by actual Hermes session `20261009_204534_bf7c51`, report `W02-08-IMAGE-REVIEW-3.md`. Hashes and limitations are in `docs/coordination/reports/W02-08-OFFLINE-ACCEPTANCE.md`. They are source references, not a build approval or portable deployment command.

The operational copies remain in the integration checkout’s ignored `.task-inputs/` and are hash-bound separately in each prepared review request. The helper uses an explicit Windows root, the newly created target resources and retained private project evidence; the override deliberately comes from `.task-inputs/worker-buildspec.json`, outside the source archive. Do not substitute the legacy project-configured buildspec. Copy preservation changes neither reviewed bytes nor operational behavior.

Default preparation is local-only and requires a clean exact accepted HEAD. Execution requires a separate exact request/archive/helper/override review and one-shot owner admission with fresh identity/project checks. No polling, retry, deployment, image/security acceptance or runtime launch is provided. Native Docker copy/config behavior and installed Linux inventory remain unmeasured until a real build; subprocess stdout bounds are post-capture acceptance limits.
