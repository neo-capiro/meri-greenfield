# Independent observed-read integration review

**ACCEPT_SOURCE** for canonical source `753566baf2d230ed241941dcdeca41625277cb1d`, tree `660f21c0ccc165ba8741d477c6126e4e7e479be5`, and final root receipt freeze `4c40fb4c35d716dcd1e3b09ec29647ccca5a1326`, tree `4673eaef2e094d36cdb999f821ca12371488e24d`. Base is PR31 `cff71e1ba8ca8dea8970ad0c778b580a73f84815`. The complete test source is `005cb30d7e8c1be28792e4c722c62005e728862f`; its only product/test delta from the canonical source is the exact independent test reviewed here. No runtime gate is accepted.

Criteria were committed before candidate inspection at `a5a424ccf6d1db6c085cd2957cf7a91625bad8da`. The baseline capture confirms all four operations were unresolved in PR31. The new controls exercise the actual canonical resolver and production disabled gateway, not a replacement registry or disconnected family mock.

The accepted operation additions are `search_public_web`, `scrape_web_page`, `search_sam_opportunities`, and `get_florida_budget_project`. All prior 63 descriptors preserve their values/order, schema hashes and serialized callback source. All 139 original rows remain accounted for: 96 selected, 43 deferred; 66 mapped and 30 selected pending. There are 67 typed descriptors because the partial action-item contract does not map its original native capability. Every descriptor remains unimplemented/pending, with null handler and zero retries. Catalog version is 0.2.9, private contract version 0.2.0; public 0.1.0 remains unchanged.

The loader adds only the three accepted families. Public web and SAM use their named methods; Florida's generic methods remain namespaced in `floridaBudgetValidators`. Canonical output callbacks strip the original-request transport field before forwarding each family's closed context. Florida advertises normalized `FloridaBudgetInput` and still admits/defaults raw `FloridaBudgetRequest` through the normalizer. Context keys are closed and required where declared; model arguments cannot inject them.

The 27 independent controls pass. They verify exact descriptors/mappings/schema pins; unchanged prior callbacks; detached request/output and canonical argument digest; cross-family and hostile-data refusal without getter/proxy effects; catalog promotion, retry and schema mutations; every operation's unavailable gateway refusal before authority/budget calls; public-web query/text bounds, redirect and coverage relationships; SAM's separate observation clocks, count race, active/NAICS selection and trusted evidence mode; and Florida's raw defaults, named client/UUID resolution, folder conflict, scope/time and continuation relationships. URL syntax, asserted hashes, selected scope, source-status metadata and empty results are explicitly not network permission, provenance, current authority or completeness evidence.

Independent static preservation/packet audit is **311/311 PASS**. Of 6,947 original tracked files, **6,927 are byte-identical**; the only changes are three canonical files and seventeen allocated test expectation files. Applying each recorded replacement produces the exact changed test, and applying its inverse restores every original byte. The explicit four-operation allowlists and current counts preserve prior behavior assertions. All nine accepted family source/schema/author-test files match their reviewed commits. All six complete author/reviewer packet folders and their **153 manifest members** match the original immutable references.

| Family | Accepted source | Author packet | Independent family review |
| --- | --- | --- | --- |
| Public web | `c7d2bb344d56552d271c3f8d508b99cb8e2bb970` | `8edcfe8673072bcc925bc332e5a584b800ca5042` | `4e6733e7eb971bd71afb9a50817f0993ee02c228` |
| SAM | `02bac2139b13dec288b5ca2c19edc3be85e2c6b2` | `6414cdae5324b43e612b1176e7096cbeb8b50636` | `ae179ffc40e15a893cfaaa58d07caa6b0c5b2953` |
| Florida | `dabe2b50d94f0b12ef983292a1c18e1ef35d4675` | `e37a72402f8b4b7167e7efac9c4845caf5acef07` | `495cf95f842023c856716698a7effc62e98d30ac` |

The read-only root-receipt audit is **46/46 PASS**. It verifies raw-stream hashes, exact source/test pins, exit status, cleanup and results: root focused **755/755**, source audit **7,415/7,415**, family packets **171/171**, public generated/types plus **7/7**, and expanded **2,817/2,817**, zero skipped. Root expanded includes the exact 27 independent controls. This reviewer did not repeat broad or public suites.

Three reviewer assumptions failed and remain preserved with raw streams/preimages: the initial 26/27 test result assumed an ordering for SAM's context-key set; the first packet audit assumed lowercase `manifest.json` while the SAM reviewer used `MANIFEST.json`; the first receipt audit was 42 PASS/1 FAIL because it expected a script named `check:types` instead of the actual `typecheck`/`tsc --noEmit --strict`. Corrections changed only those assumptions. No production defect or source repair is attributed to them. The corrected assertions retain exact required-key admission, filename bytes/hash validation and actual compiler invocation evidence.

All seven reviewer-owned groups (`268233`, `269443`, `269501`, `270772`, `271176`, `271949`, `272026`) exited and were absent, with no timeout/kill. Five root check groups were likewise absent; its public and expanded captures reaped five zero-exit descendants. These receipts cover local source-check cleanup only. Previous author/reviewer failures, including Florida's immutable UUID/alias negative controls and raw whitespace limitation, remain unchanged in their original packets.

No production, runtime, native, SQL, cloud, provider/model, customer-data, security, proxy or frontend action occurred in this review. Dependencies were copied from an existing exact-lock donor, without installation. G1 remains open. Source adapters, current tenant/actor/wall and folder authorization, context/clock provenance, source/HTTP limits and model/runtime execution remain unqualified. Passing a private contract cannot enable a descriptor or establish full native capability parity.

Reproduce the focused integration controls after merging the reviewed source and test:

```sh
node --test packages/contracts/test/retrieval-observed-integration-independent.test.mjs
python3 docs/qualification/candidates/read-continuation-20261012/observed-reads-integration-review/audit.py 753566baf2d230ed241941dcdeca41625277cb1d
python3 docs/qualification/candidates/read-continuation-20261012/observed-reads-integration-review/receipt-audit.py
```

The review manifest binds this report, the exact independent test and all allocated evidence, excluding only itself. Final acceptance is source/receipt acceptance at the exact pins above.
