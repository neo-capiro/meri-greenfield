# Document read: source-only tariff successor

This proposal extends the **base general-read manifest**, not the selected
`read_client_documents@0.2.0` operation or its input/output schema. The Core
owner must make `POST /api/clio/tools/read_client_documents` unconditionally
provider-disabled for every 0.2 task token in the deployed source/image:
`allowPaidExtraction:false` must be applied before both vision and Whisper
branches. Listing and locally extractable text may return; image-only and
audio/video content must return the existing truthful unreadable/blocked
coverage or fail closed, with no provider call. The current Meri dispatch
maps a Core `UNAVAILABLE` failure to `INVALID_RESULT` for this family, so a
typed unsupported result is not yet a completed receiver contract. A MIME,
filename, model argument, or unsigned header never selects this mode.

The new manifest variant is exactly:

```json
{"mode":"source_text_only","route":"/api/clio/tools/read_client_documents","coreSourceCommit":"<40 lowercase hex>","coreImageDigest":"sha256:<64 lowercase hex>","configurationSha256":"<64 lowercase hex>"}
```

It occupies `manifest.documentPricing` only when the document operation is
allocated. Exactly this variant has `profileVersion:"1.1.0"`, and its document
schedule charge is exactly **1 µUSD per call**. The allocation's existing
manifest digest, run limits, reservation, settlement, deadline, task token,
correlation, selected client, and output validation still apply. The old
`profileVersion:"1.0.0"` accepts only the complete vision plus transcription
pricing object and remains parseable; the composer emits 1.1.0 for this new
variant only. The existing complete pricing object is still accepted and its
conservative maximum charge is unchanged. No `actualCost` field is added to
the closed document result.

The Core source commit, deployed image digest, and configuration digest must
be measured and compared with the **current** Core route by the shipping/render
owner before this variant is issued. That current-Core comparator is required
work: today's Meri installation measures Meri source, not the Core route.
Shape validation alone is not that comparison. The source-only variant must never be issued
against a Core route that can make a paid extraction call. The current Meri
adapter does not send an extraction mode to Core; the Core route must remain
provider-disabled for the lifetime of every live 1.1.0 text-only allocation
and delegation. To enable paid extraction on that same endpoint, first drain
or expire those runs/delegations and use the complete measured pricing object
with a pre-call audio-duration cap, or introduce a separate signed/versioned
mode selection checked by Core before both paid branches. Do not infer the
mode from returned content.

Implementation is limited to the existing Meri general-read manifest,
allocation composer, charge-schedule parser, tariff proposal, and focused
tests. The Core route, current image/config measurement and runtime relay
belong to their existing owners. Current `documentPricing` validation checks
the syntax of those pins; the runtime comparison is still an integration
requirement. The signed task credential relay is also still pending. This
source proposal does not install or activate the document read.
