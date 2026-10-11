# G1 SDK fixture transport — Codex independent source review

Date: 2026-10-11 UTC. Decision: **ACCEPT SOURCE ONLY AFTER CODEX REPAIR**. G1 remains **OPEN**. This accepts a local transport implementation for further composition and qualification; it does not admit a service, image, real TLS endpoint, current-fence decision, two-task run, cloud action, or deployment.

## Provenance and closure

The bounded H2 worker began from integration commit `3d496f6845bf2503cf623c353ea3b5b9fc307a00`, with allocation commit `7014005bc7c0e8930f7a0b13ab1cd15a9adcc207`, and returned `c8de644e790a2b1a8874cded94031ce824633ba1`. Its owned additions were the private HTTPS transport module, its offline tests and `CODEX-G1-SDK-FIXTURE-TRANSPORT-REMOTE.md`. They were cherry-picked locally as `3d868c3` and `5d8fcd3`. The worker used a one-shot Hermes session, exited 0 with a completed usage record and clean worktree, and the registered PID 20824 (created 13:34:52Z) and its parent were confirmed absent; `work/H2-supervisor.json` is CLOSED. No dormant worker was left.

Codex inspected the actual module and tests, then repaired edge cases in `63216297d618b62d067876d21b7eed189be5dfd8`: a fixed `application/json` media type, rejection of double-slash and encoded paths, a 60-second maximum timer interval, exact decimal and byte-equal `content-length`, fixed-error handling for malformed peer identity, and abort-listener/request cleanup when injected boundaries throw or settle synchronously. These are local source changes, not proof of native TLS behavior. The worker's handoff is preserved as its original claim; this review applies to the repaired integration bytes.

## Independent checks

On Node 24.19.0, Codex ran the repaired transport's focused offline suite: **28/28 pass**. The combined contract, fixture-channel and fixture-transport suite passed **161/161**, exit 0. All transport tests inject a fake `node:https` boundary. `git diff --check` and the integrated worktree status were clean at the review point. There was no socket, DNS, TLS handshake, certificate presentation or live peer in these checks.

The module accepts only a trusted fixed HTTPS endpoint and approved port, a fixed certificate fingerprint plus hostname verification, nonempty copied mTLS material, bounded canonical request bytes, four closed operations, and a finite deadline. It dispatches one POST with no redirect/retry/proxy fallback and bounds response data during receipt. Errors use fixed codes without response content. The transport is not imported into an assembled worker image or qualification package entry yet; the package/dependency closure and exact-image replay are future shared-path decisions.

## Remaining gates

Real TLS chain/hostname/pin/mTLS and teardown must be qualified against an approved endpoint on the pinned image. A trusted service still needs current grant and fence enforcement, atomic immutable checkpoint publication/readback, durable budget and model enforcement, and physically verified two-task Fargate cancellation/drain. The missing historical H1 archive and real 75-request corpus remain blockers for their respective acceptance claims. This source acceptance cannot advance G1 by itself.
