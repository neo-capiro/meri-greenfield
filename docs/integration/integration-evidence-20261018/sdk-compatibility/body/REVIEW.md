# Python SDK/native contract follow-up

Base `9f54238c84dc03f0505ccac99be5652dbb2d16db`; branch `fix/sdk-proxy-body-contract-20261019`. Separate reused sparse worktree; no dependency installation. Only the six allocated Python source/test files changed.

| Commit | Resulting contract | Focused verification |
| --- | --- | --- |
| `2ea14a7be74d6acc8d8e1eba6221e43717f79b37` | Opaque bounded metadata.user_id; tools[]; exact two-beta subset; immutable NativeBody.anthropic_betas; optional actual native header validated against body; trusted immutable schema binding and explicitly authorized StructuredOutput | Envelope/body/transport 34/34 |
| `13a97be2c552eb7addf6ed508ae945f7df30fcc0` | Response context_management absent/null/exact applied_edits[] only, at message and message_delta observation locations | Usage 14/14 |
| `87b6e8beac3af3ed72d22247c59ac461b7edd3d5` | Capture-authorized exact thinking={type:'disabled'} and numeric temperature0/1 only | Final affected group49/49 |

The final focused run tested the exact six file contents subsequently committed unchanged in `87b6e8be`. Source SHA256s and scrubbed-log hashes are in manifest.json. The existing focused baseline at9f54238 passed41/41. The eight added tests account for49 after; no original failure is hidden or skipped.

| Added regression | Contract tested |
| --- | --- |
| test_structured_schema_binding_is_trusted_immutable_json | Frozen JSON binding; strict root, duplicate/nonfinite/malformed/size refusal |
| test_sdk_metadata_beta_enums_and_empty_tools_preserve_counted_bytes | Exact bytes/hash/count input, closed metadata, beta subset and semantic feature refusals |
| test_structured_output_requires_exact_trusted_schema_and_tool_authority | Default/allowlist-only/schema-only tool refusal; exact schema match including JSON type differences; format-only binding without implicit tool grant; effort/extra-field refusal |
| test_closed_beta_headers_match_body_without_changing_signed_or_counted_bytes | Header absent or exact same set in either order, ASCII OWS; exact raw headers/body/count bytes; UNKNOWN hold |
| test_beta_header_duplicates_unknowns_and_body_mismatches_never_count_or_send | Duplicate headers/values, empty entries, mismatch, unknown/case/Unicode/CRLF/vertical whitespace denied before count/hold/send |
| test_absent_null_and_exact_empty_context_metadata_preserve_complete_usage | Complete message/start/message_delta observations with unchanged usage binding |
| test_applied_unknown_or_malformed_context_edits_remain_sticky_unknown | Applied edits, malformed shapes, unknown fields and unsupported observation locations retain UNKNOWN |
| test_observed_disabled_thinking_and_default_sampling_are_closed | Exact disabled shape and numeric0/1; enabled/adaptive/budget/extra thinking, bool/string/null/fraction/out-of-set sampling denied |

Retained failed controls: new body/schema tests against9f54238 original body owner3errors/3; new empty-context test against9f54238 original native usage owner1failure/1 (body/header working-tree edits present but native usage and imported JSON/tree helpers unchanged); new thinking test against13a97be production1error/1. Commands and scrubbed logs are retained, including inherited upstream Pydantic ReadOnly warnings. No assertions were removed. One prior sampling refusal changed from1 to0.5 because the approved observed compatibility contract now admits exactly1.

Runtime: Python3.13.5, LiteLLM1.104.2, boto3/botocore1.43.111, HTTPX0.28.1. Replacement environment removes all ambient variables and credentials. Tests prohibit DNS and use synthetic count/ledger/provider transports. No provider calls.

Exact full focused command (baseline and final):

```sh
env -i PATH=/usr/bin:/bin TZ=America/Toronto PYTHONDONTWRITEBYTECODE=1 LITELLM_LOCAL_MODEL_COST_MAP=True AWS_EC2_METADATA_DISABLED=true /tmp/meri-integration-sdk-env/bin/python -m unittest apps.proxy.product.test.test_envelope apps.proxy.qualification.test.test_bedrock_transport apps.proxy.qualification.test.test_native_usage -v
```

Exact new body/schema failed control (before production edits):

```sh
env -i PATH=/usr/bin:/bin TZ=America/Toronto PYTHONDONTWRITEBYTECODE=1 LITELLM_LOCAL_MODEL_COST_MAP=True AWS_EC2_METADATA_DISABLED=true /tmp/meri-integration-sdk-env/bin/python -m unittest apps.proxy.product.test.test_envelope.EnvelopeTests.test_structured_schema_binding_is_trusted_immutable_json apps.proxy.qualification.test.test_bedrock_transport.BodyTests.test_sdk_metadata_beta_enums_and_empty_tools_preserve_counted_bytes apps.proxy.qualification.test.test_bedrock_transport.BodyTests.test_structured_output_requires_exact_trusted_schema_and_tool_authority -v
```

Response failed control uses the same environment and `-m unittest apps.proxy.qualification.test.test_native_usage.UsageTests.test_absent_null_and_exact_empty_context_metadata_preserve_complete_usage -v`. Thinking failed control uses `-m unittest apps.proxy.qualification.test.test_bedrock_transport.BodyTests.test_observed_disabled_thinking_and_default_sampling_are_closed -v`. Intermediate passing focused commands are the full command limited respectively to envelope+transport or usage modules.

Trusted composition API:

```python
BodyLimits(
    allowed_tool_names=frozenset({'StructuredOutput'}),
    structured_output_schema_json=trusted_constant_json_string,
)
```

The optional binding is strictly parsed at construction, bounded by the existing body envelope and JSON tree limits, and normalized to immutable JSON for exact schema value/type comparison. The actual signed/count/request bytes are never normalized or rewritten. A format-only branch can use the schema binding without granting StructuredOutput as a tool. Schema absence still refuses StructuredOutput even if its name is allowlisted. The allowlist remains at most8 names, body4MiB, input65536/output8192; prices, CountTokens body, original deadline, one-send guard, UNKNOWN hold and settlement ownership are unchanged.

The later thinking/sampling extension is intentional and grounded in the pinned accurate-profile SDK capture `/tmp/meri-integration-sdk-review/profiled-exact-parameters-before-guard.json`, whose hash is recorded in manifest.json. It grants no thinking budget or broader sampling range.

Remaining dependencies: trusted per-run production schema custody and other MCP tool policy are not wired by this lane. The local SDK harness may inject an explicit fixed trusted schema; this does not establish production selected-skill readiness. Actual Bedrock acceptance of the exact translated beta request, private owner HTTPS, PostgreSQL, image startup and live chat remain separate qualification gates. No build, merge, deployment or live provider action occurred. PR175 and Core were untouched.
