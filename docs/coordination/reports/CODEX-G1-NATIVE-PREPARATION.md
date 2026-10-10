# Codex native compiler DATA preparation

The new `scripts/qualification/native_preparation.mjs` prepares inert binding, graph and template DATA from the eleven-member compiler closure at `651ec8ce136a9ed3b22f911ea0dac90f33de40c7`. The selected profile is explicitly `native` or `canary`. It exposes no execution option, caller-selected compiler, source reader, root override or import function. This report requests independent offline source review; it does not admit a worker or advance G1.

The task started from `df80261df164805a66034e018e1abbb0d93b586d`. Ownership is exactly the new preparation module, `scripts/test-native-preparation.mjs` and this report. Existing compiler, W18 binding/planner, locks and shared contracts were unchanged by this task. Concurrent owner changes to the support-build helpers remain outside this task.

The eleven literal records were supplied as discovery DATA in `.task-inputs/CODEX-G1-wire-repair-1/compiler-closure-11.json` and separately compared with every working file and raw Git blob at the fixed reference before and after local preparation. They cover the eight earlier compiler members, `lib/ecs-wire.mjs` and the actual SDK duplicate-key scanner/protocol dependencies. The tool freezes all eleven records and the array; it never derives expected pins from an imported compiler or caller input.

## Source and input boundary

The ordinary module imports only Node built-ins. Invocation snapshots the provided raw static-pins file, its own source and the executing Node binary, then reads the fixed Git tree/blobs and working files. Every Git mode must be regular, every fixed file must have the literal length and SHA256, and the Git batch headers/object IDs must agree. These checks finish before either fixed dynamic import. The scanner is imported from its verified eleven-member path; it rejects duplicate object names, including escaped collisions, before `JSON.parse`. Fatal UTF8 decoding, depth limits from the scanner, finite numbers and reserved object members add explicit input refusals. Raw static pins are bounded at 16 MiB.

Only the actual selected public admission/graph/template factories are called. Admission receives `{staticPins: pins}` with no `executeAdmitted` property. The resulting binding must be inert; the graph must retain its false `GuardInput`; template metadata must be inert and its full definition must match the separately returned graph. The tool then remeasures all eleven Git/working records, raw static pins, helper source and Node binary. All checks precede output creation.

Successful output is one exclusively new directory with five files: original `static-pins.json`, compact `binding.json`, `definition.json`, `template.json` and `manifest.json`. The three products use unmodified `JSON.stringify` output from the compiler factories. Manifest schema `meri-native-preparation/2` binds the explicit profile, source reference, eleven pins, pre/post source observations, local Git command/stream identities, helper/runtime identities and all four data-file identities. Its status is `INERT_DATA_PREPARATION_NOT_ADMISSION`, always with `runtimeEnabled: false`. A write failure can leave partial output; the final manifest is written last, and an existing output is never overwritten or silently resumed.

The focused reader checks visible ancestor links, regular type, link count, path/descriptor identity, length and timestamps, using a bounded allocation and closing its descriptor. Git uses the fixed local executable, argument arrays, a sanitized Git environment, disabled hooks/fsmonitor, a 15-second direct-child timeout and a 2 MiB output bound. No AWS/client/model/native module is imported.

## Checks and retained facts

Fixed Node `C:/Program Files/nodejs/node.exe` v24.19.0 ran `--test scripts/test-native-preparation.mjs`. Final suite: **37 PASS, 0 FAIL, 0 skipped**, child and wrapper exit 0, 18.492 seconds under an external 180-second bound, from 14:45:34.242144 to 14:45:52.734357 UTC on 10 October 2026. Each isolated test child has its own 30-second bound. Nineteen measured source/input records were identical before and after this final suite.

The finite checks cover each of eleven genuinely missing members and eleven same-size mutations; changed entry code is rejected before its top-level filesystem marker can execute. Fresh-process public API calls synchronously modify the real temporary app, SDK protocol leaf or raw input after the preparation promise reaches its import await: each refuses without products. Other checks cover the missing Git reference, duplicate/escaped/nested JSON names, malformed UTF8/JSON and BOM, non-finite/reserved members, cross-profile/unknown-profile inputs, forbidden execution/loader/reader/root options, raw input bounds and preservation of every byte in an existing output directory.

Positive checks compare all six original native A/B product hashes, all three complete canary products against the existing compiler factories, and native/canary SDK-profile graphs with 94 states. Even a synthetically supplied actual-origin label leaves both profiles inert. The role-free native case retains absent task roles and an execution-only `iam:PassRole` resource list. These are local data assertions, not observations of fresh AWS authority.

The initial suite had **36 PASS, child exit 0**, 16.235 seconds and stable measured inputs. Its Python wrapper saved binary captures and process metadata, then failed only while printing Unicode check marks to a cp1252 console; the outer wrapper therefore exited 1. This evidence-display failure is retained and is not relabeled as a test failure or an entirely successful wrapper. The final run followed the addition of the remaining original A-product check and used escaped ASCII for display. The two suites overlap; they are not 73 distinct cases.

One additional default CLI local preparation, using the immutable W18 raw native B pins, exited 0 in 0.533 seconds with **AWS calls 0**. Author DATA readback independently compared eleven working files with `git show 651ec8c:<path>` before and after, checked every emitted file hash and all pre/post closure records. This establishes local identity only.

| Retained native B DATA | Bytes | SHA256 |
| --- | ---: | --- |
| Raw static pins | 10904 | `fc9f1beb1fc0e0c065abb9339ad4cfccc9a5b12591386064e113d128686591cc` |
| Binding | 7133 | `9b9b77832b482e2d70f096326aa5c50cac60dbb1a37187bbb68cb6d20af654c1` |
| Definition | 112210 | `2c962d23a3ab42317e9b9d9ecd80c9d8eab7af6a7e9c59f46359de106f51eac3` |
| Template | 115766 | `c2de9e540fb97dc0e3a3ea421eea768ee58212c8593f4d70462bbc8f9bc0818a` |

Evidence is under `.task-inputs/CODEX-G1-native-preparation-1/`: both suite captures/envelopes/source snapshots, the unchanged first wrapper, revised display wrapper, local preparation/captures/readback and prepared products. Its evidence manifest binds 23 payload files: 5819 bytes, SHA256 `5969d8f55785d09c11f7930cba921b6ea5f3253faece3ca8e50d52f87bee9189`. The local prepared manifest is 20511 bytes, SHA256 `75ab9e19adad02ccaf27c794e1cde2047620c661ec8ded2035421235ca9bd695`. Test fixture clones were restored/asserted then deleted; per-case full clone snapshots are not retained. Node test labels and binary streams remain available.

Preparation source: 13100 bytes, SHA256 `f6609d07b92f552215a524c75dff0fefde8e43daae1ac27c21dda0ab1fc8943f`. Test source: 13815 bytes, SHA256 `5990f8b9f97df8c232496c33409a6f8437cb599863207ec943de09bee5dd6cd4`. The Node binary observed before/after was 92825416 bytes, SHA256 `3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237`.

## Owner invocation and limits

After independently reviewing the exact committed source, invoke a fresh ordinary Node process with exactly `--profile native|canary --static-pins <absolute-file> --output <absolute-new-directory>`. No default input discovery, latest-reference resolution, execution flag, deployment or retry is available. The existing W18 CLI remains unchanged and retains its historical source pins; this new preparation tool does not silently upgrade that planner or its four request contracts.

This is a trusted-checkout observation, not an atomic hostile-filesystem or arbitrary JavaScript embedding boundary. Windows link/reparse visibility and timestamp granularity limit race detection. Previously cached modules, caller loaders, modified built-ins and a same-user hostile actor are outside the boundary; use the reviewed fresh CLI. Manifest Git streams are represented by lengths/hashes and command outcomes, rather than copied raw source blobs. The external test wrappers use direct-child timeouts and PIPE capture without an independent memory cap; descendant cleanup is not proven by those envelopes. Compiler/runtime identity does not authenticate the supplied evidence, prove freshness or establish service behavior.

A later separate owner executor must bind this exact reviewed source and output, independently inspect fresh authority and pass the real deployment/transport/worker/cleanup gates. This task made no AWS/provider/Hermes/build/host/task call and no admission decision. G1 remains open; 49 findings/22 severe remain open and Office remains deferred. Current Meri is untouched.
