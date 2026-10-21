# M8 missed source receiving, 21 October 2026

This is a source receipt against `e39d07c00d9c4b33d16bf3cd579ed2e8dd7992be`, preserving the current first-chat/next-turn receiver and PR190 followups. It receives the missing later M8 source from `b465b2e6223fea02d658ae2b6e99bfe3e6b5a234`. D005 isolated-host placement and D015 Bash placement are accepted directions; their native qualification and activation gates remain held. No deployment, live migration, mount, image build, native helper execution, workflow or feature activation was performed.

## Outline and source disposition

The outline was recorded before implementation in the task's owned `meri-browser-review/IMPLEMENTATION-OUTLINE.md`: receive unmounted host libraries and tests, adapt only the trusted broker-directory field and closed browser shim contract, preserve current activity/options/runtime behavior, and verify source and synthetic behavior while retaining native qualification failures.

The missing-source inventory contained 66 source/test blobs. All 66 paths are now received: 62 retain the donor bytes; four are adapted deliberately:

| Path | Receiving decision |
| --- | --- |
| `apps/worker/conversation/activity.mjs` | Add only `brokerSocketDirectory` to trusted capability preparation facts; retain current setup/load budgets, telemetry, streaming and read-ahead behavior. |
| `apps/worker/conversation/options.mjs` | Add only the optional trusted field and exact `/run/meri-launch` validation; retain current SDK environment, continuation and next-turn handling. |
| `apps/worker/conversation/test/bash-sandbox.test.mjs` | Receive broker-denial cases while retaining the newer SDK environment assertions. |
| `apps/worker/conversation/host/network/host-relay-entry.mjs` | Add inert `--help` with exit codes, matching the local relay CLI. New `test/host-relay-entrypoints.test.mjs` is discovered by the existing worker `test/*.test.mjs` suite. |

Host responsibilities remain separate: `control/` owns authenticated currentness transport and a proposed transaction adapter; `launcher/` owns one-use SDK/browser pre-exec descriptors; `network/` owns namespace, relay and firewall setup/readback; `browser-workspace/` owns preparation and paused-child readback; `cloud-absence/` owns bounded termination/readback interpretation; `composition/` joins these through injected canonical ports. Their constructors are unmounted. The native C files are source, not qualified binaries. The unapplied `infra/browser-host/enabled-*` definitions describe closed-network qualification only.

The browser fragment now admits only a run-bound native shim descriptor; it never hands the SDK the real Node/Playwright command. `brokerSocketDirectory` adds filesystem denial without opening Unix sockets or network binding. The host currentness monitor covers every isolated SDK run and anchors lease expiry at the validated wall/monotonic sample. Browser egress likewise retains monotonic expiry and a wall-clock floor. Existing `egress/proxy-server.mjs` receiver fixes are preserved.

The three 18 October M8 handoff/qualification/action documents are received as historical source context. Their future action descriptions do not authorize execution. Current `browser/activation.mjs`, `infra/browser-host/watchdog.mjs`, `apps/runtime`, `packages/contracts`, `infra/product-preview` and `.github` are unchanged by this receipt. A source search found no runtime or product-preview import of the new host composition/native relay adapters.

## Verification actually run

Node 24 on Windows, with the receiver's installed dependencies borrowed through local directory junctions. Test runs used `--experimental-test-module-mocks --test --test-concurrency=1` and the worktree's `MERI_REVIEW_SOURCE_ROOT`. Raw logs remain in the owned task directory beside the worktree; counts below preserve failed and skipped outcomes.

| Check | Result |
| --- | --- |
| Every `host/**/*.test.mjs` | 133 tests: 117 pass, 12 fail, 4 skip. |
| Every `browser/test/*.test.mjs`, every `infra/browser-host/*.test.mjs`, Bash sandbox and sandbox readiness | 80 tests: 74 pass, 6 fail. |
| Current worker `activity*.test.mjs`, `options*.test.mjs`, typed completion; runtime activity diagnostics, SDK pin, dynamic SDK options, prepared runner query and native/runtime next-turn tests | 109 tests: 100 pass, 6 fail, 3 skip. |
| New relay entrypoint import/help/missing-or-malformed-config smoke | 6 pass. Both entrypoints exit without allocating a relay for these inputs. |
| `node --check` on the initial 62 received JavaScript files | All pass. The subsequently added smoke file and CLI help were executed by the six passing tests. |
| `git diff --check` | Pass. |
| Exact base `e39d07c00` comparison: original host/browser tests plus activity-browser/options-capabilities/sandbox-readiness | 122 tests: 103 pass, 19 fail. These are the same 19 existing platform failures observed in the candidate. |

The 19 reproduced base failures are POSIX workspace/path assumptions, Windows symlink permission, and the pinned real SDK returning `SDK_STARTUP_FAILED` rather than the Linux sandbox-dependency result. The five additional failures are new host fixtures with Linux assumptions: `browser-workspace/prepare.test.mjs` calls `process.geteuid`; the readback positive fixture and two browser-broker fixtures derive backslash paths via the existing `browserPaths`; `network/network.test.mjs` expects the entrypoint suffix with `/`. Existing runtime path guards and these assertions were not weakened. They still require execution on the intended Linux host.

The four host skips lack the local `python3` cryptography certificate fixture. The three current regression skips explicitly require real POSIX directories or a Linux remote runner. No real mTLS issuer, PostgreSQL host-control schema, native compiler/helper, Linux network namespace, browser sandbox, image or cloud resource was qualified. Synthetic passing cases validate source contracts and refusal/cleanup behavior only.

## Remaining runtime and qualification requirements

1. **Canonical host authority.** `host/control/postgres-store.mjs` requires proposed `meri_host_control` tables plus an acknowledged transaction and a canonical admitted-run/policy reader on that same transaction. `SCHEMA-PROPOSAL.md` remains a proposal, without an allocated/applied migration or issuer. The current run/lifecycle owner must provide those bindings and atomically revoke/replace the host generation; an in-memory or test callback cannot substitute. No competing run store is introduced.
2. **Prepared-run wiring.** `host/composition/run.mjs` returns a one-use `processClientFactory`, Bash facts, browser port and settlement. The existing prepared-run owner must connect them to its single SDK query after authority/image prerequisites are satisfied. This receipt intentionally leaves runtime entrypoints unchanged. Default-on browser policy with an empty allowlist is preserved, and the hard activation gate still returns held.
3. **Native confinement and image.** Compile and pin both launchers and the MCP shim on the exact Linux image; prove all entrypoints, UID/cgroup/netns/mount placement, browser/renderer sandbox, SDK Bash fresh `/proc`, private browser workspace, credential denial, and cleanup. `composition/native-verifier.mjs` deliberately returns `HOST_CONFINEMENT_UNPROVEN` and `HOST_OUTER_ISOLATION_UNPROVEN`; partial proc readback does not mint an acceptance receipt. Bash refuses weaker nested sandbox readiness.
4. **Route and effective-origin evidence.** The enabled template allows only the closed qualification topology on private TCP 443. It is not the current product model-proxy `:8443` route. The image/network owners must reconcile the exact model route and loopback IP-SAN/CA, supply the dedicated public proxy compartment, and qualify effective-origin restrictions including TLS coalescing/domain fronting. Canonical browser approval, artifact ingestion and source-scope ports still require real tenant-bound connections.
5. **Independent destruction evidence.** `cloud-absence/wire.mjs` accepts an explicit exact root-volume `deleted` state; an empty list does not prove it. The ENI wire has no qualified positive absence result. `infra/browser-host/watchdog.mjs` still has `launchAdmitted:false`. The existing watchdog/control owners must provide independently qualified positive instance/root/ENI absence, late-launch containment and UNKNOWN quarantine before an actual host can be admitted.

Fable retains the accepted Meri source continuation. These are concrete missing authority/binding/qualification requirements, not a claim that the historical donor branch itself supplies current coverage. Safe inert source is received now; production host authority and activation remain unprovided.
