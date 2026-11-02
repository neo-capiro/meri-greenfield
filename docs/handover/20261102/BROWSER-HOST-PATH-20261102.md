# Browser host path: design, change map and shipping brief (2 November 2026)

Neo, 1 November 2026: "for browser host just make it feel like Claude". Meri browses the open public web with a live
viewer and user takeover, on one isolated browser context per conversation, hosted on a dedicated `c7g.large` ARM64 EC2
host provisioned and torn down with the run. The selected-tab extension is deferred. This document is the design
outline the implementation follows, the map of the pull requests that deliver it, and the brief a Sonnet executor
follows to ship it. It does not authorize a deploy; the release executor follows
[BROWSER-ENABLEMENT-RUNBOOK-20261101.md](../20261101/BROWSER-ENABLEMENT-RUNBOOK-20261101.md) for the gate itself.

## 1. Design in one page

**One provisioned lifecycle, two purposes.** The native-processing host already has a complete, qualified lifecycle:
reserve a row → arm the managed watchdog → claim one dispatch → `RunInstances` with owner tags → bootstrap over SSM
(prepare CSRs, install issued leaves) → admit the row as active → control reads host currentness → teardown at the end
of the run (remote close, process absence, EC2 destroy, physical absence readback, canonical receipt). The browser host
is the second purpose of that same lifecycle, never a second coordinator: `hostMode:'browser-only'` on the same
`host_allocations` table, the same reservation writer, the same provisioning coordinator, the same watchdog, the same
bootstrap protocol and the same teardown owner, with its own image, AMI, instance type and bootstrap document.

**Need and readiness.** The browser need (`browser-execution-prerequisite.mjs`, read by the Temporal broker right after
the native need over `execution/browser/prerequisite`) requires control's `browserActivation` record to be open AND the
run's resolved browser policy (platform record, tenant settings, the actor's current role) to be enabled: a tenant or
role with the browser off gets no host and never waits. When needed, the model turn waits until the browser host is
`ready`: active row, bootstrap custody retained, and the canonical run says `browserAdmitted`. Known cost, accepted for
this release: every browser-enabled run boots one host before its first turn (tens of seconds); provisioning on first
browser tool use is the follow-up that removes it.

**Generation and identity.** Generation is the run's writer fence, as for native. The host id is deterministic per
purpose (`meri-browser-host-provision/1` versus `meri-native-host-provision/1`), so the two hosts of one run never share
an id, and the unique index "one unterminated host per conversation and purpose" lets them coexist.

**The host itself.** One root service (`apps/runtime/browser-host-service/host.mjs`) over the protected installed
bundle the bootstrap program wrote: it creates the root-owned generation and run cgroups, pins the lifecycle producer,
reads this run's canonical facts from Control (the active browser policy is the only policy it will serve), applies
finite memory/pid/cpu limits to the run cgroup, starts the run-bound egress proxy as its own process under the proxy uid
in the run's `browser-proxy` leaf (every admission is decided by the supervisor's egress control over IPC) and pins it
with a host nft guard (public IPv4 TCP 80/443 only; private, CGNAT, link-local and metadata ranges dropped), builds the
browser network compartment with one route from the namespace-local relay port to that proxy, arms the per-browser and host-wide observers through a measured confinement verifier, and
composes the browser-only service: admitted workspace, root-only launcher (browser child dropped to its own uid with
NoNewPrivs, hidden cgroupfs, private workspace view), confined Chromium context, session facade, named operations and
the viewer, all on ONE pinned mTLS listener (`hostEndpoint.port`) that also serves the Control lifecycle route. The SDK
of the run lives in the AgentCore runtime; the host-owned takeover retirement therefore observes Control's facts (the
run leaves `active` with SDK and Bash denied and the host's custody attached) instead of retiring a local process.

**Teardown.** The broker tears down every original host of the run (native, browser) on every terminal path; one
failure never skips the other. Control's teardown owner reads the row by host id, dispatches on its purpose, and for
browser-only drives the host's lifecycle route: `close` (the host destroys the session and context, stops the launcher,
revokes the egress grant and closes its proxy, disposes the profile, closes the network compartment, and reports
`browserEgress`/`browserState` while its listener stays up to answer), `processes` under the `browser-host-descendants`
scope (the generation cgroup reads `populated 0`), then EC2 destroy and physical absence, recording the 0004 browser-only
receipt (`processScope browser-host-descendants`, `browserEgress closed`, `bashEgress not-applicable`, `browserState
disposed`). The host's own local receipt reports instance destroy and absence as `not-applicable`: it never claims a
physical proof it cannot make.

**Destinations and approvals** are PR 540: open public web by policy, denied hosts carried inside the policy and enforced
by the host egress grant, interactions classified on the live page (credential input refused, submissions ask, routine
runs).

## 2. Change map

| PR | Scope | State |
| --- | --- | --- |
| [#540](https://github.com/neo-capiro/meri-greenfield/pull/540) | Open public web, denied hosts, classified interactions, `EGRESS_REQUIREMENTS` update, runbook decisions | open |
| [#542](https://github.com/neo-capiro/meri-greenfield/pull/542) | Browser-only allocation route: migration 0008, provisioned-purpose contracts, reservation writer and readiness, provisioner `hostMode`, worker `browserDeployment`, broker browser need, control prerequisite route, teardown dispatch, renderer | open, stacked on #540 |
| PR 3 (this change) | Browser host boot: production `host.mjs` over the installed bundle, lifecycle route on the pinned listener, viewer input over the wire batch, host-owned retirement, measured browser confinement verifier, host-local teardown, ARM64 image recipe, static host infra template | open, stacked on #542 |

### 2.1 PR 2 in detail

- `packages/contracts/native-lifecycle.mjs`: `PROVISIONED_HOST_MODES=['native-processing','browser-only']`,
  `assertProvisionedHostAllocation`; the lifecycle request accepts a host's own purpose (`hostMode` must equal the
  installed allocation's). `native-observer.mjs` launch tags and `native-bootstrap.mjs` scopes accept both purposes.
  The close answer may carry `browserEgress` and `browserState`.
- `apps/control/browser-hosts/migrations/0008_browser_only_provisioning.sql`: derived from the pinned 0006 bodies
  (`guard_allocation` five purpose gates, `guard_native_observer` `V2_CONTEXT_REQUIRED`) and the 0005/0006/0007
  constraints (`native_physical_phase`, `native_declaration_shape`, `host_allocation_certificate_window`) with
  `'native-processing'` widened to the two provisioned purposes; predecessor pins on the exact function bodies; legacy
  rows and historical native rows untouched; the 0004 browser-only teardown receipt branch unchanged. Ordinal 85 in
  `first-chat-migrate.mjs` (after main's 0032 at 84). `browser-only-provisioning-migration.test.mjs` recomputes the derivation.
- `native-reservations.mjs`, `postgres-allocations.mjs`, `allocation.mjs`, `native-physical-state.mjs`: provisioned
  purposes reserve, claim, record, bootstrap and admit same-row; a provisioned admission without a reservation refuses
  (the direct active insert remains legacy-only); `createPostgresHostAllocationReader.ready` answers the browser-only
  readiness (absent, not-ready, ready with `browserAdmitted` currentness).
- `apps/runtime/native-host-provisioning.mjs`: `createNativeHostProvisioning({...,hostMode})`,
  `nativeHostId({binding,generation,hostMode})`.
- `apps/runtime/config.mjs`, `native-worker-owners.mjs`, `temporal-worker.mjs`: `nativeProvisioning.browserDeployment`
  (same account, region and control policy digest as `deployment`) composes a second launch port and coordinator on the
  shared pool, authority, issuer, SSM transport and watchdog; the broker asks `execution/browser/prerequisite` after the
  native need, provisions with the browser coordinator, and tears down both hosts.
- `apps/runtime/browser-execution-prerequisite.mjs`, `agentcore-execution.mjs`, `agentcore-candidate.mjs`,
  `agentcore-control-http.mjs`, `control.mjs`: the browser need and readiness, the `browserPrerequisite` operation and
  its control-only route, late-bound like the native ones when `browserHosts` is declared.
- `native-host-lifecycle.mjs`, `native-lifecycle-client.mjs`, `host/teardown.mjs` (remote browser-only branch),
  `native-control-teardown.mjs`, `native-observer-runtime.mjs` (placements per purpose), `uploads/control-lifecycle.mjs`
  (`uploads.native.host.browserDeployment.amiId`).
- `infra/product-preview/first-chat/native-processing-material.mjs`: `features.nativeProcessing.browserDeployment`
  renders to the worker (`nativeProvisioning.browserDeployment`) and to control (`browserDeployment.amiId`); it must share
  the native placement, observer, control connection, issuer CA and source commit, and differ in image digest and AMI.

### 2.2 PR 3 in detail

- `apps/runtime/browser-host-service/host.mjs`: `startBrowserHost()` and CLI `main()` (see §1, "The host itself");
  `installed.mjs`: the browser layout of the reviewed profile (`kind:'browser-host'`, limits `deadlineMaxMs`,
  `maxFreshMs`, `localSettleMs`, fixed paths for the two helpers, node, the MCP `cli.js`, browsers and the workspace
  root, four distinct identities `sdk`/`browser`/`hostRelay`/`localRelay`, `network.privateInterfaceName` and
  `network.browserProxyPort`), over the shared `installedHostMaterial` split out of
  `native-processing-host/protected-bootstrap.mjs` (the native reader is unchanged in output);
  `retirement.mjs`: host-owned takeover retirement over Control facts and hold reads.
- `composition.mjs`: `retirement` required and handed to the session host (takeover can begin), `host` optional
  (absent on a provisioned host), `lifecycle` route handler passed to the listener, `destroy({retainListener})` and
  `closeListener()` for the Control-driven close. `entrypoint.mjs` readiness over inputs only; the environment config
  reader (`config.mjs`) is deleted: the installed bundle is the one configuration source.
- `apps/worker/conversation/browser/session/native-input.mjs`: the viewer input adapter takes the wire batch
  `{leaseEpoch,events}` the frontend and relay send (mouse move/down/up with button, wheel, named keys down/up, text),
  admitted as a whole by `admitInputBatch`; printable keys stay text so they enter the confidentiality filter.
- `host/browser-viewer-transport.mjs`: the fixed `NATIVE_LIFECYCLE_PATH` on the pinned listener reaches the host's
  lifecycle handler (authenticated by the handler against the protected Control pins, outside the viewer admission count).
- `native-processing-host/lifecycle.mjs` and `hierarchy.mjs` accept both provisioned purposes: `close` carries
  `browserEgress`/`browserState` for a browser host, `processes` answers `browser-host-descendants`, `observe` refuses;
  `lifecycle-http.mjs` exports the Control peer authenticator and bounded body reader the native entrypoint now uses.
- `host/composition/browser-verifier.mjs`: the measured `verifyConfinement` for the host-wide observer (live leader kernel
  facts via the generalized `readLeaderKernelFacts`, root-owned closed generation and run groups, every PID in the tree
  on a confined uid with NoNewPrivs and hidden cgroupfs; an exited leader must be gone from the system).
- `host/teardown.mjs`: host-local browser-only settlement (`ports` exactly `{browser,processes}`, instance
  `not-applicable`); `host/network/host-launcher-adapter.mjs` accepts the browser-only forbidden-uid set (three).
- `apps/runtime/Dockerfile.browser-host` + `browser-host-service/image/package.json`: the ARM64 image recipe (§3.2).
- `infra/browser-host/provisioned-stack.mjs`: the static CloudFormation source for the shared security group, instance
  role/profile and log group (§3.3).
- `apps/worker/conversation/browser/workspace.mjs`: `browserPaths` uses posix joins (host paths are Linux paths).

## 3. Shipping brief (executor: Sonnet; operator: Release)

Preconditions: PR 540, PR 2 and PR 3 merged; native processing (runbook step 2) live or shipped in the same window; the
host-to-control currentness listener (`browserHosts.tls.hostServer` + `bind`) rendered and reachable from the host
subnet on port 443 of `control.meri-preview.internal` (runbook 3a). No step below deploys anything without Release.

1. **Database (Release).** First rehearse on an isolated PostgreSQL 16 (Codex-Gates): with `MERI_D2_TEST_ADMIN_URL`
   pointing at a throwaway database, run `node --test infra/product-preview/first-chat-database.test.mjs
   apps/control/browser-hosts/test/browser-only-provisioning-migration.test.mjs` and then the full plan
   `node infra/product-preview/first-chat-migrate.mjs integration` against that database twice (the second run must be a
   no-op). Then snapshot `capiro-newstack-preview-clone` and apply ordinal 85
   (`0008_browser_only_provisioning.sql`) with the existing `first-chat-migrate.mjs integration` stage. Verify:
   `guard_allocation()` and `guard_native_observer()` `prosrc` hashes changed from `ee96403b…`/`24b99863…`; the three
   constraints are `convalidated`; the ledger has 85 rows. Rollback: the forward migration is reversible only by
   restoring the snapshot (no browser-only rows exist before the first browser run).
2. **Image.** Create the ECR repository `meri-greenfield/browser-host` (immutable tags, scan on push) if it does not
   exist. In the gate environment (WSL Codex-Gates): generate the browser stack lockfile once with
   `npm install --package-lock-only --ignore-scripts --no-audit --no-fund --prefix apps/runtime/browser-host-service/image`
   and commit it (lockfile owner). Build `apps/runtime/Dockerfile.browser-host` once for `linux/arm64` from the exact
   source commit (`docker buildx build --platform linux/arm64 -f apps/runtime/Dockerfile.browser-host .`), push to the
   `meri-greenfield/browser-host` ECR repository, record the digest, run the scanner (0 HIGH/CRITICAL; record decisions
   for other findings). The build records `/opt/meri/browser-host/helper-hashes.txt` (launcher, relay launcher and
   `protected-bootstrap.mjs` SHA-256: these are `helperSha256`, `nativeHostRelayHelperSha256` and `programSha256`),
   `chromium-hashes.txt`, `os-installed-packages.txt`. Bake the browser host AMI with the same recipe as the native host
   AMI (the image pulled at first boot and started as the native image is: privileged, host network and PID namespace,
   host cgroup2 at `/sys/fs/cgroup`, `/run/netns`, the protected bundle directory `/var/lib/meri/native-bootstrap` and
   the workspace root `/var/lib/meri/browser-workspaces` from the instance; unprivileged user namespaces enabled for
   Chromium's namespace sandbox). Write the reviewed profile (`profile.json`) with `layout.kind:'browser-host'`, the
   limits, the fixed paths (`/opt/meri/meri-host-launcher`, `/opt/meri/meri-host-relay-launcher`, `/usr/local/bin/node`,
   `/opt/meri/browser-host/node_modules/@playwright/mcp/cli.js`, `/opt/meri/browsers`, `/var/lib/meri/browser-workspaces`),
   the image identities (sdk 1001, browser 2002, hostRelay 3001, localRelay 3002, proxy 3003), the run limits
   (`memoryBytes` 2147483648, `pidsMax` 512, `cpuQuotaUs` 200000, `periodUs` 100000 on c7g.large), the instance's
   private interface name (`ens5` on c7g) and the namespace-local proxy port (3128); its SHA-256 is `profileSha256`.
   AMI recipe, concretely: start from the native host AMI recipe (same base, same SSM agent, same bootstrap document
   install), replace the pulled image with the browser host digest, set the account/AMI defaults for IMDSv2 required with
   hop limit 1 and an encrypted gp3 30 GiB root volume, enable `kernel.unprivileged_userns_clone=1` and
   `user.max_user_namespaces` for Chromium's namespace sandbox, and register the SSM document
   `meri-browser-host-bootstrap` (the same document body as the native one; its name, version and SHA-256 go in
   `bootstrapSpec.document`). Record
   `imageDigest`, `sourceCommit`, `bootstrapSha256`, AMI id.
3. **Static host infra (Release).** Render `infra/browser-host/provisioned-stack.mjs` with the VPC id and CIDR, the
   control task security group and the `meri-greenfield/browser-host` repository, review, create the stack. It yields
   the `meri-browser-host` security group (ingress TCP 9444 from the control security group only; egress TCP 443 to
   control, DNS to the VPC resolver, TCP 443/80 to 0.0.0.0/0; no IPv6), the instance role (SSM core, pull of that one
   repository, writes to its own log group) and the instance profile; outputs give the group id and the profile Name.
   The security group's 0.0.0.0/0 includes the VPC: it is one layer only. Private, link-local and metadata ranges are
   refused by the run policy in the supervisor and dropped for the proxy uid by the host nft guard, which step 4c probes.
   One listener port: viewer, named browser operations and the lifecycle route share `hostEndpoint.port` 9444.
4. **Deployment inputs (private copy).** `features.nativeProcessing.browserDeployment` with `accountId`, `region`,
   the native `placement` (with `securityGroupIds:[<browser SG>]` and `iamInstanceProfile:<profile Name>`),
   `launch{ImageId:<browser AMI>,InstanceType:'c7g.large',SubnetId,SecurityGroupIds:[<browser SG>],IamInstanceProfile:{Name:<profile Name>}}`
   (exactly these keys: `compileNativeDeployment` refuses `Arn`, `MetadataOptions` and `BlockDeviceMappings`; those
   properties come from the AMI and account defaults of step 2),
   `imageDigest`, `sourceCommit`, `bootstrapSha256`, `physicalObserver`, `launchTagPolicy`, `bootstrapSpec` (the
   bootstrap document name/version/sha256, `programSha256` and `profileSha256` from step 2, `hostEndpoint{port:9444,
   serverName}`, the SAME `control` block and `issuerCaCertificate` as the native deployment). Render; the renderer
   refuses drift in placement, observer, control connection, source commit, or an image digest or AMI equal to the
   native one.
5. **Deploy order.** Control first (it serves `execution/browser/prerequisite`), then the Temporal worker (it asks for
   it). A worker ahead of control fails every run with `NATIVE_OPERATION_UNAVAILABLE`.
6. **Gate (runbook step 4).** Only after the qualification host measured the activation checklist and the evidence file
   is committed: set `features.browserActivation` open with the evidence hash and the current
   `EGRESS_REQUIREMENTS_SHA256`, render, deploy control.
7. **Verify (runbook 5c, as updated by PR 540)**: a run shows `browser.enabled:true`; its browser-only row goes
   reserved → dispatching → active with bootstrap custody; the host log shows `browser-host.started`; `browser-prepare`
   succeeds; navigation to a public origin loads, to `https://app.capiro.ai/` refuses with `BROWSER_HOST_DENIED`, to a
   private address with `BROWSER_URL_NOT_PUBLIC`; a link click runs without a prompt, a form submission waits for
   approval, a password field refuses; the viewer streams frames and the user's mouse, wheel, keys and text reach the
   page; takeover drains the model turn and hands back; the run ends and the row terminates with a verified
   browser-only receipt (`close` answered `browserEgress closed`, `browserState disposed`; `processes` empty); the
   instance, root volume and ENI are absent.

Hardening set by source: proxy under its own uid with a read-back nft guard; finite memory/pid/cpu limits on the run
cgroup, re-measured by the confinement verifier; NoNewPrivs, zero capabilities and hidden cgroupfs for every tree
process. Not set by the recipe, to be measured or decided at step 4c: a seccomp/AppArmor profile for the root
supervisor (it runs privileged with host network and PID namespaces, which the helpers require), a read-only root
filesystem for the supervisor container, and per-process rlimits beyond the cgroup limits. The Claude Agent SDK package
is present in the image as a module dependency of shared worker modules and is never invoked (no query, no provider
credential, no Bash); splitting that import chain is a follow-up. The frontend viewer sends each character as a key
down/up pair; the host types printable keys as text, so no frontend change is needed for takeover sign-in.

Rollback: hold `features.browserActivation` (new runs mount no browser port and no browser host is provisioned); the
database delta, the static host stack and the worker's `browserDeployment` may stay in place.
