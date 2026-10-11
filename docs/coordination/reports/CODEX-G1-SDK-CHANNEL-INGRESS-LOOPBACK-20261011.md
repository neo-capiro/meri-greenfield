# G1 SDK callback to ingress real-loopback integration

Codex source review decision: **ACCEPT this bounded transport compatibility
check; G1 HOLD**. Base `e932bb8f7bdf3f57750d052156032b583b348d34`;
shared policy `neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`.

The new test calls the existing six-field driver callbacks through
`createFixtureChannel`, `createFixtureHttpsTransport`, a real loopback TLS 1.3
socket with an authenticated client certificate, and `createFixtureIngress`.
It checks A authorization and commit, then B's stale-A denial, load and verify
using the exact receipt reference. The observed operation order is authorize,
commit, authorize, load, verify. Both partial-recovery flags remain false.
The negative case rejects a wrong server certificate pin and an untrusted
client certificate before resolver or handler dispatch. Server sockets close.

Synthetic CA/server/client certificates were generated locally under ignored
`.task-inputs/sdk-fixture-ingress-1/certs/` with the repository test generator.
Pinned Node 24.19.0 focused loopback: 2/2 pass, exit 0. The combined affected
ingress, channel, transport and private fixture contract/wire suites: 111/111
pass, exit 0. Offline root `npm ci --ignore-scripts` installed 13 locked
packages for this fresh worktree. No test or process remains running after
the command exits.

The resolver and handlers are deliberately synthetic. Flipping the test's
`replacementAdmitted` flag is test arrangement, **not** a PostgreSQL grant
transition or physical old-task credential revocation. The responses are
preconstructed synthetic receipts, not actual immutable S3 uploads/readbacks.
This test does not start two ECS tasks, run the Claude Agent SDK, prove native
quiescence, or admit an image. Durable store composition and the actual bounded
two-task experiment remain required.
