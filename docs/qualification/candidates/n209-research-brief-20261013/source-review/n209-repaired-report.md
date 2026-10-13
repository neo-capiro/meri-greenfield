# First repaired N-209 source review — HOLD

Reviewed source `57c8f7b99043938666b8f29f1e61e81c96c81d39`, tree `b2729e85e4bbf3647129128edabb455d6847f96b`. The original two blockers are repaired: each expected exact subject filter must occur once, and frozen public package/mapped current/index bytes are exact again. Full generated/type/public check passed, including71 public controls. Existing213 focused application/contracts/CLI controls passed.

The original37 independent controls pass with the documented approved400→403 mapping; refusal still occurs before budget reservation/generation. The reviewer added stronger generation/charge/settlement/unknown assertions and retained the exact original test preimage plus mapping. No semantic or authority assertion was dropped.

Decision: **HOLD** on two new private authority-binder findings. The expanded suite observed37 pass /2 fail out of39; both fail independently of any model, source, native DB or production credential.

* Borrowed receiver is not preserved. `own(artifactOptions.authority,...)` returns an inert shallow clone, so `authority.check(call)` calls the borrowed function with that clone as `this`. A port expecting its original owner fails. Preserve the original approved receiver while capturing its validated method. The exact call/resource/signal reference should continue to reach the canonical owner unchanged.
* Prepared context is not immutable at the execution comparison. `prepared.context` is a mutable detached snapshot. The binder hashes it at each check. Mutating its evidence hash after binding also changes `bound.context` when it is the same context object; a canonical intent using that altered context is admitted and the borrowed owner runs. This bypasses correspondence to the compiler's original context hash even though the request text/parent remain pinned. Capture the originally admitted context digest at binding and compare every execution to that immutable value.

The private binder should remain a recipe correspondence check that delegates all policy/current authority to the existing owner. No HTTP or generated contract change is necessary. This reviewer changed only assigned tests/evidence, preserved failed runs and did not alter implementation.
