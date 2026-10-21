# Meri selected read continuation: independent source review and worker checks

Reviewed production receiving point: `fde87b6c035261eab7073dbfbc095cd3947693bf`,
against assignment base `98d3c96a2c944a8211856e98b5bd62e824b4b5f7`.
Core was inspected read-only at `138c04373b18bb730b1ad0f8f9338342f628b8c6`.
The later memory DTO correction `26c748dcf03dcf469baa178140e4c53a11660e3e`
was separately reviewed as a four-line production boundary correction.

Test-only branch: `codex/meri-read-discovery-tests-20261019`, based on the reviewed
receiving point. It then received root's existing mail fixture correction
`ea5e60e053b8d9129ae025496ee1e21a41ab8af0` as local cherry-pick `5c8ed568`.
The independent worker test change is
`e2479866c4d81f975db46d2e738be50c9201b934`; receive that test commit without
duplicating the mail fixture commit.

## Source review result

No blocking authorization widening or replacement of a real producer with a
fixture was found in the reviewed production change. This is source review,
not approval of an installation, image, live source, provider, database or chat.

- The selected composer binds Research/Florida authority and evidence GETs to a
  distinct attended credential callback. That callback forces the trusted run
  binding and uses the current live bearer broker with expiry. Option B's opaque
  `mrd.*` per-call handles remain confined to delegated credential exchange.
- Original task queries now retain the trusted invocation ID and exchange a
  one-use token for the exact original flat POST body. The selected runtime and
  worker discovery require client scope; the legacy producer's broader task
  behavior does not create broader authority here. Current task/actor, grant,
  service identity, reservation, budget and final release checks remain owned
  by the existing gateway/Core boundaries.
- Monday's existing Core `readWithCurrentMondayMapping` reads and compares the
  same managed mapping before and after its canonical source read. The signed
  token reply contains no mapping receipt. Removing Meri's impossible receipt
  requirement does not create a model-owned board mapping: exact signed route,
  request bytes and correlation remain bound, Core retains the board wall, and
  Meri still validates the canonical page plus actual actor/client row fields.
- Business-development evidence accepts selected-client scope and
  `CapiroMeriRead` credentials only. It cannot fall back to the older ordinary
  Bearer scope gate. Core's current conversation observation verifies the
  prospect's linked client against the delegated client and includes the
  prospect/client/scope tuple in `contextRevision`. The existing native owner
  compares current conversation authority across the call and before release.
- New source/selection paths are included in measured family source closure.
  Memory search, proposal approval boundaries, the signed eligibility helper,
  durable proposal continuation and their existing measured source labels remain
  preserved. The later DTO correction keeps the helper-only callback on its
  existing signed helper path while removing it from the closed generic native
  credential DTO; it adds no authority or new memory implementation.
- Mail's task factory only accepts mailbox scopes already present in an admitted
  task, with an explicit continuation owner. The production selected composer
  intentionally excludes mail until the authoritative scope admission and
  durable continuation owners exist. No mailbox is inferred from model IDs.

## Dependencies and truthful limits

- Research-source candidates and BD evidence remain unqualified while the exact
  Core delegated-read allowlist entries are absent. Synthetic tests explicitly
  model a compatible admitted producer; their success is not live admission.
- For selected-client BD, the delegated conversation reader requires the requested
  native conversation ID to equal the run binding's conversation ID. Core must
  resolve that ID to an owned active `clioConversation` and its authorized prospect.
  An arbitrary greenfield or model-supplied native UUID cannot bridge missing
  conversation/prospect custody. This remains a live qualification prerequisite
  even after the operation allowlist is extended.
- Research/Florida still require actual public issuer/key/recipient pins and enabled
  matching Core/Intel retained receivers. Evidence GETs require a current attended
  bearer and the current Core Portfolio grant. No credentials or pins were invented.
- The received news, legal-reference and outreach adapters retain bounded input
  slices: exact news source or explicit-year personnel; parser-independent legal
  selectors; and explicit selected-client campaign lists. Unsupported windows,
  citation parsing and broader outreach inputs remain unavailable.
- Certification, rule status, SAM opportunities and attachment custody/clock
  dependencies remain as described in
  `SECOND-PACKAGE-PRODUCER-CONTRACTS-20261019.md`. Their existence in the catalog
  does not make them installable, available or qualified.

## Worker verification and test changes

The worker registry contains **81 operations in 45 families** at the reviewed
point. The test commit changes only files under
`apps/worker/conversation/reads/test/`:

- `business-development.test.mjs`, `completion.test.mjs`, `families.test.mjs`,
  `funding.test.mjs`, `kb.test.mjs`, `newmode.test.mjs`, `research-legal.test.mjs`,
  and `source-slices.test.mjs` reconcile the inventory and preserve independent
  source/installation/discovery/client/family/allocation gates.
- `options.test.mjs` uses the current canonical initial-input allocation before
  writer-fence-1 submission. It explicitly pins active profile reads and verifies
  that an omitted active list registers nothing. A missing per-run installation
  does not change the measured tool profile or imply an executable source.
- `selected-continuation.test.mjs` adds **25 ordinary, no-selected-skill cases**
  for legal reference, LegiWatch news, outreach, research candidates and BD
  evidence. They exercise actual profile/MCP/delegation/gateway owners with
  explicitly synthetic Core/SQL/source inputs. Positive profile calls require
  exact active operation pins, current gates, signed body-bound tokens and durable
  receipts. Negatives preserve missing active pin, missing/withdrawn installation
  or discovery, disabled source, wrong family policy and release revocation with
  an unsettled UNKNOWN reservation.

Commands and outcomes on Node `24.19.0`:

```sh
timeout 120s node --test --test-timeout=60000 apps/worker/conversation/reads/test/*.test.mjs
```

The coherent 450-case worker run initially produced **442 pass, 7 fail,
1 cancelled, 0 skipped**. The eight unsuccessful cases were the stale options
activity fixture and seven signed-mail server scenarios, including the parked
cancellation case. The root mail fixture correction fixed those server scenarios.
The options fixture required both current initial-input admission and explicit
active profile pins; assertions now check the current fixed-profile semantics.
An earlier setup attempt also lacked the local temporal dependency link and used
an invalid extra `binding` field in this review's availability probe. Those setup
and test mistakes were corrected without changing production behavior.

```sh
timeout 45s node --test --test-timeout=30000 \
  apps/worker/conversation/reads/test/options.test.mjs \
  apps/worker/conversation/reads/test/server.test.mjs \
  apps/worker/conversation/reads/test/selected-continuation.test.mjs
```

After the targeted repairs/additions: **42/42 pass**, zero failures, cancellations
or skips. This includes all formerly unsuccessful worker groups plus the 25 new
ordinary profile tests. The complete prior worker suite was not repeated after
these isolated test/fixture changes; the focused groups retain their relevant
previously passing scenarios alongside the corrected and new cases.

```sh
node --test --test-timeout=30000 \
  --test-name-pattern='constructor holding both handlers|overclaimed worker snapshots' \
  apps/worker/conversation/reads/test/research-legal.test.mjs
git diff --check
```

**2/2 pass** and whitespace check passes. The additional overclaimed-snapshot
case preserves the old negative test's security intent: even a synthetic worker
snapshot listing the reference operation cannot grant an unallocated actual
gateway source call or accepted receipt.

No real provider/Core/Intel requests, live SQL, source activation, SDK model query,
image build, deployment, merge, publication or frozen candidate modification was
performed by this review/test lane. No package or lockfile was changed. All test
processes were allowed to finish or explicitly stopped; dependency links are local
scratch setup and are not committed.
