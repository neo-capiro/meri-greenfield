# Profile capacity — bounded implementation outline

Base frontend7dbf8e1ee7e2ded8c6f7b0e3d3b9bc557cdca1a3. Core contract verified against fd8765ec01d292013758606204f2c9d886cd31c1. Shared policy b32b4803933760dc0a93fffdcd8fba30a89c3aac, map2026-09-30.

CORE-074/076: reuse the existing Core HTTP client, identity cache and client writer boundary. The billing feature owns the validated minimal state projection, capacity interpretation, fresh read preflight and a reusable status. Manual creation and LDA import consume the public interface; routes remain composition only. Scope queries by actor/tenant; do not treat client catalog visibility as tenant usage.

Current Core rules: billing disabled bypasses slots; comped bypasses slots unless payment-locked; trial allowance is at least ten; none/canceled require subscription; past_due retains slots until locked. Existing server rejection/partial LDA receipts remain authoritative. A browser snapshot does not reserve slots or fix concurrent backend capacity races. No financial calculations.

Figma411:45337 current high-fidelity context and screenshot inspected with required skill. Its exact quote/card/charge/receipt needs the approved new billing contract; example prices and card are fixtures. This pass provides truthful capacity feedback in existing Add profile/intake primitives, with no successful-looking payment controls. Add prospect remains independent of client slots.

Full summary CORE-075 has a separate BillingAdminGuard (active billing-admin membership or capiro_admin). Current identity projection lacks that capability; minimal state is safe for every role and sufficient for capacity. Summary, hosted Checkout/portal, payment requests and inline purchase remain distinct workflows.

Verification planned: schema rejection; disabled/comped/trial/active/past_due/locked behavior; tenant usage independent of accessible client list; failed/held reads prevent writes; actor invalidation/unmount; capacity change at dispatch; import selection size; server402 retains input; mutation invalidation; editing existing clients bypasses new-slot gate; desktop/mobile-dark browser capture. No live writes/provider calls or current build; Cleanup disk reserve remains active.
