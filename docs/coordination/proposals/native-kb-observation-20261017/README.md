# Proposed native KB observation

This documentation-only agreement packet proposes `search_client_knowledge@0.2.0` as the sixth finite operation in `meri-native-read-observation/1`. The current Meri codec still admits only five funding operations and rejects this KB vector. Neither the proposal nor the funding source milestone implements or exposes semantic KB search. Its existing graph sibling remains unchanged. No installed server, credentials, provider call, qualification or live activation is claimed.

The separately allocated Core owner stacks its observation/controller/tools change on corrected funding PR52 `51c157444ac43035eeb489ff46aee5a4e89ba3ac`, tree `54af881dddef397db0ff215d6eb2a72d74c0d1bd`. Meri owns the later private-wire/schema/SDK and source adapter packet. Core domain search, public DTOs, module/bootstrap and auth middleware are outside this allocation. Name and mode packets remain unallocated.

## Exact bytes and retained source contract

`golden.json` retains the original unwrapped body, canonical request JSON/hash, closed observation, canonical observation JSON/hash, decoded UTF-8 byte count and unpadded base64url carrier. It uses the adopted `canonicalize` implementation; whitespace, Unicode and uppercase UUID spelling are deliberate. Hash the original parsed request before any defaults, trimming, kind selection or limit normalization. The carrier is correlation data, never an authority grant. Keep the existing matched service proof, current native bearer/tenant/user and resource checks before native I/O.

The existing retrieval contract at Meri PR110 `f7f4ed5b397fcd44576251739ed361aee6941d7a` owns these semantics:

- `packages/contracts/retrieval-0.2/catalog-validation.mjs` declares version `0.2.0`.
- `client-knowledge-search.schema.json` defines a closed raw body: required `query:string`; optional `clientId:string|null`, `kind:string|null`, `limit:number|string|null`. Its context is exactly `{asOf}`.
- `client-knowledge-search-validation.mjs` requires a nonblank trimmed query. Preserve raw client-string truthiness/spelling; admit the four existing kinds or null; retain numeric limit clamping to 1–20 without flooring, with nonnumeric values defaulting to 8. The carrier does not change domain normalization.
- The closed output already requires `generatedAt` in the missing-client note and the client success/ordinary-empty/caught-unavailable branches. Every returned result must use the exact captured canonical `context.asOf`. Caught KB/provider failure has the existing unavailable note and empty results; validation/client lookup/not-found throws remain execution failures and gain no fabricated DTO.

The no-client result has no client metadata/query and performs no client lookup or embedding search. A truthy UUID requires fresh one-client/native visibility authority before HTTP; never inject a conversation's selected client into an omitted field or resolve a name. Legacy Core calls without a carrier may capture their existing clock once. Meri calls must carry one trusted instant throughout validation, admission and receiving. Provider cancellation and fractional-limit SQL outcomes still require genuine native qualification; synthetic fixtures cannot establish them.

The five published funding vectors are unchanged at PR109 `b4daa4adf6e8269e7c341751db9a02bf6d4f062b`, Git blob `9536c662f4abd3487b6bdb4000ff06a0250f44ae`. A future finite-six Meri patch must preserve their exact bytes and reject every unallocated operation, version, context field, malformed canonical value and body substitution. The frozen public retrieval schema is unchanged by this proposal.
