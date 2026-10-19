# PR193 qualified public receiving packet

**Ready for Neo's private local re-render.** Both AWS jobs succeeded; all six immutable measurement receipts, seven launch gates and canonical runtime-values assembly passed. Independent result review found no unresolved qualification finding. No third job is authorized and the candidate is not deployed.

Start with [Neo's exact local render/upload instructions](NEO-PRIVATE-RERENDER-HANDOFF.md). Existing private inputs stay on Neo's secure operator host; every private path is a placeholder. Fresh revision, foundation and role readbacks precede rendering. External upload/deployment require the parent's separate approval.

| Item | Pin |
| --- | --- |
| Product source | `5b395d4ce9218b872b21c420dc00a3af31739824` |
| Node image digest | `sha256:ea0e9ad4cfcec1052c33b39ae2f41c1df6e591b7ab2e74c762a1f68f54990b49` |
| Product build | `meri-greenfield-qualification-build:2d0c9e04-a170-46d2-9d0b-f4094e6a48e8` |
| Measurement build | `meri-greenfield-qualification-build:56cd3c64-a7cb-46ec-9cd6-86f92041bbed` |
| Runtime values | 28,933 bytes; SHA256 `46a04439273a9a26b90472b4fab28f9d13068187e033ad41d12e7045d48f4e0d` |
| Baseline | C `5a42ec962677e70e76db5433330b52fd34db5bcd`; 3 turns, 1 tool; absent optional activation selectors |

## Evidence map

- [Qualification report](../PR193-RETENTION-BUILD-20261019.md): exact source, image, source checks, measured/reused fields and remaining live gates.
- [Independent result review](MEASUREMENT-RESULT-REVIEW.md): all six S3 VersionIds, SHA256/size pairs, complete launch results and fixture limitations.
- `public-candidate/`: deployment inputs, unchanged C policy/allocation, newly assembled runtime values, product receipt, scan bindings and exact C compatibility helper.
- `product-result/`: product receipts and authenticated operator readbacks.
- `measurement-prepared/`: exact submitted request, buildspec, source plan and immutable public payload.
- `measurement-packet/`: frozen generator/verifier/wrapper, focused checks and request review.
- `measurement-results/`: six exact-version result bodies.
- `measurement-operator/`: six authenticated HEAD/GET pairs, download manifest, filtered terminal records, assembly output and live revision/image metadata. The duplicate downloaded public payload is omitted; its original exact bytes remain in `measurement-prepared/`.
- [Public file manifest](PUBLIC-FILE-MANIFEST.json): raw byte sizes and SHA256 hashes for this directory, excluding the manifest itself.

The launch module measures synthetic prepared descriptors and native CLI bytes without executing a model conversation. The pinned successful producer enforces fixed24 Linux cases (B6/R6/W12), but no independent per-case transcript was retained. A complete measured76-row installation inventory does not enable or qualify76capabilities. Private render, approved upload/version binding, deployment approval and live functional/desktop/security acceptance remain pending.
