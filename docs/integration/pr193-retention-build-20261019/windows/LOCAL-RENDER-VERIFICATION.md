# Windows local-render verification

Ready for Neo's separate local execution. The wrapper composes the exact published source and qualification packet; no qualification job was repeated.

- Actual Windows PowerShell 5.1 parser: three production render files pass.
- Process argument roundtrip: eight fake cases pass, including spaces, quotes, backslashes and shell metacharacters. An initial author test-array wrapping error was corrected in the harness; no production quoting change was required.
- Actual `-File` entry: wrong readback commit returns exit2 / `PR193_READBACK_COMMIT_REFUSED`; existing output returns exit2 / `PR193_OUTPUT_EXISTS`; neither prints the fake private path.
- `Test-Pr193LocalRenderOffline.ps1`: actual entry/Common ACLs with fake public and child adapters pass. It verifies five role receipt rows, canonical argument composition, absent feature selectors, inherited owner-only child ACLs, suppressed fake private stdout and existing-output refusal before public preparation. A reviewer harness initially obtained exit1 by launching PowerShell itself through the CRT quoting adapter; direct native PowerShell invocation confirms exit2. Product Node/Git process argument cases passed separately.
- Root reviewed canonical stage3/render argument names and summary/role output paths against exact source5b395d4c. No concrete unresolved local-wrapper finding remains.

The fresh readback input is commit `05b73a61cb4f2bbfa52eae38ea23e44598c33e9f`, manifest SHA256 `adc81416f2b4c93d3fe3ee4694fbe3160e7a5180182a4b482e892d9e922ff613`, completed20:11:10UTC. Canonical `stage3-input` accepted its foundation and both revision statuses. The DescribeSecret stage maps independently confirm `FIRST_CHAT_20261019D` is absent for all five roles. Historical `listedVersions` arrays are partial deprecated-version pages and must not be treated as a complete version inventory. The separate manual upload must obtain complete fresh metadata before writing.

No actual private file was opened, no private render ran, and no upload/deployment occurred during preparation. Windows source download and dependency setup execute only when Neo invokes the wrapper using existing authentication. The qualified runtime, three-turn/one-tool policy and unchanged proxy/Temporal images remain pinned.
