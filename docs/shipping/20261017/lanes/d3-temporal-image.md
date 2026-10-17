# D3: Temporal server derivative image build path

Owner: Fable. Branch `fable/meri-d3-temporal-image-20261017`, cut from integration `5fbd6c06`. **Status: source.** Nothing was sealed for use, uploaded, built or pushed.

## What exists

| File | Role |
|---|---|
| `infra/product-preview/temporal-launch.Dockerfile` | Three literal amd64 digests, no base build args, no `# syntax=` image. Node binary from the Node runtime's builder; GNU loader/libraries from the Wolfi base + retained `libstdc++` APK; unchanged Temporal 1.32.1 pin. |
| `infra/product-preview/temporal-image-context.py` | Streaming, deterministic sealer (`python3`, 3.14/zlib-ng). Git blobs re-verified by SHA-1; refuses an existing output. |
| `infra/product-preview/temporal-image-build.sh` | CodeBuild body: verify context → build (CA via BuildKit secret) → locked-down launcher smoke + probe → push → scan gate (zero HIGH/CRITICAL) → checksum-bound receipt or failure record. No retry. |
| `infra/product-preview/temporal-image-start.sh` | Dry run by default; live start needs `MERI_TEMPORAL_IMAGE_START_APPROVED=<zip sha>`, idle and tag-absence preflights, timeout 30, queue 5, retry 0. |
| `test_temporal_image_build.py`, `test_temporal_image_start.py` | Stubbed aws/docker, library mode, seal/verify, dry run. |

## Sequence

```sh
# 1. Seal (offline). The issuer CA is public PEM text; its SHA-256 must equal MERI_TEMPORAL_ISSUER_CA_SHA256.
python3 -I -B infra/product-preview/temporal-image-context.py --repository . --commit <C> \
  --issuer-ca <issuer-ca.pem> --output <inputs>/temporal-context.zip
# 2. Dry run (no AWS call). Prints the exact StartBuild request.
MERI_REPO=. bash infra/product-preview/temporal-image-start.sh <C> <inputs> <zipSha256>
# 3. One start, after approval of that ZIP SHA-256 and spend.
MERI_TEMPORAL_IMAGE_START_APPROVED=<zipSha256> MERI_AWS_PROFILE=<profile> MERI_REPO=. \
  bash infra/product-preview/temporal-image-start.sh <C> <inputs> <zipSha256>
```

Receipt: `s3://meri-greenfield-qual-build-967807252336-us-east-1/results/temporal-image/<C>/<attempt>/temporal-image-receipt.json` (or `temporal-image-failure.json`, which keeps scan counts and HIGH/CRITICAL rows). Image tag `temporal-server-<C>-<attempt>` in `meri-greenfield/qualification-worker`.

## Blockers and risks

1. **Issuer CA does not exist yet.** The Dockerfile bakes `/opt/meri/issuer-ca.pem` (required secret mount), so the seal needs the real issuer server-trust CA. A CA rotation means a rebuild.
2. **Scan coverage.** ECR basic scanning reads the Alpine APK database of `temporalio/server` only. It does not see Go stdlib/module CVEs in `temporal-server`, the Node binary, or the copied Wolfi files. A zero-finding gate is therefore not a full vulnerability disposition.
3. **Upstream Alpine packages may fail the gate.** The derivative cannot fix them without pinned package versions; the failure record keeps the exact rows.
4. **Docker Hub pull.** `temporalio/server` is pulled anonymously from Docker Hub by digest (rate limits).

## Temporal schema setup (Stage 1)

Nothing in source applies the `temporal` (1.19) and `temporal_visibility` (1.14) schemas. The launcher only renders config and starts `temporal-server`. The deployment template adds a migration SG ingress rule but no migration task. `temporal-migration-plan.mjs` is an ordering contract (`source-only-unexecuted`). The upstream server image is not expected to contain `temporal-sql-tool` or `schema/`; the pinned admin-tools image (`sha256:4fdaf912…`) is. The build probe records this in the receipt. No schema mode was added to the server image.
