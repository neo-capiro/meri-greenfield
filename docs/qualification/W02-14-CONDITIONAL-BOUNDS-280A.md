# W02-14 conditional finite source bound proof, frozen source 280a2a2

This is Codex read-only source/arithmetic support, not implementation, actual Hermes review, owner acceptance, native qualification or a service guarantee. All six modules were fully read at clean HEAD `280a2a222d4443a03e96c7cd3c17571fa4329163`. The parent's `c280a2a...` reference had an extra leading `c`; the checkout's actual 40-character commit is pinned here. `ARITHMETIC.json` records exact raw source hashes, lengths, collection keys and arithmetic. `derive.py` reads those bytes as data, verifies hashes, counts literal builder calls and calculates ordinary arithmetic. It does not import or execute a candidate module or evaluate JSONata.

## Scope and assumptions

Let L(v) be the number of Unicode code points in the compact JSON serialization used by the retained JSONata `$string` model, and B(v) its UTF-8 byte length. Then B(v) <= 4L(v). Quotes, backslash escapes and control-character escapes are already characters of the serialized string; they are not expanded a second time. Consequently `6L(v)<=cap` implies `B(v)<=4 floor(cap/6)`. This distinction is essential: proving actual B does not prove the stricter 6L predicate.

The proof assumes standard compact JSON serialization, matching retained JSONata string/path/filter/merge behavior, successful finite binary64 numeric values requiring at most 25 ASCII serialization characters, and the fixed scalar owner-admitted input shape for the hypothetical Initialize path: canonical UUID (36), `sdk|office` (<=6), deterministic execution name (<=55), fixed binding ID (64), finite numeric t0. The run object needs <=250 ASCII characters. Arbitrary post-admission state injection and invalid 40,000-character tokens are outside that reachable-shape argument. GuardInput currently refuses the default/synthetic binding; that trivial refusal is not a proof of future native execution. In particular, this arithmetic does not qualify all guard coercion/type behavior or actual AWS Context/wire semantics.

The bounded object is the workflow's explicit persistent variable store and each resolved Output. It excludes the execution input/context kept by the service, complete Task result before projection, transient JSONata evaluation/merge allocation, workflow definition size, event history, logs and service transport encoding. A projection can fail or service payload/runtime limits can intervene before these expressions. Numeric/serialization failures are not converted into a physical-cleanup guarantee.

## Complete write and output inventory

`app.mjs` is a pure re-export; `binding.mjs` freezes static pins/evidence references; `task-definition.mjs` validates their records; `infrastructure.mjs` embeds the generated graph and IAM data. None assigns workflow persistent variables. Static complete task-definition bodies and authority bodies are not copied into `$ctx` or the record base. Binding reduces ten authority documents to reference records and checks their aggregate canonical UTF-8 size <=16384 at binding:43-51. Only this bounded reference array enters every record. Wire reference metadata is separately bounded and does not enter these record outputs.

`workflow.mjs:39` Initialize is the only direct `$ctx` construction. It constructs exactly the 31 initial keys listed in ARITHMETIC.json, with the fixed run shape, scalar defaults and empty arrays; it is well below both adopted caps. Thereafter 31 literal `pass` builders and seven `prepare` builders update only `$ctx` through `commitCtx` (workflow:11,21), for 38 generated ctx-update states. `prepare` is itself a `pass`; there is no additional persistent-variable write hidden in it. Their update families are:

| Update family | States / fields |
|---|---|
| Launch | ConsumeAttempt, RetainRun, LaunchUncertain: attempt flags/time, direct selection, fixed operation, bounded issues |
| Discovery | StartScan, RetainPage, NextInventory, DiscoveryError, PickCandidate: bounded response-derived ARNs/token, page/mode/poll/call counters, fixed operation, current/ENI resets |
| Projection and ownership | RetainCandidate, BindOwned, BindOverflow, OverflowExhausted, ForeignOrAmbiguous, CandidateError: current projection, at most 4+6 positive records, hold/failure/issues |
| Qualification | EvaluateTask, RetainENI, ENIMismatch, ENIContradiction, NetworkUnknown: readiness/failure, current ENI, immutable typed net pins, bounded issues |
| Stop | SelectOwned, RetainPreStop, PreStopReadUnknown, MarkStopAttempt, RecordStopTiming: selected bound ARN, stop flags/attempt state, current projection or ledger |
| Terminal | PickConfirm, RetainFreshTerminal, TerminalReadUnknown, RetainTerminal, BumpProbe, PrepareFinal, PickFinal: current, terminal flags/time, probe counters and final queue |

Only `launchObservedEnd` and `overflowed` are added to the initial top-level ctx keys: 33 possible keys, costing 404 ASCII characters including braces/key quotes/colons/commas. No raw object is merged into top-level ctx. Nine record builders assign no variables. Ten Task builders use the common workflow:20 assignments; both Catch entries use its common bounded error assignments. Their only additional persistent names are `raw, rawOver, callOk, callError, observedMs, enteredMs, createdMs`. Choice/Wait states assign nothing.

All Pass/Task/Catch Outputs are `{}` (two bytes), except the nine record states and the two explicitly constructed Succeed outputs (workflow:127-128). AdmissionRefused is Fail, not an arbitrary returned payload. The noncompiled early return contains only that constant Fail graph. The record/final enumeration below therefore covers every dynamic Output.

## Ordinary guarded contexts and complete variables

For every non-fallback ctx returned by commitCtx, `6L(ctx)<=196608`, so `B(ctx)<=131072`. Tasks do not alter ctx. Success sets `callError=null` and raw to a value satisfying `L(raw)<=5461` or null. Catch sets `raw=null` and the bounded error value has `L<=170` or a small constant. Thus raw and error are mutually exclusive large objects; at most 21844 bytes need be allocated to that large value. The other null, three finite numeric values, two booleans and all eight outer variable keys cost <=178 ASCII bytes. The prior 1024-byte allowance is conservative, not an added product cap.

Normal full variables are therefore <= `131072+21844+1024 = 153940` bytes. A Task/Catch following a fallback uses the separate fallback ctx bound below, not the ordinary predicate bound. Failed/missing Task result projection yields null/error and cannot enlarge this estimate. A thrown expression before successful assignment is outside the successful returned-value proof.

## Positive ledger bound

New ownership can be established only from an untruncated retained task projection (expressions:32,43; workflow:74-78). A truncated core has no required run tags/startedBy/group. Existing-positive shortcuts do not allocate another ledger. The projection has `L<=floor(16384/6)=2730`, hence `B<=10920`.

The ledger copies only the ARN, definition and initial container-ARN values, each once, from disjoint positions in that projection. This permits a malformed large initial container-ARN value: no string/namespace assumption about that initial value is needed. A missing container ARN introduces at most four bytes of null. All other pre-network ledger values are four finite numbers (createdMs, firstSequence, terminalAt, probeSeq) and four booleans/omittable flags. Charging the FULL eleven-key object punctuation (153), four numbers at 25 each (100), four flags at five each (20), and missing-container null (4) gives **277 ASCII bytes**, already double-counting copied-value keys that existed in the projection. Thus the earlier 384 allowance is safe.

The two network properties add exactly at most 58 ASCII bytes per existing object: `,"netId":"` +21+`"` costs32, and the analogous netIp field with15 characters costs26. Null pairs cost26. Only RetainENI changes them (workflow:88); its sole predecessor ENIShape requires eniGood, which explicitly includes anchored ENI and IPv4 syntax (expressions:80-81,95). Valid values are nonempty, so the first truthy pin is never replaced. Other ledger updates only change fixed flags/numbers (workflow:103,116,120).

One ledger is therefore <= `10920+384+58 = 11362` actual bytes. At most ten such objects are retained. Do not multiply the new ASCII metadata by four: keeping this mixed byte/character accounting gives a tighter source-only proof.

## Important correction: direct count is not proved to be four

RunShape bounds the top-level task-array count to four but does not require its entries to be objects or each `taskArn` field to be scalar. `$raw.tasks.taskArn` can flatten a nested ARN array before filtering. A raw `tasks:[{taskArn:[validArn1,...validArnN]}]` is a source-level counterexample to the previous `direct<=4` premise; it is not evidence of an actual AWS response. Therefore the older claim that ALL remaining fallback characters fit4096 under four direct ARNs is not a complete source-only derivation.

This also matters beyond byte arithmetic. With a singleton nested ARN array, RetainRun can set launchCertain=true and leave qualificationFailed=false despite the malformed RunTask record. With five selected ARNs under one top-level entry, direct/queue can have five entries; qualificationFailed=true then drives containment. The independent once-only selected-expression witness was run by `/root/contract_review`, not by this proof author: `.task-inputs/W02-14-runshape-audit-6/result-1.json`. Its report includes both nested shapes and separately shows that a foreign-cluster Describe record still fails new ownership. The source retains the independent OwnedCapacity limits4+6 and StopIdentity pending-ledger exact-count gate; direct membership alone neither creates a ledger nor permits StopOwned. This is not a complete stop replay. A focused source correction must require every top-level tasks entry to be an object with a typed canonical scalar taskArn before RetainRun (and reject nested task arrays), while preserving uncertain launch discovery/containment rather than trusting malformed direct entries. Source pins and this write inventory must then be rechecked.

The correction is to bound the entire selected array. Filter + distinct selects valid string occurrences from a response with `L(raw)<=5461`, without duplicating source occurrences. Every retained ARN is ASCII with no JSON escaping. The selected direct array's serialized bytes are consequently <=5461, regardless of its count. The queue is reset to precisely that array, so both copies together cost <=10922 actual bytes. This proof assumes the standard retained path/filter/selection semantics; no AWS response schema assumption is needed. Other candidate queues may be larger, but fallback replaces them and normal ctx writes remain predicate-guarded.

CurrentArn is null/omitted or a selected valid ARN. The binding regex permits a cluster name of at most196 ASCII characters; the task namespace gives an ARN length at most269, hence its quoted value costs <=271.

## Compact fallback enumeration and full variables

Fallback clears current, ENI, allArns, token history and finalQueue, reduces issues to one constant, and resets queue to direct. The two ledgers, net pins and original stop/time flags remain. Besides ledger object values, direct/queue arrays and nextToken, EVERY remaining value plus ALL top-level key punctuation is enumerated below:

| Item | Maximum characters/bytes (all ASCII) |
|---|---:|
| All 33 ctx key punctuation |404|
| Fixed run object |250|
| Quoted currentArn |271|
| Nine numbers: D,C,attemptStart,attemptEnd,mode,pages,polls,calls,launchObservedEnd |225|
| Nine booleans: attemptConsumed,launchCertain,overflowExhausted,taskReady,qualificationFailed,hold,finalMode,stopMode,overflowed |45|
| Quoted fixed operation |34|
| completeModes |7|
| allArns/tokens/finalQueue empty arrays |6|
| current and eni null |8|
| Constant ctx-overflow issues array |25|
| Two ledger-array wrappers and at most ten commas |14|
| **Total** |**1289**|

Some absent optional fields are deliberately charged anyway. This also justifies a 4096 allowance for this corrected remainder category; the earlier category that INCLUDED direct/queue needs the correction above. The retained nextToken has <=2048 original code points and, more usefully, serialized L<=5461 because it is a subvalue of a bounded prior raw response. Its actual UTF-8 is <=21844. It is not necessary to assume raw UTF-8 length2048 or to discard escaping/multibyte costs.

Fallback actual bytes are <= `10*11362 + 2*5461 + 21844 + 1289 = 147675`. Complete fallback variables are <= `147675+21844+1024 = 170543`. These tighter bounds lie inside the previous loose envelopes163368/186236, but amend their direct-count derivation. Fallback is NOT separately predicate-checked; this does not prove `6L(fallback)<=196608` or guarantee normal processing/terminal availability.

## All assembled record Outputs

The common base has authorityReferences<=16384 actual bytes. The complete record metadata allowance is enumerated in ARITHMETIC.json: maximum full base+extra key punctuation171, longest quoted kind21, run250, quoted binding ID66, four base numbers100, at most two extra numbers50, quoted managed-role ARN94, target quotes2, and two booleans10. This deliberately charges values from mutually exclusive record kinds together and totals764 ASCII bytes, below4096. The managed-role bound follows binding:27 (fixed prefix plus at most28 characters); the exact base/extra key lists of all nine records are retained in the arithmetic. Every J-wrapped extra VALUE is guarded by recordBytes, yielding <=21844 actual bytes or the small truncation object. The only unguarded extra values are constants or the bounded fixed managed-role ARN.

| Record | Potentially large guarded values | Other values |
|---|---|---|
| AdmissionRecord | input, execution | fixed managedRoleArn |
| LaunchAttemptRecord | identity | true flag |
| RunResultRecord | raw | launchCertain boolean |
| PageRecord | raw | page/mode finite numbers |
| OwnershipRecord | task | finite createdMs, direct boolean |
| ObservedRecord | task, eni | qualificationFailed boolean |
| PreStopRecord | original, freshTask, eni, identity | target<=269 ASCII, two flags |
| StopResultRecord | error | target<=269 ASCII, ok flag |
| TerminalRecord | task, original | target<=269 ASCII, finite observedMs |

PRE_STOP is the maximum by this common upper envelope: `4*21844+16384+4096+269+10 = 108135 <131072`. Other records have at most two large values and fit this envelope. A missing value omits a property or becomes null; charging it its full allowance is conservative. Task/Catch outputs themselves are always `{}`.

## Both final Outputs: normal and fallback predecessors

FinalConfirmed copies only run,D,C,owned,overflow; FinalUnknown additionally copies issues and overflowExhausted. They never copy current/raw/ENI/direct/queue/token history/authority references. Re-keying owned/overflow does not duplicate their values.

For a normal ctx, count object punctuation exactly as `1+sum(len(key)+4)`. The 31 initial keys remain in every reachable ctx (merge updates never delete them), costing369 ASCII bytes. FinalUnknown's ten keys cost124; its three new constant values (cleanup, qualification, binding ID) cost97. Discarding all noncopied ctx values can only decrease size. Hence `B(FinalUnknown)<=B(ctx)-369+124+97 = B(ctx)-148 <=130924`. FinalConfirmed keys cost93 and its maximum three new constant values cost126: `B(FinalConfirmed)<=B(ctx)-150 <=130922`. This argument does not depend on Unicode content or the number of issues; it compares copied value bytes exactly and removes fixed ASCII keys.

For a fallback ctx, final output contains at most ten ledger objects plus small fixed run, numeric/boolean/constant values, key punctuation, ledger-array wrappers and the single constant issue. Charging4096 for that complete non-ledger remainder is conservative (no direct/queue/token/current/ENI/refs are exported). Thus either final is <= `10*11362+4096 = 117716 <131072`. This lies inside the old129236 envelope. A fallback normally forces hold and therefore FinalUnknown; bounding both outputs is stronger and does not rely on that routing.

## Limits and disposition

No actual-byte overflow was established for successful explicit variables/Outputs under the stated premises. A repeated failing 6L fallback may clear current before terminal evaluation, keeping cleanup UNKNOWN. It preserves selected currentArn, stopMode, original deadlines, positive ledgers and stopAttempted flags; the stop-dispatch path can still reach fresh STS, MarkStopAttempt and StopOwned. This is source reachability, not a promise that time, service identity, permissions or transport will permit those calls. Undefined/malformed result handling or expression failure may interrupt the graph earlier.

The new net fields are included, but no additional future subnet/AZ ledger fields are included; those require recalculation. Native execution, source acceptance, real guard/type behavior, service serialization/context, history/payload limits, IAM/current tags, timeout/Catch behavior, transport retries, survival and physical cleanup remain unqualified. The nested-array direct-count issue remains a source-shape finding even though the revised aggregate arithmetic covers its bytes. Parent owner must independently review this proof before using it in any source-admission decision.

The first invocation of the new arithmetic support script failed before producing JSON because its draft builder-count assertions expected11 Task calls and30 pass calls. A source-only regex recount found10 and31; those proof counts were corrected. The failure is retained in arithmetic-run-1-failure.txt. No candidate module was imported/evaluated/executed, and no candidate test was run.
