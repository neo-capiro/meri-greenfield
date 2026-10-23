---
name: reference-capiro-deploy-traps
description: "capiro-dev deploy mechanics — migration status command, the shared migrate family trap, the surgical API/web-vnext roll, and where the authoritative vnext deploy workflow lives"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 47d1ef51-4b70-4b5b-b341-5197d367bae6
  modified: 2026-09-17T18:13:58.038Z
---

Operational facts for deploying `capirov2` to `capiro-dev`, all learned the hard way.

**The entrypoint command is `migration-status`, not `migrate-status`.** Passing the wrong
name prints the full 150-command usage list and exits 1, which reads like a failure.
`migrate` applies; `migration-status` is read-only. Always run status **before and after**.

**Never register a new revision of `capiro-dev-api-migrate` just to run a one-off.**
23 unpinned EventBridge rules resolve that family to `:LATEST`, so a new revision silently
changes the image every scheduled job runs. Register a separate throwaway family instead
(e.g. `capiro-dev-api-crm-status`) and pass the command via `--overrides`.

**Rolling the shared API safely:** copy the live task def, change ONLY the `image` field,
diff it field-by-field to prove nothing else moved, register, then `update-service`.
Rollback is one `update-service` back to the prior revision — no rebuild. CDK is the wrong
tool here; it would carry unrelated infra drift.

**Git Bash mangles leading-slash AWS arguments** (`/capiro/dev/api` becomes a Windows
path). Prefix commands with `MSYS_NO_PATHCONV=1`. Log reads also need
`PYTHONIOENCODING=utf-8` or the AWS CLI dies on a charmap error.

**`scripts/deploy-dev.sh` had three separate blockers as of 2026-08-13 — read this before
trusting it.** It is still the right source for the migrate-before-API-roll *ordering*, but
two of its four steps did not work:
1. **`--build` was broken on Windows.** `MSYS_NO_PATHCONV=1` (needed for ARN colons) also
   stops MSYS converting `$REPO_ROOT`, so native `docker.exe` got `/c/dev/...` as the buildx
   context → `unable to prepare context: path ... not found`. Fixed via `cygpath -m` in
   PR #951. `set -e` did abort before deploying — but **verify that yourself by re-reading
   the ECR digests, don't assume.**
2. **`force-new-deployment` (steps 3+4) deploys NOTHING on these services and still reports
   success.** `capiro-dev-api:145` pins a SHA *tag* and `capiro-dev-web:73` pins a *digest*,
   so forcing a deployment re-pulls the identical image. You must register a new pinned
   revision and `update-service --task-definition` — the surgical roll described above. This
   is the dangerous one: a "successful" deploy that shipped nothing.
3. **`capiro-dev-api-admin-migrate` cannot start** — its latest ACTIVE revision pins
   `capiro/dev/api:0982eb9c9ba…`, a tag no longer in ECR (lifecycle-policy GC), so the task
   dies `CannotPullContainerError … not found` and the script aborts every run. Note this is
   the **admin** family, distinct from `capiro-dev-api-migrate` above (which must never be
   bumped). Before skipping the migrate step, PROVE it is a no-op:
   `git diff --name-only <deployed-sha> <new-sha> -- 'apps/api/prisma/**'` must be empty.

**CI does not build images** ([[project-capirov2-ci-blocked]]), so `:latest` can lag `main`
by days and `--build` is mandatory. `:latest` is also NOT what the task defs use — see (2).

**Proving a web deploy actually shipped, without logging in:** diff the bundle hash in
`curl -s https://app.capiro.ai`, then follow the lazy-chunk graph (index → `VNextApp-*.js` →
`CongressionalStaffVNext-*.js`) and grep the leaf chunk for a string unique to the change.
vNext screens are code-split, so the top-level bundle will NOT contain them — and pick a
string the rest of the app doesn't already have (Outreach copy reused in a vNext screen
matched before the deploy and briefly looked like a false positive).

**CRITICAL, cost a wrong "verified live" report on 2026-08-13: `app.capiro.ai` and
`os.capiro.ai` are TWO SEPARATE ECS SERVICES, each needing its own build+push+roll.
Deploying to one does NOT touch the other, and deploying to the wrong one silently
verifies clean while the user's actual screen stays broken.**
- `capiro-dev-web` → **app.capiro.ai**. **STALE, corrected 2026-09-07: this used
  to render the CANONICAL `DirectoryPage`/`AppShell`, not any `src/vnext` screen —
  that is no longer true.** Live code inspection (PR #1507/#1508/#1510 deploy
  session) found `capiro-dev-web`'s own task-def now sets `WEB_SURFACE=vnext`,
  and `apps/web/src/App.tsx`'s `isVNextSurface` branch renders `VNextApp` there
  too, same as `capiro-dev-web-vnext` — the two surfaces have converged, likely
  as part of [[project_vnext_old_ui_purge_program]]'s "100% vNext" closure.
  Regardless: see [[feedback_app_capiro_deprioritized]] — Neo does not want
  effort spent verifying or deploy-hardening app.capiro.ai, it's slated for
  eventual retirement. Default future effort to os.capiro.ai only; only touch
  capiro-dev-web when there's a specific, concrete reason to.
- `capiro-dev-web-vnext` → **os.capiro.ai**. This is the ONLY service that renders
  `src/vnext` screens (Directory, Dashboard, LegiWatch, etc.) in production. If
  the user's bug report is about a vNext screen, this is the service that needs
  the roll — often *instead of or in addition to* `capiro-dev-web`.
- They pull from **different ECR repos** (`capiro/dev/web` vs `capiro/dev/web-vnext`),
  so an image built and pushed for one is invisible to the other; each needs its
  own `docker buildx build --push`. `capiro-dev-web-vnext`'s working build line is
  `docker buildx build --builder pe-ship --platform linux/arm64 -f apps/web/Dockerfile
  --provenance=false --no-cache-filter build --build-arg GIT_SHA=$SHA -t
  <repo>:$SHA --push .` — `--provenance=false` is required or the push is an OCI
  index, not a manifest, and the digest ECS keys on differs (see
  [[project-web-vnext-os-capiro]]).
- Both services otherwise roll the same surgical way: fetch the live task-def JSON,
  change ONLY `image` (+ `CAPIRO_WEB_RELEASE_SHA` for web-vnext), strip revision
  fields, register, `update-service`, `wait services-stable`. `force-new-deployment`
  does nothing useful on either — see the entry above.
- **Before reporting any vNext fix as deployed, verify on `os.capiro.ai` specifically**
  — with a real authenticated session (Claude-in-Chrome reusing the user's logged-in
  Chrome, not a bare `curl`), reproduce the exact repro steps from the bug report.
  `curl https://app.capiro.ai` proves nothing about vNext screens.

**Windows AWS CLI + non-ASCII env values (e.g. the corrupted `MAP_STYLE_ATTRIBUTION`):
`PYTHONIOENCODING=utf-8` is NOT sufficient — the CLI still dies
`'charmap' codec can't encode character '�'`. `PYTHONUTF8=1` is the fix** (PEP 540
Python UTF-8 mode; forces `sys.stdout` regardless of the Windows console codepage).
Set both together. Without it, `describe-task-definition ... --output json > file`
exits 255 AND leaves a truncated, unparseable JSON file in place — don't assume a
short/invalid file is a redirection issue, re-check the exit code.

**Build logs:** `docker buildx ... | tee file | tail -N` shows nothing until the build ends —
`tail` buffers. Read the tee'd file directly.

**A `cdk diff` for the WebVNext stack is clean** when it touches only WebVNext-owned
resources plus a TaskDef replace. Any change to the listener default action or a rule below
priority 50 is a stop condition — that is what protects app.capiro.ai.

**The authoritative source for the `capiro-dev-web-vnext` deploy process is
`.github/workflows/web-vnext-deploy.yml`**, not a memory reconstruction of
it — read that file directly before deploying vnext by hand (needed whenever
[[project-capirov2-ci-blocked]] is still in effect, which auto-fires this
workflow on push-to-main and also blocks its `workflow_dispatch`). It's a
better source of truth than this note because it's version-controlled: gates
on 4 named vnext tests + typecheck + build, validates the service/target-group
shape before touching anything, tags the image `repo:$sha` + `repo:latest`,
registers a task-def diffing only `.image` + `CAPIRO_WEB_RELEASE_SHA`, and has
an automatic roll-back-on-failure step. Confirmed working end-to-end on
2026-08-16 replicating it by hand for PR #992 (see
[[project_strategies_v3_design_system]]) — took ~26min for the arm64
`docker buildx build` step alone under QEMU emulation on this machine, so
always background that command with a generous timeout, never foreground it.

**Robustness tip on the image digest**: rather than trust `docker buildx
build --push`'s own locally-reported digest (which can be a multi-arch
manifest-list digest if attestations got attached, potentially not what you
expect even with the flags above), query ECR directly for the tag you just
pushed and use THAT digest in the task-def: `aws ecr describe-images
--repository-name capiro/dev/web-vnext --image-ids imageTag=<sha> --query
'imageDetails[0].imageDigest'`. This sidesteps the whole
manifest-vs-manifest-list ambiguity — ECS pulled and ran healthy from it
without needing `--provenance=false` at all in this session's build.

**Final proof a vnext deploy is live, better than bundle-hash-diffing**:
`curl -s https://os.capiro.ai/runtime-config.js` — its `releaseSha` field is
written fresh into the task-def's `CAPIRO_WEB_RELEASE_SHA` env var on every
deploy (see the workflow above) and is served directly, no auth needed. Diff
it against your merge commit; this is simpler than the lazy-chunk-grep method
below and doesn't depend on guessing a string unique to the change.

**`nest build` OOM-kills under QEMU cross-arch emulation (2026-08-16, Phase 8 ship)**:
building `linux/arm64` on an amd64 host via `docker buildx --builder ship` (or any
QEMU-backed builder), the `apps/api` build stage's `nest build` step hit
`FATAL ERROR: Reached heap limit ... JavaScript heap out of memory` around
2GB even though the Docker VM had 16GB free — V8's default old-space heuristic
misreads emulated `/proc/meminfo` under QEMU and picks a ceiling far below
what's really available, and the codebase has grown past that ceiling. Fix:
pin `NODE_OPTIONS=--max-old-space-size=4096` on just that one `RUN` line in
`apps/api/Dockerfile` (committed to main in `dad97e60a`) — scoped to the build
stage only, doesn't affect the runtime image or its env.

**Re-confirmed 2026-09-14 (admin broadcasts ship, [[project_admin_broadcast_messages]]): a live
`aws events list-targets-by-rule` scan found 22 rules targeting `capiro-dev-api-migrate` (most
unpinned) and ZERO targeting `capiro-dev-api-admin-migrate`. The repo's own
`docs/runbooks/prisma-migrate-commands.md` says the opposite and is wrong on this point —
trust the live scan, not the runbook. admin-migrate rev 42 ran status→migrate→status cleanly.**

**`capiro-dev-api-admin-migrate` is the RIGHT migrate vehicle and it WORKS (re-verified
2026-08-18, revision 23).** The 2026-08-13 note above about it being unable to pull its image
is **stale** — it pulled and ran fine. Crucially it connects as the Aurora **master** user
(`/capiro/dev/aurora/master-*`), unlike the serve task which uses the app credentials — that
is what lets migrations run `CREATE ROLE`/`GRANT`/`CREATE EXTENSION`. Clone its live task-def
JSON, change only `image` (it pins by **digest**, keep that convention), register, `run-task`.
Log stream is `api/api-admin-migrate/<task-id>`.

**Reading a one-off task's logs: get the stream prefix from the task-def, don't guess.** The
prefix is `logConfiguration.options["awslogs-stream-prefix"]`, and the stream is
`<prefix>/<container-name>/<task-id>` — e.g. `db-inspect/db-inspect/<id>`, NOT `api/api/<id>`.
Guessing `api/...` for a non-`api` container returns `ResourceNotFoundException`. Worse, the
"most recently active stream in the group" is **not** your task — `/capiro/dev/api` is shared,
and grabbing the newest stream pulled a live user's unrelated research session instead.

**`capiro-dev-api-db-inspect` is a ready-made read-only probe**: entryPoint is `["node","-e"]`,
so pass arbitrary JS via `--overrides` `containerOverrides[0].command` (container name is
`db-inspect`). Ideal for `pg_stat_user_tables` row counts, `pg_indexes`, `pg_roles`,
`_prisma_migrations` inspection against live without touching anything.

**Measure table sizes before designing a migration mitigation.** `capiro-dev`'s biggest
Knowledge-Plane-relevant table is `federal_award` at ~164k rows / 204 MB; `sam_opportunity`
~49k, `congress_bill` ~46k, and the `canonical_entities`/`entity_*` family is **empty**. At
that scale a plain non-`CONCURRENTLY` `CREATE INDEX` is a seconds-long lock, not an outage —
an elaborate out-of-band index build + `migrate resolve --applied` was designed and then
correctly abandoned once measured (see [[knowledge-plane-phase16-18-readiness]]).

**Throwaway one-off migrate family naming precedent**: `capiro-dev-api-crm-status`
already existed from an earlier session; this session added
`capiro-dev-api-kp8-migrate` for Phase 8's migrate-status→migrate→migrate-status
sequence. Clone the live `capiro-dev-api-migrate` family's task-def JSON (role
ARNs, secrets, env, network mode all identical), swap only `family` + `image`
+ `command`, register as a brand-new family — never bump the shared
`capiro-dev-api-migrate` itself. `aws ecs run-task` with the same
`networkConfiguration` (subnets/securityGroups) as the live `capiro-dev-api`
service works fine for these one-offs. Fetch task logs via
`aws logs get-log-events --log-group-name "/capiro/dev/api" --log-stream-name "api/api/<task-id>"`
(needs `MSYS_NO_PATHCONV=1` for the leading-slash log-group name too, same as
ARNs).

**A `prisma migrate status` listing dozens of DB-ledger migrations "not found
locally" is not necessarily wrong-database** — it can be benign pre-consolidation
drift (old per-subsystem migration folders like `ws_*`/`intel_*`/`sp_*`/`onboard_*`
that predate this repo folding several services into one `apps/api` schema).
`prisma migrate deploy` only ever acts on migrations present in the local
folder; it silently ignores ledger entries with no local match. Confirm via
the "last common migration" line and check that the "have not yet been
applied" list is short, chronologically sane, and matches what you actually
expect — that's what actually matters, not the size of the "not found locally"
list.

**`scripts/deploy-dev.sh` only ever reads `$1` — you cannot combine flags** (2026-08-19,
directory former-staff-badge deploy). `--api-only --build` silently keeps `DO_BUILD=false`
(only `$1` hits the `case`), so it "skips local build — assuming CI already pushed," then
force-new-deployment restarts the SAME stale pinned image and reports success. Confirmed via
`aws ecr describe-images imageTag=<your-commit-sha>` returning `ImageNotFoundException` —
nothing had actually been pushed. Fix: run with **just** `--build` (its single-flag form),
which builds+pushes+rolls BOTH api and web(app.capiro.ai) — accept the incidental
app.capiro.ai churn rather than trying to hand-scope it. **But even a real `--build` run's
"stable" report doesn't mean it shipped**: both `capiro-dev-api` and `capiro-dev-web`'s
task-defs are pinned to a specific digest/SHA-tag (this program's own rollback-safety
convention), so `force-new-deployment` just restarts that same pinned image regardless of
what got freshly pushed to `:latest`. Still have to manually register+patch a new task-def
revision pointing at the fresh digest for BOTH — the script's build step is trustworthy, its
rollout step is not, on this cluster.

**Correction to the fetch-vs-XHR note above: it is not universal.** The Directory module's
`/api/directory/*` calls go through **XMLHttpRequest**, not `fetch` — a `window.fetch` monkeypatch
captured nothing for `/api/directory/committees/:id/staff` or `/api/directory/contacts`, while
patching `XMLHttpRequest.prototype.open`/`send` (add a `load` listener, stash `this.__url` from
`open`) captured every response cleanly. Check which mechanism a module actually uses
(`read_network_requests` confirms the URL fired; try both patches) rather than assuming either
one repo-wide — different modules/API clients in this app use different HTTP mechanisms.

**`capiro-dev-api-admin-migrate` broke AGAIN from ECR pruning (2026-08-20, District Nexus
Release 1 index creation)** — revision 26 (the one re-verified working on 2026-08-18) had its
pinned image digest garbage-collected by ECR's "keep last 5" lifecycle policy by the time this
session needed it; `run-task` failed immediately with `CannotPullContainerError`. This is not a
one-time fluke — treat any admin-migrate revision as having a short shelf life. Fix each time:
`aws ecr describe-images` for the digest the LIVE `capiro-dev-api` service currently runs, clone
admin-migrate's task-def JSON, swap only that digest in, register a new revision, run that one.
**Running arbitrary DDL (not just `prisma migrate deploy`) via this family works fine**: override
the container command to build `DATABASE_URL` the same inline way, then `node -e "..."` calling
`prisma.$executeRawUnsafe` — call each `CREATE INDEX CONCURRENTLY` statement as its own separate
`$executeRawUnsafe` call (never inside `$transaction`, which CONCURRENTLY can't run inside).
Verified this way: `federal_award_contractor_name_lower_idx` and `federal_award_recipient_uei_idx`
both built successfully in ~27s against the live table and read back `indisvalid=true,
indisready=true` via a `pg_index`/`pg_class` join in a follow-up `$queryRawUnsafe` in the same
script. See [[project_district_nexus_release1]].

**Generic `/tmp/*.json` scratch filenames for AWS CLI output race with other concurrent processes
on this machine (confirmed 2026-08-26, Meri v6 institutional-memory-ui deploy)** — writing a live
task-def fetch to `/tmp/current-td.json` and re-reading it moments later in the same script
returned DIFFERENT content across consecutive reads (once genuinely correct revision 176, then
stale revision 151 data on a supposedly-fresh re-fetch) even though `cygpath -w` confirmed both
reads targeted the identical physical file path. Almost certainly another automated
agent/session on this same shared machine using the same generic `/tmp/current-td.json` name and
racing it — this machine runs multiple concurrent Claude Code sessions/agents (`capiro-agent`
commits are a visible symptom). **Fix: always use a unique, session-scoped filename under the
session's own scratchpad directory for any AWS CLI JSON scratch file (task-def fetches, patches,
diffs) — never a generic `/tmp/*.json` name.** This is a real, reproducible, this-machine-specific
hazard for exactly the kind of fetch→patch→register task-def workflow this file documents
throughout — not a one-off fluke, and dangerous specifically because the stale-read failure mode
looks identical to a legitimate revision number, not an obvious error.

**`iam.Role.roleName` in aws-cdk-lib (confirmed on 2.252.0) always resolves through the CFN `Ref`
intrinsic — a Token — even when you pass an explicit `roleName` prop.** The construct's getter is
unconditional: `get roleName(){...return this.getResourceNameAttribute(this._resource.ref)}`, no
branch for "was the physical name literal." A test asserting `role.roleName === 'literal-string'`
pre-synthesis will ALWAYS fail with `Received: "${Token[TOKEN.N]}"`, regardless of whether the
stack code is correct. `role.physicalName` DOES hold the literal (`Resource` base class's
`given-resolved` case returns `this._givenPhysicalName` directly) but it's `protected`, not
accessible from outside the construct. Fix: assert against the synthesized template instead —
`Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', {RoleName: 'literal-string'})`.
Confirmed 2026-08-30 (PR #1362) — this was a bug in a brand-new test, not in 8+ month old code,
so don't assume an "obviously right-looking" assertion pattern is safe just because it reads
naturally.

**A committed `infra/deploy/*-taskdef.json` file can silently drift from the LIVE task-def** —
confirmed 2026-08-30, `capiro-dev-api-strategy`: the committed file was missing 5 env vars
(`MERI_RELEASE_GATE*`, `CONTEXT_PACKET_V2*`) that had been added to the live task-def out-of-band
since the file was last synced. Registering the committed file wholesale would have silently
regressed live feature-gating config. Before registering ANY task-def from a repo-committed JSON
file, always `aws ecs describe-task-definition` the LIVE one first and diff environment/secrets
field-by-field against the committed file — treat the live one as ground truth and apply only the
specific fields your change actually intends to touch, the same "surgical roll" discipline as an
image-only bump.

**`cdk synth <one-stack>` / `cdk deploy <one-stack>` still constructs EVERY stack in the app**,
including ones you have no intention of touching (e.g. a frozen Compute stack) — `bin/*.ts`
instantiates all stack classes at module load regardless of which stack name you pass, so a
successful synth of stack A is also proof stack B's constructor (imports, cross-stack references
like `assetsStack.strategyReportTaskRole`) doesn't throw, even though only A gets deployed.

**Native Windows Python (`sys.platform == 'win32'`, confirmed at
`C:\Users\neoma\AppData\Local\Python\pythoncore-3.14-64\python.exe` via the WindowsApps shim)
cannot resolve git-bash POSIX-style `/c/...` paths in `open()`** — fails
`FileNotFoundError` even though the path demonstrably exists and `ls`/bash see it fine. Convert
with `cygpath -w` first and pass the Windows-style path (`C:\Users\...`) into any inline
`python3 -c "..."` snippet that does file I/O. Same root cause as the long-documented
`aws ecs register-task-definition --cli-input-json file://...` git-bash path gotcha above, just
hitting a different binary.

**LibreOffice headless (`soffice --headless --convert-to pdf`) is a solid substitute for "open
in actual Microsoft Word/PowerPoint" when no real Office is installed** — confirmed 2026-08-30,
`C:\Program Files\LibreOffice\program\soffice.exe` was present on this machine. It refuses /
warns on genuinely malformed OOXML the same way Word would ("damaged", "needs repair"), so a
clean conversion with no warnings is real corroborating evidence a generated `.docx`/`.pptx`
isn't corrupt, on top of (not instead of) the unzip+`XMLValidator.validate()` check. Convert,
then `Read` the resulting PDF directly (the Read tool renders PDF pages to images) for a visual
layout check — no `pdf2image`/`poppler-utils` needed for that inspection path, only if you want
raw PNG files on disk instead of an inline read.

See [[project-client-crm-vnext]] and [[project-web-vnext-os-capiro]].

**Hand-rolled deploy facts, confirmed 2026-08-19 while shipping PR #1094 with CI still dead:**
- The migrate family `deploy-dev.sh` uses is **`capiro-dev-api-admin-migrate`** (NOT
  `capiro-dev-api-migrate`, the one with the 23 unpinned `:LATEST` rules). Checked every
  EventBridge rule: **nothing references admin-migrate**, so registering a new revision of it
  pinned to a fresh image digest is safe. Its container runs a raw shell `prisma migrate
  deploy`; to get read-only status instead, `run-task --overrides` swapping the command for
  `prisma migrate status`.
- **`prisma migrate status` exits 1 whenever anything is pending** — that is not a failure.
  Read the log for "The migration have not yet been applied:" and check the list.
- Two ledger rows (`20260524010000_add_program_element`, `00000000000000_init_workspace`)
  exist in the DB with no local migration file. **Pre-existing and harmless** — `migrate
  deploy` ignores them; only `migrate status` reports them.
- **`capiro-dev-api` has NO deployment circuit breaker** (`enable:false`), unlike
  `capiro-dev-web-vnext` which has one with `rollback:true`. A bad API image will NOT
  self-revert and the API backs BOTH surfaces — verify by hand immediately and be ready to
  `update-service` back. A 401 JSON body (`Missing bearer token`) from `/api/health` is a
  good liveness signal: it proves the API answered, not just the load balancer.
- **`MSYS_NO_PATHCONV=1` and `jq`/file arguments fight each other.** Setting it for a whole
  command stops MSYS converting `/c/...`, and native `jq.exe` then cannot open the file
  ("No such file or directory"). Scope it to the AWS calls that need leading-slash args; for
  `--cli-input-json` use `file://$(cygpath -m "$path")` and leave MSYS_NO_PATHCONV unset.
- **Prove an image-only task-def edit before registering it:** run the jq transform with the
  CURRENT image and diff — an empty diff proves the transform itself changes nothing, so the
  real run's one-line diff is trustworthy. Push only the `:<sha>` tag and pin by the digest
  read back from `aws ecr describe-images`, leaving `:latest` alone so nothing else shifts.
- arm64 builds under QEMU on this machine: api `nest build` ~547s, web-vnext vite ~1084s.
  Budget ~20-25 min per image and run them concurrently on separate buildx builders.

**CRITICAL, cost a wrong "deployed + live" report on 2026-08-19: `/api/engagement/*` is
served by its OWN ECS service, `capiro-dev-engagement-api` — NOT `capiro-dev-api`.**
This is the same class of trap as the app.capiro.ai/os.capiro.ai split above, and it is
easy to miss because the path starts with `/api/`.
- ALB `capiro-prod-alb` listener 443 **rule priority 6** matches `/api/engagement/*` and
  sends it to target group `capiro-dev-engagement-api`. Everything else under `/api/*`
  falls to a lower-priority rule and a different service. So **every Outreach V3 route
  (`/api/engagement/outreach-v3/**`), and all Engagement Manager routes, are served by
  engagement-api.** Rolling `capiro-dev-api` changes NOTHING for them and still reports
  a clean, healthy, 2/2 rollout.
- Its own ECR repo is **`capiro/dev/engagement-api`**, built from
  **`apps/engagement-api/Dockerfile`** with the repo ROOT as build context. That
  Dockerfile compiles the SAME `apps/api/src` (entry `dist/engagement-main.js`,
  serve-only, never runs migrations) — so a code fix in `apps/api/src` IS in the image;
  it just needs its own `docker buildx build --push` + task-def roll.
- Container name is `engagement-api`, port **4500**, log group `/capiro/dev/engagement-api`,
  stream prefix `engagement-api`. Roll it the same surgical image-only way as the others.
- **Symptom to recognize:** a schema/validation change deployed only to `capiro-dev-api`
  makes the live engagement API reject the NEW field shape. Because the old locator
  schemas are zod `.strict()`, an unknown key is rejected **regardless of its value** —
  so both `field: null` and `field: "realValue"` fail identically with the same generic
  400. That value-independence is the tell that you are talking to an OLD build, not that
  your new code is wrong. Confirm by running the payload through the deployed image's own
  `dist/` (`docker run --entrypoint node <image> script.mjs`) — if it parses there but
  fails over HTTP, you are hitting a different service.
- Verify which service actually serves a path before believing any deploy:
  `aws ecs describe-services --services <svc> --query 'services[0].loadBalancers[0].targetGroupArn'`
  then `aws elbv2 describe-rules --listener-arn <443-listener>` and match the path
  conditions. `aws ecs list-services --cluster capiro-dev` first — there are 11 services,
  including `capiro-dev-engagement-api`, `capiro-dev-api-strategy`, `capiro-dev-intel-api`,
  `capiro-dev-onboard-api`, all fronting different `/api*` prefixes.

**There are TWO clusters** (`capiro-dev` and `capiro-prod-os-capiro`) and THREE ALBs
(`capiro-prod-alb`, `capiro-prod-os-capiro-primary`, `capiro-prod-os-capiro-secondary`).
`os.capiro.ai` resolves to multiple A records; the one that carries the `/api/engagement/*`
rule is `capiro-prod-alb` (100.50.67.115 at time of writing). Don't infer the backend from
the "prod"/"dev" naming — it is misleading. Probe route existence cheaply with an
unauthenticated `curl -X POST`: **401 = route exists** (auth guard ran), **404 "Cannot POST
/path" = route not registered on the service that answered**.

**`aws ecs register-task-definition --cli-input-json file:///tmp/foo.json` fails `No such
file or directory` on Windows Git Bash even though the file demonstrably exists** (confirmed
2026-08-24, vnext dashboard/shell deploy). Git Bash's `/tmp` is not a path the native
`aws.exe` can resolve through a `file://` URI. Fix: `file://$(cygpath -m /tmp/foo.json)` —
the same conversion already documented above for `--cli-input-json` generally, just hadn't
been hit for `register-task-definition` specifically until now. Don't set
`MSYS_NO_PATHCONV` for this command — it isn't needed (no leading-slash ARN args here) and
would only reintroduce the buildx-context trap from a different command.

**Reproducing an authenticated API call from the browser console: use the app's own
`window.fetch` path, not a hand-rolled `fetch` with a Clerk token.**
`await window.Clerk.session.getToken()` yields a token the API may not accept the same way
(observed inconsistent 401/404 vs the app's own 201 for the identical URL). The reliable
method is to hook `window.fetch` (the app uses fetch, NOT XMLHttpRequest — an XHR-only hook
captures nothing) and then drive the real UI control. Also: `form_input`/synthetic clicks may
not update React state on these controlled inputs — set values via the native setter
(`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v)` +
`dispatchEvent(new Event('input',{bubbles:true}))`, `'change'` for `<select>`) or the submit
handler reads stale empty state and silently no-ops with no error shown.

**Never roll an image built from a feature branch (2026-09-02, Hill Day deploy).** The live
`capiro-dev-api` image was `45a8c6db7` (a merge that landed on main AFTER my branch point); my
branch-built image lacked it, so the roll silently regressed LegiWatch phase 9 until rebuilt from
main. Gate every roll with `git merge-base --is-ancestor <commit-of-live-image> <commit-of-new-image>`
(must print YES) and build from the merged main SHA, not the PR branch.

**The Bash tool's real hard ceiling on this machine is 600s (10 min) per call, regardless of
what `timeout` value you pass — confirmed independently by 5+ separate deploy agents on
2026-09-06/07 (batch merge of PRs #1507/#1508/#1510), each hitting it on their own ~15-45min
docker build.** Requesting `timeout: 1800000` does not error and does not get honored as a
literal block — the harness auto-promotes the still-running process to a tracked background
task partway through and explicitly promises a later completion notification, the same
mechanism as an explicit `run_in_background: true` call. **A subagent cannot hold a truly
synchronous foreground call open across a build this long — stop asking for one.** The
reliable pattern (confirmed working every time it was used): don't try to force a literal
blocking call; instead either (a) launch the build detached (`nohup ... & disown`, exit code
captured to a file) from inside a plain foreground call and attach a `Monitor` watcher polling
the log/exit-code file for a real completion marker, re-arming the watch if its window expires
before the build finishes, or (b) just let the harness auto-background it and immediately
attach a `Monitor` watcher rather than ending the turn. Either way: never declare a build done
until you've independently confirmed the real exit code AND the pushed digest, and never treat
"my call got backgrounded" as license to stop tracking it — that combination (backgrounded +
abandoned) is what silently stalls a deploy with nothing pushed and nobody watching.

**This same shared machine accumulates buildx builder containers across sessions going back
weeks — 24 were found still `Up` in one 2026-09-06/07 session** (`p10b28`, `lwqa-ship`,
`fo-ship`, `mga-orch`, `mga-api`, `p10b22-ship`, `hd2-webvnext`, `hd2-api`, `hd2-workspace`,
`webvnext-ship-hd`, `strategies-ship-*`, `eng-web-ship`, `pe-ship`, `ship`, etc., some from
2026-08-25). Each idle buildkit container still holds some baseline memory, and this
contributed to genuine host memory contention (confirmed via `docker exec ... ps aux` showing
3+ concurrent arm64 QEMU builds pinned at 100% CPU competing for one Docker Desktop VM's ~15GB
budget) that caused a real `vite build` OOM (exit 134) on a `capiro-dev-web-vnext` deploy after
44 minutes — the identical command succeeded in 20 minutes once contention cleared. Before
launching several concurrent heavy builds, check `docker buildx ls` / `docker ps | grep
buildkit` for pressure, and remove ONLY the builders you created yourself for already-confirmed-
complete deploys this session (`docker buildx rm <name>`) — never touch a builder you didn't
create, since this machine runs multiple concurrent Claude Code sessions and an unfamiliar
builder may belong to one of them.

**Confirmed twice in the same session that a DIFFERENT concurrent process can deploy to the
exact same ECS service you're mid-deploy on.** Once as a scratch-file collision (a disposable
Python script in the shared scratchpad got overwritten mid-build by another session deploying
`capiro-dev-engagement-api` from the same commit — harmless since real data files used unique
names, but make even throwaway script filenames unique too). Once as a real task-def race: a
`capiro-dev-web-vnext` deploy agent fetched the live task-def (revision 243) at the start of a
45-minute build, and by the time the build finished, a *different* process (same `capirocli`
IAM identity, different session) had already registered and rolled out revision 244 in the
interim. The fix that worked: re-`describe-task-definition` for the CURRENT live state
immediately before building your edited JSON (not the state you fetched at the start), re-run
the ancestry check against that fresh state, and diff field-by-field against THAT baseline —
never build your task-def edit from a fetch that's more than a few minutes stale on this
machine.

**A generic `json.load(open(path))`/`json.dump(...)` round-trip on a fetched task-def, without
explicit `encoding='utf-8'` on BOTH the read and write `open()` calls, re-mangles the ALREADY-
mojibake `MAP_STYLE_ATTRIBUTION` value into a DIFFERENT mojibake string (2026-09-17, amendment-
strategy deploy)** — confirmed via a field-by-field diff catching `'ï¿½ OpenStreetMap
contributors'` (the live value, decoded UTF-8-as-Latin-1 upstream, pre-existing and not mine to
fix) silently becoming `'� OpenStreetMap contributors'` (a single U+FFFD replacement
character) purely from Windows Python's default `open()` encoding (cp1252) round-tripping bytes
that aren't valid in that codepage. `PYTHONUTF8=1`/`PYTHONIOENCODING=utf-8` env vars are NOT
sufficient by themselves for this — `json.load`/`json.dump` don't take an `encoding=` kwarg (that
throws `TypeError: unexpected keyword argument 'encoding'`); the fix is `encoding='utf-8'` passed
explicitly to every `open()` call that touches a task-def JSON, and `ensure_ascii=False` on the
`json.dump` so the corrupted-but-unchanged value round-trips byte-identical rather than becoming
an ASCII escape sequence that ALSO differs from the live value. **Always diff the full task-def
field-by-field before registering** (this repo's own established discipline) — it is what caught
this before a register/roll made a real, no-diagnostic-value change to a live env var.

**Ingestion task defs are NOT rolled by rolling the API (learned 2026-09-16,
[[project_news_feed_source_slug_regression]]).** Each `capiro-dev-api-sync-*` family pins its
OWN image digest, and its EventBridge rule target pins a REVISION (e.g.
`capiro-dev-sync-rss-intel` → `capiro-dev-api-sync-rss-intel:12`). A script fix inside the api
image only reaches the scheduler after (1) registering a new revision of that family with the
new digest and (2) `aws events put-targets --rule <rule> --targets file://<targets-with-new-arn>`.
Their logs live in `/capiro/dev/api-migrate` under `<prefix>/<container>/<taskId>`, not
`/capiro/dev/api`. Also: re-fetch the live service task def IMMEDIATELY before registering —
another session on this same machine (`capirocli`) registered `:371` mid-roll and a clone of the
older snapshot shipped stale `GIT_SHA`/`RELEASE_SHA`; set both to the built commit, not just `.image`.
