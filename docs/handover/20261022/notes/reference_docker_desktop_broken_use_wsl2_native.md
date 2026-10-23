---
name: docker-desktop-broken-use-wsl2-native
description: "Docker Desktop on this machine is INTERMITTENT, not permanently broken — it worked fine on 2026-09-12 (arm64 buildx pushes to ECR). Always test `docker version` first; only fall back to the Ubuntu-24.04 WSL2 distro's own native Docker when Docker Desktop is actually down"
metadata:
  node_type: memory
  type: reference
  originSessionId: 96919a57-c947-48bd-b779-43f9635b16e0
  modified: 2026-09-18T04:16:40.023Z
---

**Check Docker Desktop first — it is intermittent, not permanently broken.** On 2026-09-12 (Meri Import-Saved-Docs deploy) it worked normally from Git Bash: `docker version` returned server 29.7.2, `docker buildx ls` showed the `desktop-linux` builder with `linux/arm64` available, and `docker buildx build --platform linux/arm64 ... --push` built and pushed both the workspace and web-vnext images to ECR with no WSL2 fallback needed. So run `docker version` before assuming anything; only use the WSL2 path below when that actually fails.

**When it IS down, the symptoms look like this** (observed 2026-09-10, defense-budget Phase 10B-36 qualification-driver work): launching `C:\Users\neoma\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe` via PowerShell `Start-Process` starts several `com.docker.*`/`docker-*` processes, but they vanish within 1-2 minutes and `docker ps` keeps failing with `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`. `wsl --list --verbose` shows the `docker-desktop` distro stuck at `Stopped`. Retried twice, same result both times — likely a nested-virtualization limitation of this sandbox, not a one-off fluke.

**Working alternative: the separate `Ubuntu-24.04` WSL2 distro already installed on this machine has its own native Docker, completely independent of Docker Desktop.** `wsl -d Ubuntu-24.04 -- bash -lc "docker ps"` just works (real systemd `docker.service`, confirmed `Active: active (running)`). Node v20.20.2, pnpm 9.12.0, and Python 3.12.3 are also already present there; `uv` is not (install via `curl -LsSf https://astral.sh/uv/install.sh | sh`, installs to `/root/.local/bin`, then `source $HOME/.local/bin/env`).

**How to drive it from this Windows machine's Bash/PowerShell tools:**
- Prefix every `wsl.exe` invocation from Git Bash with `MSYS_NO_PATHCONV=1` or paths get mangled the same way other leading-slash args do.
- Clone/build INSIDE the WSL2 distro's own native filesystem (e.g. `~/capiro-qual-driver`), not by reusing a Windows-side `node_modules` — platform-specific native binaries (esbuild, prisma engines, etc.) silently break across the OS boundary. A private/authenticated repo needs a token-embedded clone URL (`git clone https://x-access-token:$(gh auth token)@github.com/...`) since WSL2 has no `gh` auth of its own.
- To background a long-running command so it survives the individual `wsl.exe` call returning: `setsid bash -c '...' < /dev/null > /dev/null 2>&1 & disown` — a bare trailing `&` without `setsid`+redirected-stdin gets killed the moment that particular `wsl.exe` invocation exits. Poll a log file for a completion marker afterward.
- WSL2 Ubuntu-24.04 ships its own local Postgres already listening on port 5432 (`sudo systemctl stop postgresql` once, or any disposable container trying to bind that exact port fails).
- Copying edited files from the Windows-side working copy into the WSL2 clone: write a plain bash copy script to a Windows scratch path and invoke it as `wsl.exe -d Ubuntu-24.04 -- bash /mnt/c/Users/.../script.sh` (files under `C:\` are reachable from WSL2 at `/mnt/c/...`) — far more reliable than trying to pipe file content through nested PowerShell/wsl.exe quoting.

See [[project_defense_budget_phase10b36_qualification_driver]] for the task this was discovered during.

**2026-09-14 (admin broadcasts ship, [[project_admin_broadcast_messages]]): Docker Desktop died
MID-BUILD, not just at startup.** Two arm64 images built fine on `desktop-linux`; the third
(engagement-api, ~40 min into `nest build`) ended with `failed to receive status: rpc error:
Unavailable ... EOF`, after which `docker ps` returned API 500s / deadline-exceeded and the
`docker-desktop` distro showed `Stopped`. Pushed images are unaffected (ECR is the source of
truth); only the in-flight build is lost. Finished the third image via the WSL2 route:
- The `setsid bash -c '...' & disown` detachment recipe above did NOT survive the `wsl.exe`
  call returning this time — no log file was ever created and the builder sat idle. What
  worked: `systemd-run --unit=<name> --collect -p WorkingDirectory=<clone> -p Environment=HOME=/root
  /bin/bash -c "docker buildx build ... > /mnt/c/<scratch>/build.log 2>&1; ..."` — a transient
  systemd service, fully independent of the launching process; check with
  `systemctl status <name>` from a later `wsl.exe` call.
- ECR login inside WSL: `aws ecr get-login-password` on the Windows side → write to a scratch
  file → `docker login --username AWS --password-stdin` inside WSL reading `/mnt/c/...`;
  delete the file right after. Same for the `gh auth token` used for the token-embedded
  shallow clone (`git init && git fetch --depth 1 <url> <sha> && git checkout FETCH_HEAD`).
- Escaping trap: `$?` inside a `bash -c "..."` string that is itself inside the
  `wsl.exe -- bash -lc "..."` argument gets expanded by the OUTER Git Bash even when written
  `\\\$?` — the unit ended up running `echo \0 > exit-file`. Don't rely on an exit-code file
  from that nesting; read the build log's `pushing manifest ... DONE` / `ERROR` line and
  confirm via `aws ecr describe-images --image-ids imageTag=<sha>` instead (which you should
  do anyway).
- `qemu-aarch64` binfmt was already registered in the distro and a `docker-container`
  builder there reports `linux/arm64`, so no extra `tonistiigi/binfmt` step was needed.
- **But the WSL route then wedged too**: the engagement-api Dockerfile's runtime stage runs
  `apt-get update && apt-get upgrade -y` (the api Dockerfile does not), and under QEMU that
  step stalled at "Unpacking libpam-runtime" with no log output for 26+ min, after which
  `systemctl`/`docker ps` inside the distro hung indefinitely (the distro still answered a
  bare `echo`, `vmmemWSL` sat at ~340 MB). Host had ~4 GB free of 32 GB with Docker Desktop's
  dead processes still resident. Not recovered — `wsl --shutdown` or a Docker Desktop restart
  would have killed other sessions' builders. Lesson: when Docker Desktop dies mid-session,
  treat the WSL fallback as a one-shot for SMALL builds; a long emulated build that includes an
  `apt-get upgrade` is a poor candidate, and consider asking Neo before restarting either engine.

**2026-09-15/16 (defense-budget PR #1634 release build, [[project_defense_budget_phase10b37_production_reextraction_and_first_approvals]]): the whole WSL2 subsystem wedged mid-session, not just Docker.** A `git clone` into a fresh directory stalled at exactly 120K `.git` size / 0 files checked out, process alive but making zero progress; killing and retrying reproduced identically. Escalated: even a bare `wsl -d Ubuntu-24.04 -- echo hi` and `wsl --list --verbose` from the Windows side started timing out. This was the VM itself wedged, not a Docker-specific failure — confirmed by `wsl --shutdown` (waited for it to return, no other visible sessions), after which a plain `echo` succeeded again and the clone worked immediately on retry. **Fix for a wedged (not just Docker-dead) WSL2: `wsl --shutdown`, then retry the exact same command** — no need to re-clone from scratch or change approach, the VM just needed a cold restart. Reusing an EXISTING already-cloned repo (`git fetch` + `git reset --hard <sha>`) instead of a fresh `git clone` avoided the stall entirely on a second, unrelated repo already present from an earlier session — prefer that when a working clone already exists.

**2026-09-17 (amendment-strategy deploy): `systemd-run --collect` detached builds got CANCELED
within ~20-30s of the LAUNCHING `wsl.exe` call returning, every time, across 4 separate builds** —
BuildKit logged `debconf: falling back to frontend: Teletype` then `#N CANCELED` /
`ERROR: failed to solve: Canceled: context canceled` at basically the same wall-clock point in each
unrelated build stage, which is the signature of the whole WSL2 VM being torn down externally, not
a per-build failure. This also lines up with an earlier full-VM reboot in the same session (`docker
ps` showed every buildkit container, including ones from OTHER unrelated sessions running for days,
suddenly "Up 8 seconds"; `dmesg`/`uptime` confirmed the VM's own uptime was under a minute). Root
cause on THIS machine: the WSL2 instance does not reliably stay alive on `systemd-run`-detached work
alone once the launching `wsl.exe` process exits — unlike the 2026-09-14 admin-broadcasts session
where this same pattern worked. **Fix that worked:** don't detach at all — run the build as a
single, long, BLOCKING `wsl.exe -d Ubuntu-24.04 -- bash -lc "docker buildx build ... --push ."`
Bash-tool call with `run_in_background: true` set explicitly, so the harness's own background-task
tracking (not `systemd-run`) keeps ONE live `wsl.exe` process attached for the build's whole
duration — this appears to be what actually keeps the WSL2 VM from idling out mid-build. Treat
`systemd-run` detachment as unreliable on this machine going forward; prefer a harness-backgrounded
blocking call for anything that must survive more than a couple minutes.

**Also confirmed the same session: the Bash tool pre-processes `$VARNAME` tokens in the command
STRING itself against its own (Windows/Git-Bash) environment, before the string ever reaches any
nested shell — even many quote-levels deep (`wsl -d ... -- systemd-run ... -- /bin/bash -c
"...$SHA..."` inside a single-quoted outer wrapper).** A variable set only inside the nested WSL
shell (e.g. `SHA=... ; docker buildx build -t repo:$SHA`) silently evaluates to EMPTY at the outer
level first, producing something like `-t repo/api:` (trailing colon, empty tag) →
`invalid reference format` — not a shell-quoting bug, a property of this specific tool. Confirmed
against both a `for` loop variable (`$u`, `$f` — never bound, `echo "$u"` printed nothing) and an
inline `SHA=` assignment. **Fix: never put a `$VARNAME` reference in a Bash-tool command string
that is meant to be evaluated by a shell OTHER than the outermost one — inline the literal value
instead** (repeat the command N times with the literal substituted in, rather than looping over a
shell variable across a `wsl`/nested-shell boundary). See also
[[reference_bash_tool_collapses_double_backslash]] — same class of "this tool mangles the command
string before any real shell sees it," now confirmed for `$VAR` expansion in addition to `\\`.

**2026-09-18 (defense-budget Phase 10B-41 continuation, [[project_defense_budget_phase10b41_continuation_diagnosis_and_prototypes]]): a NEW, worse failure mode — ARM64 cross-build fails immediately, not intermittently.** `docker buildx build --platform linux/arm64` on the `desktop-linux` builder failed right away with `exec format error` on the very first `RUN` step (not a mid-build death, not a startup hang — the daemon was up and simple builds may still work, but ARM64 emulation itself is broken). Forced the WSL2/QEMU fallback, which was too slow to finish in-session (a single `nest build` step on the full `apps/api` monorepo was still running past 11 CPU-minutes at close-out). Check ARM64 buildx specifically (not just `docker version`) before assuming cross-arch builds will work — this machine's Docker Desktop can be "up" while its ARM64 emulation path is dead. Recommendation going forward for anything requiring an ARM64 image build: use native ARM64 compute (Graviton EC2 or CodeBuild) rather than QEMU on this machine, given repeated slowness/wedging across sessions.

**`systemd-run --working-directory=` is not optional if you need a specific cwd.** `systemd-run --unit=<name> --collect -- docker buildx build -f apps/api/Dockerfile ...` run from inside a `bash -lc "cd /some/repo && systemd-run ..."` wrapper does NOT inherit that `cd` — systemd-run spawns the unit under its own default working directory (effectively `/` or `/root`), so a relative `-f apps/api/Dockerfile .` fails instantly with `ERROR: resolve : lstat apps: no such file or directory` (looks like a missing-file problem, is actually a missing `--working-directory=/the/repo` flag). Always pass `--working-directory=<absolute path>` explicitly; don't rely on the wrapping shell's `cd`. Same session also confirmed: `systemd-run`'s own stdout (piped through `| tee`) only ever contains its own "Running as unit: ..." line, never the unit's actual output — that goes to the journal (`journalctl -u <name> -f --no-pager`, or `--no-pager` snapshots) regardless of any pipe on the `systemd-run` invocation itself.
