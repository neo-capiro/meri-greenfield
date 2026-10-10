# Codex independent review: native DATA preparation

**Offline review PASS within the stated trusted-checkout boundary.** I found no source blocker in candidate `ca4144180d7507b5ee53c45b3b139a13693a9ed1` for preparing inert native/canary JSON. Integration acceptance remains the owner's decision. This review grants no deployed authority, runtime admission, security waiver or G1 advancement.

This is a separate Codex source review of source_discovery's implementation, not an implementation-author check or a Hermes review. Ownership is this new report and the ignored `.task-inputs/CODEX-G1-native-preparation-owner-review-1/` evidence directory. Existing source, contracts, fixtures and reports were not edited.

## Exact source and boundary

I read all three candidate files and all eleven compiler/scanner dependencies. Raw Git blobs at the candidate matched its three committed files; the eleven working files matched every literal length/hash and raw Git blob at `651ec8ce136a9ed3b22f911ea0dac90f33de40c7`. The scanner's `protocol.mjs` dependency is included. The retained evidence contains raw Git stdout/stderr pairs and the full eleven-record inventory, rather than relying only on the producer's manifest.

| Candidate file | Bytes | SHA256 |
| --- | ---: | --- |
| `scripts/qualification/native_preparation.mjs` | 13100 | `f6609d07b92f552215a524c75dff0fefde8e43daae1ac27c21dda0ab1fc8943f` |
| `scripts/test-native-preparation.mjs` | 13815 | `5990f8b9f97df8c232496c33409a6f8437cb599863207ec943de09bee5dd6cd4` |
| `docs/coordination/reports/CODEX-G1-NATIVE-PREPARATION.md` | 9242 | `16d1fa492d91df4fda25346805b32e3772df983fc43ddcd913d66b73f3e5bae0` |

The preparation module statically imports only Node built-ins. Before either fixed dynamic import it checks all eleven literal working/Git pins, the bounded input, its own source and the executing Node binary. It has no caller-selected compiler, import callback, source reader, root override or execution-admission option. The compiler receives only `{staticPins: pins}`. The binding and template must be inert; the full graph must retain its false guard and equal the template's embedded definition. All source/input/runtime checks repeat after the import awaits and compilation, before output creation.

The strict input scanner runs before JSON parsing. Its depth bound, duplicate/escaped-key rejection, fatal UTF8 handling, finite-number and reserved-member checks are meaningful. The reader bounds allocation before reading, compares path/descriptor identity and timestamps, closes descriptors, refuses visible ancestor links, nonregular files and multiple hard links. Output uses a new nonrecursive directory, exclusive files and manifest-last publication. A failed write may leave partial output; that directory must not be interpreted as a completed preparation or resumed silently.

## Independent checks

I ran the focused suite **once** using the pinned Node executable, a replacement environment without provider credentials or preload settings, `stdin=DEVNULL`, argument arrays and binary capture. Fixed Git was used; temporary suite clones were confined beneath the new ignored review directory. The run lasted **17.844 seconds**, from `2026-10-10T14:55:51.802144Z` to `14:56:09.653334Z`, under a 180-second direct-child timeout: **37 PASS, 0 FAIL, 0 skipped; child exit 0**. The nineteen source/input/runtime measurements were identical before and after.

Raw stdout is 3393 bytes, SHA256 `e4eac7c3861de311342f07ea238da3c40670b39bad33ba17e8d1d36504906008`; stderr is empty. `suite-envelope.json` SHA256 is `67c2300fb3d4863f2e75a164d1ffaf0358f1346489e9d1472f1c3c246591090f`.

The suite exercises all eleven missing and eleven same-size changed closure members, preimport changed-entry refusal before its marker executes, actual copied source/protocol/input changes after an import await, duplicate/escaped/nested JSON, invalid encodings/JSON/BOM, nonfinite/reserved members, cross-profile inputs, forbidden API options, the 16 MiB input limit, missing Git reference and existing-output preservation. Native/canary SDK-profile and role-free native products remain inert. The canary product comparison is against the same accepted compiler factory, not a separately frozen literal canary baseline.

The native A and B checks compare six product hashes with frozen historical oracles. I independently reconciled original A raw files, the retained author B products, their manifests and literal test oracles as DATA:

| Product | A SHA256 | B SHA256 |
| --- | --- | --- |
| Binding, 7133 bytes | `19dfb84639bad374aa8e38c255512d1a1cc76eb0843c3d2d5929d8a4a4d671c5` | `9b9b77832b482e2d70f096326aa5c50cac60dbb1a37187bbb68cb6d20af654c1` |
| Definition, 112210 bytes | `2c962d23a3ab42317e9b9d9ecd80c9d8eab7af6a7e9c59f46359de106f51eac3` | same |
| Template, 115766 bytes | `6a8c3255737fc3d9dc0153241fd3af49ad7d186607f7a3d6b371d2881561b4c7` | `c2de9e540fb97dc0e3a3ea421eea768ee58212c8593f4d70462bbc8f9bc0818a` |

All 23 payloads in the author's evidence manifest matched. The retained B manifest binds four data files and all eleven pre/post working/Git records, helper/runtime records, `INERT_DATA_PREPARATION_NOT_ADMISSION`, `runtimeEnabled:false`, the 91-state false-guard graph and its matching template. Independent DATA reconciliation is `retained-data-audit.json`, SHA256 `e704115edfd4e09af7cb993133454a4c874d9452147cb1ae28884ceb99e6280b`.

## Failed checks and material qualifications

My supplemental harness reached six expected CLI refusals for relative/directory/hard-linked input, junction ancestors and a missing output parent, then failed while setting up the copied repository: its own `scripts/qualification` destination directory was absent. Exit 1, original source, raw captures and error remain preserved. Its final per-child result table was never written; those branches are not six independently enveloped test results. I did not rerun the focused suite or those completed branches.

A new corrected harness completed only the unfinished await-boundary witness. It modified an isolated copied entry after preparation reached its import await. **The copied modified module's top-level filesystem marker executed, preparation refused, and no output directory was created.** This confirms the implementation's explicit limit: pre/post hashes detect unacceptable products but do not prevent changed code from running during an import race. Use is restricted to an ordinary fresh Node process in a trusted checkout, without hostile same-user writers, loaders, modified built-ins or prior cache interference. The witness does not establish a hostile-filesystem security boundary. Its envelope SHA256 is `078e73d9a4a248598ef61056ae5a06b7532637521d5a62947d0b7cecc69f6625`.

The author's earlier 36-test child passed, but its display wrapper failed on cp1252 Unicode output after saving captures. The corrected author run added the missing A oracle and passed 37; both histories remain intact and overlap. They are not 73 unique cases, and they do not replace this independent run.

Our supervisors use direct-child deadlines; descendant-tree cleanup is not proven. Raw outer captures have no live byte quota. Git and Node identities were independently measured, but the tool's manifest is identification DATA rather than authentication. Embedded evidence and origin labels, task definitions, IAM and mutating ASL states are compiler inputs/products; neither those labels nor compiled JSON prove fresh AWS authority or service behavior. The full graph intentionally contains task-launch/stop states behind its inert guard.

## Handoff

The finite review evidence manifest inventories **81 payloads**, 16910 bytes, SHA256 `989cc17d9aa42982a3788b32f402f804413041078782aa24396860d4ed645d7a`. It explicitly excludes full cloned repositories and path fixture directories; raw source blobs, helpers, captures, input files and results are retained. No full per-case clone or descendant-cleanup proof is claimed.

Recommend acceptance only for this exact offline DATA preparation source. A later separately reviewed owner executor must bind reviewed source/products, fresh service authority and real transport/worker/deadline/cleanup evidence. No AWS, provider, native worker, browser, build, deployment, Hermes or paid-inference action occurred in this review. G1 remains open, the recorded security findings remain open, Office remains deferred, and current Meri is untouched.
