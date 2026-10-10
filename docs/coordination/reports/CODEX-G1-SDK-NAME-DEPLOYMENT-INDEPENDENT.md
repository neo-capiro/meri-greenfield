# SDK canonical name and deployment DATA independent review

10 October 2026 UTC. Codex review in dedicated `review/g1-sdk-native-name-deployment`,
base `92c5a9d430aa4e8d022b4b6697ff8ecd75662ce3`. Outcome: **SOURCE PASS for the
two-expression name repair; DEPLOYMENT DATA VERIFIED within the retained receipt
scope. Native execution, publication, risk acceptance and G1 remain unadmitted.**
No new source blocker was found in this bounded subject. The reviewer did not
author the owner NAME repair or deployment. The reviewer authored the earlier
source2 repair review `a7c15ed80e2c2edfd661ab866ba8e0724041782c`; this review does
not present those unchanged earlier assertions as a new independent result.

## Exact source subject

The owner report matches raw Git at `be33e877f680607af5e125da8c58fda1a816b678`;
the owner worktree was clean. Both closures and all twelve source members were
copied and hash-verified before pure imports. Source2 closure is 11321B/SHA256
`b249206aab260c3b54c439b53f2802d3e3f0dc1ef8a0f3ccc0c70cd74c722167`.
Source3 `closure-manifest.json` is 11751B/SHA256
`702d1c35c06c0a39c08683f9754207d58a8d5ed762f9cad33297cb91b4242a04`.
Only these raw substitutions occur:

| Member | Source2 | Source3 |
| --- | --- | --- |
| `sdk_binding.py` | `NAME = 'meri-sdk-' + RUN` | `NAME = 'meri-native-sdk-' + RUN` |
| `sdk-observer.py` | `NAME = "meri-sdk-" + RUN` | `NAME = b.NAME` |

The repaired binding is 14924B/SHA256
`884d891d93dfb30badd7a1d924ebe3426b8f6c8cc4c9ee78db3c039bed692de3`;
observer is 24455B/SHA256
`a21829bbfb7b312ebd0e4ed410ce7412839a98937dd457b5ee412b6ac9ad3031`.
The other ten members are byte-identical. The three canonical imports also match
raw Git at `e1d7dea29872176476c2455cc97f3ffa34b1ef92`. Eleven historical compiler
records and twelve references were verified separately; no compiler was invoked.

Full source inspection covers binding, all eight entrypoints, the fixed authority
inventory, canonical dependencies and the owner's three NAME preparation/check
sources. Controller, observer, execution ARN, reservation and input all use
`meri-native-sdk-f1bdbc76-068f-4d04-bc91-5abd2608f05f`. Execute/readback/publish,
cleanup and the conservative RUNNING/STOPPED-empty authority condition are
unchanged. The canonical name does not admit an action or reset D720/C900.

## Actual deployment evidence

The owner DATA seal is 15691B/SHA256
`2bb240b77832c10a4dd51d9cfa3bfba7f6a96e4f6c2ae5938dc0c9c6505de582`.
All 53 sealed files were byte-verified and copied: fourteen successful raw AWS
receipt triplets, two successful supervisor triplets, two action freezes and the
consumed execute reservation. All fourteen full argv arrays match the exact
caller/stack/change-set/machine/role requests, `capiro-dev`, `us-east-1`, fixed
11-element CLI suffix, 45s capture and zero automatic retries. Streams match their
receipt hashes; stderr is empty. Full caller identity is the exact account
967807252336 `user/capirocli`, UserId `AIDA6CVOOW5YCNOGMSALQ`.

The single `ExecuteChangeSet` receipt follows the exact CREATE_COMPLETE/AVAILABLE
two-Add change set. Its execute freeze binds reviewed source2, graph/template,
prior source acceptance, review and supervisor/preparer pins. The consumed nonce
and run/binding/output match that freeze. Actual execution used source2, not
source3. The execute supervisor exited0 at 20:10:45.391483Z; separate readback
exited0 at 20:11:57.549323Z. These are direct-child bounds, not descendant cleanup
proofs. The execution ACK alone is not used as deployment completion evidence.

Subsequent actual readbacks show the exact new SDK stack CREATE_COMPLETE and its
parameter `DefinitionObjectVersion=s.upW5EAgxUeDQwJWt_GpSbaSdzIAJyJ`. Server and
deployed templates equal the pinned 3808B/SHA256
`9b4d3c91099a154bc81d8561d94bfae6f3f1095dd497fb13629e20ec8f2b0f0d`
proposal, containing only the IAM role and Standard state machine. Actual machine
definition bytes equal the 145649B/SHA256
`1858d43c75d44b133271ee181da3748df7c22e174500120047f324839f342a39`
proposal. The machine is ACTIVE/STANDARD with the exact role, logging OFF and
tracing disabled. A second caller/machine capture corroborates the same result.

Role trust is exactly `states.amazonaws.com` plus the fixed SourceAccount and
machine SourceArn. The sole inline policy is `ExactQualificationRun`, exactly
matching the template; attached policies are empty, no permissions boundary is
reported, and MaxSessionDuration is3600. The policy retains SDK:2/exact cluster,
run/component/probe request tags, task-prefix/tag-limited StopTask, execution-role
only PassRole, and bounded read authorities. No additional worker or provider
role is introduced. These reads establish the retained policy configuration,
not a live IAM authorization or ECS execution test.

Both machine reads omit `revisionId`. Conditional publication remains HELD;
neither null nor a guessed value satisfies its revision gate. The fourteen
selected receipts contain no PublishStateMachineVersion, StartExecution or
RunTask, and local publish/start reservations are absent. This is scoped retained
evidence, not a global CloudTrail or privileged-admin exclusion proof. Deployment
does not supply the future full fresh45-response native authority gate.

## Independent local controls

After source pinning, one isolated Python3.12.14 child passed **14 guarded fake
controls** in0.422s. It imports the actual binding/controller/observer, denies
physical sockets/process dispatch and refuses canonical AWS adapter imports.
The actual controller main builds canonical start input, name, memory reservation
and D720/C900; the observer accepts that input and rejects original names, wrong
execution/machine/version/redrive evidence. Duplicate JSON, overflow and NaN
remain rejected. Fakes for admission, authority, persistence, adapter and an
explicitly unpublished synthetic version were finally restored. No operational
reservation was written. This proves the name seam, not those mocked gates.

One Node24.19 child evaluated the **actual deployed GuardInput** using pinned
JSONata2.0.6, passing **18 literal expected outcomes** in0.453s. Canonical name
passes; original name, mismatched context, foreign run/binding/probe/machine,
extra/missing keys, bad time types, future time and 30s-plus1ms fail. Exact start
and 30s boundaries pass. The actual fake-controller-produced body also passes.
The version-ARN-as-base-machine-context case fails. Local evaluation does not
establish AWS context casing/semantics or publication/version compatibility.
Root's earlier six controls are retained and overlap with these outcomes; they
are not counted as additional live coverage.

Both children ran once under60s direct-child bounds with raw binary streams,
post-completion512KiB checks, timestamps and source/runtime pre/post hashes.
No child timeout/failure or unchanged positive rerun occurred. DATA checks also
verified the two supervisor argv/freeze hashes, eight additional pinned evidence
copies and the owner's exact narrow11-element suffix correction. Source2/source3,
original execution receipts and prior failures stayed intact.

## Qualifications and handoff

The original owner DATA checker failed before output by comparing a12-element
tail with11 expected elements; v2 changes only that slice and remeasures the same
DATA, without AWS replay. Both sources and the diagnosis are preserved here.
This reviewer first read the allocation's nonexistent `source-closure.json`
instead of actual `closure-manifest.json`, and later made one wrong-worktree
local projection read. Those terminal read diagnostics are recorded separately;
neither dispatched a helper/AWS operation or changed a verdict.

External hashes and protected owner files remain a trust assumption. Python
stdlib/AWS CLI transitive files are not a full frozen runtime; historical closure
prose about adapter installation/imports is qualified by the owner report. No
new root native supervisor is assumed. Review performed zero AWS/provider/model
calls, helper CLIs, installs, native launches or Hermes invocations.

Evidence is under the review worktree's ignored
`.task-inputs/CODEX-G1-sdk-name-deployment-review-1/`: `data-verification.json`
105352B/SHA256 `fbb1fe1b6757b4b992e30f05dea4df3a59c4a4c4a98f476d0e367e66ca9c31b7`,
`action-binding-verification.json` 8878B/SHA256
`0803d64fd606dfd3ee7596d33e3dafce0f87e42179dfb5f7c0a5fa1c5efec829`,
both control sources/results and raw process receipts. Final manifest is emitted
after the sole-report commit. Native Messages/tool/stream, decoder/interrupt/
resume, immutable publication, fresh admission, physical STOPPED and deadline
cleanup remain separate unrun gates. All49 worker findings plus five older
vendor-open findings remain OPEN; paid inference$0/$10 and G1 OPEN. This review
grants no execution, residual-risk, production, Office/browser or cutover approval.
