# Diagnostic release cycle

The parent relayed Neo's explicit approval at 23:48:50 UTC on 19 October 2026 for a new $5 incremental build/measurement allocation, raising the total approved ceiling from $616 to $621, followed by reviewed deployment to the same preview. Maximum two sequential jobs; execution at most 30 minutes and queue at most 5 minutes per job; no automatic retries. A fresh model chat is not authorized.

At 23:53:31 UTC Neo additionally approved combining the newly found transport repair with diagnostic source `97795c86dbc1c0045c14747cecf170a9dc44f73d`, running focused regressions and required image, measurement, scan and deployment checks only. The frontend wording repair belongs to its separate frontend artifact. No wider Core/UI changes, capability changes, IAM/network/security changes, or agent transmission of secrets are authorized.

## Current gate

The hold below was subsequently released for reviewed transport commit `516a86b61a0b3874707ecf672beb23df51b2ad06`. It was cherry-picked with attribution onto diagnostic source `97795c86dbc1c0045c14747cecf170a9dc44f73d`, producing exact pushed source `2b4421f612f9fbb728d6da52927aac228d712d40`. Focused diagnostic and transport checks, independent archive review and actual build-request review passed before submission. Approved job one `meri-greenfield-qualification-build:04e83f76-34b4-4d4a-be39-d75e34697173` completed successfully at 2026-10-20T00:13:45.363Z, with zero retries. Authenticated source/image/receipt joins passed; digest `sha256:f5a7abc9940ef8f5092bbfa9db9c3345874d448de2d7d7712645f8aad9db5ff7` has a COMPLETE scan with zero HIGH/CRITICAL findings and successful cleanup. Job two remains subject to exact finalized-request review. This records the sequence; it does not enlarge the allocation or authorize a fresh model call.

### Preserved pre-integration hold

The first candidate remains unsealed. Wait for the reviewed exact transport commit, integrate it into the dedicated successor worktree, review the combined diff and focused regression results, then seal the exact combined source. The parent's urgent hold arrived before any upload or build submission. No paid attempt was lost.

Root is the only AWS operator. Archive/source audit, public proof preparation, build packet assembly and measurement packet preparation have exclusive local output paths. All prior evidence remains intact. The read-only resource preflight passed for the existing jump-cli account, CodeBuild project, encrypted versioned bucket and ECR repository; no resource configuration was changed.

The public packet helpers are preparation tools, not authority to submit. Only actual immutable upload receipts may fill source and payload VersionIds. Preserve an intent before each external mutation; an uncertain submission must be observed before any retry and does not authorize another job. Measurement starts only after image/source/scan acceptance.

Private rendering or private material upload, if needed by the canonical pipeline, remains a user handoff. Agent work continues on public inputs and review while that handoff is pending.

## Local setup evidence

The first dedicated worktree creation failed on Windows long paths before leaving a worktree directory; the branch was created. A subsequent creation uses per-command `core.longpaths=true` and the existing branch, preserving all other worktrees. This is a local setup correction, not a repeated product check or AWS attempt.
