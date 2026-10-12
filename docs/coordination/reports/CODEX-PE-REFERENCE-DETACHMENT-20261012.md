# PE reference result detachment

## Outline before repair

Base is PR32 `ede7b56845816d38d0bbffab5a657aaa4f978739`. Root owns one production line in `pe-references-validation.mjs`, a new detachment test, any explicitly justified original test expectation correction, and this report/evidence packet. The separate program-element family is outside this repair. Independent reviewer owns separate tests/report/evidence.

Direct `assertPeReferenceOutput` currently checks a detached inert snapshot but returns the caller's object. Its old author test explicitly expects that identity. The canonical operation resolver already snapshots before calling this validator; this finding does not establish a live gateway bypass. The proposed private API change is to return the exact validated snapshot, matching recent accepted family boundaries. Preserve value semantics, source admission, registry/descriptors and all public contracts.

First reproduce caller/result mutation aliasing using the unchanged source. Freeze the negative test and raw failure. Then return the validated page and run the original family suites unchanged; preserve the expected obsolete identity assertion failure before replacing only that assertion with deep equality and distinct identity. Save the exact inverse patch and original preimage. Recheck original family behavior, new mutation controls and canonical resolver behavior. No source access or native/runtime/provider/SQL/model/cloud execution is authorized or implied.

Acceptance requires independent review at the exact source commit, preservation audit, bounded process exit and complete raw evidence. This is a source-only repair; all handlers remain unavailable and G1 remains OPEN.
