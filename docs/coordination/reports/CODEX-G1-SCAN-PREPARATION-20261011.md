# G1 basic image-scan preparation

11 October 2026 UTC. Base `7f1d20d2c28db25948ecc02d26545645e87a3e3c`, isolated branch `task/codex-g1-trusted-composition-20261011`. This work implements the scan allocation in [the trusted-composition outline](../tasks/CODEX-G1-TRUSTED-COMPOSITION-20261011.md). **SOURCE_ONLY / HOLD; G1 OPEN.** No image, package, architecture, placement or deployment decision changes. No AWS, network, image build/pull, container, native SDK or provider execution occurred in this lane.

## Canonical owner and boundaries

`scripts/qualification/worker_image_scan.py` owns offline **basic ECR scan preparation**, with a thin argument/output adapter. The existing `worker_image_publish.py` owns publication identity/readback and does not contain a scan parser; it is unchanged. The new owner reuses `worker_image_collect.py` for stable bounded reads, strict duplicate/nonfinite-refusing JSON, SHA-256 and deterministic encoding. Approved registry/repository and image-digest syntax come from the publication owner. No second AWS client, download layer, source registry, package inventory or authorization mechanism is introduced.

The domain API is `analyze_basic_scan(raw, *, expected_sha256, image_digest)`. Its file adapter is `prepare_file(scan_response, *, expected_sha256, image_digest)`. Neither API creates files or invokes processes/network. Importing performs no external I/O and does not require ambient configuration. No collector, publisher, Dockerfile, component pin, lockfile, generator, context membership or consumed build-authority hash was edited.

## Input and result contract

Input is a complete basic `DescribeImageScanFindings` response, externally pinned to its exact original bytes, and a separately reviewed exact immutable image digest. The approved registry is `967807252336`; repository is `meri-greenfield/qualification-worker`. Preconditions reject bad pins/path syntax before the canonical file reader performs I/O. The raw byte cap is 8 MiB; findings are capped at 10,000; basic attributes at 50 per finding. Strings have explicit bounds and must encode as valid UTF-8; the serialized output cap is 64 MiB.

The reader requires exact registry/repository/digest, `COMPLETE`, no nonnull continuation token and exact equality between every returned row and all declared severity counts. Integer counts reject booleans, negatives, excesses and unsupported severities. Duplicate JSON keys, nonfinite numbers, ambiguous attribute keys and duplicate finding rows are refused; changing attribute order does not bypass row identity. The same CVE on genuinely distinct providers remains distinct. All six basic severities—including INFORMATIONAL and UNDEFINED—are retained.

Only supported basic-response/finding fields are accepted. Nonempty or malformed `enhancedFindings` is explicitly unsupported and refused, rather than reported as a clean basic scan. An absent or empty enhanced list is permitted. Optional name, description, URI and provider attributes remain optional. Every accepted raw finding and every attribute is retained without deduplication or alteration. Missing package name/version stays null; it is not inferred from CVE text. Scan metadata and response identity/status metadata are retained. Recorded timestamps are metadata, not proof of freshness.

The deterministic output has schema `meri-worker-basic-scan-preparation/1`, status `SOURCE_ONLY_HOLD`, raw byte/hash and image bindings, every raw row, observed provider attributes, severity counts and OPEN disposition placeholders. Applicability, supported fix, embedded-copy coverage and owner decision remain null. It does not invent paths, installed-package membership, vendor verdicts or remediation. `scanEvidenceComplete` means structural row/count completeness only; external pins do not authenticate service origin or establish fresh vendor coverage. `scanAdmitted`, `runtimeAdmitted` and `g1Admitted` are always false, even with zero findings. Previously unresolved findings and component/notice obligations are explicitly retained as separate obligations.

## CLI and evidence handling

The CLI is stdout-only for a successful scaffold; it makes no persistent writes. Help exits 0. A valid complete HOLD scaffold exits 0, meaning the preparation result was produced—not that the image is safe. Invalid arguments or evidence exit 2. Domain/file failures emit one bounded refusal message on stderr without printing input paths or exception contents. Unknown and abbreviated options are rejected.

```bash
python3 -I -B -S scripts/qualification/worker_image_scan.py \
  --scan-response /absolute/retained/ecr-scan/stdout.bin \
  --scan-sha256 <externally-reviewed-original-response-sha256> \
  --image-digest sha256:8d1ec09aa78f47a11019089dacde93289fc66a39f55bd4357e59eeb25d9b52ac
```

The external pin must come from the reviewed owner capture/artifact chain. Computing a digest inside this analyzer and treating that as external verification would defeat the binding. A newly fetched ECR response is separate evidence; changes in formatting, timestamps, findings or vulnerability metadata must not overwrite the historical scan or borrow its old byte pin.

The [existing publication report](CODEX-G1-SDK-IMAGE-PUBLISH-20261011.md) records the historical complete semantic response as 59,678 bytes / SHA-256 `56a3d5f87336bf8f6a93111ecb8e976a75458f60e42dc5553fb01e460483f415`, with 47 findings including 5 CRITICAL and 17 HIGH. Those bytes were not available in this lane. **This code has not processed that response and does not reconstruct its rows.** A capture's envelope hash and retained stdout bytes must be independently reconciled before supplying its externally reviewed pin.

## Future read-only acquisition; not executed

Use the existing owner-only `aws_evidence.py` reader after its Linux executable/profile selection and authenticated caller are independently qualified. These concrete argument lists fit its current read-operation vocabulary; they are documentation, not execution/admission. Each command needs a fresh, exclusive absolute output directory. Its fixed profile/configuration policy remains the owner's responsibility.

```bash
python3 scripts/qualification/aws_evidence.py \
  --out /absolute/fresh/scan-capture --label exact-image-scan -- \
  ecr describe-image-scan-findings \
  --repository-name meri-greenfield/qualification-worker \
  --image-id imageDigest=sha256:8d1ec09aa78f47a11019089dacde93289fc66a39f55bd4357e59eeb25d9b52ac
```

The existing reader retains CLI stdout/stderr and process metadata. Its current ECR path uses CLI aggregation rather than individually exposed raw service pages. The analyzer accepts only a complete retained aggregate whose counts reconcile and whose continuation token is absent/null. It neither performs pagination nor authenticates individual pages; incomplete aggregates are refused. Any future explicit page reader must independently bind each request/token/response and the final complete aggregate rather than weakening this check.

11 October source correction: the scan command takes singular `--image-id`.
The canonical reader's separately reviewed encoding repair sets
`AWS_CLI_OUTPUT_ENCODING=UTF-8`; captures retain original binary streams.
See [the repair report](CODEX-G1-ECR-SCAN-OPTION-20261011.md). The earlier
parser-failed and CP1252 captures remain separate historical evidence.

Recover the separately recorded immutable build archive with its actual version:

```bash
python3 scripts/qualification/aws_evidence.py \
  --out /absolute/fresh/archive-head --label immutable-result-head -- \
  s3api head-object \
  --bucket meri-greenfield-qual-build-967807252336-us-east-1 \
  --key results/sdk-worker-image-441596ba-edd3-4e1b-ba0a-eee53c9c4af4/evidence.tar.gz \
  --version-id RN2aZBAyPulzEwf6iNKONh8NDBAsIRJ6 --checksum-mode ENABLED

python3 scripts/qualification/aws_evidence.py \
  --out /absolute/fresh/archive-get --label immutable-result-get -- \
  s3api get-object \
  --bucket meri-greenfield-qual-build-967807252336-us-east-1 \
  --key results/sdk-worker-image-441596ba-edd3-4e1b-ba0a-eee53c9c4af4/evidence.tar.gz \
  --version-id RN2aZBAyPulzEwf6iNKONh8NDBAsIRJ6 --checksum-mode ENABLED \
  /absolute/exclusively-owned/evidence.tar.gz
```

Before download, the owner must reserve an absent destination inside an exclusively owned directory; AWS CLI otherwise permits overwriting an existing output file. Reconcile returned VersionId, ContentLength, checksum and retained process evidence. Canonically read/hash the downloaded file and require the recorded **2,394,778 bytes / SHA-256 `0d1b822f1b27e29b1c37e3b8b2eede574b1a6218d71fe491f39ce95f3d209c34`**. This analyzer does not download or extract archives. Complete member reconciliation, installed-package/filesystem binding and actual notice content belong to separately reviewed owners. Do not assume the separate 47-row scan document is an archive member.

Protocol reference: [AWS DescribeImageScanFindings API](https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_DescribeImageScanFindings.html) and [basic ImageScanFinding fields](https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_ImageScanFinding.html). Official references were read during preparation; no documentation sample is treated as actual Meri evidence.

## Verification and remaining work

Actual targeted check: `python -B -m unittest discover -s scripts/qualification -p test_worker_image_scan.py -v` passed **18 tests**. Tests retain independent fixture counts and explicit expected output, with all severities, zero findings, distinct providers, optional missing metadata, identity/status mismatches, pagination, count/type/limit failures, duplicate/nonfinite JSON, duplicate attributes/reordered duplicate rows, enhanced/unknown fields, Unicode and output bounds, external pin failures, pre-I/O argument checks, canonical link/hardlink/ancestor-link refusal, actual CLI help/missing/refusal/HOLD behavior and import safety. CLI subprocesses used Python only, with 10-second limits, completed physically and left no files in their caller-owned test directories. Inert import is exercised with socket/process/file methods guarded against use.

No broad unrelated suite was replayed by this lane. Root owns registration, independent acceptance, integration and additional checks. No failed targeted attempt occurred. No live scan, old raw scan, immutable archive or package/license closure was exercised. Severe finding dispositions, coherent supported patched package selection, exact fresh image build/scan, live runtime wiring and G1 acceptance remain HOLD.
