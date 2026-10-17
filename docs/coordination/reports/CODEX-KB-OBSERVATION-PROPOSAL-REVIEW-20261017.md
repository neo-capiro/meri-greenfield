# Native KB observation proposal - independent review

Disposition: **ACCEPT_PROPOSAL_SOURCE**, with no blocking findings in the two reviewed documentation files. This accepts an agreement candidate, not a product wire extension, semantic KB adapter, SDK exposure, Core integration or live qualification. The reviewer changes only this report.

Reviewed files are [proposal README](../proposals/native-kb-observation-20261017/README.md) and [literal golden vector](../proposals/native-kb-observation-20261017/golden.json), against the actual local frozen retrieval resolver/validator and unchanged finite-five observation codec. Meri review baseline is local `6104c2c1edb9be1a1353a94552fef28e6b63b2e5` / PR112 continuation. The README's corrected Core funding pin `51c157444ac43035eeb489ff46aee5a4e89ba3ac` is coordinator-supplied allocation metadata; this proposal review does not independently accept that Core implementation.

## Exact reviewed bytes

| Artifact or derived value | Independently verified value |
| --- | --- |
| Proposal `README.md` SHA-256 | `7606f91dfba7338afef6bb6af9b9f984a7c7b51e6e3a051ef52b88ea747e1018` |
| Proposal `golden.json` SHA-256 | `f1b7b1f5c0b8c5ed3d78d3f02db7a6746604149022931c2952842419fbe99786` |
| Canonical original request UTF-8 bytes | 123 |
| Original request SHA-256 | `5a1fe25a9a0a88616f200c7e135c55f689f30b20cf481b7d1e137d06432f8e70` |
| Canonical observation UTF-8 bytes | 242 |
| Observation SHA-256 | `50110f074edd07a79429c8199ae854e5e2a39d4c66fdc40900449a81866c9592` |
| Unpadded base64url carrier characters | 323 |
| Normalized-input SHA-256, deliberately different from raw request hash | `72847fcb3894b12f74c5c978d1b9863c0c0b313467b063de190a8f2cf1d1fe8e` |
| Existing five funding vectors Git blob | `9536c662f4abd3487b6bdb4000ff06a0250f44ae` |
| Existing funding golden-file SHA-256 | `822c245038110acda1d2656f21bc78fbf190496aa21e2cde4f1a32e2f5bbdf3b` |

The adopted `canonicalize` implementation independently reproduces both stored canonical JSON strings, both hashes, the decoded byte bound and every character of the carrier. Decoding the carrier reproduces exactly the canonical observation bytes. The original query has two leading and two trailing spaces, actual U+00ED and U+1F331, with UTF-8 hex `20204369766963202620656e657267c3ad6120f09f8cb12020`. The uppercase UUID spelling is retained. Console rendering initially obscured those characters; direct UTF-8/codepoint inspection confirms no replacement character or question-mark substitution in the fixture.

## Frozen contract and outcome review

The actual `resolveOperationContract({id:'search_client_knowledge',version:'0.2.0'})` accepts the proposal request with exactly `{asOf:'2026-10-17T12:34:56.789Z'}`. It trims only the effective query, retains the original request and uppercase client spelling, keeps `client_doc_chunk` and numeric limit 5, and produces the distinct normalized-input hash above. The raw request hash correctly precedes normalization.

Four independently constructed synthetic DTOs passed the actual frozen receiver: success, ordinary empty results, caught-unavailable empty results with the native note, and the missing-client note without client/query metadata. For every branch, a substituted `generatedAt` and an extra private field refused. Lowercasing the returned client identity refused because this raw contract preserves its spelling. Combining the unavailable note with matches also refused. These are receiving checks, not execution of Core lookup, embedding or provider code.

Closed request/context checks refused model `asOf`, tenant and normalization-context fields, absent/extra/noncanonical clock context, and blank effective query. Additional normalization probes confirmed numeric bounds 1/20, retained fractional 2.5 without flooring, string/null limit default 8, unknown kind becoming null, and preservation of a truthy whitespace client string. No name resolution, selected-conversation injection or fabricated not-found DTO follows from these input facts. The README correctly leaves genuine provider cancellation and fractional-limit SQL outcomes to native qualification.

## Current product boundary stays finite-five

Without any product wire edit, the current codec refuses the KB proposal at **create, assert, encode and decode**, each with `NATIVE_READ_OBSERVATION_REFUSED`. Its admitted operation set remains exactly the five funding reads. The proposal cannot therefore advertise or accidentally enable the sixth operation.

All five existing funding vectors were separately recomputed and decoded/re-encoded using that current codec. Their request JSON/hash, observation JSON/hash, byte count and carrier remain consistent. The working file `packages/contracts/native-read-observation-0.2/test/golden.json` is byte-identical to its HEAD Git object and has the exact published blob identifier recorded above. An initial lookup omitted the `test/` component; the historical PR109 commit object is also unavailable locally. Inspection of the tracked tree located the correct file, and exact current bytes plus the recorded immutable Git blob establish unchanged funding fixtures without fetching or modifying source.

## Checks and limits

The independent read-only verification ran as a stdin ES module using the existing Node 24 overlay with `--preserve-symlinks --max-old-space-size=256 --input-type=module`. **91 assertions passed**, process exit 0, no assertion failure. This count describes the narrow proposal checks, not a product test-suite or live-qualification count. No broad tests, installs, builds, native HTTP/provider/database calls, runtime configuration, source/shared-contract edits, staging or publication were performed.

Proceed only with the separately allocated Core KB observation/controller/wrapper packet and later coordinated Meri finite-contract/source/SDK work. Every returned KB branch must consume the same trusted instant; validation/client lookup/not-found exceptions remain failures. Preserve all five funding vectors and funding-only behavior, exact service/user/current resource gates, request correlation, cancellation/expiry and absence-versus-unavailability distinctions. Name and mode packets remain unallocated. This documentation-only acceptance advances no implementation, exposure or live count.
