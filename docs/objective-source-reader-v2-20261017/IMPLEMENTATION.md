# Objective reader v2 source implementation outline

Baseline: Meri PR121 `0d6ba1590b41e3bc911e8c50f7c7407632101832`.
Parent selected a distinct Objective Ed25519 protocol; existing reader and Core
RS256 remain unchanged. Meri integration owner reserves new
`apps/runtime/objective-source/*` and `packages/contracts/objective-reader-2/*`.
Shared prepared-run-issuance/bindings changes await that owner's final first-chat
pin or explicit acceptance of a minimal patch. There is no source mount yet.

Canonical ownership and dependency direction:

- Versioned contracts own closed request, signed claim, nonsecret observation
  and immutable custody projection schemas. Freeze and independently review in
  Git before any HTTP source mount. Core consumes the exact pinned contract.
- Pure fact compiler reuses the existing candidate Request validator, Objective
  pair validator and JCS whole-facts hashing. Its bindFacts decorator preserves
  original issuance identity and expiry and refuses changed bound facts.
- Custody owner derives the seven-field binding from canonical accepted run and
  already-ISSUED protected facts. An immutable persistence port owns compare/CAS,
  conflicts and uncertain outcomes; caller HTTP data cannot create a mapping.
- Active observation requires active run/original unexpired issuance. Historical
  observation uses bounded immutable metadata custody and fresh native authority;
  original execution expiry is evidence, never renewed. Neither projection may
  serialize resolveFacts, proxy credentials, material references or capabilities.
- Reader gate and dedicated Core signer/decoder/transport bind one purpose,
  issuer, audience, kid, route, exact bytes, source and short expiry. Separate
  purposes cannot exchange keys. Existing strict gate and Temporal signer are
  untouched. All composition defaults closed until genuine bindings exist.

Verification: closed-schema mutation and secret-field rejection; wrong issuer,
audience, purpose/key/route/body/source; immutable binding/facts conflict and
uncertain mapping; original-versus-read expiry; current access changes; actual
production factory composition over explicitly synthetic credentials and native
adapter fixtures. No dependencies installed or live action. Existing Core
`eef7cd1b` PostgreSQL qualification remains scoped to its original unchanged code.
