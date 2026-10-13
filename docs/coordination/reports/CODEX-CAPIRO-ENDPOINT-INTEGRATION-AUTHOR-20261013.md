# Capiro endpoint source integration — author receipt

The new fixture executes exact published Capiro application-authority endpoint implementations and feeds their serialized responses into canonical Meri adapters and the existing opaque-session/action application. This is executable local source integration with mocked Clerk and Prisma; it is not deployment, native authentication, PostgreSQL/RLS or current source qualification.

## Identity and ownership

- Meri base PR50: `a0614e7e16d6f92d0ca6eaa192cea7c5def21ec8`.
- Capiro PR2449 source: `60cf2e51129f8358e6afe5fc600ffcdb6de01759`, tree `1b2c9f6e975a47397f08d34563087455ed1c2242`.
- Exact eight reviewed Capiro files plus eleven dependency inputs are admitted by byte count/SHA in `cross-repo/pins.json`. Twenty-two selected AST bodies are separately hashed in `author/source-identities.json`; no private body or transpiled output is committed.
- Source freeze: `9063f707e2ac618b0dcf5bb0c5165d13914748e6`; implementation preimage/failure: `e0c7aac80fe233b1f58597c7d6fa108259c336e4`; outline/pins: `29fe8a9cc34aa0b058dc21f3864fa5ef3df3052e`; docs/comment correction: `375bdddc412a5a44edc0892341b4b0950666a396`.
- Dedicated worktree `/tmp/meri-capiro-endpoint-integration-author-20261013`; branch `task/meri-capiro-endpoint-integration-20261013`. Source repository under `/tmp` is separate from the preserved shared Capiro checkout.

`cross-repo/source.mjs` owns immutable local source admission and transient TypeScript compilation. `endpoint.mjs` composes actual middleware provenance, separate injected provider, Clerk service, role guard, tenant context, client scope and selected Meri methods. `fixture.mjs` owns synthetic SDK/Prisma records and evaluates emitted tenant predicates. `meri-fixture.mjs` reuses accepted Meri owners. `integration.test.mjs` is the focused executable contract. Imports are inert; fixture construction only reads local source and allocates in-process synthetic owners.

The only old files changed are the explicitly allocated current application-adapters README and first-line comment in `authority-http.mjs`; its executable bytes are unchanged. Historical request reports, public package, catalog, lockfiles, production handlers and original assertions are untouched.

## Verification and retained failures

`initial` retained 22/23 passing assertions. The foreign-tenant grant was correctly refused, but the fixture's case-sensitive object spread let native Response combine differently cased Cache-Control fields into `no-store, no-store`. `9063f707e2ac618b0dcf5bb0c5165d13914748e6` replaces fixture headers with case-insensitive `Headers.set`, matching native replacement semantics. The original assertion remains unchanged.

`repaired` passes 23/23 in 8.757 seconds. The tests execute the middleware-created provenance through a separate provider, actual current Clerk session path, closed identity/context DTOs, stable revision/original expiry, tenant/user wall predicates, removed/revoked/foreign grants, changed membership/role/principal/session, conversation/client refusal, rechecks during asynchronous owner reads, and a foreign Meri fence. The full chain obtains an opaque action session and runs query → draft → pending proposal → unapproved refusal with zero effects → explicit fixture approval → one task effect → same-proposal replay → native-session revocation refusal. No approval behavior was added or weakened.

`source-audit` passes: all 11,497 original Git entries accounted for; 11,495 unchanged, with only the two allocated old files changed. All 19 source/compiler-related pins and 22 exact selections verify; fixture construction issues zero endpoint requests. No package download/install/hook occurred. The existing TypeScript5.9.3 Apache-2.0 compiler cache was checked by exact byte count and SHA; its body is not vendored.

The three bounded capture process groups518232,519379,523074 were physically absent on final cleanup, with no timeout or kill. Both author-owned dependency symlinks were removed; borrowed compiler/source repository and other owners' files remain intact. Raw initial, repaired and audit captures plus cleanup evidence are retained under `docs/qualification/candidates/capiro-endpoint-integration-20261013/author/`. The manifest binds source/docs/evidence without storing private implementation bodies.

## Handoff and remaining gates

Run the exact command in `cross-repo/README.md` with explicit source repository/compiler paths and `MERI_REVIEW_SOURCE_ROOT` pointing at the composed checkout. No automatic source fetch, listener, CLI, credential acquisition, DB connection or production activation is added.

The fixture captures Nest decorator metadata and supplies dependency injection; it does not bootstrap Nest or qualify deployed HTTP. External Clerk and Prisma are mocked. Only ordinary active client-bound conversations are exercised; the research-portfolio loader fails explicitly if reached. Canonical Meri current-run/grants/budget/persistence and tool source are separately labelled synthetic ports. Capiro middleware can provision, heal, update activity and audit in real operation; fixture execution does not prove physical side-effect freedom. Source Promise races do not prove physical Clerk request cancellation. Existing production descriptors/default source flags remain unavailable/off. Live Clerk session behavior, RLS, deployment and native authority remain independent gates.

Independent source controls passed 35/35 against exact9063f707 plus docs-only375bdddc, as reported by the separate reviewer. Its final packet verdict is independent of these author passes.
