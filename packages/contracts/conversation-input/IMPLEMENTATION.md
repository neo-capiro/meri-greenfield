# Durable input admission contract

Base: `14f0bc2e5716af7c00925d13d3365b26182c9e56`. This additive contract lane owns only the new `conversation-input` source, focused generator and public controls. Runtime admission, persistence, HTTP composition and shared package metadata remain with their allocated owners.

The new positive receipt is exactly `{run, request, lastSequence, replayed}`. Its request, stored request and run schemas reference the accepted canonical owners. The browser receiver obtains a genuine submit request through the existing public receiver, and delegates submitted/history semantic checks to that same module. The generated module retains a sibling import of the existing distribution so its provenance brands are shared, never copied into another bundle.

`receiveConversationInputResponse` requires independently authenticated context, checks its run identity and selected client scope, and returns only a correlated receipt. `conversationInputView` provides the genuine canonical history view for later ordinary submit/history calls. An internal Node assertion validates the same strict receipt and semantics without asserting authority; the server service remains the owner of current authorization and deadlines. Neither validation nor an absence/error result grants dispatch permission. A queued receipt records durable admission and does not establish provider execution.

The focused generator writes only four new input artifacts and records source hashes plus the immutable canonical artifact dependencies. Existing conversation application/history distribution bytes are read, never regenerated. Qualification owns serialized generation, package metadata and compiler stages. Focused public controls cover request/view provenance, immutable correlation, normalized windows, independent context, status/error/byte bounds, browser imports and old/new receiver interoperability. No runtime, provider or real database claim follows from these controls.

Initial state: source authoring only; generation, tests and type compilation are intentionally unrun pending the Qualification resource slot.
