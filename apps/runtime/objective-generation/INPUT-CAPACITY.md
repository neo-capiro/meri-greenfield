# Private Objective input capacity

Core publishes the complete required Objective context and applies its own final
serialization preflight. Meri preserves that exact prompt through private
admission, execution, completion and retained readback. Ordinary public submit
remains limited to 100,000 characters and 128 KiB; supplementary retrieval keeps
its existing independent limits.

The shared private envelope policy is implemented in
`packages/runtime/objective-input-capacity.mjs`:

| Boundary | Maximum |
| --- | --- |
| Final prompt, UTF-8 | 768 KiB |
| JSON-encoded prompt string, UTF-8 | 896 KiB |
| Complete Core publication | 1 MiB |
| Private accepted request | 1 MiB |
| Immutable paired selection, including two prompt copies | 2 MiB |
| Completion identity and response, including three prompt copies | 3.25 MiB |
| Retained Core readback, including five prompt copies and result base64 | Existing 8 MiB |

These are serialization limits, not token estimates. The qualified Objective
model is the existing Sonnet 4.6 provider model. After immutable Objective runtime
selection succeeds, the SDK receives its explicit `[1m]` context suffix in both
`options.model` and all three pinned model aliases. Provider/model custody keeps
the original bare identifier. Other Objective models/providers fail closed;
there is no model fallback, quota change or ordinary-chat model change.

Private admission requires the immutable run-start record and exact request,
binding and client-scope equality. It projects only the separately validated
prompt into canonical public shape/receipt validation, then hashes and stores
the full original input. The projection is never saved or returned. Larger store
acceptance requires that same proof. Completion checks the complete response
before committing. Retention reads the strict persisted five-field Objective
request shape without granting submission authority.

The Objective lifecycle uses private read-run and retained-result routes. It does
not create a Core `clio_conversations` row for the public conversation index. No
public submit, history contract, provider credential rule or model budget changes.

Qualification uses synthetic full-size prompts, multibyte and JSON-escaped
boundaries, canonical native admission and completion owners, ordinary-input
negative cases and retained readback. Provider execution and live browser
acceptance are separate release checks.
