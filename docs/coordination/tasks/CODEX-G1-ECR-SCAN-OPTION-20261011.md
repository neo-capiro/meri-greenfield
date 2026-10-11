# ECR scan option repair — bounded source task

Base: `631aee670fcee6efa7170bf969b9f05f90de12e5`; branch
`task/codex-aws-scan-option-20261011`. Primary Codex owns this source repair.
The AWS shipper retains its three claimed `AWS-SHIPPER-20261011-r1` paths;
none are edited here.

The shipper reports CLI 2.36.8 parser exit 252 before service access: the
canonical capture admits plural `--image-ids`, while
`ecr describe-image-scan-findings` requires singular `--image-id`.
The singular option is currently refused before dispatch by the helper.
This is reported runtime evidence; its raw receipt belongs to the shipper.

Extend the existing canonical `aws_evidence.py` vocabulary with one closed
command override for the scan only (`--repository-name`, `--image-id`).
Keep all other service/ECR options, auth, caller/profile/path bindings,
timeouts, environment scrubbing, raw receipts and zero-retry behavior.
No new transport, dispatcher or generic option framework is needed.

Further shipper evidence reports a successful native singular read whose
CP1252 output contains `0x92` and cannot be decoded as UTF-8. Explicitly set
the documented AWS CLI v2 `AWS_CLI_OUTPUT_ENCODING=UTF-8` in the already
scrubbed child environment. Capture original byte streams before parsing;
do not guess encodings, transcode retained evidence or use Python encoding
variables as a substitute for the supported CLI setting. Add non-ASCII
forwarding and invalid-byte retention controls. Real Windows CLI
qualification remains with the shipper; its new scan is separate from
the historical checksum.

Owned paths: `scripts/qualification/aws_evidence.py`, new
`scripts/qualification/aws_evidence_ecr_test.py`, the scan-preparation
report's incorrect example, this task and the matching source-repair
report. Optional retained offline evidence is scoped to
`docs/qualification/candidates/ecr-scan-option-20261011/`.

Verify singular scan forwarding/receipts, existing plural reads, refusal
before allocation/dispatch for wrong or escaping flags, and failed-command
raw evidence. Run all existing 4 history and 10 timeout tests unchanged,
plus related publisher tests. Independently inspect the frozen patch and
run focused checks before publication. Tests mock command execution and
deny real network/process effects; no AWS, build, runtime or admission is
authorized by this source task. Preserve the original failed capture.
