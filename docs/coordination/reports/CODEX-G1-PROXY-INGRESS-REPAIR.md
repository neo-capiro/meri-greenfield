# Proxy ingress downstream-resume repair

Codex integration owner; dedicated branch `task/g1-proxy-ingress-repair`, exact
candidate base `fa1f4000dee7d57a9229e2f803dd9dde895afd5c`. The author candidate stays
unaccepted until its independently reproduced stale-pull defect is resolved.

Proportionate outline before editing: preserve `GrantAdmission` as the state owner
and `IngressAdmission` as the direct transport boundary. Recheck current grant/run/
fence and peer lease after downstream resume, before starting another owned provider
iterator pull. Add two consumer-driven regressions that revoke the grant or expire
the peer while suspended at a yielded item; assert zero second-pull side effects and
owned iterator closure. Keep existing tests and the independent continuous watcher
deployment requirement. Own only `runtime/ingress.py`, `test/test_ingress.py` and this
new report. No shared schema, dependencies, service, database or cloud changes.

Changed behavior: after every yielded item, fresh state and peer checks now precede
the next `anext` task. Revocation or lease expiry while the consumer is paused closes
the owned iterator without entering a second provider pull. Existing post-pull checks
still reject revocation that happens inside a pull.

Focused verification:22/22 tests PASS in5.138s, including both new regressions and all
20 original cases. The unchanged5s quiet-stream poll was exercised. Raw child output
and three-file pre/post byte pins are retained at
`.task-inputs/CODEX-G1-ingress-repair-check-1/`; source remained stable. The initial
direct `python -I -m unittest` invocation failed module discovery because isolated
Python omits the working directory from its import path. That diagnostic remains in
the root tool transcript; the corrected fixed wrapper explicitly inserts this
dedicated repository root. No application failure is concealed by that correction.

This repair does not qualify actual ECS/TLS identity, native LiteLLM key composition,
backpressure-independent revocation or G1. Async-generator polling still pauses while
the downstream consumer is suspended; a server-owned continuous watcher remains
required before claiming deployed revocation within30s. No server/database/provider,
cloud, Docker or Hermes execution occurred. Distinct re-review is pending.
