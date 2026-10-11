# Manual meeting debrief source

Root owns `calendar/debrief/**` and actual Calendar/detail/editor composition. The existing library owns transcript extraction; both handoffs use the same validated generation adapter and existing debrief editor. No second document editor or provider client was added.

Figma design-to-code context and screenshots inspected: desktop682:142797 and mobile698:142709, with source chooser411:64308. The text-only dialog uses existing Dialog/TextareaField, Geist and theme tokens: desktop660px, mobile358px at390px viewport, textarea180px, desktop padding24px/mobile16px. No Figma writes or new static assets.

The current capirov2 contract at fd8765ec01d292013758606204f2c9d886cd31c1 accepts `POST engagement/meetings/:id/debrief-draft` with `method=manual` and nonempty `sourceText`. It checks the owned meeting and external runtime gate, performs generation and returns a proposal; it does not save a debrief. Written context is preserved verbatim after nonempty validation. The UI bounds input to50000 characters. Generating, saving, approval and sharing remain separate explicit actions.

Written source and pending generation belong to one meeting/tenant/actor lifetime. Changing that scope remounts the coordinator; unmount aborts the request and refuses late results. Current identity, role and runtime capabilities are checked at dispatch and response boundaries. Synchronous dispatch fencing prevents repeated submit; no automatic generation retry occurs. On failure, source remains available within the same scope and an explicit warning explains that another generation is a new request.

Root browser qualification exercises whitespace rejection, exact Unicode/multiline request, separate save, failed-response retention, no automatic retry/save, navigation during held generation, runtime denial, and desktop/mobile-dark geometry. These use synthetic intercepted contracts, not live model/provider acceptance. The matching Clerk tenant/JWT/backend issuer environment remains required for signed-in local acceptance. Saved Notes are not relabeled as Meri-captured notes without verified provenance; voice capture remains separate work.

Desktop and mobile rendered dialogs were visually reviewed against the inspected references. The standard visible keyboard focus ring is retained. Existing meeting drawer and broader calendar visual differences are outside this dialog change. Check results and source binding are recorded separately in parent output evidence.
