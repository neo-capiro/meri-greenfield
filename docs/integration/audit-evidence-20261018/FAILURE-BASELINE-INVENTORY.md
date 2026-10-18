# Exact backend failures and TypeScript baseline comparison

The published PR180 source tree (local commit `43db1dfac9663962efb0e49fa24ec7ddea10f9d0`, published prefix `7e4e7582`, tree `ca3f3a59e556e191a2a76c74c5deb87cc356af5a`) was compared with its exact receiving parent PR179 `141f2ada6378382f2bf7462d8a2c5dc7758230d0`. Both were checked from separate detached worktrees. These pinned comparison runs precede the history-release and composer corrections; the post-fix verification is appended below. They do not claim release acceptance.

## Measured comparison

| Check | PR179 parent | PR180 tree | Difference |
|---|---:|---:|---|
| Standard `npm run check` | 4,356 passed / 33 failed / 4,389 | 4,357 passed / 32 failed / 4,389 | One inherited generated history fingerprint failure repaired; zero introduced failures |
| Runtime TypeScript | 3 diagnostics; exit 2 | 3 diagnostics; exit 2 | Byte-identical output |
| Control TypeScript | 18 diagnostics; exit 2 | 18 diagnostics; exit 2 | Byte-identical output |


The preserved earlier result was 4,357 passed / 32 failed. The fresh PR180 run reproduces exactly the same 32 names and locations. All 32 also fail on the parent, with byte-identical emitted diagnostics after normalizing only the worktree root in stack paths. The runtime/control diagnostic totals count projects separately: two policy diagnostics occur in both, for 19 unique path/location/code entries.

Node `v24.19.0`, npm `11.9.0`, TypeScript `5.9.3`; `TZ=America/Toronto`; `NODE_OPTIONS` unset. The inherited process timezone was made explicit to reproduce the earlier run. Every package lockfile was byte-equal between parent and current. Each worktree resolved its own local public contracts package. No source, generated files, lockfiles, assertions or gates were changed for comparison.

Commands for the canonical comparison, run in each pinned worktree:

```sh
env -u NODE_OPTIONS TZ=America/Toronto npm run check
env -u NODE_OPTIONS TZ=America/Toronto node apps/runtime/node_modules/typescript/bin/tsc --noEmit --pretty false -p apps/runtime/tsconfig.json
env -u NODE_OPTIONS TZ=America/Toronto node apps/runtime/node_modules/typescript/bin/tsc --noEmit --pretty false -p apps/control/conversations/tsconfig.json
```

## All 32 remaining failures

Each row is classified from a real parent/current rerun. “Inherited” means the exact named test fails on both, rather than an inference from unchanged files. Full emitted errors/stacks are in the scrubbed logs and JSON.

| # | Test and declaration location | Assertion / expected | Actual | Classification |
|---|---|---|---|---|
| 1 | independent public receiver actual PR42 query/read<br>`packages/contracts/test/action-application-independent.test.mjs:17:128` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 2 | independent public receiver actual PR42 draft/draft<br>`packages/contracts/test/action-application-independent.test.mjs:17:128` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 3 | independent public receiver actual PR42 prepare/pending<br>`packages/contracts/test/action-application-independent.test.mjs:17:128` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 4 | independent public receiver actual PR42 execute/executed<br>`packages/contracts/test/action-application-independent.test.mjs:17:128` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 5 | independent public receiver actual PR42 execute/replay<br>`packages/contracts/test/action-application-independent.test.mjs:17:128` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 6 | independent actual pending approval error and indeterminate accounting remain non-success<br>`packages/contracts/test/action-application-independent.test.mjs:18:1` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 7 | independent receiving refusal accepted recommendation<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 8 | independent receiving refusal unknown query field<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 9 | independent receiving refusal query digest<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 10 | independent receiving refusal event binding<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 11 | independent receiving refusal event result ref<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 12 | independent receiving refusal draft digest<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 13 | independent receiving refusal recommendation hash<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 14 | independent receiving refusal prepare approval confusion<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 15 | independent receiving refusal proposal digest<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 16 | independent receiving refusal proposal task substitution<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 17 | independent receiving refusal prepare client substitution<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 18 | independent receiving refusal execute approval confusion<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 19 | independent receiving refusal execute unknown key<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 20 | independent receiving refusal execute tenant-scope mismatch<br>`packages/contracts/test/action-application-independent.test.mjs:36:3` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 21 | independent route and status cannot reclassify an actual payload<br>`packages/contracts/test/action-application-independent.test.mjs:37:1` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 22 | independent generated browser receiver has no external/private/Node imports<br>`packages/contracts/test/action-application-independent.test.mjs:42:1` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 23 | independent receiving accepts canonical nonconsecutive reserved event sequence<br>`packages/contracts/test/action-application-independent.test.mjs:54:1` | apps/control/action-application/local/flow.mjs:4-5: value.status must equal 200; otherwise throw LOCAL_FLOW_REFUSED.<br>Expected: `The local query route returns HTTP 200 so wire() can produce a fixture before the test assertions run.` | `runLocalActionFlow requireOk throws Error: LOCAL_FLOW_REFUSED at query; fixture promise is shared across these 23 tests. Their intended receiver assertions are not reached.` | inherited fixture/precondition failure |
| 24 | initial-input generation records exact canonical provenance and one shared browser import<br>`packages/contracts/test/conversation-initial-input-public.test.mjs:50:1` | conversation-initial-input-public.test.mjs:53:110: assert.equal(sha256(sourceBytes), row.sha256, row.path), first mismatch ../../apps/control/conversations/postgres-store.mjs.<br>Expected: `96002cc66ed5658273af0cd4035e027efaaaa94708e020f28b79c22f1fc355a0` | `3943e94931fc0843faa6dac8c10c7083178996182804abe8f28f8cfedfb53a79` | inherited generated provenance mismatch |
| 25 | standalone browser module works with no Node or private graph<br>`packages/contracts/test/document-application-independent.test.mjs:76:1` | document-application-independent.test.mjs:76:384: new vm.SourceTextModule(...). The public receiver assertions are not reached without --experimental-vm-modules.<br>Expected: `vm.SourceTextModule is constructible.` | `TypeError: vm.SourceTextModule is not a constructor` | inherited environment-sensitive runner failure |
| 26 | all fourteen original descriptors and all139 native rows remain exact<br>`packages/contracts/test/retrieval-action-item-binding.test.mjs:88:1` | packages/contracts/test/retrieval-action-item-binding.test.mjs:95: deepStrictEqual original operation descriptor.<br>Expected: `{ id: 'get_client_context', version: '0.2.0' }` | `{ id: 'get_client_context', version: '0.3.0' }` | inherited descriptor expectation mismatch |
| 27 | partial binding preserves every original row and fourteen descriptors<br>`packages/contracts/test/retrieval-action-item-independent.test.mjs:26:1` | packages/contracts/test/retrieval-action-item-independent.test.mjs:32: deepStrictEqual original operation descriptor.<br>Expected: `{ id: 'get_client_context', version: '0.2.0' }` | `{ id: 'get_client_context', version: '0.3.0' }` | inherited descriptor expectation mismatch |
| 28 | meeting schema objects stay closed and package public exports stay 0.1 only<br>`packages/contracts/test/retrieval-meeting-source.test.mjs:361:1` | packages/contracts/test/retrieval-meeting-source.test.mjs:365:10: strictEqual public package version.<br>Expected: `0.1.5` | `0.1.10` | inherited package expectation mismatch |
| 29 | operation is mapped but unavailable and public exports stay separate<br>`packages/contracts/test/retrieval-memory-proposals.test.mjs:120:1` | packages/contracts/test/retrieval-memory-proposals.test.mjs:127:10: strictEqual public package version.<br>Expected: `0.1.5` | `0.1.10` | inherited package expectation mismatch |
| 30 | operational-read schema objects stay closed and package public exports stay 0.1 only<br>`packages/contracts/test/retrieval-operational-reads.test.mjs:394:1` | packages/contracts/test/retrieval-operational-reads.test.mjs:398:10: strictEqual public package version.<br>Expected: `0.1.5` | `0.1.10` | inherited package expectation mismatch |
| 31 | trusted default as-of is distinct from explicit date and generatedAt<br>`packages/contracts/test/retrieval-public-domain-query.test.mjs:101:1` | retrieval-public-domain-query.test.mjs:104:9: assert.equal(normalize({...r, asOfDate:'January 1, 2020'}).input.asOfDate, '2020-01-01T00:00:00.000Z').<br>Expected: `2020-01-01T00:00:00.000Z` | `2020-01-01T05:00:00.000Z` | inherited environment-sensitive timezone assertion |
| 32 | actual prepare/approve/execute API wire admits canonical normalization and immutable correlated result<br>`packages/contracts/test/task-command-application-public.test.mjs:25:1` | task-command-application-public.test.mjs:28:119: strictEqual command source URL.<br>Expected: `https://source.invalid/clio/tools/update_task` | `https://source.invalid/api/clio/tools/update_task` | inherited route expectation mismatch |

The five version expectation failures consist of two descriptor-version assertions and three package-version assertions; they are not five package-patch assertions.

The first 23 failures are a shared rejected fixture promise. They are not 23 independently observed receiver assertion failures: the initial query returns non-success and `runLocalActionFlow` throws at `flow.mjs:4-5` before the intended assertions. The log retains every named failed case.

## Parent-only failure repaired in PR180

`packages/contracts/test/conversation-history-public.test.mjs:57:1` — **browser distribution is self-contained and offline package resolves only public exports**

```text
AssertionError [ERR_ASSERTION]: ../../apps/control/conversations/history/service.mjs
  + actual - expected

  + '2003dd90b7ec56b1f463fc1ec9ca3ea455f86565e2302afd82bed267de9fab87'
  - 'ef6f03c97ee0f56945a587f2fe4e601a765ad4d403f200817e1fdffd064c4981'

      at TestContext.<anonymous> (file://<parent-worktree>/packages/contracts/test/conversation-history-public.test.mjs:62:238)
      at async Test.run (node:internal/test_runner/test:1389:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:960:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: '2003dd90b7ec56b1f463fc1ec9ca3ea455f86565e2302afd82bed267de9fab87',
    expected: 'ef6f03c97ee0f56945a587f2fe4e601a765ad4d403f200817e1fdffd064c4981',
    operator: 'strictEqual',
    diff: 'simple'
  }
```

The parent history metadata expected `ef6f03c97ee0f56945a587f2fe4e601a765ad4d403f200817e1fdffd064c4981` for history/service.mjs, while the parent source hash was `2003dd90b7ec56b1f463fc1ec9ca3ea455f86565e2302afd82bed267de9fab87`. PR180 regenerated the canonical history metadata. The test passes in PR180. This explains parent 33 versus current 32.

## All TypeScript diagnostics

Every diagnostic below is inherited: parent and current stdout are byte-identical for each project, including full continuation messages. Neither project passes.

### Runtime project: 3 diagnostics

| Location | Code | Exact message |
|---|---|---|
| `apps/worker/conversation/capabilities/policy-resolution.mjs:65:167` | `TS2345` | Argument of type 'unknown' is not assignable to parameter of type 'readonly string[]'. |
| `apps/worker/conversation/capabilities/policy.mjs:39:24` | `TS7006` | Parameter 'op' implicitly has an 'any' type. |
| `apps/worker/conversation/capabilities/policy.mjs:49:31` | `TS7006` | Parameter 'value' implicitly has an 'any' type. |

### Control project: 18 diagnostics

| Location | Code | Exact message |
|---|---|---|
| `apps/worker/conversation/capabilities/policy.mjs:39:24` | `TS7006` | Parameter 'op' implicitly has an 'any' type. |
| `apps/worker/conversation/capabilities/policy.mjs:49:31` | `TS7006` | Parameter 'value' implicitly has an 'any' type. |
| `apps/worker/conversation/capabilities/skill-plugin.mjs:46:48` | `TS2345` | Argument of type 'unknown' is not assignable to parameter of type 'string'. |
| `apps/worker/conversation/capabilities/skill-plugin.mjs:74:30` | `TS7006` | Parameter 'uid' implicitly has an 'any' type. |
| `apps/worker/conversation/capabilities/skill-plugin.mjs:75:58` | `TS7034` | Variable 'directories' implicitly has type 'any[]' in some locations where its type cannot be determined. |
| `apps/worker/conversation/capabilities/skill-plugin.mjs:81:38` | `TS7005` | Variable 'directories' implicitly has an 'any[]' type. |
| `apps/worker/conversation/capabilities/skill-plugin.mjs:108:26` | `TS2339` | Property 'code' does not exist on type '{}'. |
| `apps/worker/conversation/capabilities/skill-plugin.mjs:116:79` | `TS2379` | Argument of type '{ uid: number \| undefined; }' is not assignable to parameter of type '{ uid?: number; }' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.<br>  Types of property 'uid' are incompatible.<br>    Type 'number \| undefined' is not assignable to type 'number'.<br>      Type 'undefined' is not assignable to type 'number'. |
| `apps/worker/conversation/egress/proxy-server.mjs:63:9` | `TS2339` | Property 'destroySoon' does not exist on type 'Duplex'. |
| `apps/worker/conversation/egress/proxy-server.mjs:96:17` | `TS7006` | Parameter 'error' implicitly has an 'any' type. |
| `apps/worker/conversation/egress/proxy-server.mjs:98:44` | `TS7006` | Parameter 'error' implicitly has an 'any' type. |
| `apps/worker/conversation/egress/proxy-server.mjs:143:7` | `TS2740` | Type 'Duplex' is missing the following properties from type 'Socket': destroySoon, connect, resetAndDestroy, setTimeout, and 17 more. |
| `apps/worker/conversation/egress/proxy-server.mjs:167:59` | `TS2532` | Object is possibly 'undefined'. |
| `apps/worker/conversation/egress/proxy-server.mjs:168:35` | `TS2345` | Argument of type 'number \| undefined' is not assignable to parameter of type 'number'.<br>  Type 'undefined' is not assignable to type 'number'. |
| `apps/worker/conversation/egress/proxy-server.mjs:191:75` | `TS7006` | Parameter 'error' implicitly has an 'any' type. |
| `apps/worker/conversation/egress/proxy-server.mjs:208:68` | `TS7034` | Variable 'wake' implicitly has type 'any' in some locations where its type cannot be determined. |
| `apps/worker/conversation/egress/proxy-server.mjs:209:122` | `TS7005` | Variable 'wake' implicitly has an 'any' type. |
| `apps/worker/conversation/egress/proxy-server.mjs:210:18` | `TS7005` | Variable 'wake' implicitly has an 'any' type. |

## Environment and comparison controls

The two inherited runner-sensitive failures pass on both pins under this diagnostic control (83/83 each):

```sh
TZ=UTC node --experimental-vm-modules --test packages/contracts/test/document-application-independent.test.mjs packages/contracts/test/retrieval-public-domain-query.test.mjs
```

This shows `vm.SourceTextModule` requires the VM modules flag and the date-string assertion depends on timezone. It does not change the standard command or erase either failure from the reported 32.

The first isolated attempt linked contracts/node_modules outside each repository. It measured parent 35 and current 34 because the generator emitted different dependency source comments and the permission-model child could not read the outside-linked AJV package. Both extra named cases passed (29/29 targeted checks) after physically copying the same installed dependency bytes into each pinned tree; full standard checks were then rerun. No tracked source was changed. The initial failed logs are retained and labeled `linked-dependency-attempt1`.

## Scrubbed evidence

Scrubbing replaces only absolute task/worktree directories with descriptive placeholders. Test names, synthetic fixture identifiers, assertions, errors, expected/actual values, source-relative locations and stacks are retained. An automated scan found no credential/token/private-key patterns in the logs. No live external services or model providers were invoked.

| File | Bytes | SHA-256 |
|---|---:|---|
| [baseline-control-typecheck.scrubbed.log](baseline-control-typecheck.scrubbed.log) | 2826 | `0516385759864540947ba7cfdc4d3daf706deab55b44293d8f8f29ae24e37096` |
| [baseline-environment-control.scrubbed.log](baseline-environment-control.scrubbed.log) | 6171 | `19c7d252e17ba76ecec25d70bc4f56b783896bb0a8670246c19e3c697cd514b3` |
| [baseline-runtime-typecheck.scrubbed.log](baseline-runtime-typecheck.scrubbed.log) | 405 | `f288361ede5079e593ded80e09b577ab897c5a0b6229de63f576d7a4662def8d` |
| [baseline-standard-check.linked-dependency-attempt1.scrubbed.log](baseline-standard-check.linked-dependency-attempt1.scrubbed.log) | 423172 | `29a53de76df061fd0a3ddeb76944556f5107986334df4bc77b2dc7edb1179127` |
| [baseline-standard-check.scrubbed.log](baseline-standard-check.scrubbed.log) | 420551 | `eded59891ec2c8fa35b705ce37062a489740272078c01f0e2804cfc6a53c9751` |
| [current-control-typecheck.scrubbed.log](current-control-typecheck.scrubbed.log) | 2826 | `0516385759864540947ba7cfdc4d3daf706deab55b44293d8f8f29ae24e37096` |
| [current-dependency-setup-control.scrubbed.log](current-dependency-setup-control.scrubbed.log) | 2763 | `b72c8e7099c34c4d844ec3ae0d77ac0bcac940d72414675a631e74c8e0842a80` |
| [current-environment-control.scrubbed.log](current-environment-control.scrubbed.log) | 6183 | `eea8c1a7d212fd8a9ce6ef2b352b03aeafeccedf5b6828389af3b6fe3719725a` |
| [current-runtime-typecheck.scrubbed.log](current-runtime-typecheck.scrubbed.log) | 405 | `f288361ede5079e593ded80e09b577ab897c5a0b6229de63f576d7a4662def8d` |
| [current-standard-check.linked-dependency-attempt1.scrubbed.log](current-standard-check.linked-dependency-attempt1.scrubbed.log) | 422285 | `f5279a5272cdeb3462581447e9dd63139726492cbeba14a90b18c8fef18c884f` |
| [current-standard-check.scrubbed.log](current-standard-check.scrubbed.log) | 419721 | `4e11d34dadd6819a0567561c053d6a79477d4ed2e99149db6f80b8c04413fef7` |
| [historical-standard-check.scrubbed.log](historical-standard-check.scrubbed.log) | 419110 | `63ba48850479931522b856e8b2f6767ba17eb000195d3085d68986fd9a9eadb5` |

Structured companion files: [failure-inventory.json](failure-inventory.json), [run-metadata.scrubbed.json](run-metadata.scrubbed.json). Historical logs are labeled historical; fresh parent/current standard and typecheck logs are independently captured. No changes were merged or deployed.

## Post-fix verification at `1aa5c66e9283024e78ad6f26f5450cbc61a37659`

The history fence follow-up has local tree `735c275a1b0151df57060e7dc98189be91be4b59`. Root reran the same standard command after canonical fingerprint regeneration: **4,357 passed / 32 failed / 4,389 total**, with zero skips/cancellations. The complete set of failure names and declaration locations equals the 32 rows above. Both post-fix TypeScript outputs are byte-identical to the pinned parent/current outputs: runtime 3 and control 18, all inherited. The standard command remains red; two of its failures are environment-related and present on the parent as shown by the controls above.

- [Post-fix full standard log](post-fence-standard-check.scrubbed.log)
- [Post-fix runtime diagnostics](post-fence-runtime-typecheck.scrubbed.log)
- [Post-fix control diagnostics](post-fence-control-typecheck.scrubbed.log)
- [Focused fix checks: 123/123](post-fence-focused.scrubbed.log)
- [Actual A/B timing regression before repair](history-page-before.scrubbed.log)
- [Broader integration log: 257/261](broader-release-check.scrubbed.log)
- [The broader four failures reproduced on PR179](broader-release-pr179-failures.scrubbed.log)
- [Final release-fence suite: 18/18](final-release-fence-check.scrubbed.log)
- [Follow-up evidence hashes](follow-up-evidence-manifest.json)

The broader four are separate from the standard 32: `apps/control/retention/test/postgres-watermark.test.mjs:50` raises `RETENTION_CONFIGURATION` because its synthetic journal omits the already-required `withTransition`; `apps/runtime/test/startup-history.test.mjs:29`, `:80`, and `:90` fail at assertions `35:107` (`503 !== 200`), `85:10` (`503 !== 409`), and `100:109` (`503 !== 200`). Those fixtures omit `conversationCurrentness`, so the canonical history route remains uncomposed. All four reproduce on both initial PR180 and parent PR179. Counts overlap across focused and broader runs and must not be added.

No PostgreSQL server/container toolchain is available here. Actual production PostgreSQL contention/pool-pressure qualification remains unexecuted; canonical memory timing and production PostgreSQL query/lease fault models passed. No live database, first-chat startup, merge or deployment action occurred.
