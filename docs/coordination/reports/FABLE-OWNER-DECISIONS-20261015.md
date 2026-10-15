# Owner decisions received 15 October 2026 (Fable record)

Source: Neo Martinez (human owner), message to Fable on 15 October 2026, replying to the open decisions listed in the [scope ledger at 9fce47df](https://github.com/neo-capiro/meri-greenfield/blob/9fce47df989e6e0e2ba356df72462e1d70d489cb/docs/coordination/ledgers/MERI-FINAL-SCOPE-LEDGER-20261015.md). `docs/coordination/DECISIONS.md` is the coordinator's shared file, so this report records the decisions and proposes the D015 entry text below for dot to add. Nothing here grants deployment, activation, migration, credential or live-gate authority.

## Decisions

1. **Conversational write requests (`meri_intents`, proposal P10): approved.** Users can request writes from a conversation. Requests route through the existing proposal, approval and execution owners, with current permissions checked before execution. No second authorization system.
2. **The five historical deferrals become explicit.**
   - Device/browser bridge: later phase.
   - Live browser takeover: later phase.
   - Full in-browser Office editor: later phase. Document generation, revision, preview and download remain required now.
   - Authenticated third-party website workflows: later phase, each approved and tested per workflow. This does not defer authenticated Meri chat.
   - Full 139-workflow legacy parity: replaced by end-to-end coverage of the 96 included capabilities and the 14 current skills. The 43 excluded legacy tools are not reintroduced.
   - **Confirmed by the owner on 15 October 2026:** "We can do those after the first shipment." The four later-phase features (device/browser bridge, live browser takeover, full in-browser Office editor, authenticated third-party website workflows) are out of scope for the first shipment and planned after it.
3. **Browser destinations.** Capiro's platform owner maintains the approved destination list (the platform maximum). Tenant admins select from it or restrict it further and cannot expand it. Browser stays enabled by default; destination restrictions are enforced through redirects and downloads too. The initial destination list is still to be chosen.
4. **Bash placement.** If Fargate fails the sandbox probe, Bash stays unavailable there. Qualify a separate disposable, isolated worker host that supports the real SDK sandbox. Never fall back to unsandboxed execution. This is the recommended architecture; the actual host still needs qualification before activation.
5. **Neighbouring reads kept.** `get_research_portfolio`, `get_research_portfolio_changes` and `get_florida_budget_project` stay in scope (already among the 96 selected). Implement and qualify their adapters; they are not excluded because nearby legacy tools were removed.

## Effect on current work

- Decision 1 unblocks the `meri_intents` design in [FABLE-GENERAL-READ-TOOLS-20261015.md](FABLE-GENERAL-READ-TOOLS-20261015.md) (P10). Implementation follows the open HOLD repairs and still needs dot's review of the route and approval binding; it reuses the canonical approval owner, consistent with the browser approval-port binding list in the P2c report.
- Decision 3 matches the P2c policy shape (platform `maximum`, tenant/role intersections that cannot widen) and the now-mandatory `effective-origin-allowlist` egress requirement. Choosing the initial list remains open.
- Decision 4 matches the P2a fail-closed Bash admission (Bash unavailable unless an available sandbox attestation exists). Qualifying a separate host is a placement step that needs its own authorization and evidence.
- Decision 5 needs no ledger change: the three reads are already included rows; their adapters join the family-by-family read integration.
- Decision 2's 96 + 14 coverage target replaces legacy parity as the end-to-end acceptance measure.

## Proposed D015 entry for `docs/coordination/DECISIONS.md` (dot to add)

> ## D015 Owner scope decisions of 15 October 2026
>
> Human owner decision, 15 October 2026. Approve conversational write requests (`meri_intents`) routed through the existing proposal, approval and execution owners with current permission checks before execution; no second authorizer. Keep `get_research_portfolio`, `get_research_portfolio_changes` and `get_florida_budget_project` in the selected 96. Capiro's platform owner maintains approved browser destinations; tenant admins select or restrict and cannot expand; browser stays enabled by default with destination restrictions enforced across redirects and downloads; the initial list is open. If Fargate fails the sandbox probe, Bash stays unavailable there and a separate disposable isolated SDK-sandbox host is qualified; never unsandboxed. Legacy 139-workflow parity is replaced by end-to-end coverage of the 96 included capabilities and 14 skills; the 43 excluded tools stay excluded. Device/browser bridge, live browser takeover, full in-browser Office editing and authenticated third-party website workflows are deferred until after the first shipment (owner confirmation, 15 October 2026); document generation, revision, preview and download and authenticated Meri chat remain required now. No deployment, activation or gate advancement is granted.
