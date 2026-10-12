# Backend execution integration test-author receipt

Test source freeze: `60ef3f099107886565d2f20723ce0a01fcb9ca82`, on immutable canonical dependency `ea94aff840424843b4b6efbfc21fb9d195f7ff54`. Author readiness: checks pass; independent combined acceptance belongs to the root reviewer. This packet neither qualifies source access nor closes G1.

The root dependency was imported by merge `d64d3dd982e93d179f56eeb22cc8a82ba3eeafb8`; it is not a test-author implementation commit. Test-only changes are `5c87a258caf638738de45ef3b5a05310ea20f75e` followed by the one-literal fixture correction `60ef3f099107886565d2f20723ce0a01fcb9ca82`. Outline/preimage commit `88e4c5aa` precedes that dependency merge. Root can integrate the two test commits plus this evidence packet without replaying the dependency merge.

Exactly19 existing test paths change. The new `backend-execution-expectations.mjs` names each expected field transformation; it preserves other descriptor/binding fields, callback source strings, schema hashes and output definitions. The script applies all changes only after every inverse succeeds. `test-expectation-updates.json` records exact predecessor/final hashes and reversible offsets, including whole-file import steps. All19 inverses restore PR35 bytes exactly. Historical snapshot files are unchanged.

The expected ledger is139 originals,96 selected,43 deferred,83 mapped selected originals,13 pending selected originals and84 typed descriptors. The12 same-ID additions are explicitly listed. The remaining mapping is `query_action_items` to `actions.query`; the original partial descriptor and its scoped-only validator remain covered. Its replacement, two limitation strings and registry `supersededBy` are explicit changes. Original pending-case assertions for newly mapped `query_action_items`/`query_global_data` are replaced by canonical positive and rejection controls; no partial-mode rejection is removed. Hash tests reverse only the specified changed fields after checking their current values.

The31 caller-schema corrections are tested against their frozen audit examples. Every raw request now passes its advertised Request definition, and all31 retain the original normalized value, arguments hash and family validator file hash. Exactly22 examples failed the former normalized advertisement; the other9 did not. The source family schemas and outputs were not modified. The dataset profile expectation adds the exact `list_global_datasets` / `dataset-metadata/1` row in canonical registry order.

`backend-execution-connected.test.mjs` exercises all13 request/context/result paths through the actual resolver. It checks detached original requests/results, normalized hashes, trusted-context exclusion from raw requests, hostile data rejection, selected-context/result substitution, action successor target/partial/self-cycle/alias/enabled mutants, and all84 source-disabled gateway refusals before any authority or budget port. Synthetic empty/partial observations are not evidence of data absence, source coverage, approval or current authorization.

Checks actually completed:

- Exact predecessor suite: **634/634 pass** at `5c87a258`; its19 files are unchanged by `60ef3f09`.
- Connected controls: **33/33 pass** at `60ef3f09`.
- Offline inverse/source/capture audit: **154/154 pass**. Lexical assertion/declaration counts supplement the exact inverse; they are not described as an AST semantic proof.
- Full staged whitespace check failed only on preserved raw patch/failed-output spacing (four exact paths recorded in `test-author-whitespace.json`); the check over all remaining staged files passed. Raw evidence was not normalized.
- Nine owned capture groups are physically absent; none required a kill or timed out. Their original exit codes and raw streams remain in the packet.

Preserved failures and corrections:

- Initial setup/mixed-source diagnostic:470 pass/18 fail. A transformation was accidentally started before that run ended and wrote10 test files before its inverse failed. This capture is explicitly **not an exact baseline**. Its initial receipt, raw outputs, failed script and partial diff remain. No acceptance relies on it.
- First transformation failed because replacing26 with13 collided with a pre-existing13 assertion during naïve inverse counting. Exact positional inversion and atomic file staging fixed the script.
- First updated predecessor run:629 pass/5 fail. Three failures were stale expectations: dataset profile ordering, an unchanged historical hash needing explicit field reversal, and the original action pending loop. Two were an unmaterialized immutable capabilities fixture. Corrections preserve all original assertions except explicit mapped/pending expectation updates.
- First connected run:32 pass/1 fail. The profile fixture attempted to read a nonexistent schema `const`; the accepted validator requires a literal coverage note. The final commit changes only that fixture literal, with no production or assertion change.
- Setup diagnostics include `.git/info/sparse-checkout` used before recognizing worktree `.git` is a file, and the capture helper rejecting `--help` before allocating a child. Neither caused a runtime action.

Only the seven existing small contract dependencies were copied locally from the allocated donor. No installation, lifecycle script, model/provider, source, SQL, native runtime, service, cloud, frontend or deployment action occurred. Canonical production bytes match the root dependency. Root's combined verification and independent review remain separate gates; all84 descriptors remain unavailable/null/pending with zero retries.
