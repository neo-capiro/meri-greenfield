# Reproduce the historical contract comparison

## Status and scope

The accompanying [portable extractor](reproduce-contract-compatibility.py) was adapted for this handoff and is **UNEXECUTED**. No new test, installation, build, network request or application startup was performed for this handoff. The historical original extractor and independent review already established the results below; adaptation is not a fresh execution receipt.

The extractor needs only existing local Git objects, Python's standard library and an existing Node executable. It does not use private jump-box JSON, a cache, installed application dependencies, a fixed drive/path, AWS or credentials. Every output fact is reconstructed from the exact commits and vendored tarball below. It writes one explicitly selected **new** JSON output file and refuses an existing destination. No checkout, fetch, install, source mutation or archive extraction occurs.

This is a historical Meri/frontend content-and-schema comparison. It does not qualify the current checkout, current runtime image, backend integration, paired live first chat, retained conversation reload or activation. The consumer and producer distribution labels remain separate facts; this script is not an instruction to bump either label.

## Required local repositories and objects

Supply three existing local Git repositories explicitly:

| Argument | Repository | Required historical objects |
| --- | --- | --- |
| `--meri-repo` | `neo-capiro/meri-greenfield` | Commit `38f52df94b1738649776792b2a28aac743801c19`, tree `7980fe7530d6623a2de9a788e150a377aca8201b`; canonical contracts and initial-input source blobs reachable from it |
| `--frontend-repo` | `neo-capiro/capiro-frontend` | Commit `e0b47a34d00b8c181420188ed39a1d849e25ec0a`, tree `a774141d541ae051d1eafe6d50c46215c2ff1ebe`; also documentation commit `6d796834aab693e90a3a052548c4c51a03ebe3c3` |
| `--backend-repo` | `neo-capiro/capiro-backend` | An existing local Git repository, validated only as a handoff input. No backend object is used by this comparison and no backend compatibility claim is produced |

Authentication/custody of these repositories belongs to the operator's existing authorized clone or verified bundle transfer. The extractor verifies fixed content identities; it does not authenticate to a remote or obtain missing objects. On a fresh host, provision these exact objects through the approved repository transfer before running. A shallow/partial clone may lack them. Child Git commands disable lazy fetching (`GIT_NO_LAZY_FETCH=1`), disallow every transport (`GIT_ALLOW_PROTOCOL=''` and `protocol.allow=never`), and disable terminal prompting/optional locks. Missing or denied local reads refuse; a failed read is not counted as an absent source file. No credential setup is part of this command.

The authoritative consumer/producer clarification is read directly from frontend:

- Commit: `6d796834aab693e90a3a052548c4c51a03ebe3c3`.
- Path: `docs/non-meri-continuation-20261016/FIRST-CHAT-PREVIEW-BINDING-PLAN-20261017.md`.
- Blob: `936dc12f1dfe82b297db8ecae6666706878562cc`.
- Length: 17,615 bytes.
- SHA-256: `99662ac647ef5a6be3672f0dc489173719ec39cda08a375b38ca1f67ae436b62`.

Its section “Meri contract version: consumer and producer are different facts” permits the truthfully recorded producer manifest 0.1.7 alongside the frontend's frozen consumer distribution 0.1.8, subject to paired protocol proof. The documentation commit does not change the selected e0 frontend image source. The extractor verifies the whole document's fixed blob, length and SHA-256; it does not parse prose into a new policy.

## Invocation on the receiving host

Use Python 3.10 or newer and an existing Node executable (the historical environment used Node 24). Git must be on the invoking process's `PATH`. No npm or Python package install is required. The output parent directory must already exist. Choose a fresh output filename outside the source checkout.

POSIX example, replacing the four host paths:

```sh
python3 docs/handover/20261017/fable-shipping/reproduce-contract-compatibility.py \
  --meri-repo /work/meri-greenfield \
  --frontend-repo /work/capiro-frontend \
  --backend-repo /work/capiro-backend \
  --node /usr/local/bin/node \
  --output /work/evidence/contract-compatibility-historical.json
```

PowerShell example with operator-supplied paths:

```powershell
python .\docs\handover\20261017\fable-shipping\reproduce-contract-compatibility.py `
  --meri-repo $MeriRepo `
  --frontend-repo $FrontendRepo `
  --backend-repo $BackendRepo `
  --node $NodeExecutable `
  --output $NewEvidenceJson
```

`--help` describes arguments. Exit 0 prints `CONTRACT_REPRODUCTION_RECORDED` after all assertions and output creation. Exit 2 prints a fixed refusal for local-object/proof/output failures; raw Git/Node errors, remote settings, credentials and source text are not printed. Argument-parser usage errors also exit 2. Do not point `--output` at an existing retained receipt or overwrite a prior failure.

The script evaluates only the exact pinned initial-input protocol/schema constructors in a Node VM with inert protocol dependencies; it imports no runtime/application modules. The child does not inherit `NODE_OPTIONS`, `NODE_PATH` or credential environment variables. This limited constructor evaluation is not a general safe executor for arbitrary untrusted code. Git reads and Node evaluation have fixed per-operation timeouts; archive members are processed in memory and no archive paths are extracted.

## Exact historical expected results

The vendored tarball comes from `e0b47a34...:vendor/capiro-meri-contracts-0.1.8.tgz`:

| Identity | Expected value |
| --- | --- |
| Git blob | `cbd7cd8246fee5feef17a1119dc93e66df06a5a6` |
| Bytes | 523,664 |
| SHA-256 | `0b0dffa63e19c55a3bc91e0c6b39cd5ad5916c6941ae1ccdc92098ba580d9820` |
| npm SRI | `sha512-pu28RP8HPhHPiwYYI3/afGrKXHNjHHkAIxt/qe+Q7mslchnY4kCw55VklF1NnF0ri9NtOBsZtcjOoJRGsSv+XQ==` |

Historical inventory/results:

- Frontend consumer distribution: **0.1.8**. Meri producer manifest: **0.1.7**. Its package lock records **0.1.5**. These values are reported truthfully; they are not automatically reconciled by changing literals.
- Tarball: **39** regular members; **34** corresponding Meri files at 38f are byte-identical, **four** initial-input distribution artifacts are absent and **one** (`package.json`) differs.
- Distinct initial-input provenance: **21/22 source pins match**. Only `packages/contracts/generate-initial-input.mjs` is absent. All matched runtime/private initial-input and shared dependency bytes retain their hashes.
- The metadata's browser import repeats the already matched `packages/contracts/dist/conversation-input.mjs` pin (`85010997a028bdc2bc086e8b6f71bf16b4f3a6e595cf91b2764b61e76d674cb9`). Counting that duplicate entry gives **22/23**, not 22 distinct matching source pins.
- **Five** initial-input schema definitions are equivalent after reference expansion, annotation removal and `required`/`enum` ordering normalization. Validation keywords/values remain in the comparison.

| Definition | Both normalized SHA-256 values |
| --- | --- |
| `ConversationInitialInputRequest` | `5efae2c5af11aa7ebc57312328bc4752a67f0f8faba8e1628b35eaa73c75d168` |
| `ConversationInitialInputExpectedContext` | `a0505ac891c29b1ad8c1477f6a60ef838530b9604f60e0b20df61a8bc0eee4d2` |
| `ConversationInitialInputAllocation` | `9bb6249c67bc6f00ad7010e6442f0d31147ce1ceb5b002666fc4b3499ec03905` |
| `ConversationInitialInputAllocatedResponse` | `b64852e6c2a7a44789abdee60aefeeb027cc90c096df5c8406646c314df5eab0` |
| `ConversationInitialInputErrorResponse` | `207da1071c3ced81154d5de47da29d4860be36d1651aec428859534c4c388bfd` |

The absent public artifacts/exports describe a producer release-packaging gap. The selected Meri HTTP application imports the matching private relative protocol/schema owners, so those absent public package files do not establish a wire failure on the mounted path. A new consumer importing the absent producer public subpath would have a separate package-resolution issue. The extractor does not remove that distinction or claim live runtime success.

## Git-backed reconstruction without the extractor

If the adapted command cannot be run, retain the explicit failure and perform the same local reads manually; do not substitute remote main or a new package build:

1. Resolve the exact Meri/frontend commits and trees using `git -C REPO rev-parse COMMIT^{tree}`. Read the exact binding-plan blob with `git -C FRONTEND show COMMIT:PATH`; verify the blob/length/SHA-256 above.
2. Read the frozen tarball with `git -C FRONTEND show e0b47a34d00b8c181420188ed39a1d849e25ec0a:vendor/capiro-meri-contracts-0.1.8.tgz`. Preserve binary bytes (avoid shell text redirection on environments that transcode output); compare length/blob/SHA/SRI and inspect members in memory.
3. Read `package/dist/conversation-initial-input.metadata.json` from the tarball. For each of its 22 distinct provenance entries, normalize its path relative to `packages/contracts`, read that blob from Meri at 38f and compare exact bytes/hash. Restrict source reads to `packages/contracts/` and `apps/control/conversations/`. Separately account for the duplicate browser import.
4. Compare all 39 regular tarball members with the corresponding Meri `packages/contracts/` blobs at 38f. Record absent/different files explicitly; do not copy them into the producer as part of this investigation.
5. Construct the private schema from exact `packages/contracts/conversation-initial-input/{protocol,schema}.mjs` source with the documented inert `conversationInputMetadata` context (`authentication:{}`, `limits.responseBytes:2097152`). Resolve references using exact `packages/contracts/meri.schema.json` and `packages/contracts/dist/conversation-input.schema.json`. Compare all five validation shapes with the tarball's public schema and the normalized hashes above.
6. Retain a new local receipt listing exact Git pins, provenance rows, member counts, schema hashes, the adapter script hash and limitations. An unexecuted plan or historical summary is not a new passing receipt.

See [the detailed historical comparison](MERI-CONTRACT-COMPATIBILITY.md) for caller imports, DTO/runtime ownership and the source-only conclusion. Keep deployment, qualification budgets and current-source decisions with the shipping owner.
