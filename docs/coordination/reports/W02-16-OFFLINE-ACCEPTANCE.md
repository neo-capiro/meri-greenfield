# W02-16 owner acceptance — OFFLINE SOURCE ONLY

Codex accepts the exact browser-worker binding source preparation OFFLINE after independent inspection, retained primary checks, a separate actual Hermes review and post-integration byte verification. This report advances no deployment gate. Accepted candidate `28b2169b72f5832c41c5af4a3ed0986b3c2abf43`, integrated as `16cfc661bd20beca177343f419f664608532f481`, with the unchanged actual independent review `0101ef2403687bd0d55885d9e7ba192eda62e182`, integrated at root `dd5accfc90c48de7f1d38b5fa10b337385554525`.

The accepted scope is the refreshed immutable worker tuple, the guard before browser creation, and authoritative final-record binding, supported by offline source and simulated execution evidence. It grants no immutable support-build acceptance, host packaging permission, native browser admission, security admission, runtime admission, G1 completion or cutover. Application/control services remain in the new independent Fargate environment; this work changes no current Meri/Capiro deployment or source connectivity.

## Exact source and review integrity

The read-only acceptance audit compared each of the following nine files as raw bytes across six sources: candidate working file; candidate Git blob at `28b2169`; root Git blob at `dd5accf`; root working file; reviewer working file; and the preserved owner snapshot. All six copies of every file are exactly equal, with the following lengths and SHA256 values matching the snapshot manifest. The nine entries comprise seven candidate paths plus the two unchanged seccomp profiles.

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| `infra/browser-qualification/app.mjs` | 30361 | `d29250a78527acda0457a377f613cf5a6a5b66f71e9bd16c0655ac080660d757` |
| `infra/browser-qualification/bootstrap.sh` | 13121 | `205f1d22daaac9d530eb7aaef312a7569636ce917638dcabd6032c3934c4f873` |
| `infra/browser-qualification/host-evidence.py` | 89914 | `cf27ce1d1c5cf0c45ba2a1fc2a6cf6d48bd0506728202645ecb4d4f68411679f` |
| `infra/browser-qualification/security.test.mjs` | 38698 | `abd525fa7fd891f1f53f8118737232315d9644a39755dd71ceca0a03813af020` |
| `infra/browser-qualification/component-pins.json` | 10087 | `58201d00494027dbd9a7732f3a59bfc98871a38a78abb75b6131607adc634659` |
| `infra/browser-qualification/README.md` | 8715 | `b3df19db742b3790833f4accbbbf32bb885ab1df84fe6a4aade3bc49a3136df5` |
| `docs/coordination/reports/W02-16-BROWSER-WORKER-BINDING.md` | 11020 | `d630de66e1b8bb9760f31bf3f3123a0661ad96cb0b931f66e1cf213d9541e166` |
| `infra/browser-qualification/seccomp.chromium-155-amd64.json` | 17188 | `e62f4c3e3e7ce6de099ba7a0e3df0881b7b407b74dc664aef70f76f6316385c6` |
| `infra/browser-qualification/seccomp.default.docker-25.0.16.json` | 12828 | `9c1025c88ccaa517b648da571961838744ea2137f176bfe6a48b21294cae9c76` |

Snapshot: `.task-inputs/W02-16-owner-candidate-snapshot-1/manifest.json`, SHA256 `72bcb46d1bea61630fb3f5fa9f4c30ad01b355006d56dc8ccc727e7c3d3798bd`.

The actual independent review report, `docs/coordination/reports/W02-16-BROWSER-WORKER-BINDING-REVIEW-1.md`, is 12,759 bytes, SHA256 `c209894a70435c047898930df63c262174404fbc723a9e4f1b9351a542d221f0`. Reviewer Git/raw, root Git/raw and preserved audit report all match exactly. Audit manifest `.task-inputs/W02-16-owner-review-1-audit/manifest.json` is SHA256 `6d67cfb39c04a681a76d403dcb30c2bc7510d33f29b75efe13d2ba02d8410f5a`; all five recorded report/process/check-capture lengths and hashes were reverified.

Candidate and reviewer worktrees are clean at their respective exact heads. Root HEAD stayed `dd5accf` during the audit; root has owner coordination edits and is not represented as clean. This audit replayed no tests and changed no source, reports, coordination records or prior evidence.

## Actual independent review

Hermes review session `20261010_023431_041505` was distinct from author session `20261010_021036_2afa95`. The review was bounded to 20 turns/1,200 seconds. Preserved process evidence records start `2026-10-10T06:34:20.831009Z`, finish `06:37:12.745589Z`, exit 0, result commit `0101ef2`, zero processes remaining, confirmed empty process tree/readers/cleanup and no capture/cleanup errors. The controller's retained `exited-unreviewed` field is process-capture state, not an acceptance verdict.

The unchanged review gives SOURCE-ONLY PASS, records its own canonical 14 PASS / 0 FAIL run, parse/whitespace checks, all nine exact source hashes, three exact owner fixture hashes, unchanged seccomp data and 39 frozen Python function bodies identical to the `4fd85f7` baseline. It explicitly discloses that its guard test executes extracted guard lines followed by synthetic create/start counters. It ran no extra ad-hoc negative checks. Its retained report is neither rewritten nor silently strengthened by the owner evidence below.

## Preserved owner evidence

| Evidence | Recorded result | Qualification |
| --- | --- | --- |
| `.task-inputs/W02-16-owner-checks-1` canonical run, `06:35:10.875441Z`–`06:35:50.849215Z` | **13 PASS / 1 FAIL**, exit 1 | Guard case failed when Bash resolved through the WindowsApps launcher; multiline `-c` semantics produced exit 127, `bounded: command not found` and tuple fragments treated as commands. Preserve this failure. The other 13 cases passed. This did not establish a source defect. |
| Same owner capture: explicit Git Bash `-n`, Node app syntax and Node test syntax | All exit 0 | Parse checks only. |
| `.task-inputs/W02-16-owner-guard-2`, `06:38:46.097693Z`–`06:38:46.861462Z` | **1 PASS / 0 FAIL**, exit 0 | Only the previously failed guard case reran, with process-local PATH selecting existing `C:/Program Files/Git/bin`; no shim, install, machine PATH change or source repair. The other 13 cases were not repeated. |
| `.task-inputs/W02-16-primary-checks-1/owner-run-1`, `06:43:57.181384Z`–`06:44:18.031730Z` | **24 PASS / 0 FAIL**, exit 0 | One honest flow, 22 rejection cases and one explicitly separate trust-boundary demonstration. Simulated actual contiguous source flow, with injected native interfaces. |

Canonical stdout SHA256 is `11027066c7d7f749dd5bc5fae7d5197d75a86962334ce4cde24b525a8ad47707`; targeted guard stdout SHA256 is `1bd4dcdd8607273fa1e025fb417c86f8339005668b78534b387140af8a7bf014`. Primary-flow stdout is 189,603 bytes, SHA256 `916d5341d2e034a88ce500ac5bc1ec535397e40b745d945b9233978d2337bea0`. These stdout hashes were independently read back during this audit. The primary invocation pins support manifest SHA256 `e2f0d2a29431b01481e0000c6167c5f4fe67829045d5ed54a8676ac5fa952dc5`.

The primary harness extracts unchanged contiguous `bootstrap.sh` lines 144–184, from AUTH-directory creation through `CAPTURE_RC=$?`: 3,223 bytes, SHA256 `9615f939bebce78590ed390db36edfb629da9be539c65548bb0ec5d0b85cc6f3`. It executes the source pull/purge/inspect/guard/workspace/create/CID/watch/capture commands and branches; it does not append a synthetic create/start sequence. Bash is the explicit observed Git Bash executable, given a saved script rather than `-c`. Native interfaces are explicit fakes; real filesystem work is confined to case scratch directories.

The honest tuple case reached exactly one source create, watch, capture and request from actual `capture_browser` for `docker start --attach`. Each of the 22 rejection cases reached zero of all four. They cover wrong/missing/malformed IID, reference, revision and kind; old `7327` reference; manifest digest used as IID; all four observed fields jointly substituted; failed inspect; extra format field; embedded newline; failed pull/logout/purge; and nonempty selected control configuration. Traces verify credential purge before inspect, actual auth-directory absence, empty control config, exact inspected format/target and `LOGIN_DONE=0`.

The 24th case intentionally replaces both loader-provided expectations and observed metadata. It reaches one create/watch/capture/start request and is marked `boundaryOnly=true`. It is a successful demonstration of the trusted-loader assumption, **not a successful admission negative**. Do not describe the result as 23 bad tuples rejected. Expected bootstrap values must come from the independently qualified immutable loader/template; the guard cannot authenticate a caller authorized to replace both sides.

The actual `capture_browser` function is exercised with fake process/select/read/clock interfaces. Its observed start argv is not a Docker execution. Earlier root/preflight/version/timer/deadline/sanitization/support/seccomp/empty-control-config setup is injected; later stop/removal/joins/assembly/export/poweroff/root-volume cleanup is outside this slice. `bounded` and `remaining` are fakes. The evidence establishes the selected source control flow, not whole-bootstrap or native timeout behavior.

The targeted guard child passed and saved its captures; the owner wrapper then failed only while displaying a Unicode checkmark through the Windows cp1252 console. Its wrapper exit 1 is retained separately and is not relabeled as a clean wrapper run; no child test was repeated for that display failure.

The author missing-fixture first failure and closed partial implementation evidence remain in the original preserved snapshot/report. No earlier failure is removed by later passing checks.

## Accepted source behavior and authority boundaries

The intended tuple is worker reference `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:bf55fdab91136344688e2c804598546e521b24d6cdbf4fde9e6a7131e6c2ec9c`, configuration IID `sha256:6f313883ad219ebd5cc3d0dbd1df5cdf80f0f035eab5ab02c3cead4db568f471`, OCI revision `0be04d0799c9c527e300b47c19176cddb0eaa231`, kind `worker-inventory-only`.

The bootstrap guard follows immutable pull/logout/purge and precedes the sole browser create. It compares the inspected IID, first RepoDigest, source revision and kind with trusted exported expectations. `_inspect_reasons` separately binds `record.imageID` and final `inspect.Image` to the fixed accepted IID, `Config.Image` and record worker reference to the immutable reference, and revision/kind labels to fixed constants. Jointly substituted record/inspect IIDs therefore reject under the classifier tests; agreement with each other is insufficient. The primary-flow harness does not replace that separate final-record evidence.

Tuple preparation and `_inspect_reasons` remain narrow responsibilities. The older JavaScript `classifyHostEvidence` stays **UNQUALIFIED** and cannot serve as an admission oracle. The 39-body baseline is retained provenance for its specific frozen bodies; changed bootstrap/classifier bytes have their new candidate hashes and inherit no old whole-candidate or support-image acceptance.

One explicit source limitation remains: the guard compares `.RepoDigests[0]`. A correct requested digest appearing later in Docker's array could fail closed. Native ordering, pull/inspect/label semantics and the AL2023/Python target remain unmeasured. Windows checks using bundled Python 3.12.14 do not establish the AL2023 Python 3.9 runtime behavior.

## Conditions that remain open

- **W17 structural debt before packaging:** current `host-evidence.py` is 89,914 bytes / **1,446 lines**. The actual review's approximate “~1370-line” wording is retained unchanged; the current exact count is used here. A separate focused module split, preserved behavior/provenance and independent review are required before host packaging. W16's narrow binding change does not resolve that debt.
- Changed support-source bytes require a new separately reviewed immutable support build and exact template/source/context rebinding after the required refactor. Prior `d09740b`/`c51f27d` source or support-digest acceptance does not transfer. No build/push/native launch is authorized by this report.
- Qualification still requires the admitted native platform/runtime, actual browser/sandbox/renderer isolation, metadata/network denial, real observer evidence and durable CloudWatch reconstruction, bounded cleanup and physical/root-volume cleanup, with owner admission for each applicable probe. Simulated passes do not discharge these gates.
- The worker image remains **static-build-only**. **49 findings remain open: 4 CRITICAL, 18 HIGH, 18 MEDIUM, 7 LOW, 2 UNDEFINED; 22 critical/high unresolved.** No waiver or security admission is inferred.
- **Office residual risk DEFERRED. Browser/native/security admission NOT GRANTED. G1 OPEN.** Durable model/Temporal and other deployment gates remain separate. Current Meri/Capiro is untouched; source connectivity remains disabled; no cutover.

The supporting integrity audit wrote only an ignored draft and replayed no tests. Codex reverified candidate/root/reviewer byte equality and adopts this scoped owner report. No build, install, Docker/native command, cloud mutation, provider/source/tenant access or runtime admission was performed by this disposition.
