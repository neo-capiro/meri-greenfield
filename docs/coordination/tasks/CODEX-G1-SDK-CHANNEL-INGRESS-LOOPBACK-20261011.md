# G1 SDK callback/channel/ingress loopback integration

Owner: Codex. Base `e932bb8f7bdf3f57750d052156032b583b348d34`, branch
`task/sdk-channel-ingress-loopback-20261011`, dedicated worktree
`C:/dev/meri-greenfield-sdk-channel-ingress-loopback-20261011`. Shared policy
`neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`.

## Outline before implementation

The worker's existing `createFixtureChannel` owns driver-to-private-wire
mapping and its borrowed `createFixtureHttpsTransport` owns bounded mTLS client
I/O. The new private ingress owns server mTLS, socket peer binding, decode and
closed handler dispatch. Add only a real loopback integration test under the
ingress test directory and a source review report. Reuse synthetic fixture
data, the canonical private contract and synthetic test certificates.

Test A authorization and commit, then B stale-A denial, load and verify through
the actual callback/channel, HTTPS transport and ingress. Exercise wrong server
pin and an untrusted client certificate as separate refusals. The resolver and
handlers are synthetic fakes for the transport seam; they cannot prove registry
fence state, immutable S3 bytes, real ECS peer identity or two-task recovery.

No source connection, AWS, Docker, provider/customer data, cloud write, image
build, PR, merge or deployment. Run pinned Node 24 focused and affected suites,
check final diff, verify test server/socket closure and keep failed attempts.
