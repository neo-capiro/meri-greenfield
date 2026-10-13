# Pinned Capiro endpoint source integration

This is an explicit source qualification fixture, not a production mount. It executes Capiro PR2449 `60cf2e51129f8358e6afe5fc600ffcdb6de01759` (tree `1b2c9f6e975a47397f08d34563087455ed1c2242`) against synthetic external ports and passes its serialized receipts into unchanged canonical Meri receivers. No native credentials or external network/database calls are needed. Existing catalog availability and source activation remain unchanged.

The implementation outline was committed before code. `source.mjs` reads exact Git blobs from a separately supplied repository, verifies all nineteen source/dependency hashes and the TypeScript compiler, and compiles only in memory. Private source bodies and emitted JavaScript never enter Meri Git. Full middleware, Clerk, role guard, tenant store and client-scope owners execute. Exact AST-selected Meri endpoint, conversation/client lookup, scope parser and authorization helper methods retain their pinned bodies and decorators. Missing or changed source, compiler, import or selected method fails closed. Selection hashes are available in `native.sourceMetadata()`.

`endpoint.mjs` composes a real middleware-created request with a separate injected middleware provider sharing the pinned module's provenance WeakMap. It executes the actual RolesGuard before the controller, using decorator metadata to derive the two fixed routes, status and no-store header. Its Fetch-to-Express fixture uses case-insensitive header replacement. `fixture.mjs` supplies synthetic Clerk SDK and Prisma records; its query engine evaluates the emitted predicates, including tenant/user conditions on wall grants. `meri-fixture.mjs` reuses the accepted Meri host/lookup/command fixture and the actual authority HTTP client, context adapter, opaque session owner and public response receiver.

## Run

Supply an existing read-only Git object repository containing the exact commit and the exact TypeScript5.9.3 compiler admitted by `pins.json`:

```sh
CAPIRO_SOURCE_REPOSITORY=/absolute/capiro-source.git \
MERI_TYPESCRIPT_MODULE=/absolute/typescript/lib/typescript.js \
MERI_REVIEW_SOURCE_ROOT="$PWD" \
node --test apps/control/action-host/application-adapters/cross-repo/integration.test.mjs
```

Source retrieval is a separate authorized preparation step. Imports do not fetch source, allocate services or start listeners. No CLI or production export is added. The compiler is Apache-2.0; its version, exact bytes and SHA are pinned. This author run borrowed an existing compiler cache; no package download, install hook, lockfile or dependency declaration changed.

For focused review, `createCrossRepoMeriFixture({sourceRepository,typescriptModulePath})` returns `{f,native,client,adapters,host,hooks,readIdentity,readContext,send,close}`. `native.state` exposes only synthetic test rows and hooks; `native.stats()` identifies mocked external boundaries. `send(route,body,credential)` makes a real Fetch Request to the accepted Meri application and validates action responses with the public receiver. Always call `close()`. The lower-level `createPinnedCapiroEndpointFixture({sourceRepository,typescriptModulePath,now,principal,conversationId,clientId,expiresAtMs})` exposes the fixed in-process transport plus state; it never opens a server or a database. Fixture bearer strings are synthetic and must not be used as real credentials.

## Evidence and limits

The author controls cover exact wire shape, immutable source/compiler pins, separate middleware provenance, stable revisions/original expiry, foreign/missing/revoked wall grants, current native-session revocation and substitution, tenant/role/membership changes, conversation/client mismatch, and Meri current-run substitution. The full path issues an opaque action session, queries recommendations, drafts a task, prepares an immutable pending proposal, refuses unapproved execution without effects, explicitly approves in the fixture, executes once, replays the same proposal and refuses after native-session revocation.

Initial22/23 exposed a fixture header-casing merge error (`no-store, no-store`). The fixed fixture uses `Headers.set` to match case-insensitive native header replacement; all original assertions pass23/23. Failure and source preimage remain in Git.

No Nest application/bootstrap, decorator runtime, deployed HTTP listener, real Clerk backend, actual Prisma/PostgreSQL/RLS, worker, model or paid provider is qualified. The shim captures Nest metadata and supplies DI explicitly. It runs only ordinary active client-bound conversations; research-portfolio loading fails explicitly if reached, rather than claiming that broader branch was exercised. Middleware provisioning/activity/audit ports are mocked and counted, so this is not a claim of globally side-effect-free native invocation. Meri current-run/grant/budget/command persistence ports remain the existing synthetic test owners. The real source endpoint's promise timeout is logical cancellation, not proof of physical SDK request termination. Production acceptance still needs its separate live owner evidence.
