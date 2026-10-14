# Independent native session reader review

Production source reviewed and executed: `ca38a341a98b160c4ba8091bd651dce0a3a6d75a`.

Verdict: **ACCEPT_SOURCE_ONLY** for `apps/runtime/native-authority/session-registration.mjs`. Genuine supervisor launch/provenance, task verifier, admission, physical isolation and product session/output remain HOLD. A borrowed genuine ChildProcess supplied by a trusted launcher is an explicit precondition; instanceof checks do not authenticate a task or executable. The worker's callback is not independent authority.

The observer parses original stdout before forwarding complete chunks to its downstream consumer. Only its read port crosses the existing mount into the canonical durable session owner. It derives the project/main key from trusted original workspace/configuration plus complete init and main mirror frames; first witness identity/hash and original expiry remain stable. Repeated main batches and same-session subagent frames do not replace the witness. Read cancellation/deadline and bounded waiters retain ownership, and observer cleanup leaves physical process termination to the launcher. The durable owner reads this witness only at registration; later append revocation still belongs to the native verifier/current admission.

Executed once, without SDK/provider/database/cloud calls:

```text
python3 docs/qualification/candidates/native-session-supervisor-20261014/independent/capture-reaped.py baseline-ca38 node --test docs/qualification/candidates/native-session-supervisor-20261014/independent/controls.test.mjs
```

Result: **6/6 PASS**, exit0, source diff0 bytes, no timeout or group kill, owned process group absent. Capture is Linux child-subreaper owned; raw stdout/stderr hashes and exact source binding are in `baseline-ca38.json`.

Controls check independent observable outcomes: split multibyte UTF-8 and reversed main/init delivery with repeated batches preserve forwarded bytes and stable receipt; subagent-only frames cannot establish a main receipt and foreign session paths permanently refuse; unterminated stdout EOF invalidates future reads while the borrowed child remains alive; hostile request/accessor/proxy inputs execute zero traps; canceled callers release waiter capacity without revoking valid native observations; clock rollback permanently refuses renewal.

Initial static root SDK probe review: **HOLD before execution**, pending post-import abort check, bounded second confirmation after SIGKILL with temp retained on uncertain cleanup, and error-free parser completion plus retained raw-frame/hash correlation. This is probe hardening, not a production reader failure. Do not claim deployed authority from the planned actual local SDK mechanics through synthetic authorization/SQL.
