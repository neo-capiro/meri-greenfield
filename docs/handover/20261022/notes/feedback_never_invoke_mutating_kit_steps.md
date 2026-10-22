---
name: feedback-never-invoke-mutating-kit-steps
description: "Never call a ship-kit step name to \"check argument handling\"; mutating steps must require --execute that only their .sh wrapper passes"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 8ea69adf-d918-4e1a-8e90-fddb5c405451
  modified: 2026-10-20T11:17:44.353Z
---

On 2026-10-20 I ran `node kit.mjs 03-source-put --help` in the frontend ship kit, meaning only to see how the runner treats extra arguments. The runner ignored `--help` and ran the step. It put a 2 GB source version into the preview S3 bucket, in a session where all AWS mutations were the orchestrator's alone. The effect was contained (no build, no triggers) and I disclosed it, but it was an unauthorized write.

**Why:** a kit runner's step names ARE the mutation commands. Any invocation with a real step name executes it, whatever flags follow.

**How to apply:**
- Test runner argument handling only in a scratch copy whose `kit.json` has a nonexistent AWS profile, or with step names that are read-only.
- Every kit runner I write makes mutating steps refuse unless `--execute` is given, and passes `--execute` only from the step's `.sh` wrapper (see [[reference-portfolio-preview-frontend-ship-flow]]). Unknown arguments are refused.
- adj-e's Meri kit (`C:\dev\fable\ship-kit\kit.mjs`) has the same gap.
- If a mutation does happen by mistake: stop, read back exactly what changed and whether anything was triggered, make no "undo" write unless authorized, and put the disclosure in the first lines of the report.
