# PR189 research-source authorization correction

Parent: `231122607ff16c67a8fe19f8e945b2f8776431ae`. Authored source commit: `7da5bbef9b52853c278999aa40de63e7e62e1b42`. This correction belongs only to PR189; the conversational-write branch remains separate. The published PR head identifies the complete correction/evidence tree.

`search_research_sources` now requires `authorizationScheme === 'CapiroMeriRead'` from the validated per-call credential owner before any source fetch, matching business-development evidence. Actor, tenant, current selected-client and result-release checks remain in place. A current attended session is insufficient admission for this private multi-source tool.

The prior independent review missed the distinction between per-call credential custody and a delegated scheme. Its broad authorization conclusion is superseded for this operation by this correction and the retained red controls. Missing scheme, explicit `Bearer`, the actual native attended owner, and actual delegation-unavailable attended fallback each reached one source call before this fix. All four now refuse with zero source calls. The actual delegated positive still dispatches one exact signed request.

Source and native positive fixtures use actual synthetic delegated owners rather than merely relabeling ordinary credentials. The generic native-family test changes only the research-source cases and preserves their actor/client/revocation assertions.

## Focused verification

`read-tools-auth-correction-20261019/red.tap` preserves the five-case red control: four failures and one signed positive. The source commit records the exact initial command and the corrected local dependency setup. An initial composed-test module load failed because the task-local Temporal dependency link was missing; no source assertion was changed to address that setup failure.

The final coherent command was:

```sh
node --experimental-test-module-mocks --test --test-concurrency=4 \
  apps/gateway/sources/research-legal-candidates/test/handler.test.mjs \
  apps/gateway/sources/business-development/test/evidence.test.mjs \
  apps/runtime/native-authority/native-read-credentials/test/research-candidates.test.mjs \
  apps/runtime/native-authority/native-read-credentials/test/research-candidate-signed-admission.test.mjs \
  apps/runtime/native-authority/native-read-credentials/test/family-wiring.test.mjs \
  apps/runtime/native-authority/read-delegation/test/composed.test.mjs
```

Result: **290/290 passed**, zero failures, skips or cancellations. Runtime `tsc --noEmit -p apps/runtime/tsconfig.json` passed with zero diagnostics. `git diff --check` passed. These are offline/source checks with synthetic Core, database and credentials.

Fresh source-only installation measurement SHA256 is `d0484f64b14b5e38d7412e1d11ca8c7c33372ddce2b000668d16a40201d9eba4`. The research-candidate family source digest is `2ee0e0d4b8190746cca197f572148a1cdd5727234b1cdc9ad8bd50d6cf7dab53`. Exact logs, source manifest and hashes are adjacent in `read-tools-auth-correction-20261019/`. Earlier evidence and frozen image inputs are unchanged; this measurement does not activate an installation or qualify an image.

No merge, build, deployment, live provider or database check occurred. Core delegated allowlist admission and actual source qualification remain required before live use.
