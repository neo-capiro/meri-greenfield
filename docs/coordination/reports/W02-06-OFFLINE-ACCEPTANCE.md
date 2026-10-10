# W02-06 browser-host preparation acceptance

Codex integration owner, 10 October 2026 UTC. **Accepted OFFLINE preparation only. G1 remains open; no host, support build or image execution is admitted.**

Candidate `d09740b8f1fa7855baf0308d2f0f813e0e6fbf87` comprises the original bounded Hermes observer partial `4863878`, Codex observer correction `be1e7a7`, frozen loader/app correction `4fd85f73405d9cca2d66d8f01234c3aead557905` and Codex completion of the deferred bootstrap/verification/export helpers. Integration preserves all nine candidate files byte-for-byte. The authoritative collector/classifier/polling bodies and frozen app were checked independently; owner additions are not attributed to Hermes.

Separate actual Hermes reviewer session `20261009_202939_740440` ran from `2026-10-10T00:29:32.505544Z` through `00:42:51.974890Z`, returning report-only commit `6db55cdf013f1b5ea824ee39a4c4d82afe478c3f`. Launcher records exit0, zero remaining descendants, empty tree, finished readers, cleanup confirmed and no capture/cleanup errors. Its report SHA256 is `f747c42d084b97e9a61bf7f4333326576d736abf039993438d8d4961e907d1fc`. Reviewer authority was recommendation only; Codex inspected the full report, source scope and counterexamples before accepting preparation.

Codex personally ran the 13-test host suite against the exact candidate checkout, then the independent 23-case completion replay, 48 reviewer export/Put/timer counterexamples and four lifecycle outcomes: all passed with fake host/process/transport inputs. The completion replay first failed because the reviewer had removed generated ignored fixtures; the single bounded-capture test regenerated the fixture, after which all 23 replay cases passed. This was a missing test input, not a native run. Existing tests depend on retained ignored audit fixtures and local pinned dependencies; a fresh checkout without those is not a self-contained reproduction. No install or native Docker/Linux/browser/systemd command was used. Post-integration root15 checks passed, and exact candidate-to-integration source comparison was empty.

Key source SHA256 values:

| File | SHA256 |
| --- | --- |
| bootstrap.sh | `d6c10afb7d6205f633882d23ce6a112ccc136be4d64c5ffe4394d2c6ee5df0dd` |
| host-evidence.py | `3da79f3661b1f907ec7e20f1ba1426169c54b65aeebae0728161b9fc9c634fc4` |
| seccomp.chromium-155-amd64.json | `e62f4c3e3e7ce6de099ba7a0e3df0881b7b407b74dc664aef70f76f6316385c6` |
| seccomp.default.docker-25.0.16.json | `9c1025c88ccaa517b648da571961838744ea2137f176bfe6a48b21294cae9c76` |
| app.mjs | `972eea022521bc96f17f1f429d1e025ab1631ecdbc9357b1ee15bcb58fe649ce` |

The offline path requires one owned container creation/start, complete bounded stdout/stderr, actual ordered browser navigation/download/version facts, browser AND renderer sandbox observations, exact image/config/profile/source context, and a single complete hash-bound export. Transport reconstruction alone is not execution admission: validate the reconstructed complete run record and independently bind the owner context and authoritative classification. A well-formed export can carry a failed run.

Residuals remain explicit. The frozen legacy JS classifier is stale and is not an admission oracle. Observer sampling retains the last complete safe observation when later samples are incomplete. Guest stop/removal may be skipped near its deadline, and stop/removal return codes/readback are not host-cleanup proof. Independently observed EC2 termination and root EBS absence are mandatory even after a valid run/export. Native AL2023/Python3.9/Docker/systemd, browser/renderer sandbox, metadata/network denial, CloudWatch reconstruction and resource cleanup are unrun.

The `7327…` worker digest remains a preparatory pin with unresolved 2 CRITICAL/13 HIGH findings. Before any host launch, bind the final independently reviewed refreshed image, actual config/version/hash observations and support asset bytes, re-review affected source/template, complete its immutable support build and registry verification, review the exact all-ADD change set with fresh STS, and arm the already reviewed external cleanup controller before execution. Prior baseline admission does not transfer. No sandbox relaxation, new network/source/provider authority, G1 promotion or cutover follows from this acceptance.
