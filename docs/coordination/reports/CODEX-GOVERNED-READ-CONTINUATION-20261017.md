# Governed read continuation — 17 October 2026

## Scope and implementation outline

Task-owned branch `codex/meri-general-reads-governed-next-20261016` starts at local `48e091970b9f65f1e686dc917dfc80d72f9c84b9`, tree `d54f8b1eb9e20327fe19fc569585c259833eeb2c`. That tree is published by draft PR103 at `8bb0b2945429e70cf0ae1e594ea55eb8c3fa7ada`; PR103 is stacked on PR99. Release PR98 and its checkout are read-only inputs.

The bounded increment implements thirteen operations across seven complete adapter families: public web (2), governed data search (1), typed public-domain query (1), facility representation (1), District Nexus (2), client registry (1), and federal market (5). Twelve operations receive SDK exposure. Governed data search remains unexposed because the frozen advertised normalized input and raw request normalizer are incompatible; see below. Adapters use the actual fixed Core tool routes and the existing current task, allocation, tenant/user, source-grant, installation, credential and durable gateway owners. They do not create a second retrieval engine.

The parallel path owners implemented the family modules and focused fixtures separately. Root owns composition, SDK exposure, measured source manifests and ledger updates. A distinct reviewer audits both the completed adapters and the integrated private owner extension before publication.

1. Preserve raw requests and canonical receiving contracts; add only the supported default-date request bridge and the exact native SQL-result projection.
2. Extend the existing CONTROL owner with private, current native membership client IDs and a small family-context module. Facility/district use current client lineage. Every supplied market client selector requires current visibility. Registry output requires a fresh private visibility check and is withheld in full when denied.
3. Register complete families, measure every imported owner/projection helper, expose them through `meri_reads`, and test genuine gateway/owner/MCP lifecycle composition with synthetic native JSON.
4. Refresh only current source exposure, retain all historical scope rows and gates, independently review the final source, then publish a draft under standing reviewed-source approval.

## Source and authority boundaries

The source producer pin is `neo-capiro/capiro-backend@b525032222515d636b0dae2d46e40c7c3d8b5528`; the existing immutable producer-map publication is `384325afaaf7ad34aeb9ff9b2f183d667ee17343`. No product endpoint, provider, SQL database, audit sink or live credential is used by these tests.

Public web remains external untrusted evidence. Core owns provider selection, DNS/address restrictions, pinned connections, redirects, bounded HTML/PDF handling and cleanup; local synthetic DTO tests do not qualify those network controls. Governed data search preserves native page coverage, opaque cursors and provenance; Core's ContextPlane owns per-page client/mailbox authorization.

Typed public query uses the frozen finite registry (12 datasets, 88 fields). For a supported omitted `asOfDate`, CONTROL captures its trusted clock once per invocation and the request bridge supplies that exact canonical date. The original request hash remains unchanged. Native success contains SQL that the frozen public success cannot expose: a closed projection validates the exact native success shape and removes only `sql`. Errors and every other field remain subject to receiving validation. Native analytics may write audit rows; those effects require later qualification.

Native membership already produces client IDs from the current accessible-client revision calculation. The owner carries them privately; they are absent from gateway context receipts, worker arguments, returned data and credential echoes. Scoped source checks require this observation. The registry gate admits at most one canonical UUID and rechecks current authority before releasing the complete unchanged DTO. It never manufactures an empty registry match by redacting a denied identity.

Facility/district wrappers use the fresh gateway subject, including the current authorization decision ID. Stable comparisons omit only that rotating decision ID, preserving every other lineage field. Federal-market global and client variants, nullable amounts, source warnings, paging and the declared-open contract award dates extension remain unchanged. Forecast rows retain native global semantics even when a supplied client selector is authorized.

No runtime startup, infrastructure, central contract, lockfile, migration, deployment, AWS or credential change is part of this increment. Source connectivity and live qualification remain separate gates.

## Verification and review

Exact worker lock pin Zod4.6.7 is reused from the verified task-local offline extraction established by PR103. Node24.19.0 runs with `--preserve-symlinks`, a 256MiB heap and serial test concurrency; no duplicate install is performed. Dependencies are read-only junctions except the task-local Zod overlay. Owned exec sessions are allowed to exit; unrelated processes are preserved.

Author focused checks: public-web56/56 (29 adapter +27 contracts), data-search34/34 (18+16), public-domain-query20/20, and the four client/market families50/50 adapter checks plus128/128 unchanged contract checks. Initial client/market fixture failures were corrected before review: context alias mutation and synthetic numeric amount types; no production receiving rule was relaxed.

Independent bounded reviews: public-web/data-search/public-domain-query/shared result hook **ACCEPT_SOURCE**,77/77 focused checks; facility/district/registry/market **ACCEPT_SOURCE**,50/50 focused checks. Integrated current-context/visibility owner review also returned **ACCEPT_SOURCE** with132/132 owner checks and213/213 native-wiring/MCP checks. A separate docs/ledger review verified17/17 exposure checks, all preserved historical fields and exact remaining-family census.

Final integrated tests passed538/538, and the strengthened SDK block/exposure tests passed42/42. Root helper/ledger checks passed27/27. The retained/worker regression run passed143/147: all142 checks outside the unchanged options fixture passed, while that file reproduced the same four failures on the unchanged PR103 base. Two are a Windows workspace suffix guard, one is the separate Windows backslash guard, and one is a scripted pool missing the current initial-input SQL query. No failing guard or unrelated fixture is weakened. Exact commands, raw logs, initial failed outcomes and baseline diagnosis are retained in [RUNS.md](governed-next-20261017/RUNS.md).

The unchanged Windows workspace-root assertion rejects backslashes in native fixture paths. PR103 established this same6/7 platform limitation in unmodified release-source bytes. This lane does not relax the guard and does not treat that failure as a passing test.

## Current remaining-family ledger

After this increment, source exposure is55 general operations across32 worker families. Of82 selected source reads,54 have implemented adapters,53 have general exposure, and28 lack adapters across15 complete families. One implemented adapter remains unexposed: `search_capiro_data`. Source-qualified/live remains0. Research portfolio, research portfolio changes and Florida budget project reads remain implemented/exposed and in scope.

The governed search descriptor advertises `DataSearchInput`, a normalized schema requiring `window`, `clientId`, `memoryItemId` and other normalized fields. Its raw canonical normalizer instead accepts `windowStart`/`windowEnd`, refuses `window`, and refuses explicit null optional selectors. Thus every schema-valid input contains a key the raw normalizer rejects. Zod conversion also refuses its unsupported conditional constraint. The lane preserves both central contracts and the SDK fail-closed conversion, withholds the data-search SDK family, and tests the exact refusal. The CONTROL owner validates this family's valid raw input through its existing canonical normalizer rather than applying the normalized shape directly; original request bytes/proofs are retained. Correcting the central raw-input descriptor/schema requires its owner to coordinate and repin the contract/catalog; no such mutation is attempted here.

The [exact correction allocation](CODEX-DATA-SEARCH-INPUT-CORRECTION-20261017.md) includes the current raw/normalized shapes, additive request definition, three-file contract scope, hash repins and a reusable read-only probe. The proposed raw definition converts through the unchanged SDK guard and passes19/19 shape/normalizer probes with exact Zod4.6.7; this is a reviewed proposal awaiting contract ownership, not an applied contract or source qualification.

The separate [remaining dependency report](CODEX-REMAINING-READ-DEPENDENCIES-20261017.md) records each missing family, its actual source/context boundary and what must be supplied or coordinated next. These are implementation dependencies, not an assertion that absent live credentials justify skipping source work.
