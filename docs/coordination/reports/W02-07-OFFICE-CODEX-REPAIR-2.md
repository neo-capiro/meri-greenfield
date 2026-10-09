# W02-07 Office repair 2 rejected by Codex audit

Codex independent read-only audit, 9 October 2026. Candidate
`d10424b6ac6fbb34e33f3ef9f69427aae9ccc059`, branch `hermes/w02-office-export`,
worktree `C:\dev\main\meri-greenfield-worktrees\w02-office-export`.
Git status was clean, and the delta from rejected initial `89a36bf` contains exactly
the four owned exporter, decoder, tests and implementation-report files.

**REJECT for build/probe readiness.** The original actual Hermes reviewer ACCEPT
for initial `89a36bf` remains historical evidence in `W02-07-OFFICE-REVIEW.md`;
this Codex audit does not overwrite or attribute a new verdict to that reviewer.

The separate actual repair2 reviewer20261009_190910_ed9911 subsequently closed
23:18:32.438916Z with verified empty process tree/readers/cleanup. Report-only
commitef9edeea284aa7f63e803b7681e9d1789123a9b6 is retained unchanged as
W02-07-OFFICE-REVIEW-2.md. Its47owned+17adversarial passes do not resolve these
additional owner reproductions. The reviewer acknowledges nested-fact
contradictions but treats them as unreachable from an honest unchanged probe;
the allocated owner criteria require retained complete facts and strict cleanup
regardless. Its claims that every source ancestor/pre-read timestamp/cleanup fact
is checked are contradicted by the cases below. Codex's REJECT remains controlling;
the explicit implementation repair3 is active. No reviewer verdict promotes a gate.

Independent checks passed: Office fake suite **47/47**, unchanged worker suite
**81/81**, root contracts/session suite **15/15**, and `git diff --check`.
Independent adversarial replay nevertheless reproduced these required repair gaps:

- **Authoritative observations are discarded.** The unchanged `artifacts.mjs`
  retains native Python `parseOk` and parsed results, per-format PDF inspection
  results, and the recalc inspection child. `artifacts.py` reports actual DOCX
  reopened heading/table and `word/document.xml`, XLSX reopened inputs/formula
  and worksheet structure, PPTX slide/notes counts, PDF page count, and recalc
  `observed.inspected`, inputs, formula and numeric cached value. The wrapper
  drops native parsed results/structure and PDF nested results, does not require
  native `parseOk`, and does not compare recalc child observations with the
  selected observations. All ten mutations passed: native parse false, native
  nested failure, wrong/absent DOCX structure, zero PPTX slide/notes counts, PDF
  nested failure or observed page count 99, recalc not inspected, recalc child
  cached value 99, and a fourth input 999 (silently sliced away). Decoder also
  accepts native parse false or absent. Retain bounded observed facts and require
  their exact expected values; status/pass summaries alone do not close this gate.
- **Cleanup is not strict or complete.** Missing `cleanupConfirmed` passes the
  verdict because only explicit false is rejected; require exact true. Normal
  child close with a live owned group cancels the generation deadline, then fails
  after grace with **zero group-kill calls**. Kill that owned group and confirm
  absence within the bounded grace. An injected undefined group-probe result
  currently becomes `cleanupConfirmed:true` and passes; only a definite absent
  result may confirm cleanup, and default syscall errors must preserve uncertainty.
- **Source filesystem checks remain incomplete.** A real junction above `runDir`
  passes `inspectExpectedFiles`; inspect every ancestor including base/run roots.
  `readRegularFileVerified` accepts a changed pre-read mtime relative to the
  supplied lstat, so the claimed before/after timestamp verification is incomplete.
  Compare required descriptor identity, link/type/size and time facts before and
  after reading, rather than only checking mtime across the read itself.
- **Decoder bounds still follow allocation.** `extractRecordLines` splits all
  lines before checking `MAX_LINES` (the replay allocated 20002 lines before
  rejection). CLI `runCli` calls unbounded `readFileSync` before the 32 MiB check;
  bound the input read itself before allocating the full text. Native parse facts
  need strict validation; malformed evidence-path objects, unknown cgroup fields
  and generation elapsed time far beyond the declared deadline also pass today.

The bounded pending-write repair works: never-callback and late-callback writes
return failure. Eleven-file synthetic roundtrip succeeds; repeated output
acquisition is refused; invalid missing-end capture leaves no destination.
These positive checks do not resolve the above blockers. Native Office/render,
CloudWatch delivery, actual bytes/visual QA, build/deploy and G1 acceptance remain
**NOT RUN / NOT PASSED**.

Reproduction files are ignored audit scratch only:
`C:\dev\main\meri-greenfield-worktrees\w02-office-export\.task-inputs\office-audit-d10424b\audit.mjs`
and `results.json`. They use pure validation, synthetic files and injected fake
children, not native generators/Office/browser/cloud/provider/server calls.

Candidate SHA256:

| Owned file | SHA256 |
| --- | --- |
| `apps/worker/qualification/probes/office-export.mjs` | `986973ac12903cf435210e7b25819464f6e872d317dde62b9e4394303c444331` |
| `apps/worker/qualification/probes/office-reconstruct.mjs` | `7211a3c4041b818b71ed47ca9e8e535fc082e36076b97efa52ba8b2cefbcbb0d` |
| `apps/worker/qualification/probes/office-export.test.mjs` | `b5484a8c7820ec15f572831c106f4492fd285360ab0d753701ddc3b5bc59956b` |
| `docs/coordination/reports/W02-07-OFFICE-EXPORT.md` | `74401cc8f6bdb8d45e8bf688a0c1361d03840c54fd4b00b53c12c664c03fd471` |

Audit changed no candidate file or historical evidence. Only this owner report
was written in the root repository; no commit or gate promotion was performed.
