---
name: reference-meri-proxy-python-test-env
description: "How to run meri-greenfield's proxy Python suites (apps/proxy/product) faithfully on this Windows host — litellm-pinned container, dotted module names, root-owned copy, node for cross-language tests"
metadata:
  node_type: memory
  type: reference
  originSessionId: 132a8902-f161-42d4-b1f8-47a3f7430573
  modified: 2026-10-20T16:45:15.277Z
---

The local venv `C:\dev\fable\.venv-proxy-check` has NO litellm (host_composition/main import it), so proxy Python tests need a container:
- WSL Docker `public.ecr.aws/docker/library/python:3.13-slim` + `pip install --require-hashes --only-binary=:all: -r apps/proxy/qualification/linux/requirements.lock` (pass the lock via `docker exec -i ... -r /dev/stdin`; without `-i` pip silently installs nothing).
- Copy a Node 24 binary in (`docker create` the local `public.ecr.aws/docker/library/node@sha256:c83040f7…` image, `docker cp /usr/local/bin/node`) — 7 owner-wire tests shell out to `node`.
- **Copy, don't bind-mount**: `read_reviewed_file` refuses world-writable/foreign-owned files, and NTFS mounts are 0777 uid 1000 → 2 false test_main errors. tar `apps packages scripts infra` (exclude node_modules) into /src, `chown -R root`, `chmod -R go-w`.
- No `__init__.py` (namespace packages): `unittest discover` fails; run modules by dotted name (`apps.proxy.product.test.test_x`).
- Scripts: `C:\dev\fable\adj-reports\adj-e-notes\proxy-test-env.sh` (up/sync/down) and `proxy-unittest.sh all|<modules>`. Baseline at candidate 4: 191 OK (3 skipped).
- WSL idles out and stops the container: keep `wsl -d Ubuntu-24.04 -- sleep 5400` running in background; `docker start adj-e-pytest` revives it with packages intact.
- adj-c's render test (`render-material.test.mjs`) needs a Python WITH `cryptography` for its throwaway PKI: the system Python 3.11 has it (`MERI_TEST_PYTHON` defaults to `python`).

**More faithful: in the real product image** (adj-b, 10-20, scripts in `C:\dev\fable\adj-reports\adj-b-review-proxy-evidence\`):
- **Image:** derive `FROM` the serving proxy `qualification-worker@sha256:734a20ec…`, which is already local in WSL Docker, so no ECR login is needed.
  - Replace `/opt/meri/apps/proxy` with `git -c tar.umask=0022 archive <c> apps packages scripts infra`.
  - Add node from the local node image through a wrapper. Wolfi has no `/usr/local/bin`; `mkdir` it.
- **Run:** each module as uid 10001 with `--network none --read-only --tmpfs /tmp`.
- **Module count:** 28 modules, including the 4 top-level `apps/proxy/product/test_*.py`. 205 tests at `4797f7da`, 191 at `5de48c76`.
- **The material cross-check** (`test_model_proxy_material`) is skipped without a repo-root `node_modules`, and also needs `apps/runtime/node_modules` (`@aws-sdk/client-ecs`). Mount the workspace `node_modules` of the WSL clone `/opt/adj-b-transport/repo` read-only.
- **Bash tool trap:** `$VAR` inside `wsl.exe -- bash -c '…'` gets pre-expanded. Always write the script to a file.

Related: [[reference-meri-greenfield-windows-test-env]], [[project-meri-proxy-403-owner-grant-and-exchange-budget]]
