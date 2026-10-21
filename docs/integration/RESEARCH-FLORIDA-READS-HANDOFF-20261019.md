# Research and Florida selected read composition

Source-only handoff for the receiving integration owner. No image, configuration,
installation, infrastructure, database, live provider or deployment was changed.
Frozen candidate `34851020aa0d73fead4db59ba6e26a098e2d0313` and PR175 are unchanged.

## Source receipts and design

- Exact base: `98d3c96a2c944a8211856e98b5bd62e824b4b5f7`.
- Implementation commit: `91e7f5f6b180e89f100ef58f430e77deb3f41d2d`.
- Implementation tree: `a054f6fbe26a5660252a9ace8254b20dd50571d0`.
- Review branch: `codex/meri-research-reads-20261019`; publication belongs to the
  receiving owner. No merge into the frozen shipment candidate is authorized.

The outline recorded with the receiving owner before implementation was to reuse
existing source adapters, subject/context owners, and retained credential owners;
add one bounded selected-family composer; preserve live task/client/credential
authority and source projections; test the genuine local gateway chain and
security negatives. Inspection found complete existing signed retained task ports
for detail/changes and Florida, so those owners were composed rather than replaced.
No new endpoint, producer, permission, write operation or persistence owner exists
in this change.

Changed implementation files:

- `apps/runtime/native-authority/retained-reads/research-florida-task-ports.mjs`
  selects exactly the requested families and merges the existing context owner.
- `apps/runtime/native-authority/retained-reads/task-ports.mjs` forwards configured
  request and response limits to its existing delegated transport, taking minima
  with supplied task-approved limits. Existing direct callers without the optional
  limits retain their previous defaults.
- `apps/runtime/native-authority/retained-reads/test/research-florida-task-ports.test.mjs`
  contains 12 focused cases. This handoff is the fourth changed file.

## Composition API and integration order

```js
const taskPorts = createResearchFloridaTaskPorts({
  enabled: true,
  familyIds, // nonempty subset of RESEARCH_FLORIDA_TASK_FAMILIES
  coreOrigin, fetchImpl, now,
  maxRequestMs, maxResponseBytes, // optional; defaults 15000 / 1048576
  retainedAuthority: { issuerId, keyId, publicKeyJwk, recipients },
});
const result = taskPorts({ task, getNativeCredentialWithExpiry });
```

`RESEARCH_FLORIDA_TASK_FAMILIES` is exactly `research-portfolio`,
`research-portfolio-evidence`, and `florida-budget`. The result contains only
selected families; detail/changes or Florida also return
`contextPorts.retainedContextPorts`. Evidence-only composition needs no
`retainedAuthority`. Default-disabled configuration is inert. Each selected family
must have a matching operation in the enabled task-approved read configuration.
Research evidence retains the existing requirement for exactly one trusted client
scope; a tenant-only fixture cannot be used to claim that path is available.

The callback must issue an actual live **ordinary native user Bearer with expiry**.
An Option B opaque handle, signed-source token, service secret, or model-provided
ID is not this credential. The receiving owner identified that the existing
`reads-composer` callback may yield an Option B handle and is adding a distinct
attended credential callback bound directly to the native bearer broker. Pass that
callback into this factory under `getNativeCredentialWithExpiry`; do not route
these families through an Option B tool token or service-secret fallback.

1. Receive the implementation commit without changing the frozen build source.
2. Add the narrow trusted signer/recipient configuration in the receiving startup
   owner and compose this factory for its exact measured retained family subset.
3. Pass the live attended Bearer callback, preserve the returned context port,
   and retain the installation/discovery/allocation checks in their existing owners.
4. Run receiving CLI/configuration and combined runtime checks once the independent
   family slices are received. Selection in source does not qualify or activate a
   production installation.

## Operations and authoritative source boundaries

Core source was inspected at dot's exact
`138c04373b18bb730b1ad0f8f9338342f628b8c6` using its retained authority/principal
controllers, services, trust module, and Research Portfolio controllers/services.

| Operation | Existing production source path and contract | State here / dependency |
| --- | --- | --- |
| `get_research_portfolio@0.2.0` | Existing handler describes ordinary `GET /api/research-portfolios/:id`; the selected mode uses Core authority `POST /api/clio/application-authority/retained-research-portfolio`, issuer `/retained-research-portfolio-principal`, then `POST /api/clio/retained-reads/research-portfolio` with signed `CapiroRetained`. Canonical `ResearchPortfolioDetailResult`. | Source-composable; local real gateway/retained-owner chain passes with synthetic HTTP/SQL. Core enabled trust pins and live source qualification remain required. |
| `get_research_portfolio_changes@0.2.0` | Corresponding authority `/retained-research-portfolio-changes`, issuer `/retained-research-portfolio-changes-principal`, data `/api/clio/retained-reads/research-portfolio-changes`. Canonical `ResearchPortfolioChangesResult`, raw cursor and limit preserved. | Source-composable; bounded first page and separate empty continuation tested. No cursor authenticity or corpus completeness claim. |
| `get_research_evidence@0.2.0` | Existing native authenticated `GET /api/research-portfolios/:id/reviews?lane=mine|team|deferred|resolved`, `/snapshots/:recordId`, or `/annual-review`; `ResearchPortfolioEvidencePage`. Reuses `createResearchEvidenceTaskPorts` and existing HTTP adapter. | Source-composable; review composition plus existing snapshot/current-continuity/source/security tests pass. Requires the live ordinary attended Bearer and current Core Portfolio grant. No signed evidence receiver was invented. |
| `get_florida_budget_project@0.2.0` | Existing handler describes Core native tool POST; selected mode uses Core authority `/api/clio/application-authority/retained-florida-budget`, issuer `/retained-florida-principal`, then Intel-origin `POST /intel-api/internal/legiwatch/retained-florida-budget` with `CapiroRetained`. Canonical `FloridaBudgetOutput`. | Source-composable; Core-produced effective scope/client resolution, selected-client equality, observation time, canonical empty/null and pagination fields retained. Requires the real retained Core/Intel trust configuration and reachable Intel receiver. Native tool is not in Option B's allowlist. |

All delegated operations use the existing Core identity route first. Current Core
tenant/membership/resource authority and the task's accepted request/fence/grant
are rechecked by their existing owners before and after source work. Native GET
evidence remains under Core's current user/grant authorization. The unchanged
evidence projection preserves provenance, retained limitations and explicitly
partial corpus coverage. Florida's existing `generatedAt` is an observation label,
not evidence of a historical source snapshot. No source freshness or negative
assertion beyond those existing contracts is claimed.

Dot must supply actual matching issuer ID, key ID, public principal JWK and exact
recipient origins for all three existing retained operation keys. Detail and changes
must share the Core origin; Florida uses the actual Intel origin. Core source is
mounted but intentionally returns unavailable until `RETAINED_READS_ENABLED` and
complete validated trust pins are installed. No keys, credentials, live config or
installation were fabricated. The complete history-release route remains a
separate dot-owned dependency and was not edited.

## Verification and limitations

Local Node version: `v24.19.0`. Exact existing canonicalize/AJV/pg dependencies were
borrowed from the authorized local dependency installation; no package or lockfile
was installed or changed.

```sh
node --test apps/runtime/native-authority/retained-reads/test/research-florida-task-ports.test.mjs apps/runtime/native-authority/retained-reads/test/task-ports.test.mjs
```

Final result: **19/19 pass**, no skips. Covers exact selected families, three signed
data paths, evidence GET reuse, cursor continuation, narrower configured/task
deadline and response limits, disabled/unapproved families, expired/revoked grants,
foreign Florida folder-client resolution, and unavailable source without fallback.

```sh
node --test apps/runtime/native-authority/retained-reads/test/research-florida-task-ports.test.mjs apps/runtime/native-authority/retained-reads/test/task-ports.test.mjs apps/runtime/native-authority/retained-reads/test/control.test.mjs apps/runtime/native-authority/retained-reads/test/research-evidence-task-port.test.mjs apps/gateway/test/research-evidence-source.test.mjs apps/gateway/test/research-evidence-independent.test.mjs
```

Final result: **161/162 pass**, no skips. The sole failure is unchanged
`research-evidence-independent.test.mjs:71`, **independent memory adapter
eager-response handoff retains cancellation ownership**. It fails
`INVALID_ARGUMENTS` in unchanged `memory-proposals/http-adapter.mjs:72` before
the intended body-cancellation exercise. It was independently reproduced in a
detached sparse worktree at the exact base with:

```sh
node --test --test-name-pattern='independent memory adapter eager-response handoff retains cancellation ownership' apps/gateway/test/research-evidence-independent.test.mjs
```

Exact-base result: **0/1**, same failure and locations. This lane did not change
memory behavior, its fixture or its assertion. The earlier aggregate before the
two added selection/limit cases was 159/160 with this same inherited failure.
Two initial new-case fixture expectations were corrected: the combined-family
fixture must supply the existing client scope for evidence, and gateway error
translation is not required to expose the source's private response-limit code.
All no-output/no-settlement, data-request-count and deadline assertions remain.

`git diff --check` and `node --check` for both implementation modules pass. This
JavaScript slice adds no type API; the receiving owner runs the affected runtime
type/build checks on the coherent integrated point. No real PostgreSQL, Core/Intel
network, production grants/revocation latency, final image, SDK tool discovery in a
live chat, deployment or first-chat success was exercised. Synthetic fixtures are
not production behavior or an installation receipt.
