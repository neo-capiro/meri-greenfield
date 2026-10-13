# Exact Capiro endpoint integration

This continuation consumes the implemented Capiro application-authority endpoints from independently reviewed draft PR2449 and runs their responses through the canonical Meri authority, context, opaque-session and action application. The local chain now exercises query → draft → pending proposal → unapproved refusal → explicit fixture approval → one effect → replay → revocation refusal. No production endpoint, catalog entry or source connection is enabled.

## Exact source and boundaries

- Base: Word workflow PR50 `a0614e7e16d6f92d0ca6eaa192cea7c5def21ec8`, tree `2d4e5f20948daa3c3eb77709bd5c677d1b4325fe`.
- External source: Capiro PR2449 `60cf2e51129f8358e6afe5fc600ffcdb6de01759`, tree `1b2c9f6e975a47397f08d34563087455ed1c2242`.
- Author source: `9063f707e2ac618b0dcf5bb0c5165d13914748e6`; documentation/comment update `375bdddc412a5a44edc0892341b4b0950666a396`; author packet `e37a648d464ae2fade173f8eda7fd6f60f7d7649`.
- Independent behavioral controls ran at `fd1fd98bfb7f7a75435ad4a0b6e64b46a191d132`. Final reviewer packet: `6e52e6abfdf7a41256febea83cc8b15262f6cd06`, tree `04f27f4b1d70788cf299e9ce6b0919e57cfb8351`.

The new `application-adapters/cross-repo/` loader verifies the external commit/tree, nineteen exact Git members and the caller-supplied TypeScript5.9.3 compiler before transient in-memory compilation. It executes actual middleware request provenance, a distinct middleware provider instance, online-session owner, role guard, tenant context, current conversation/client predicates and selected endpoint/controller methods. Twenty-two exact AST selections are recorded by hash. No Capiro implementation body, transpiled output, credential or native data is committed to Meri. Import is inert, and fixture construction does not issue endpoint requests.

Clerk SDK, Prisma records, Nest bootstrap/dependency injection and the current Meri run/grants/budget/persistence/tool ports remain explicitly synthetic. The Prisma fixture evaluates the actual emitted tenant and ethical-wall predicates, including foreign-tenant grants. Only ordinary active client-bound conversations are exercised; research-portfolio loading refuses if reached. This is source composition, not live Clerk/JWT, PostgreSQL/RLS, Nest bootstrap or deployed HTTP qualification. Promise deadline refusal does not demonstrate physical cancellation of a remote SDK call. Real Capiro middleware can provision, heal, update last-seen state and audit; this fixture does not claim those operations are globally side-effect-free.

## Validation and retained failures

- Author: **23/23**. The initial **22/23** result is preserved. Its sole defect was the fixture's case-sensitive header object combining differently cased Cache-Control fields into `no-store, no-store`; the repair uses native case-insensitive Headers replacement. The original assertion remains intact.
- Independent reviewer: **35/35**, including foreign tenant/actor/client grants, revoked membership/session/wall access, caller-forged authority, exact DTO joining, revision and fence drift, expiry during parked online-session work, and the approval/execution/replay flow. The initial **34/35** result is preserved; its sole failure was a reviewer test referring to `catalog.originalTools` instead of the existing `catalog.originals` field.
- Integration regression replay: **127/127**, spanning existing authority/context/session tests plus the new pinned-source composition, at `c5a2482536d65257759ca7a663c33697068344f6`. Later source bytes match the independently accepted freeze; intervening existing-file changes are documentation and one comment only.

The integration replay of the frozen independent controls also passed **35/35** at `750c289bd1b94fce0e67c576e283f5b7927cf8e6`, in 11.812 seconds. The metadata-only source/preservation audit passed at the same head, verifying ten integrated source/document/test blobs and all **39 author/reviewer manifest members**. It records 103 source/evidence checks plus the non-overwrite save guard. SHA-256 manifests and owned-process cleanup bind the packet. Raw failures, commands, stdout/stderr, exact tested commits and original deadlines remain available. Original author/reviewer histories are merged without rewriting them.

All **11,497** base Git entries remain. Exactly **11,495** are unchanged; only the allocated current adapter README and first-line comment in `authority-http.mjs` differ. Its executable bytes are unchanged. Original tests, contracts, migrations, catalog, document workflow and prior evidence are retained. The ledger remains **139 originals / 96 selected mapped / 43 deferred / 97 operations**, all operations with null handlers, unimplemented availability, pending qualification and zero retries. Public0.1/private0.2 separation is unchanged.

## Delivery and remaining gates

Run the explicit local commands in `apps/control/action-host/application-adapters/cross-repo/README.md`; the caller must supply an existing exact source repository and admitted compiler. No package install, automated fetch, native credential acquisition, DB connection, cloud action, provider call or spend is introduced.

The independent verdict is **ACCEPT_SOURCE**, with **runtime HOLD**. G1 stays OPEN; G2–G7 remain unentered. Live application identity/authentication, RLS and deployed endpoint checks remain open alongside supported patched runtime image, native task-A/B checkpoint recovery/stale rejection, durable budgets, sandboxed browser/renderer, egress/watchdog/teardown and artifact inspection. The prohibited old image was not launched.

The Word workflow is already published separately in PR50. Native fixture endpoint/schema compatibility is published separately in PR51 at `a16e52ef5bd8d570c995dff298facbc0d1969000`; this branch is based on PR50 and does not implicitly incorporate or execute that native fixture. The designated native owner must supply its actual results. This lane neither reads private native packets nor claims synthetic checks close native gates. No main merge, frontend change, deployment or infrastructure change occurred.
