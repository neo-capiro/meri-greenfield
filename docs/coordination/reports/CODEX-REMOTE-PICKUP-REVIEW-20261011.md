# Remote pickup source review — 11 October 2026

## Pins and decision

- Shared Capiro policy: `b32b4803933760dc0a93fffdcd8fba30a89c3aac`. `origin/main` was fetched; local policy HEAD is clean and three commits ahead with no incoming commit. Machine map last modified 2026-09-30 00:21:48 UTC, SHA256 `294d7449619e3b10913008e31d8d610075e6852ff0f0cc0d38de8f6a8c6369ab`.
- Published handover: `05271df2bbe7fd50031e7486316a23f05a70bc49`, unchanged remote branch at pickup. Accepted prior source: `2f0e03ac656e393165ebc539bf6bfe9209623e2d`.
- Local integration branch `resume/meri-g1-integration-20261011`: mail `d041d7b025f87e8dc14623bda5abb899831e344c` from `dd98d6268d2e7057b4ef236bb2fd352f0fb0cec6`; metadata `933136745bb749e00bb6310f81b89584eebaa58a` from `086263abdf1b5c34b502a44d957b5568e837f992`; SDK adapter `be3908ce934ec21eabaf48ef86f6e9455edf94b2` from preserved `4d33640d9eaadc045c1c1f15dfcceddfe330f3fa`.
- Mail: **ACCEPT SOURCE ONLY** for pending private list/search contracts, with null handlers and disabled source access. SDK wire/callback: **ACCEPT SOURCE ONLY** for the partial qualification fixture. Metadata: **ACCEPT DOCUMENT PUBLICATION ONLY**; the 93-intent extraction claims remain pending original private JSON/capture review. None of these decisions closes REL-02, the runtime fixture or G1.

## Independent checks

- Mail candidate changed exactly its eight committed paths; `git diff --check` passed. Pinned `npm ci` completed with Node 24.19.0. The first contract run passed 91/92: the public distribution check could not find `esbuild` because `packages/contracts` has its own lockfile and had not yet been installed. After its independent `npm ci`, the exact candidate passed 92/92.
- Metadata candidate changed exactly two task/report documents. The report's 93 unique IDs equal the canonical selected ledger minus three mail IDs, with 86 literal, two partial and five missing statuses. Three frozen Capiro source blobs matched both reported SHA256 and Git blob IDs at `fd8765ec01d292013758606204f2c9d886cd31c1`; the four proposed missing-metadata blob IDs also matched. Its ignored `CAPABILITIES-93-FINAL.json` and original reader captures were unavailable on this host, so individual extracted schemas/defaults were not independently reproduced.
- All seven SDK WIP paths matched the handover manifest's byte counts and SHA256 values. The exact WIP commit passed its focused 46/46 wire, callback and existing fixture-contract tests. The returned source remains a thin, private adapter; it does not supply authenticated transport, durable storage, live fence publication or an actual two-task fixture.
- On the local integrated tree, all contracts plus the SDK callback passed 121/121; the public 0.1 distribution's generated check, typecheck and 7/7 package tests passed. The contracts, callback and unchanged native-session-file tests passed 135/135 when run serially. The broad concurrent run failed twice at one unchanged `native-session-files.test.mjs` source-identity case with `SOURCE_CHANGED`; that file passed 14/14 alone. Preserve this concurrency failure for diagnosis before any broader acceptance claim. `git diff --check` passed; the branch was clean after the three cherry-picks.

## Remaining boundaries

Original ignored `.task-inputs` captures were not present at the historical worktree paths on this server, and no approved encrypted archive locator has been provided. The frontend was cloned separately at `28c300093c0886018c49df8764a8e6fac44819eb`; no frontend implementation or live transport was accepted here. Node 24 was supplied by the bundled runtime; system Node 22 does not meet either repository's engine range. No cloud, source, provider, model, customer-data, merge, push or deployment action was performed by this review.

G0 stays accepted; G1 stays **OPEN**; G2–G7 remain unentered. The source integration is local and requires subsequent bounded implementation, independent exact-candidate checks and the relevant owner admissions before operational tests or publication.
