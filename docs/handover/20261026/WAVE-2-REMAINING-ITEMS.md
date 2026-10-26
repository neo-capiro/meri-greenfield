# Wave 2 closed with carryovers — Fable's remaining fixes

Wave 2 is administratively closed. Accepted fixes are deployed; functional acceptance remains **CHANGES**. Fable owns the residual fixes, and Neo will post the results in the fresh Wave 3 chat.

1. **General email access:** the new General request completed and history loaded, but the model reported `mail_list_messages: ACCESS_DENIED`. Inspect the actual denial; the raw gateway receipt was not inspected. General may read authorized stored mail—no blanket ban, Core-wall bypass or empty-inbox inference.
2. **Safe session recovery:** [frontend PR172](https://github.com/neo-capiro/capiro-frontend/pull/172) is **CHANGES / DO NOT MERGE**. Generic access-loss retry can reserve an unintended successor after a started/stopped conversation. Preserve exact selection unless the canonical owner proves safe unstarted-original recovery. Historical5xx cause/original delivery remain unknown.
3. **Outlook sync/status:** fix stale sync and expired subscriptions through the actual configured owner. [Core PR139](https://github.com/neo-capiro/capiro-backend/pull/139) has independent13/13 PASS and no identified projection-code defect, but **documentation CHANGES**: it overclaims whole-sync cause/all-worker state and prescribes callback routing/Send consent without proof. The unconfigured warning was on Gmail, not Microsoft.
4. **Prepared actions:** reads remain unavailable in General and client scope. Fix the existing read path; preserve uncertain action outcomes.
5. **Memory/document workflows:** merged fixes are live, but full fresh workflow acceptance is unverified. Original save/create effects remain UNKNOWN; reconcile exact receipts before replay.

Root's final smoke used exactly3 new submissions, no retries: General admission/history worked but mail failed; client-profile read passed; same-chat recall/streaming passed, while one Stop raced to Completed, so **cancellation was not proved**.

Separate limitations/debt: missing-fixture and other NOT RUN workflows; disabled legacy generators/previews; incomplete physical restore/retention/performance proof; baseline-identical lifecycle10/10 and Routines5/5 browser failures. These are not newly invented bugs or reasons to repeat accepted FE167–170 checks. Two Worker68 failed starts preceded native ECS recovery; cause remains unproved.

Deployed26 October00:34:47 UTC: Core15/929acd; Control72/Worker68/Schedule5/87dc; frontend33/d285; Runtime9/preview9/DEFAULT9. Existing Release remains sole shipper.

Use `FABLE-WAVE2-REMAINING-FIXES-PROMPT.txt` and its complete `FABLE-WAVE2-CARRYOVER-BRIEF.md`. No new decision is required to start. Actual OAuth consent is a later human step only if necessary. No external sends, authorization bypass or new architecture.
