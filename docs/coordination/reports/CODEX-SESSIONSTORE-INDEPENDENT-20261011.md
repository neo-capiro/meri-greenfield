# Independent SessionStore and native source review

11 October 2026 UTC. **HOLD_SOURCE: optional SessionStore key admission needs repair.**
The native ancestor-observation change is acceptable as source-only behavior under its documented ownership and quiescence prerequisites. This review grants no runtime, durability, image, build, AWS or release authority.

## Frozen source and preservation

Reviewed commit `09b962f86e52b9559c46b19c80d8c25fcd3410f5`, tree `b045c081443d08ace456c08b30ad84acefa9dd30`, in the dedicated detached review worktree. Base is `a5c41c7afdd9ec235ac3a0184a96e4c457ef2f90`. AGENTS.md, implementation standards, allocation and author report were read. Local object reads explicitly disable lazy fetching. All nine allocated candidate paths are byte-identical to PR2 source `65d9c750639e0d370985827983f24019a3f585ab`; original fourteen native test assertions remain byte-identical to the base. No contracts, service source, package manifests, locks or infrastructure changed in the frozen 24-path diff.

The canonical native module is 12,049 bytes, SHA256 `543e05c230bf614cd5cf73f2d69877f1311ec0faf9d7ca205429161a75b842e1`. Its diff changes only capture ancestor observation and explanatory ownership comments; restore implementation and original tests are preserved. New source remains split into the optional adapter, independent readback verifier and deterministic evaluation provider. The verifier reuses canonical restore verification and public hashing rather than implementing another restore algorithm.

## Blocking finding: session scope can change after validation

`scopedSessionKey()` in `bound-session-store.mjs` reads `key.projectKey` while checking the authorized scope, then reads it again to construct the transport key. An enumerable getter returning the authorized project on its first invocation and `foreign-project` on its second is accepted by `store.append()`. The injected append transport then receives `{projectKey: 'foreign-project', sessionId: <authorized session>}`. The independent probe observes exactly two getter invocations and a foreign-project transport dispatch.

This violates the adapter's demonstrated foreign-session/project refusal before transport. It does not demonstrate a compromise of an actual trusted transport: that transport is absent and remains responsible for authorization and atomic current-fence enforcement. Nevertheless, the local one-session guard must hold before dispatch and cannot rely on the absent downstream transport to repair a key that changed during admission.

Required repair: admit inert key data before accessing values, capture one owned key snapshot, and validate and forward that same snapshot. Apply the same rule to construction-time `sessionKey` and append/load/listSubkeys key inputs. Preserve opaque subpaths, bounds, canonical binding and trusted transport ownership. Search canonical descriptor-based admission before adding another parallel helper; preserve any meaningful differing data budgets.

Related observation: a stable enumerable getter on an entry is accepted by `jsonCopy()` and executes twice, during serialization and comparison, before a copied plain object reaches transport. The current implementation therefore does not refuse accessors before executing caller code. Include accessor/proxy/custom conversion coverage in the repair's JSON boundary assessment; do not claim the existing JSON-safety tests cover these values.

## Independent physical checks

| Check | Result |
| --- | --- |
| Original native 14 + native boundary 7 + SessionStore 16 | 37 PASS, exit 0, no failures/skips; 60-second supervisor bound, 1.434 seconds |
| Nine candidate paths and original native-test preservation | PASS, exit 0; no remote or lazy object fetch |
| Borrowed ancestor mode change during actual file read | Refused with `SOURCE_CHANGED`, exit 0; owned temporary root removed |
| Changing key getter and stable entry getter | Reproduced the admission defects, exit 0; 15-second supervisor bound, 0.332 seconds |
| Actual borrowed owner mutation | UNAVAILABLE: this host returns `EINVAL` from chown to the synthetic uid/gid; temporary root removed |

All retained bounded process groups are absent. Focused test TMPDIR is empty after execution. Dependencies were copied physically from the already restored author worktree into ignored worker node_modules; there was no install, network acquisition or lock change. An earlier combined owner/mode probe exited 1 because the host rejected chown with EINVAL, before its accessor portion ran; it cleaned its owned root. The retained separate probes record the host limitation and completed reproductions without treating the earlier exit as a source defect.

## Accepted behavior and qualification limits

Within the documented trusted, quiesced filesystem prerequisites, owned config/projects/project metadata and selected content remain fully observed; borrowed parent device/inode, type, mode, uid/gid and realpath remain guarded. Unrelated sibling timestamp/membership changes above config are tolerated. Existing symlink/junction, parent replacement and same-length content mutation cases pass, and the independent borrowed-mode refusal passes. Atomic hostile traversal, reverted mutations, full Windows reparse behavior and actual owner mutation on this host remain unproved.

The optional adapter preserves ordered opaque JSON entries, UUID-less duplicates, main/subagent streams and compaction fields in synthetic tests. Unknown append outcomes block queued and retry dispatch; the adapter has no uncertainty retry. Its timers are owned and cleared, and timeout abort does not claim to undo a remote write. `closeMirror()` rejects new appends while already queued calls remain observable. `settleObservedCalls()` is explicitly an observed-promise settlement, not SDK flush, complete transcript acknowledgement or durable checkpoint commit. Trusted transport authentication, generation fencing at the actual commit and durable storage remain implementation/runtime gates.

The previously recorded one static component-pin failure remains a real dependency for the separately allocated pin advancement; it was not rerun or weakened here. No image authority transfers with a source-pin refresh. Later author documentation or test runs were not substituted for the frozen source under review. Actual SDK mirroring, subprocess/subagent/tool shutdown, transcript/workspace binding, immutable publication, replacement-task resume and stale-worker effect denial remain unqualified. Required receipt flags stay `completeRecoveryCheckpoint:false` and `sessionStoreQualified:false`.

Evidence is in [independent-review](../../qualification/candidates/sessionstore-consolidation-20261011/independent-review/): `focused.json` and raw streams; `source-preservation.json`; `adversarial-probes.mjs`, bounded receipt and raw streams; and `native-mode-probe.mjs`, bounded receipt and raw streams. Reviewer writes are restricted to this report and its allocated evidence directory. No product source edits, cloud/provider/native SDK execution, remote Git writes, merges, commits or deployment occurred.
