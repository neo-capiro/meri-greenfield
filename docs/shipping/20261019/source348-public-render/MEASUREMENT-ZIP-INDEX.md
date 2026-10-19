# Source348 Node exact-image measurement archive index

This is a scrubbed member and hash index of two locally inspected evidence archives. The ZIP files and their member payloads are **not** in this repository. Member sizes below are uncompressed bytes; each member SHA-256 hashes its uncompressed exact bytes. Both receipts name Meri source `34851020aa0d73fead4db59ba6e26a098e2d0313`, original Node build `meri-greenfield-qualification-build:526c3e16-753b-4fa9-b6ca-9ed811eb8fc7`, and image digest `sha256:7b295b4265141ff8feefc86dd3fec18e10be5e1a72cd88b7a50511ef53501044`.

| Archive | Measurement build | ZIP bytes | ZIP SHA-256 | Receipt and launch status | Use |
| --- | --- | ---: | --- | --- | --- |
| Successful exact-image measurement | `meri-greenfield-qualification-build:90e6b6f3-4a33-456f-82d2-1ef08ad36adb` | 23,934 | `106febd9d843af78822a2d9fe4d73f93e3039979f936bf85353f2f7e1985552e` | `MEASURED` / `VERIFIED` | Accepted separate measurement for the exact Node image. |
| Earlier failed attempt | `meri-greenfield-qualification-build:d071bc68-da00-43b9-bd78-afc8e51eec3a` | 9,170 | `34217f835bf7bcc6ebdd0cd35dcafa9a01bb8c62ea91309041bb82195ec6c62a` | `FAILED` / `NOT_OBSERVED`; diagnostic `LAUNCH_ENVIRONMENT` | Diagnostic only; not accepted measurement evidence. |

The accepted `90e6` ZIP is retained at `s3://meri-greenfield-qual-build-967807252336-us-east-1/results/product-image/34851020aa0d73fead4db59ba6e26a098e2d0313/exact-image-measurement/7901187224e41b90fb55adc22072114f/image-measurement-evidence.zip`, VersionId `k9LyV3F8ZAPoCmfFkmRT.a6VgfX.mw1Y`. This index does not reconstruct the missing original Node producer receipt.

## Accepted `90e6` archive members

| Member | Bytes | SHA-256 |
| --- | ---: | --- |
| `image-measurement-receipt.json` | 42,179 | `2cd14ff70df5eaa994166dc07b66d8a19fc4e2c75c57c23e6b052d095cf0bd56` |
| `image-measurement-diagnostic.json` | 12,426 | `243413b9789aa1326605ebcac247f4d4a4b4bff351b2c9107bd17e0c782b1d46` |
| `launch-measurement.json` | 23,516 | `fa6d1becefa349c72ee2a02b4ab398ea2ad6f927dc13288e05d0cf781a8a0908` |
| `package-measurement.json` | 416 | `3043530cccd35bda64e9e12d3a7a1ff2c4c0df732a5e5db52024f80f81dd6ee0` |
| `native-measurement.json` | 371 | `74d951ba8a15cad7ff00ae33678def8e779201090430e613da4dc838ea091f68` |
| `evidence-members.json` | 756 | `146bb543440278bc4df50b20ca4e84028b047a9c0aa048d634973bb77585fae0` |

## Failed `d071` archive members

| Member | Bytes | SHA-256 |
| --- | ---: | --- |
| `package-measurement.json` | 416 | `3043530cccd35bda64e9e12d3a7a1ff2c4c0df732a5e5db52024f80f81dd6ee0` |
| `native-measurement.json` | 371 | `74d951ba8a15cad7ff00ae33678def8e779201090430e613da4dc838ea091f68` |
| `evidence-members.json` | 753 | `4d73052f2a1e1b9b921fd4d280c3f9000543a3739e6370436956bcbdb5e6bd23` |
| `image-measurement-receipt.json` | 18,687 | `ab59550318cef2600dde7dbcb1616b15a2ea41faff6d534176be65632f86d0b4` |
| `image-measurement-diagnostic.json` | 12,461 | `3ff7ca33871368dddb0b691423355f3efbf2ada0f4423b4fe38632b54bc2d6ee` |
| `launch-measurement.json` | 26 | `58c5c891e8003c26cc697097ad625b09f3aea37a169b3dc65a1dd2c849c29777` |

The local review parsed all twelve members as JSON and screened field names and strings for credentials, tokens, private keys, email addresses, signed URLs, and URL user information. The published index contains only the above identifiers, statuses, sizes, and hashes; neither ZIP was cleared for publication.
