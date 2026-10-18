# Control private-origin Node trust: source proposal

Base: frozen PR175 `993f52a97e5d9edcf65c9f89423c097aa52831c7`.
Branch/worktree: `dot/control-ca-trust-20261018` / `meri-control-ca-trust`.

The current source sets the image's Node extra roots to the locked RDS bundle and overrides only the worker to its private server issuer. Control uses global fetch for a private-origin self-call. Missing issuer trust is a source-supported hypothesis until the live exception code is observed. No live exception or successful live repair is claimed.

The implementation outline agreed with the integration owner is control-only init composition. The 174,560-byte RDS bundle remains image-baked; it exceeds the existing static-material 32 KiB file and 64 KiB bundle caps. Canonical static material validation and its `/run/meri` inventory stay intact. After it succeeds, init verifies the configuration and private PEM against independent material pins, verifies the private CA's DER pin against issuer configuration, and verifies the baked RDS lock. It creates an exclusive `0600` composite in owned `0700` `/tmp/meri-control-ca`, preserving every original RDS byte. The existing task-local tmp volume is mounted into control init. Init failure withholds SUCCESS and releases owned static material.

Main control starts with `NODE_EXTRA_CA_CERTS=/tmp/meri-control-ca/ca-bundle.pem`. Before allocating runtime resources it reads back the exact composite against both inputs and refuses missing/changed output. The init process retains the image default. Worker, runner, issuer, model owner, credentials, hostname verification, database configuration and Dockerfile/RDS bytes are unchanged. No TLS bypass or custom global fetch dispatcher is introduced.

Canonical implementation: `apps/runtime/control-ca-bundle.mjs`; lifecycle integration: `material-init-cli.mjs` and `cli.mjs`; task/config wiring: product-preview manifest, first-chat renderer and Stage 3 binding validation. This adds no shared wire contract, database change, service or deployment step.

Verification is focused on exact root preservation, private CA/pin rejection, actual fresh-Node global fetch over loopback TLS, hostname rejection, init sequencing/rollback, and synthesized control/worker/runner wiring. The local executable is Node 22.23.3; the approved product image uses Node 24. Node 24/Linux UID 1000 IO and image qualification remain separate gates. No AWS call, secret value read, SQL, image build, deployment, new chat or live acceptance is authorized by this source proposal. Deployment stays held for separate trust review.
