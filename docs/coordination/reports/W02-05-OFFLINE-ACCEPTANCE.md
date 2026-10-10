# W02-05 integration-owner offline acceptance

Codex accepts the exact SDK wire-capture preparation at `85ca1efd09f4d6c03d3e4d6048966db30c16b7a5`. This integrates four new files and preserves the real Hermes implementation and subsequent Codex correction lineage. It does not admit a native task, provider request or deployment, and G1 remains open.

Separate actual Hermes review 6 ran against that exact commit in session `20261009_201418_ab097e`, from 2026-10-10T00:14:13.401544Z to 00:25:56.711489Z. Its report-only commit `7e9aa3d7f5727052ac719ee7b5208315acb8d8e1` is retained unchanged. The launcher recorded exit0, no remaining descendants, empty process tree, finished readers, cleanup confirmed and no capture/cleanup errors. Earlier rejected candidates and review5 findings remain historical evidence; they are not retroactively accepted.

The accepted correction closes review5 F1-F4: current report hashes and owner attribution; bounded writes with one persistent error/close observer per stream and sticky failure; an assistant response containing exactly the emitted tool-use block; and camel/acronym credential-key detection while retaining plural token accounting fields. This accepts the terminal Node Writable close contract and a fail-closed stream after timeout. It does not claim handling of arbitrary events after terminal close.

Codex independently reran the exact source's 73 owned tests and 14 prior adversarial cases, then personally reran the separate reviewer's 55 new cases. All passed. The real reviewer also reported 81 worker static and 15 root checks against byte-identical files in the pinned dependency checkout. Its fresh review checkout lacked dependencies and failed to load the root check; that environmental limitation and read-only sibling dependency reuse are disclosed in the unchanged report. Tests use synthetic injected fakes: no SDK child, socket, server, AWS, model, credential or private source was exercised.

Accepted SHA256:

| File | SHA256 |
| --- | --- |
| sdk-capture-options.mjs | 964f4f1958dd0707198fcd21611018b9a9337e90e5f434ed24ce47beb3986b0e |
| sdk-capture.mjs | 4b71228ed0ce49f4bc39c2abcc497d7b76fea30ffd115ca796a13dff7edd6840 |
| sdk-capture.test.mjs | 38a3018af9702affe042bb8a2bf8f9078c5353446c2599f16d933f163c751c72 |
| W02-05-SDK-WIRE-CAPTURE.md | 1f840b51e2c958484138545b268f72043bb9937014a32bf77c7f5e218fe8c843 |
| W02-05-SDK-REVIEW-6.md | e740dd9525fe7415daf2c22d561833d78d694397aaf55bef242d2d021c6bb761 |

Native synthetic wire capture on an independently admitted image, trusted proxy/Bedrock translation and authorization, durable aggregate budget, cancellation/retry handling, and session/file recovery remain unrun. No prior image admission transfers to a refreshed candidate. Bedrock test spend remains $0 of the authorized $10 cap. Current Meri/Capiro and production routing remain untouched.
