# Accepted PE reference result ownership repair

**ACCEPT_SOURCE** for `8dcc6e13f360c15d9ba0f7c9fbd3419f1318afe3`, independently reviewed at `d42163c7de42aa39010d29be9c3fdd2693343084`. The one-line production change returns the exact validated snapshot from `assertPeReferenceOutput`, preventing later direct caller/result mutation from changing the other object. All three reference operations and both contractor outcomes retain their value and validation semantics. The canonical resolver already detached caller data before this repair; no live gateway bypass or runtime acceptance is claimed.

Root negative controls first reproduced six direct alias failures while three canonical controls passed. The production repair passed all new controls; the original family suite had 70 passes and one obsolete same-identity assertion. The sole original assertion edit now requires deep value equality, distinct result identity and unchanged caller data. Its exact original file, replacement text and inverse patch remain preserved.

Final root focused verification is **144/144 PASS**: original family/independent behavior, nine new ownership controls and connected canonical/catalog checks. Source/receipt audit is **14,410/14,410 PASS**, preserving 7,184 of 7,186 original files byte/mode-identically; the only changes are the one-line return and explicit author-test assertion. Three bounded focused setup failures are retained: initially omitted sparse gateway/r2 dependencies, an unsupported sparse-add option that left the first omission unresolved, and two missing frozen baseline evidence files. Correcting the local checkout changed no source or assertion. Every root check group exited without timeout/kill.

Independent verification passed **16/16 controls** and **32/32 source checks**, including full nested contractor provenance/buckets and bidirectional mutation isolation. Eight corrected baseline ownership failures are retained; a reviewer fixture that accidentally accessed a proxy before admission was corrected separately, with its original failure preserved. The independent report and 18-member manifest are imported exactly.

All schemas, catalog descriptors, original scope and public contracts are unchanged. Handlers remain unavailable; source, authorization, native/runtime and deployment gates remain HOLD. No external source access, provider/model/SQL/cloud action or spend occurred. Seven owned copied dependency directories were verified against their capture and removed; the shared donor was untouched.

## Historical implementation outline

# PE reference result detachment

## Outline before repair

Base is PR32 `ede7b56845816d38d0bbffab5a657aaa4f978739`. Root owns one production line in `pe-references-validation.mjs`, a new detachment test, any explicitly justified original test expectation correction, and this report/evidence packet. The separate program-element family is outside this repair. Independent reviewer owns separate tests/report/evidence.

Direct `assertPeReferenceOutput` currently checks a detached inert snapshot but returns the caller's object. Its old author test explicitly expects that identity. The canonical operation resolver already snapshots before calling this validator; this finding does not establish a live gateway bypass. The proposed private API change is to return the exact validated snapshot, matching recent accepted family boundaries. Preserve value semantics, source admission, registry/descriptors and all public contracts.

First reproduce caller/result mutation aliasing using the unchanged source. Freeze the negative test and raw failure. Then return the validated page and run the original family suites unchanged; preserve the expected obsolete identity assertion failure before replacing only that assertion with deep equality and distinct identity. Save the exact inverse patch and original preimage. Recheck original family behavior, new mutation controls and canonical resolver behavior. No source access or native/runtime/provider/SQL/model/cloud execution is authorized or implied.

Acceptance requires independent review at the exact source commit, preservation audit, bounded process exit and complete raw evidence. This is a source-only repair; all handlers remain unavailable and G1 remains OPEN.
