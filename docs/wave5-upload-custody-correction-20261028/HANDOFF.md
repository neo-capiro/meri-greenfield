# Upload bearer compatibility correction

## 1. Requirement and source

This successor to b43b590e83ce256c1adc544579ea1fca19fb177e addresses independent Hermes F1 in report f2412f53af64cf55238bd79c45487df68f98af2e551c292ad206d8245ba6af6f. Original source and report remain unchanged. Scope is the existing upload HTTP boundary, its focused test and generated source-hash metadata.

## 2. Behavior

Uploads accept the same bearer character class and 8192-character ceiling plus up to two trailing padding characters as canonical conversation HTTP. The exact token is forwarded unchanged to existing session authentication and current-access checks. Syntax acceptance never grants access.

## 3. Ownership

No credential owner, route, persistence, package manifest, public schema, archive, policy or native tool changes. This preserves all original custody and UNKNOWN semantics.

## 4. Failure witness

The new focused test fails on b43's original application with 403 instead of 200 for a legal canonical token. Evidence is work/wave5-upload-bearer-failure-witness.log. It also checks illegal/internal whitespace and punctuation, invalid/middle padding, excess length, unchanged token forwarding, and denial by the actual session owner.

## 5. Checks

Run the affected upload policy/extraction/custody/retention and runtime port tests, plus canonical upload generation/check and git diff --check. Exact results are recorded in the external correction handoff after execution. Previous source review/tests and isolated SQL proof are reused for unchanged behavior; no full campaign, build or live operation.

## 6. JPEG/PDF bound ownership (review F2)

Admission validates PNG dimensions but only JPEG/PDF magic. The separate native extractor must enforce JPEG's 40-million-pixel and PDF's 200-page limits before decoding/rasterization; this checkpoint does not establish those native observations. The native owner and real corpus qualification remain required before exposure. A missing parser remains unavailable, never extracted by assumption.

## 7. Conservative failure outcomes (review F3)

Status makes only a read-only native observation but may durably reconcile a positive exact-object observation from writing to stored. Its READ_UNAVAILABLE failure outcome does not authorize a second PUT or imply no local reconciliation occurred. Inspect failures are conservatively UNKNOWN after dispatch, including a non-stored refusal before actual inspection; callers must consult current status, not infer an effect or retry grant from that label.

## 8. Remaining scope

Original b43 remaining migration registry, native source/config/host/image/corpus, input selectors and SDK Read, public package binding, UI and deployed acceptance obligations remain open. This is a bounded compatibility fix, not MM12 completion.

## 9. Integration

Keep b43 and its first review frozen. Independently review only this correction delta, then join its exact commit with the later coherent96d-based input source. No push, merge, deploy or target operation is authorized by this handoff.
