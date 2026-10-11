# Browser history timestamp repair — source only

The canonical history decoder now accepts the measured AWS CLI offset/microsecond timestamp form without broadening embedded EC2 `CreateTime`. The original strict parser and `fixtureHistoryTimestamp` export remain unchanged. The new `fixtureHistoryEnvelopeTimestamp` is used only for history envelope/start/order/Task event times. Raw service captures, Task payload strings, source/version/input identity, original clock, pagination, ownership, one-create/first-delete, UNKNOWN and absence/runtime-false rules remain unchanged.

Dedicated worktree: `C:/dev/main/meri-greenfield-worktrees/g1-browser-history-timestamp-repair`, branch `task/browser-history-timestamp-repair`, original base `266fc01ef0c6e3229714960a2e2dc78c23cd89d6`. AGENTS/standards and canonical owners were read; `.task-inputs/history-timestamp-repair-1/OUTLINE.md` preceded edits. Tracked ownership is the two history modules, existing history test and this report. A separately root-authored bootstrap context-time repair is incorporated by exact authorized cherry-pick, separately attributed below.

## Timestamp boundary

The history-only parser accepts finite safe numeric seconds with the existing nearest-millisecond conversion; strings have exactly four year digits, calendar/time fields, optional 3 or 6 fractional digits, and explicit `Z` or signed `HH:mm` offset. No fraction is also accepted because CLI `datetime.isoformat()` emits that when microseconds are zero. It rejects malformed calendars, month/day rollover, leap seconds, 24-hour time or offset, offset-minute overflow, timezone absence, other fraction lengths, whitespace, trailing newline/data and non-string/non-number inputs. `setUTCFullYear` avoids JavaScript's special years 00–99 behavior. It validates local calendar fields before subtracting the bounded offset; integer microseconds round deliberately to milliseconds, including second/day/year carry.

This is a transport representation repair, not authority. Parsed event times still undergo the existing original T0/create window/C/order checks. The unchanged EC2 parser accepts only its old canonical millisecond-Z string profile at `volume().CreateTime`; offset and six-digit EC2 strings remain refused. No generic recursive date normalization, global AWS config change, capture override, new timestamp package or new parser framework was introduced. Step Functions context `Execution.StartTime` is a distinct root-owned ASL boundary; this task's envelope parser does not pretend to qualify that boundary.

## Checks actually run

Pinned Node24.19.0 ran once:

`node --test infra/browser-enforcement/fixture-volume-history.test.mjs infra/browser-enforcement/fixture-volume-probe-provenance.test.mjs`

The actual child returned0 in0.500 seconds under a60-second direct-child timeout: **54PASS/0FAIL/0skipped**. This includes36 original history groups,6 new timestamp groups and12 existing managed-bridge groups. New groups cover measured offset/six-digit/no-fraction/UTC forms and a half-hour offset; safe numeric/canonical compatibility; rounding ties, leap-day and year carry and year0099; malformed/type profiles; both legacy and bootstrap complete reconstruction with CLI envelope strings and retained raw bytes; explicit EC2 profile separation; original start/create/C/order refusal and the exactC capture boundary. These are synthetic DATA checks, not service captures or full ASL replay.

`tests-1/{stdout.bin,stderr.bin,process.json}` retains binary output, argv, timestamps, timeout, exit, runtime and source pre/post identities. All source/runtime records were stable; stderr was empty. After saving that complete successful envelope, the Python reporting helper failed while printing Unicode checkmarks through Windows cp1252 (`UnicodeEncodeError`). That is retained as a reporting failure; the Node suite was not replayed. A separate DATA-only validator checked saved hashes/exit/stability/counts, the original strict parser body, all36 original history test bodies (allowing only the import addition and CRLF/LF Git normalization), and the exact history import/EC2 call replacement. No assertion was deleted or weakened. Git diff whitespace checking passed.

The capture helper uses ordinary bounded direct-child PIPE capture, with finite postbuffer evidence rather than a streaming memory cap or process-tree guarantee. No server, SDK, CLI, provider, AWS, native engine, Docker, owner admission, T0 or operational reservation ran. Bounded Git/PowerShell/Python DATA preparation and pinned Node pure tests are explicitly included in this source qualification.

## Mechanical pack promotion

The accepted executor is `fe706f2e690841f97fff8a47d945212077f77732`, original pack `g1-browser-managed-import-repair/.task-inputs/managed-executor-import-repair-1`; accepted supervisor is `eded6d2eca31694973873ddad9d83473c89ac397`, original pack `g1-browser-managed-probe-supervisor/.task-inputs/managed-probe-supervisor-1`. Their immutable bytes, metadata, consumed records, source-origin roots, SOURCE10 and runtime remain untouched.

The first uninvoked promotion draft is retained under `executor/` and `supervisor/` with `promotion-proof.json`. Subsequent static source inspection found that the old supervisor's relative `JOB=HERE.parents[1]/...` selected the wrong path at the newly nested location. No candidate was imported or acted. The final separately named promotion corrects only that fixed path expression and records inverse byte equality for every literal replacement; process/Job algorithms remain exact. This is an explicitly retained preparation defect, not a successful operational attempt or a reason to erase the draft.

Final promotion identities, root prerequisite and closure verification are recorded in the completion appendix and finite seal. Fresh owner-created freeze/admission/supervision, complete genuine managed capture, original T0/C and current caller/read-only role still do not exist from this task. Old operational slots and all global consume paths are preserved. Nothing here grants another mutation, resets a clock, authenticates capture origin or proves physical absence.

## Remaining gates

Distinct source/closure review and root acceptance precede any operational work. The promoted sources are prepared, uninvoked candidates. Managed history reconstruction remains partial observed Task/ownership evidence. Actual history capture, live TestState wire, prearmed cleanup, physical volume absence, managed survival, isolated host/browser controls and G1/security acceptance remain open. Existing49 findings/22severe plus5 older vendor-open findings and Office deferral are unchanged. Current Capiro/Meri is untouched.

## Completion appendix

Root prerequisite `b164e15625eed5d01d3300846e1fb50e830a0955` was reviewed as a complete two-path diff and cherry-picked as `b19fa273ce03db3196f4eae697f03a37018d351d`. Its bootstrap-only context guard accepts the documented0/3/6/9 fraction lengths and retains the submillisecond tail at inclusive upper bounds. The shared ISO expression's default remains the exact old EC2 profile; root's retained29/29 JSONata/activation/workflow receipt and original-product byte oracle are separately attributed, not this author's executions. No additional source blocker was established by the diff read. The original mistaken abbreviated commit supplied by root failed Git lookup; corrected full SHA was then used. No partial cherry-pick occurred.

After incorporating that changed workflow dependency, only the six new timestamp groups were rerun against combined sources: `node --test --test-name-pattern="history CLI|history microsecond|history date|all event envelopes|history envelope profile|CLI envelopes" infra/browser-enforcement/fixture-volume-history.test.mjs`. Actual6PASS/0FAIL, exit0,0.250 seconds/60-second bound; complete binary/stable pre/post envelope is `combined-targeted-1/process.json`. The corrected reporting helper escapes console Unicode. The36 original history and12 bridge groups were not repeated; their earlier54PASS receipt remains distinct. No bootstrap context or old operational suites were replayed here.

Final packs are `.task-inputs/history-timestamp-repair-1/executor-2/` and `supervisor-2/`:

| Source/closure | SHA256 |
| --- | --- |
| executor-2/executor-closure.json (381,552B;1,020 records) | `55e522fc9f35d1a7634425d34477404691b9c751cacd9f3309acf998a91451e1` |
| executor-2/managed_binding.py | `150542c5e78f9e3922912aec29a844cf69fc0e0984dda652273945d56dd74099` |
| executor-2/managed_executor.py | `9408c0780f152fdb40605971770061aa7b8c5587b389d9d4045b684479ae9f93` |
| executor-2/source-origin.json | `42c0475a8abe79b771fc82109b09422fd24083c5ce41fedc4c058a496c665f70` |
| supervisor-2/supervisor-closure.json (1,175B;4 records) | `c0a0235aaef32da014fd2546bfd22aea610b05c5001e6e712f6f0cb1fb3ded3f` |
| supervisor-2/probe_binding.py | `7313665c4ed0899948a636b95a662274c0b39d12b688c5a9ce90a81e1128c7a6` |
| supervisor-2/run-managed-probe.py | `57f18557a363b157c3857f85ab7ad172903d5ebb9d83ea0ee17526040598395f` |

`promotion-proof-2.json` binds23 copied members and1,029 original protected record occurrences. Of the eight canonical JS copies, three changed: the two owned history modules and root's workflow (`b8eedd369fbff65be7347af80fcfeb5ea6bd17a49e877fb9ca7a183aba931caa`). The other five are byte-identical. SOURCE10's twelve files, inherited969 Python runtime records, Node,27 original actual stage references, predecessor inventory and runtime inventory remain unchanged. New source-origin bridge records refer to this fixed canonical worktree; original source-origin data and its roots are untouched. New binding changes exactly PACK, fixed bridge origin root and its metadata hash. Entry changes exactly PACK and binding hash. Supervisor binding changes HERE/PACK, explicit fixed Job path and executor closure/binding hashes; thin supervisor entry changes HERE and binding hash. Every replacement has an inverse byte-exact and AST-equivalent proof. `probe_process.py` and canonical6726-byte Windows Job source remain byte-exact, with unchanged600-second/C/440-second margin,8MiB/1MiB stream limits, suspended assignment and cleanup algorithms.

Promotion ran DATA preparation only; neither final executor, supervisor nor their candidate imports were invoked. The final finite seal remeasures old/new closure references and current report/raw Git. It is not an owner supervision freeze or an admission. Source paths and hashes must be reviewed again before any separately admitted managed action; no old namespace or consumed attempt may be reused. Tool-only setup failures (incorrect report/path guesses and one unsuccessful report patch anchor) remain transcript evidence; they were not candidate check failures or hidden retries.
