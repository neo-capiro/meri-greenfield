# Control CA source verification

Base: `993f52a97e5d9edcf65c9f89423c097aa52831c7` (frozen PR175).
Scope: source only. Live private-origin trust failure remains a hypothesis pending an observed exception code.

## Passed focused checks

`focused-tests.tap`: **40 passed, 0 failed, 1 skipped**, Node **22.23.3** on Windows. The retained skip requires real Linux UID/GID 1000 and a writable isolated `/run` and remains unrun. New composer IO checks use a mocked Linux filesystem; they do not qualify Fargate mounts or native Linux behavior.

```powershell
$env:MERI_TEST_OPENSSL='C:/Program Files/Git/mingw64/bin/openssl.exe'
node --experimental-test-module-mocks --test `
 apps/runtime/test/control-ca-bundle.test.mjs `
 apps/runtime/test/control-ca-init.test.mjs `
 apps/runtime/test/cli-product-runner-pin.test.mjs `
 infra/product-preview/material-init.test.mjs `
 infra/product-preview/manifest.test.mjs `
 infra/product-preview/manifest-token-writers.test.mjs
```

The new real TLS test uses a fresh synthetic OpenSSL CA/leaf, a loopback server and fresh Node child processes. DNS is confined to loopback in those children. RDS-only trust rejects that private issuer; the composite succeeds for `control.meri-preview.internal`; a wrong hostname fails `ERR_TLS_CERT_ALTNAME_INVALID`. The actual extra-root store contains the original 114 RDS certificate fingerprints and the one synthetic private CA. No external request, DB credential or real private PKI is used. OpenSSL version: 3.5.5.

`node --check` passed for the modified renderer and Stage 3 binding module. Importing both modules together passed. `git diff --check` passed. The original PR175 checkout was still clean at the frozen base after implementation.

## Retained failures and remaining gates

- The first new TLS test fixture attempted `pki.py`; the sandboxed Python launcher returned 103. Outside that boundary the installed Python 3.14.7 started but reported `ModuleNotFoundError: cryptography`. The new standalone TLS tests now generate only their own small OpenSSL fixture and pass; the existing renderer fixture is unchanged.
- `focused-tests-initial-dependency-failure.tap`: 13 passed and four suites failed to import because the new worktree lacked the existing qualification package dependency link. Reused that local ignored dependency junction without installing or changing packages.
- `focused-tests-prior-control-assertions.tap`: 38 passed, two failed, one skipped. The two failures were prior exact control environment/init assertions. Updated them to assert the intended composite path, init flag and shared tmp mount while preserving worker and runner assertions.
- `render-stage3-fixture-blocked.tap`: the two selected renderer/Stage 3 integration cases fail in `createRenderFixture.setup` before rendering because `pki.py` cannot import `cryptography`. No assertion was weakened or fixture substituted. Rerun these cases in the existing approved test environment with that dependency.
- Node 24, real Linux UID/GID 1000 init/readback, product image qualification, AWS configuration, live TLS exception diagnosis and authenticated chat remain unrun. No dependency was installed or downloaded. Deployment and trust activation remain held for separate review.

## Separate diagnostic finding

`apps/runtime/runner-runtime-diagnostics.mjs` allows `KICKOFF_UNKNOWN` but the producer uses `executionFault('KICKOFF_UNKNOWN')`, whose exact code is `NATIVE_EXECUTION_KICKOFF_UNKNOWN`. A separate small correction can allow that one literal and test the producer's actual error with unchanged rejection identity. This trust commit deliberately leaves that diagnostic change separate; no prefix/wildcard acceptance is proposed.
