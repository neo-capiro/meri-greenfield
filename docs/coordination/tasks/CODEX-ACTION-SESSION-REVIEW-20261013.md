# Independent opaque action session review

Base `9815492c`, isolated `/tmp/meri-action-session-review-20261013`, branch `review/meri-action-session-20261013`. Reviewer owns only new `apps/control/action-host/session/*independent.test.mjs`, this task, matching review report and `action-session-20261013/review/**`. Twenty-minute source-only task; subprocesses bounded240 seconds; no recursive delegation, native/provider/Clerk/customer access, installation, shared public/frontend changes or publication.

Frozen before candidate implementation:

- Native identity is verified by a trusted configured port; no JWT decoding or caller tenant/actor/run/client authority. Browser hints select requested context only. Owner must return closed fresh receipts bound to exact verified identity, full current binding, selected client/scopes and stable revision.
- Issued bearer is opaque, random, bounded and stored by digest; never contains caller claims or application secrets. Fixed HTTP issuance has strict method/path/JSON/header/body limits, no approval creation or command execution. Tokens cannot select source/authority ports.
- Each host use rechecks current native identity/context authorization with original issuance provenance, expiry cap and stable revisions. Cross-tenant/actor/client/run/binding substitution, expiry/revocation and delayed/aborted receipts fail closed. No issued token after cutoff or unobserved late owner result; hostile data/getters/proxies do not execute.
- Actual accepted Fetch application and query→draft→prepare→separate existing approval/execution must be composed, not callback-only success. Original immutable proposal correlations and current selected scopes remain enforced. No second policy, SQL store, approval or budget implementation.
- Initialization is inert. Owned session closure/revocation is explicit; borrowed application/services/pools are not disposed. Existing source and tests preserved except an exact root-authorized additive case seam if later allocated.
- Test source/packet hashes, failure preimages and raw streams retained; ordinary inert source and loopback tests only after approved interface/coherent freeze. Source acceptance does not qualify live native auth, credential storage, process restart, TLS/CORS/frontend deployment or current rights.
