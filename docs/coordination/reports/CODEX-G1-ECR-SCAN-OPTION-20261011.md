# ECR scan option and UTF-8 capture repair

11 October 2026 UTC. Base
`631aee670fcee6efa7170bf969b9f05f90de12e5`, dedicated branch
`task/codex-aws-scan-option-20261011`. Primary Codex owns this narrow
repair; the AWS shipper's claimed report/task/evidence paths are untouched.
**ACCEPT source-only repair after independent review. No AWS action,
image build, runtime admission or G1 closure.**

## Trigger and intentional changes

The shipper reports that CLI 2.36.8 rejects plural `--image-ids` on
`ecr describe-image-scan-findings` with parser exit 252 before service
access. The unmodified helper rejects the required singular form. The
[official command reference](https://docs.aws.amazon.com/cli/latest/reference/ecr/describe-image-scan-findings.html)
confirms singular `--image-id`. Existing `describe-images` and
`batch-get-image` use the plural form.

The canonical `scripts/qualification/aws_evidence.py` now has one named
`COMMAND_OPTIONS` override: scan admits exactly `--repository-name` and
`--image-id`. Selection occurs after the existing operation allowlist,
before option validation, deadline validation, directory allocation and
dispatch. Other service/ECR vocabularies and publisher calls are unchanged.
Wrong plural, unrelated scan options, abbreviations, equals syntax and
global/pagination options refuse before effects. The scan-preparation
report's erroneous example is corrected without rewriting a capture.

The shipper's subsequent native singular read reportedly succeeded with
47 rows but emitted CP1252 `0x92`; `json.loads(bytes)` then refused UTF-8.
That reported fresh 59,678-byte capture has SHA-256
`011fff3c6b57794e0674644c0f8d14c56a7b6a94c1512e3806b256abe2afaa6a`.
It is separate from historical `56a3d5f8…`; neither set of raw bytes was
supplied to or rehashed by this source task.

The already scrubbed child environment now sets
`AWS_CLI_OUTPUT_ENCODING=UTF-8` for captures. This changes non-ASCII CLI
output encoding intentionally; input-file encoding, executable selection,
profiles, caller guards, timers, shell, retries and raw receipt structure
stay unchanged. There is no fallback decoding, transcoding, replacement
character policy or historical checksum reconstruction. Raw stdout/stderr
and their hashes are retained before parsing, including malformed output
after a successful process exit.

[AWS configuration documentation](https://docs.aws.amazon.com/cli/latest/topic/config-vars.html#locale)
documents the output variable. The exact
[AWS CLI 2.36.8 source](https://github.com/aws/aws-cli/blob/2.36.8/awscli/compat.py)
defines it and reconfigures output streams through
`set_preferred_output_encoding`. The complete reference source, including
its Apache-2.0 notice, is retained as evidence only; no upstream CLI code is
copied into product logic.

## Verification

Python 3.12.14, isolated `-I -B -S` checks, each with an external 60-second
timeout:

| Check | Result |
| --- | --- |
| New ECR vocabulary/capture tests | 7/7 PASS |
| Original history tests, byte-identical | 4/4 PASS |
| Original timeout tests, byte-identical | 10/10 PASS |
| Existing publication suite on candidate | 8 PASS / 1 ERROR |
| Same publication suite on exact untouched base | Same 8 PASS / 1 ERROR |
| Source preservation and upstream encoding exercise | PASS |
| Diff whitespace check | PASS |

The publication error is the preexisting
`test_publish_manifest_pins_both_new_sources` refusal
`ValueError: exact source/recipe records`; the collector's old fixed member
count does not match current source. Its raw candidate and fresh-base
failures are both retained. No fixture, record count, runtime/caller guard,
authority, assertion or gate is weakened to hide it. The first combined
verification script finished its checks/preservation proof and exited 1
because it asserted every suite passed; that failed outcome is retained,
not described as overall success.

The new offline tests deny actual process/socket effects and mock only the
CLI boundary. They verify exact singular argv, raw UTF-8 punctuation,
receipt hashes, fixed environment over a hostile CP1252 override, existing
plural reads, no singular escape to other commands, refusal before
allocation, original profile/deadline behavior, one-call failure retention
and untranscoded CP1252-byte refusal. They prove adapter behavior, not live
Windows/AWS compatibility.

The separate encoding exercise executes the actual 2.36.8 upstream
encoding function, extracted from the retained reference source, on a real
`TextIOWrapper` initially configured for CP1252. With the supported variable,
the stream emits UTF-8 accented text and U+2019, which round-trip through
`json.loads` with exact values and no CP1252 `0x92`. It does not execute an
AWS binary or emulate the whole Windows CLI.

Preservation compares the canonical AST to base after removing only the
new vocabulary override, its lookup and output-encoding keyword. All other
code is AST-identical. Original history/timeout tests, worker builder,
publisher, host-assets builder, read-only request validator and shape
decoder remain byte-identical. Two early multi-file patch attempts refused
incorrect context before applying changes; corrected context applied the
intended patch. One optional raw-source web reader refused the URL; the
GitHub reader retrieved the exact tag source. These preparation failures
did not change tests or grant runtime authority.

The first cached diff check caught one extra terminal newline added by the
reference-file patch wrapper. The local commit was not published. That
extra byte was removed to match the complete fetched reference exactly,
its evidence hash was refreshed, and the corrected cached diff was checked
before final source acceptance/publication. Upstream function bytes and
all tested product/test code were unchanged by that evidence correction.

Raw check streams/envelopes, exact upstream source and preservation proof
are under
`docs/qualification/candidates/ecr-scan-option-20261011/`.

## Handoff and remaining gates

Independent review accepted frozen source
`42399f0569921eb81e0a91eb06d85353d5745686`, tree
`6be454ef5e4ab0a6ff71c1205ab8a4c64cdd37bd`. It separately reproduced
7 ECR, 4 history and 10 timeout tests, all PASS, and verified clean bounded
process exits, the complete canonical AST/unchanged-file proof, retained
capture hashes, the exact reference-source hash and the actual upstream
CP1252-to-UTF-8 stream exercise. No cloud or native CLI execution occurred.
The following acceptance/evidence additions are documentation only; tested
product/test bytes are unchanged.

The independent reviewer retained exact unified tool command receipts and
merged output, explicitly not separately captured binary stdout/stderr.
These receipts/proofs are copied byte-exact into the evidence directory's
`independent-review/` subtree. Author split raw streams remain separate.

After independent source review/publication, the shipper should use the
exact reviewed commit in an isolated checkout and reacquire the scan with
singular `--image-id` through the unmodified canonical entry point. Retain
the original parser-failed capture, the native CP1252 capture and the new
UTF-8 capture independently; verify the last receipt's source, raw bytes,
complete counts and absent continuation token. Do not require the new
response to match an old checksum.

The shipper's Python 3.11.15/user-path and `capirocli` identity still do not
satisfy the worker builder's pinned Administrator Python 3.12.14/path/hash
and `hermes-cli` principal. This patch does not repair or bypass those
separate bindings, rebaseline consumed build authority, fix image findings,
or admit a new build/runtime. Endpoint ENIs are shared infrastructure and
remain outside temporary-task cleanup. Source/image/license/security and
actual recovery/discovery/budget/browser gates remain HOLD; G1 OPEN.
