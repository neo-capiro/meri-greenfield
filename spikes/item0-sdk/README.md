# Item 0 SDK experiment (not product code)

Base: `05d588c7c5d6da8b8e8a12ea4d47e16526af1aaf`. Requirements: PR206 handover `39decf1ff6c382c1a2d5172a13c1da6f1074520d`.

Implementation outline: use the pinned Claude Agent SDK as the only loop, its Claude Code preset, built-in tools, ordinary SDK skill/subagent configuration, and standard session store. A five-question synthetic fixture supplies content; it does not access Core or represent real permissions. The script records timing, observed tool use, usage and session behavior. Root owns container/AWS execution and quality comparison. No product runtime, old authority, infrastructure, database or shared package changes belong in this spike.

The experiment will use a new scratch/config directory, explicit direct Bedrock configuration, per-query turn/cost/time bounds, and denied Bash. Tests cover malformed/missing configuration without network access and the actual pinned SDK API surface. Live results remain pending until root executes the bounded script.

## Local source checks (no model calls)

```
cd spikes/item0-sdk
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
node run.mjs --help
```

The six tests exercise actual SDK store methods and a real loopback HTTP MCP server/client, with invalid-header/input controls. They do not run Claude or call AWS. TypeScript checks the actual JavaScript option construction and SDK message narrowing against 0.3.295. The explicit test script is this isolated experiment's smoke entrypoint; production CLI discovery is unchanged.

## Root execution

Use a clean Linux checkout of the spike commit. Root first verifies AWS CLI v2, its account, approved Bedrock model/profile access and narrowly scoped task role. Do not read or copy another host's credentials. The existing preview runner is X86_64 and has no task role according to root's live inspection, so it cannot establish this direct ARM64 path.

Root supplies a verified ARM64 Node 24.22.1 Debian/glibc base digest:

The existing model at the pinned source is `us.anthropic.claude-sonnet-4-6` (`infra/product-preview/first-chat/deployment-inputs.json:135`, `policy.json:6`, `runtime-values.json:23`). Root must verify current profile access before supplying that ID; this experiment does not change the default model decision.

```sh
docker buildx build --platform linux/arm64 --build-arg NODE_IMAGE="$VERIFIED_NODE_IMAGE" \
  -f spikes/item0-sdk/Dockerfile -t meri-item0-spike:"$SOURCE_SHA" --load .
```

Image entrypoint: `node run.mjs`; default `--help` makes no model call. Required environment: `CLAUDE_CODE_USE_BEDROCK=1`, `AWS_REGION=us-east-1`, standard ECS task-role credentials. The task needs Bedrock InvokeModel/InvokeModelWithResponseStream only on the approved profile and its routed model resources, plus logging. Model discovery/model availability checks may need additional read permissions; root should inspect the actual refusal before adding them. No Core secret, DB URL, owner/proxy token or Anthropic API key. Default AWS credential-chain behavior is retained. The model ID must be supplied explicitly, never guessed by this script.

Run **each command in a fresh container**, always using `/scratch` as `cwd`, mounting an empty writable `/evidence` output for new results and the **seed output read-only** at `/seed` for continuity. Root captures all three output files before destroying the task. A Fargate run needs root's existing output collection method, or a narrowly scoped synthetic evidence prefix if it uses S3; this script does not upload anything.

```sh
# First fresh container; evidence output is seed/
node run.mjs --run --question seed --model "$APPROVED_MODEL_ID" --work /scratch --out /evidence/seed
# Second fresh container; seed/ from above mounted read-only as /seed
node run.mjs --run --question resume --model "$APPROVED_MODEL_ID" --work /scratch --out /evidence/resume --resume-from /seed
# Third fresh container; restore original seed again, not the resumed branch
node run.mjs --run --question fork --model "$APPROVED_MODEL_ID" --work /scratch --out /evidence/fork --resume-from /seed
# Fourth and fifth fresh containers
node run.mjs --run --question compare --model "$APPROVED_MODEL_ID" --work /scratch --out /evidence/compare
node run.mjs --run --question web --model "$APPROVED_MODEL_ID" --work /scratch --out /evidence/web
```

Each query is bounded at **12 turns, estimated USD 1, 4096 output tokens per model request and 120 seconds**. The five queries therefore have USD 5 aggregate SDK estimated limits; that is not an AWS hard-spend guarantee. Keep an outer task timeout (e.g. 180 seconds), stop the specific task on timeout, preserve failure evidence and verify exit. An optional extra Stop probe uses `--question compare --stop-after-ms 3000` in a sixth fresh container with another USD 1 estimated bound. This returns exit 1 intentionally; inspect interruption time and task exit rather than treating it as a successful answer. No automatic retries by the experiment; provider retry remains inside the SDK.

The fixture HTTP MCP server is bound only to `127.0.0.1`, requires a literal synthetic header and has one read-only fake tool. It exercises native MCP HTTP options; **it is not a production gateway or an authority design**. Do not expose its port. File tools operate in this isolated scratch filesystem; this experiment does not qualify the production filesystem or egress sandbox. Avoid unrelated host mounts. The `web` query needs egress to the real public endpoints used by native WebSearch/WebFetch; capture denied destinations rather than opening unrestricted access or substituting another provider. Other questions deny those web tools.

## Evidence and interpretation

`report.json` contains final synthetic answers, initialization tool/skill lists, observed tool calls/results, SDK usage and relative timings. `events.json` contains content-free event timing. `session-store.json` contains opaque SDK transcript entries, including subagents, solely for transfer into a fresh `InMemorySessionStore`. No new continuity protocol is implemented. Keep raw transcript evidence private; only scrubbed findings belong on GitHub.

`success` means the SDK returned a successful result with no detected mirror error and the expected session identity. It does **not** mean a required tool was actually used, a question was answered well, or a production gate passed. Check tool names and matching result error flags. For resume/fork, require the remembered phrase, same/new session ID respectively, and unchanged original seed entries for the fork. Failure to recover the phrase is an adjust result even if the script's execution outcome is success.

Compare all five answers with claude.ai using the identical synthetic questions and fixture content. Score grounding, explicit uncertainty, actionability, organization and continuity (0–2 each); record reviewer and both answers. No comparison has been run by this lane. TTFT starts at the SDK query, not ECS task admission. Core and DB are absent, so this cannot establish product overhead or the item 0 call-count limits.

`modelUsage` includes main, subagent and query-pipeline side calls; `usage` is main-loop only. Resumed/forked result totals can include prior session totals. Do not sum successive cumulative results or bill a resumed run for the seed again. Persist the observed baseline and use a reviewed per-run delta plus the owned price table later. SDK estimates do not include every helper request and are not an invoice.
