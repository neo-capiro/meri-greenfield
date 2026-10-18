# Meri receiving candidate — shipping packet, HOLD

This packet is for the existing shipping owner. It is a source receipt and a list of required qualification inputs, **not permission to deploy or run a chat**. Dot retains Portfolio/Modules. No competing AWS operator, merge, deployment, migration, credential change or paid model call was used for this integration.

## Candidate and operator receipt

| Item | Receipt / required value |
| --- | --- |
| Receiving branch | `integration/meri-receiving-20261018` |
| Combined handoff parent | `7252f483c59cd676e868e40d4bf73c2ca55c137f`, `dot/meri-release-combined-20261018` |
| Final reviewed code and evidence pins | See [integration report](MERI-INTEGRATION-20261018.md); documentation commits do not replace the tested code/tree pin |
| Startup successor | PR187 `51f4a38e2e43d6ff050db08e3235b2b447b708cf`, stacked on PR182; received once, retaining document/delegation options during the conflict resolution |
| Frontend | PR98 `5c784e3e46114816ba57db17ad7a2c2013a8d81a`; composer recovery unchanged |
| Core | Published batch `78ceaf9bdfe00c8f013aac15eb8483312ae4f803` is unmounted; proposed protected methods are not applied |
| Release image digest | **UNAVAILABLE — exact final Dockerfile has not been built/qualified. Do not use the adapted diagnostic image.** |
| Region/account | `us-east-1` / `967807252336`; supplied deployment context, not a fresh AWS observation |
| Current live state | **UNREFRESHED.** Shipping owner reports its execution session offline with networking disabled and no visible prior AWS profile; this is not evidence that credentials were deleted |
| Rollback target | **UNREFRESHED.** Sole shipping owner must read actual task/image/configuration state after existing authorized access is restored |
| Historical reference | PR175 `993f52a97e5d9edcf65c9f89423c097aa52831c7`, image `sha256:bd8bb81f29e084e494263741fea0ed297421d36165dc55722429ad1e4dfb8802`; historical evidence only, not a verified current rollback target |

Preview UI is `https://portfolio-preview.app.capiro.ai`; Meri origin is `https://meri-preview.capiro.ai`. Production `os.capiro.ai` remains unchanged. Existing deployment/chat HOLD remains active.

## Configuration that must survive qualification

- Runtime architecture is **linux/amd64, x86_64**, UID/GID `1000:1000`. The received image closure pins Wolfi Node `24.21.0`, glibc `2.44`, executor Python `3.13.16`. Local source checks use Node `24.19.0`; the separate proxy partition uses Python `3.13.5`. These are different receipts.
- Worker SDK `0.3.295` / CLI `2.1.295` must use exactly `meri-sonnet-qualification`. LiteLLM `1.104.2` maps it to `bedrock/invoke/us.anthropic.claude-sonnet-4-6`, retaining the fixed regional profile, allowlist, pricing, `65536` input / `8192` output bounds and reservation accounting. Provider identity is Claude Sonnet 4.6 via Bedrock.
- Control starts in a **fresh process** with the composite `NODE_EXTRA_CA_CERTS` path produced by `apps/runtime/control-ca-bundle.mjs`. Preserve all 114 unchanged RDS roots and the pinned private issuer. Init precedes Control; verify fresh-process global-fetch hostname checks and actual database trust. Never replace that with `NODE_TLS_REJECT_UNAUTHORIZED=0` or a mocked TLS check.
- Retention history keeps the held read session through scheduled-origin resolution, positive versus absent custody, both freshness checks and cleanup. Core's final whole-response decision remains blocked; retention locks alone do not settle membership or archival authority.
- UNKNOWN usage, truncation, cache usage, conflicting totals and lost/unresolved acknowledgements retain liability. Passing the minimal Messages client partition does not qualify actual SDK requests, selected-tool authority or structured output.

## Build and material sequence

Use the existing canonical tooling and the [reviewed closure commands C1–C10](integration-evidence-20261018/image/EXECUTOR-CLOSURE-REVIEW.md). The complete three-commit document closure is included; retained source verifies **44 additional APKs and four wheels**, all locked hashes matching. Source test exit alone is insufficient: its pending-record case is conditionally skipped after all additions are retained.

1. Finish the source blockers in the integration ledger. Seal the exact reviewed committed Git source with `image-build-source.py seal`, then verify the source request/archive/member manifest with `image-build-source.py verify`. Bind immutable base images and the exact Dockerfile, lock, runner, verifier and producer bytes. Do not source-rehash historical image receipts into fresh proof.
2. Build the **exact** runtime Dockerfile on supported linux-amd64 using the existing producer. The previous exact build failed under local disk exhaustion; an adapted diagnostic Dockerfile is not accepted. Retain build logs, image digest, installed lock verification, runtime-base probe, runner and the producer's 24 Linux fixture results.
3. Run the sealed executor-generation helper inside that image under actual UID1000, no network, read-only root, dropped capabilities, no-new-privileges and bounded resources. Verify TXT/DOCX/XLSX/PPTX artifacts and process-group cleanup. Its printed `readOnlyRootChecked` literal does not establish the sandbox. No claim is made for PDF rendering, Portfolio preview or pandas analysis.
4. Generate canonical measurement arguments using `runtime-values.mjs measurement-override`; execute them in the **final image** with the existing provider-call-free spawn capture. Regenerate launch/options/skills/policy receipts after the alias and document changes. Historical launch/options hashes and 15-Oct image-closure hashes are stale.
5. Assemble runtime values with `runtime-values.mjs assemble`, then have the sole shipping owner render material with `render-material.mjs` using the existing authorized private inputs. Record source/image/configuration/material versions together. This packet creates no replacement private input, trust issuer or credential.

## Migration requirements

This receiving increment adds **no SQL migrations relative to `7252f483`**. No migration was executed. Do not infer database readiness from this absence: the shipping owner must compare the candidate's existing migration ledger with the actual deployed schema, then report any required already-reviewed migrations without executing them under the current hold. The document closure itself changes packages/image inputs, not database schema. Pending artifact/memory/adoption work is not approved by receiving these dependencies.

## Required release gates and eventual acceptance

Still required: approved Core native identity/route integration and the exact scheduled/lineage/cursor subject contract; actual SDK→LiteLLM request admission, selected schema/tool roundtrips and retry liability; real private owner HTTPS and PostgreSQL qualification; actual init→fresh Control first-run/multi-run readiness and database trust; exact image/launch/material receipts; restored sole-operator readback and refreshed rollback target.

After those pass review and Neo **explicitly clears the hold**, the existing shipping owner may perform only the then-authorized shipment. Acceptance must use a real authenticated prompt and verify the assistant reply, history after reload, a second turn, and Stop cleanup. Preserve failed attempts and inspect unresolved reservations/process cleanup. Healthy endpoints, passing source tests and a produced image are not those acceptance checks.
