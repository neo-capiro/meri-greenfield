# Pinned CLI residual effort beta — bounded source review

SDK0.3.295 / CLI2.1.295, native executable SHA256
`4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358`.
Read-only binary inspection; no production or dependency edits. Exact bounded
snippets and binary byte offsets are in `PINNED-EFFORT-BETA-SNIPPETS.json`.

The residual beta is deliberately independent of whether an effort value is
sent. `CNe` at offset217589858 checks model support (`TE`). If supported and no
explicit output_config.effort key exists, it appends the effort beta when the
resolved effort is undefined. A string effort appends it too. The normal request
builder calls CNe after constructing its beta list, at offset217637741.

`B$` at210442028 parses unset/auto into null. `yv` at210445852 returns undefined
for that null sentinel in this case; therefore the body effort parameter is
omitted, but CNe's undefined branch still appends the beta. The installed official
SDK declaration, `sdk.d.ts:6009`, describes unset as causing no effort parameter;
it does not promise absence of the effort beta. Current public environment docs
list auto/model-default behavior and do not document unset.

Why the fixed custom alias is treated as effort-capable:

1. `Pe` at207083798 selects firstParty for this ordinary Anthropic-compatible
   client unless an explicit alternate provider mode is selected. A custom
   ANTHROPIC_BASE_URL changes the endpoint, not that provider-mode selection.
2. `NF` at209467871 ignores `_SUPPORTED_CAPABILITIES` overrides when `zd` is
   true. `zd` at207084524 includes firstParty and gateway. This explains the
   previous empirically ineffective empty capability override.
3. `TE` at210437240 finds no recognized old-model exclusion for
   meri-sonnet-qualification and falls back to `kz(cc(model))`; firstParty
   returns true. Merely containing "sonnet" does not canonicalize this alias to
   a built-in model: `rF` at209450578 returns the unrecognized alias unchanged.

The public `_NAME`/`_DESCRIPTION` variables affect picker display only. Correct
`modelOverrides: {"claude-sonnet-4-6":"meri-sonnet-qualification"}` or a
`modelPicker` row with behavesAs Sonnet4.6 can give the alias its accurate model
profile while keeping the transmitted alias. Sonnet4.6 supports effort, so that
accurate mapping does not disable CNe's beta branch. Mapping to a different,
older model solely to suppress effort would misstate client-side capabilities
and prompt/default behavior and is not an appropriate repair.

No documented supported omit-effort-beta setting was found in the relevant
public environment/model configuration references. ANTHROPIC_BETAS adds betas;
it is not a subtraction list. Global experimental-beta disabling also disables
native structured output and already failed to remove this beta. Request/header
rewriting and artificial unsupported-model error responses are excluded.

The exact installed parser DOES recognize `CLAUDE_CODE_MODEL_CAPABILITIES`:
`Zvo` at207077505 accepts semicolon-separated model selectors and comma-separated
capabilities, with a leading minus denoting false. `TE` checks this map before
its default provider fallback. Thus
`meri-sonnet-qualification=-effort` is a precisely pin-recognized negative
capability override. The variable is absent from current public environment
documentation; it remains an undocumented, pin-specific experiment, not a
supported production recommendation.

Root authorized exactly one bounded capture experiment: actual canonical SDK
options, fixed model alias, canonical Objective JSON schema, prompt caching
disabled, effort unset and that negative effort capability. No global beta flag,
tool change, request rewrite or guard relaxation is applied. The private entry
script and its separate SHA256 provenance are retained as
`pinned-capability-experiment.mjs` and
`pinned-capability-experiment-source.json`; this is not represented as committed
production source. Its receipt is `pinned-capability-experiment-receipt.json`.

Minimal next owner decision: if empirical capture confirms this pin-only gate
removes effort beta while preserving native schema, decide explicitly whether
an undocumented version-fenced client capability override is acceptable, or
retain the beta and review its exact fixed-model native contract / seek an
upstream supported control. Neither choice closes metadata, selected tool/schema,
actual structured_result, valid allocation, or owner HTTPS qualification gates.

## Single authorized experiment result

The exact command was:

```sh
node /tmp/meri-integration-sdk-review/pinned-capability-experiment.mjs --python /tmp/meri-integration-sdk-env/bin/python --out /tmp/meri-integration-sdk-review/pinned-capability-experiment-receipt.json --client sdk --output-format json-schema
```

It exited2, preserving the existing admission failure. The private experiment
script SHA256 is
`66831c109d98c5f97fbab1d549a9abb2439933de2f8d64c8d179b8cf7ede3ba7`.
No repository source was edited; the receipt separately identifies the unchanged
committed harness helpers and this uncommitted experiment entry point.

| Observation | Result |
| --- | --- |
| SDK model argument and request alias | meri-sonnet-qualification, unchanged |
| Global experimental-beta disable flag | Absent |
| Effort beta in SDK header or final native body | Absent |
| Final native beta list | context-management-2025-06-27 only |
| Selected Objective schema | Present as StructuredOutput tool; reply property and required/closed schema retained |
| Native output_config.format | Absent; native-format preservation is not established |
| Actual SDK structured_result success | Unproven; admission still refuses |
| Count/reservation/provider/settlement | 0/0/0/0 |
| Native startup/shutdown | Passed |

The negative override therefore has its predicted effect on effort capability,
but is **not a product answer**: it is undocumented, the native structured-format
path is not qualified, and other request-contract gates remain. The schema was
not silently discarded; it used the same synthetic-tool fallback seen in earlier
experiments. This single capture cannot establish why that fallback was selected
or attribute it to the negative effort override. No additional variants were run.

Final owner decision remains explicit: obtain an upstream supported effort-beta
control, or review an exact fixed-model beta contract; a version-fenced internal
override would require separate support/risk approval and full selected-schema
and tool qualification. Do not mislabel Sonnet4.6 as an older model to suppress a
header, rewrite requests, relax tool authority or accept cache liabilities as
ordinary priced input. Full owner HTTPS remains OPEN independently.

Primary references checked2026-10-18:
- https://code.claude.com/docs/en/env-vars
- https://code.claude.com/docs/en/model-config
- Installed published SDK `sdk.d.ts:6009` and `modelPicker.behavesAs` declaration.
