# Native ancestor supervisor source continuation

Status: **SOURCE CANDIDATE; independent review pending. Native execution HOLD.**
Base PR16 `e8d2c0d0e5db8fb01ba2df26c4eb3f79b296c0b5`. The source-only
adaptation lives under
`docs/qualification/candidates/native-supervisor-20261012/author/`. No production
runtime, canonical diagnostic, inventory, capture, contract, image or dependency
was changed. No target module was imported or executed and no native child or
real thread was created by the checks.

## Exact input and preservation

The parent reader reported verification of the private 39,189-byte ZIP with
14 members, SHA256 `6b5a503b242def09dec995110ae8e645fb3413cf4659b4df81a1a9d493499ee0`.
The author did not repeat Library retrieval. HTML operator decoding of the
relayed supervisor produces exactly 11,124 bytes, SHA256
`e37894e22b3bb290c8b8b8fb7aaf35f2d7b2868cc2d469214913953d1b4fc9df`.
Raw relay and derivative remain private under restricted directory/file modes;
private paths and bodies are not in Git. Current source identity is verified;
the historical command did not pin wrapper bytes and is not retrospectively
attributed to this source. The proposal's LF relay derivative does not match the
original member hash and is labelled a derivative only.

The current wrapper selected the old executable from the original receipt and
used a fixed occupied destination. Its 15-second interval excluded pre/post
verification and packaging, permitted additional waits and could not preempt
process creation or pipe closure. Its retained stream buffers were capped but
thread completion was an EOF proxy. These are source findings, not observed
native failures. The complete findings and line references are in
`author/current-source-review.json`.

## Concrete repair and boundaries

`run-supervised.py` retains the one unchanged ancestor diagnostic and exact
original receipt/repository/output binding. It explicitly selects the new
reported executable through a private action record, with the known 91,648-byte
SHA256 identity, and independently retains the known diagnostic and original
receipt hashes. It reuses the canonical inventory's ordinary-path, reparse,
single-link and named/opened identity predicates; no canonical guard was edited.
Its JSON reads are bounded at the descriptor, with cap+1 growth rejection,
opened/named metadata brackets and the shared clock. The original source Git
checks use the same capture routine; an exact Git executable identity is now
required instead of ambient PATH selection. A fresh destination is admitted
before exclusive directory/file creation. No original evidence is overwritten.

`supervision.py` owns only direct-child capture. Its explicit spawn/thread/sleep
ports let the fixed wrapper compose the actual native operations while source
checks use inert objects. One budget begins at wrapper entry, reserves action
through second10, termination through second13 and all drain/evidence work
through second15. Every wait is clipped to the remaining absolute budget;
late returns never reset it. Both stdout32,768 and stderr65,536 retained-byte
caps reject overflow. EOF is recorded only for `read()==b''`, independently of
reader errors/settlement. Unsettled readers prevent a mutable snapshot and their
streams are not closed under them. A late owned child gets a best-effort kill,
but uncertain exit, failed cleanup and blocked native calls remain HOLD.

This is **cooperative scheduling, not a proven hard15-second watchdog**. Python's
[subprocess documentation](https://docs.python.org/3.11/library/subprocess.html#subprocess.run)
explicitly limits timeout handling during initial process creation. Neither a
clock check nor a source fixture establishes a deadline across blocked native
operations. The source declares `hardTotalProven:false`, direct-child-only scope
and no descendant/runtime acceptance. A separately qualified enclosing watchdog,
its exact host/process ownership and its final time/exit evidence remain needed.
No artificial watchdog boolean or self-issued admission receipt was introduced.
The budget begins on entering the wrapper function, after interpreter startup
and module loading; the enclosing watchdog must cover that earlier interval too.

The native entry is deliberately unadmitted. Missing immutable source-verification
and complete prior-evidence manifest hashes cause explicit refusal before any
filesystem or child operation; missing exact Git path/hash/size likewise refuses.
The callable future composition has a concrete native adapter, but no executing
CLI: direct entry returns HOLD. This is a reviewable partial repair, not a
ready-to-run wrapper or permission request. Later qualification must complete and
review those exact bindings, identity evidence, actual supervision and action
authority together. Packaging/upload is a separate action and cannot extend this
budget. Failure evidence may remain partial when the shared budget expires;
the enclosing owner must preserve its independent receipt.
Exclusive raw file writes and recorded stream hashes are not verified evidence
publication. This draft records `evidencePublicationVerified:false`: final
readback, fsync and complete membership validation remain unresolved. The
canonical inventory writer owns those checks but expects an unallocated slot
and removes its own partial files on failure; adapting the pre-reserved slot
and failure-preservation semantics requires a separate reviewed change rather
than silently substituting that writer or claiming equivalence.

## Identity evidence limit

The parent reports matching candidate named/opened executable identity and
matching bytes, alongside false complete-field bracket and bounded-hash flags.
The full supporting records and exact original predicate have not been relayed
to this author. Metadata version and a matching hash do not prove distributor
trust or loaded DLL closure. Access-time observations must be described
separately from device/file identity, regular-file type, link/reparse state,
size/content and mutation timestamps. No access-time exception is applied here;
the original canonical comparison and the failed private observation stay
unchanged. Full bracket acceptance, hostile/reverted-replacement resistance and
historical source identity remain unestablished.

## Verification and preserved findings

`source-checks.py` parses the actual wrapper as AST without importing it. Only
the new lifecycle's `Refusal`, `Budget` and `capture` definitions are selected
from its AST and compiled into an isolated namespace. Every process, stream,
thread, clock and sleep input is an inert Python object; there is no Popen call,
real thread, target diagnostic/candidate execution or native syscall.

First, second and third author captures passed22 controls each. Those source
hashes and outputs remain separate. Root and independent review found an
unbounded second JSON open after prehashing and unguarded `is_alive` calls; both
were repaired. The action-deadline check was corrected before the independent
reviewer's first replay, so there is no claimed failing original replay for that
case; any removal control is explicitly a mutant. Independent chronology is
preserved in the review lane: `first-inert-results.json` passed60/60; adding the
throwing reader-state control produced60 pass/1 fail in
`reader-status-before.json`. After that repair, `reader-status-repaired.json`
and the first frozen replay passed72/72. The reviewer then added a late-read
byte-accounting control against exact freeze
`0217137304aa80dab662a4e98b934b30a9742cbc`: `late-read-before.json` records74
pass/1 fail. A stderr read returned three bytes at second16; HOLD and refusal
were correct, but observedBytes incorrectly remained zero. The exact failing
source and raw evidence remain preserved in the review lane.

The narrow follow-up records the type, actual returned-byte count, bounded
retention and overflow before the post-read deadline check. A late return still
refuses without accepting EOF, issuing another read or resetting the budget.
New author controls cover the three-byte late read and a65,537-byte late stderr
read retained at65,536 bytes. The follow-up author capture passes27/27 and leaves
the original25-control freeze and all earlier outputs unchanged. Final exact
independent review is pending; no earlier failure is erased or reclassified.

The current synthetic controls do not qualify Windows process creation, real
thread/pipe behavior, full filesystem bracketing, authentication, runtime
provenance, or physical native teardown. No diagnostic, collector retry, build,
runtime/database/cloud action, paid model or G1 admission is authorized or run.
