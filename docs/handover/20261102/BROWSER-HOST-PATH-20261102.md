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

**Need and readiness.** While control's compiled `browserActivation` record is open, every run is admitted with
`browser.enabled` and the runtime mounts the browser port, whose `browser-prepare` resolves this run's browser-only
allocation. So the browser need is the activation record itself (`browser-execution-prerequisite.mjs`), read by the
Temporal broker right after the native need (`execution/browser/prerequisite`), and the model turn waits until the
browser host is `ready`: active row, bootstrap custody retained, and the canonical run says `browserAdmitted`.

**Generation and identity.** Generation is the run's writer fence, as for native. The host id is deterministic per
purpose (`meri-browser-host-provision/1` versus `meri-native-host-provision/1`), so the two hosts of one run never share
an id, and the unique index "one unterminated host per conversation and purpose" lets them coexist.

**Teardown.** The broker tears down every original host of the run (native, browser) on every terminal path; one
failure never skips the other. Control's teardown owner reads the row by host id, dispatches on its purpose, and for
browser-only drives the host's lifecycle route: `close` (the host revokes the egress grant, closes its proxy, destroys
the session and disposes the profile, and reports `browserEgress`/`browserState`), `processes` under the
`browser-host-descendants` scope, then EC2 destroy and physical absence, recording the 0004 browser-only receipt
(`processScope browser-host-descendants`, `browserEgress closed`, `bashEgress not-applicable`, `browserState disposed`).

**Destinations and approvals** are PR 540: open public web by policy, denied hosts carried inside the policy and enforced
by the host egress grant, interactions classified on the live page (credential input refused, submissions ask, routine
runs).

## 2. Change map

| PR | Scope | State |
| --- | --- | --- |
| [#540](https://github.com/neo-capiro/meri-greenfield/pull/540) | Open public web, denied hosts, classified interactions, `EGRESS_REQUIREMENTS` update, runbook decisions | open |
| PR 2 (this change) | Browser-only allocation route: migration 0008, provisioned-purpose contracts, reservation writer and readiness, provisioner `hostMode`, worker `browserDeployment`, broker browser need, control prerequisite route, teardown dispatch, renderer | open |
| PR 3 | Browser host boot: `browser-host-service` production `main()` over the installed bundle, lifecycle route (`close`/`processes`) for the control teardown, viewer input adapter (`{leaseEpoch,events}`), takeover `retirement` port, ARM64 image recipe (`Dockerfile.browser-host`: Playwright MCP 0.0.83 + Chromium), bootstrap document/program for the browser host, infra template (`c7g.large`, SG, instance profile, SSM) | next |

### 2.1 PR 2 in detail

- `packages/contracts/native-lifecycle.mjs`: `PROVISIONED_HOST_MODES=['native-processing','browser-only']`,
  `assertProvisionedHostAllocation`; the lifecycle request accepts a host's own purpose (`hostMode` must equal the
  installed allocation's). `native-observer.mjs` launch tags and `native-bootstrap.mjs` scopes accept both purposes.
  The close answer may carry `browserEgress` and `browserState`.
- `apps/control/browser-hosts/migrations/0008_browser_only_provisioning.sql`: derived from the pinned 0006 bodies
  (`guard_allocation` five purpose gates, `guard_native_observer` `V2_CONTEXT_REQUIRED`) and the 0005/0006/0007
  constraints (`native_physical_phase`, `native_declaration_shape`, `host_allocation_certificate_window`) with
  `'native-processing'` widened to the two provisioned purposes; predecessor pins on the exact function bodies; legacy
  rows and historical native rows untouched; the 0004 browser-only teardown receipt branch unchanged. Ordinal 86 in
  `first-chat-migrate.mjs` (after main's 0032 at 84 and intents 0006 at 85). `browser-only-provisioning-migration.test.mjs` recomputes the derivation.
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

### 2.2 What PR 3 must deliver on the host

1. **`main()` for `browser-host-service`** over the installed bundle written by the bootstrap program (identity, TLS,
   profile), building the browser-purpose currentness client, the egress service with the system resolver, the network
   compartment, the viewer relay and listener, the context port (Chromium with `chromiumSandbox:true` under a non-root
   uid), and the lifecycle route the control teardown drives (`close` returns `browserEgress`/`browserState`,
   `processes` returns the `browser-host-descendants` absence record).
2. **Viewer input**: `native-input.mjs` takes the wire batch `{leaseEpoch,events[]}` (mouse move/down/up, wheel, key
   with shift, text) that the frontend and relay already send.
3. **Takeover**: pass a `retirement` port into `browser-session-host.mjs` so `prepareTakeover` can begin.
4. **Image**: `apps/runtime/Dockerfile.browser-host` (ARM64 Node 24, `@playwright/mcp@0.0.83` with its pinned
   `playwright-core`, Playwright's arm64 Chromium, iproute2/nftables/procps for the compartment; non-root users for SDK,
   browser and relays), scanned to 0 HIGH/CRITICAL.
5. **Bootstrap and infra**: the browser bootstrap SSM document and program (same protocol as the native one), the AMI
   recipe, and the EC2 inputs (`c7g.large`, 30 GiB encrypted gp3, IMDSv2 hop limit 1, terminate on shutdown, the host
   security group, instance profile with SSM and ECR pull).

## 3. Shipping brief (executor: Sonnet; operator: Release)

Preconditions: PR 540, PR 2 and PR 3 merged; native processing (runbook step 2) live or shipped in the same window; the
host-to-control currentness listener (`browserHosts.tls.hostServer` + `bind`) rendered and reachable from the host
subnet on port 443 of `control.meri-preview.internal` (runbook 3a). No step below deploys anything without Release.

1. **Database (Release).** Snapshot `capiro-newstack-preview-clone`. Apply ordinal 86
   (`0008_browser_only_provisioning.sql`) with the existing `first-chat-migrate.mjs integration` stage. Verify:
   `guard_allocation()` and `guard_native_observer()` `prosrc` hashes changed from `ee96403b…`/`24b99863…`; the three
   constraints are `convalidated`; the ledger has 86 rows. Rollback: the forward migration is reversible only by
   restoring the snapshot (no browser-only rows exist before the first browser run).
2. **Image.** Build `Dockerfile.browser-host` once for `linux/arm64`, push to the `meri-greenfield/browser-host` ECR
   repository, record the digest, run the scanner (0 HIGH/CRITICAL), and bake the AMI with the same recipe as the native
   host AMI (the bootstrap program at `/opt/meri/native-bootstrap.mjs`, the browser host image pulled at first boot).
   Record `imageDigest`, `sourceCommit`, `bootstrapSha256`, AMI id.
3. **Security group `meri-browser-host`.** Ingress: TCP 9443 (viewer/tools listener) and TCP 9444 (lifecycle route) from
   the control task security group only. Egress: TCP 443 to the control private listener; TCP 443 and 80 to the internet
   through the NAT route (the public web; the egress proxy on the host decides every connection); UDP denied except DNS
   to the VPC resolver; no IPv6. The instance profile: SSM core, ECR pull of the browser repository, no other grants.
4. **Deployment inputs (private copy).** `features.nativeProcessing.browserDeployment` with `accountId`, `region`,
   the native `placement`, `launch{ImageId:<browser AMI>,InstanceType:'c7g.large',SubnetId,SecurityGroupIds:[<browser SG>],IamInstanceProfile}`,
   `imageDigest`, `sourceCommit`, `bootstrapSha256`, `physicalObserver`, `launchTagPolicy`, `bootstrapSpec` (the browser
   bootstrap document name/version/sha256, program and profile hashes, `hostEndpoint{port:9444,serverName}`, the SAME
   `control` block and `issuerCaCertificate` as the native deployment). Render; the renderer refuses drift in placement,
   observer, control connection, source commit, or an image digest or AMI equal to the native one.
5. **Deploy order.** Control first (it serves `execution/browser/prerequisite`), then the Temporal worker (it asks for
   it). A worker ahead of control fails every run with `NATIVE_OPERATION_UNAVAILABLE`.
6. **Gate (runbook step 4).** Only after the qualification host measured the activation checklist and the evidence file
   is committed: set `features.browserActivation` open with the evidence hash and the current
   `EGRESS_REQUIREMENTS_SHA256`, render, deploy control.
7. **Verify (runbook 5c, as updated by PR 540)**: a run shows `browser.enabled:true`; its browser-only row goes
   reserved → dispatching → active with bootstrap custody; `browser-prepare` succeeds; navigation to a public origin
   loads, to `https://app.capiro.ai/` refuses with `BROWSER_HOST_DENIED`, to a private address with
   `BROWSER_URL_NOT_PUBLIC`; a link click runs without a prompt, a form submission waits for approval, a password field
   refuses; the viewer streams frames and takeover works; the run ends and the row terminates with a verified
   browser-only receipt; the instance, root volume and ENI are absent.

Rollback: hold `features.browserActivation` (new runs mount no browser port and no browser host is provisioned); the
database delta and the worker's `browserDeployment` may stay in place.
