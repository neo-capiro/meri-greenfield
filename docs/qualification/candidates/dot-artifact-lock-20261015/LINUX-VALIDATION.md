# Isolated CPython3.13 artifact validation — NOT RUN

This is a runbook, not execution evidence or authorization to provision/install/build. Base source: `3532541665c62940cd83d98503b3d1d4a0ae718b`; candidate branch `dot/artifact-lock-closure`. Execute only after separate authorization in an already approved disposable Linuxx86_64/glibc environment, against the exact reviewed candidate commit/tree/lock and `wheel-inventory.json`/`source-proof.json` in this directory. No image materialization/build, shared host modification, credentials, provider, browser, cloud or database service is needed for the core checks. Source-enabled behavior remains disabled; fixture identity/accounting is synthetic.

## Preconditions and exact paths

The owner must record the disposable environment identity, candidate source/tree/lock/inventory hashes, CPython3.13.5 build provenance, Node24.21.0 provenance, glibc/OS identity, immutable dependency inputs and explicit writable mounts before running commands. Use the agreed Debian13/glibc2.41 profile; do not silently substitute host Python3.12, another interpreter build, architecture, distribution or placement. Apply approved non-root execution, network denial, CPU/memory/PID/filesystem quotas and an external whole-environment watchdog/teardown. Provisioning/building that environment is outside this runbook.

Required preprovisioned inputs:

* `/validation/source`: isolated copy of the exact candidate source and its reviewed Node dependencies, including root contracts/Ajv/canonicalize and qualification's exact locked PptxGenJS4.0.1/jszip closure. No ambient host node_modules. Preserve and compare source hashes before/after; fixtures may leave failure evidence in their own historical evidence paths, which must be recorded, not erased to claim a clean run.
* `/validation/wheelhouse`: offline, read-only set of all21 reviewed wheels, with filename/size/SHA256 matching `wheel-inventory.json`. No additional wheels, credentials, index or network fallback. Verify the wheel payloads themselves, not just downloaded METADATA hashes, before installation.
* `/usr/bin/python3.13`: exact reviewed CPython3.13.5 and venv/ensurepip support, including its native standard library, resource and compression support; `/usr/bin/timeout`, Bash and ordinary required system utilities already approved/provisioned. No new apt/pip acquisition is implicit.
* `/validation/evidence`, `/validation/tmp`, `/validation/home`: owned, quota-bounded writable directories; source/dependency input bindings remain distinct from evidence.
* `/opt` must be an explicitly preprovisioned **private disposable writable mount owned by the non-root validation UID**, with enough quota for the venv and path aliases. It must not expose the host's `/opt` or another owner's runtime. `/opt/codex` **must not exist** there. The candidate venv will occupy the existing test literals only inside this isolated filesystem. Do not run setup on a workstation, shared runner or host with an installed Codex runtime. Environment-variable markers and a writable-path check alone do not prove isolation; the owner must record the actual mount/namespace binding before execution.

Existing tests hardcode `/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3`: `apps/artifacts/test/artifact-execution.test.mjs:42,109`, `artifact-adapters-independent.test.mjs:14`, `document-replay.test.mjs`, `apps/artifacts/independent/document-replay-independent.test.mjs:13`, and the Office/column suites. They also hardcode `.../dependencies/node/node_modules/pptxgenjs` in the first two suites. Setting PATH, VIRTUAL_ENV or PYTHONPATH does not redirect those literals, and executor `-I` intentionally rejects ambient Python configuration. Do not rewrite tests, monkey-patch subprocesses, disable assertions or symlink to a host Python3.12 runtime to obtain passing results.

Use a real candidate venv at the literal Python path and an alias to the reviewed PptxGenJS installation in the disposable filesystem. This is a test-environment compatibility binding, not a product path/placement change. Never overlay or replace an existing host runtime. Retire the entire disposable environment afterward; do not issue a recursive cleanup against `/opt/codex` on a shared host.

## Candidate-only setup and offline installation

Run the following sequentially in a clean Bash session **inside the authorized disposable environment**. The owner must already have established isolation and quotas; the guards below only catch obvious path/version mistakes.

```bash
set -euo pipefail
umask 077
export PATH=/usr/local/bin:/usr/bin:/bin
unset PYTHONHOME PYTHONPATH VIRTUAL_ENV NODE_PATH NODE_OPTIONS
unset MERI_DOCUMENT_PYTHON MERI_SOFFICE MERI_ARTIFACT_REVIEW_LABEL
export HOME=/validation/home TMPDIR=/validation/tmp
export MPLCONFIGDIR=/validation/tmp/matplotlib
export OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1
export PYTHONDONTWRITEBYTECODE=1
export PIP_CONFIG_FILE=/dev/null PIP_DISABLE_PIP_VERSION_CHECK=1
export PIP_NO_INDEX=1
cd /validation/source
test "$(uname -s)" = Linux
test "$(uname -m)" = x86_64
test "$(id -u)" != 0
test -w /opt
test ! -e /opt/codex
test ! -L /opt/codex
test -d /validation/evidence
test -d /validation/tmp
test -d /validation/home
test "$(node --version)" = v24.21.0
/usr/bin/python3.13 -I -B -c 'import platform,sys; assert sys.version_info[:3] == (3,13,5); assert platform.machine()=="x86_64"; assert platform.libc_ver()==("glibc","2.41")'
candidate_dir=docs/qualification/candidates/dot-artifact-lock-20261015
sha256sum apps/worker/qualification/requirements.lock.txt \
  "$candidate_dir/wheel-inventory.json" "$candidate_dir/source-proof.json" \
  > /validation/evidence/candidate-input-sha256.txt
timeout --kill-after=10s 90s /usr/bin/python3.13 -I -B - <<'PY' \
  > /validation/evidence/wheel-payload-verification.json
import hashlib,json,pathlib
manifest=json.loads(pathlib.Path('docs/qualification/candidates/dot-artifact-lock-20261015/wheel-inventory.json').read_text())
rows=manifest['packages']; house=pathlib.Path('/validation/wheelhouse')
names=[r['filename'] for r in rows]
assert len(rows)==21 and len(set(names))==21
assert {p.name for p in house.iterdir()}==set(names)
verified=[]
for row in rows:
    assert pathlib.Path(row['filename']).name==row['filename']
    wheel=house/row['filename']
    assert wheel.is_file() and not wheel.is_symlink() and wheel.stat().st_size==row['size']
    digest=hashlib.sha256()
    with wheel.open('rb') as stream:
        for chunk in iter(lambda:stream.read(1048576),b''): digest.update(chunk)
    assert digest.hexdigest()==row['sha256'], row['filename']
    verified.append({'filename':row['filename'],'sha256':digest.hexdigest(),'bytes':row['size']})
print(json.dumps(verified,indent=2))
PY
mkdir -p /opt/codex/runtimes/codex-primary-runtime/dependencies
candidate_python_root=/opt/codex/runtimes/codex-primary-runtime/dependencies/python
timeout --kill-after=10s 60s /usr/bin/python3.13 -I -B -m venv "$candidate_python_root"
candidate_python="$candidate_python_root/bin/python3"
timeout --kill-after=10s 300s "$candidate_python" -I -B -m pip --isolated install \
  --no-index --find-links=/validation/wheelhouse --only-binary=:all: \
  --require-hashes --no-cache-dir --disable-pip-version-check \
  -r apps/worker/qualification/requirements.lock.txt \
  2>&1 | tee /validation/evidence/pip-install.log
timeout --kill-after=10s 60s "$candidate_python" -I -B -m pip --isolated check \
  2>&1 | tee /validation/evidence/pip-check.log
mkdir -p /opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules
pptx_source=/validation/source/apps/worker/qualification/node_modules/pptxgenjs
test -f "$pptx_source/package.json"
ln -s "$pptx_source" /opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/pptxgenjs
node --input-type=module -e 'import {createRequire} from "node:module"; const r=createRequire("/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/pptxgenjs/package.json"); const p=r("./package.json"); if(p.name!=="pptxgenjs"||p.version!=="4.0.1")throw Error("PptxGenJS pin"); r("jszip"); console.log(JSON.stringify({pptxgenjs:p.version,jszipResolved:r.resolve("jszip")}))' \
  > /validation/evidence/node-artifact-paths.json
```

The installer timeout is bounded and failure is terminal. Do not retry with unhashed packages, `--system-site-packages`, a source build or an ambient index. `--isolated` plus explicit offline arguments avoids pip configuration surprises. The approved wheelhouse verification must reject a payload/hash mismatch before execution; this document does not transfer the prior metadata-only review to wheel bytes.

## Interpreter, package and native-import readback

This script derives exact expected versions from the candidate lock, checks all21, imports actual modules (including compiled/native paths), and proves their origin is the candidate venv. It does not infer installed validity from pip success. Preserve stderr and exit status.

```bash
timeout --kill-after=10s 90s "$candidate_python" -I -B - <<'PY' \
  > /validation/evidence/python-readback.json
import importlib, importlib.metadata as metadata, json, pathlib, platform, re, sys
prefix=pathlib.Path('/opt/codex/runtimes/codex-primary-runtime/dependencies/python')
assert pathlib.Path(sys.prefix)==prefix and sys.prefix!=sys.base_prefix
assert sys.version_info[:3]==(3,13,5) and platform.machine()=='x86_64'
assert platform.libc_ver()==('glibc','2.41')
assert 'include-system-site-packages = false' in (prefix/'pyvenv.cfg').read_text()
lock=pathlib.Path('apps/worker/qualification/requirements.lock.txt').read_text()
expected=dict(re.findall(r'^([\w-]+)==([^ ]+) --hash=sha256:[a-f0-9]{64}$',lock,re.M))
assert len(expected)==21
versions={name:metadata.version(name) for name in expected}
assert versions==expected
modules=['PIL.Image','pandas','numpy','matplotlib','contourpy','cycler','fontTools',
         'kiwisolver','packaging','pyparsing','dateutil','pytz','tzdata','six',
         'docx','xlsxwriter','openpyxl','pypdf','lxml.etree','et_xmlfile','typing_extensions']
locations={}
for name in modules:
    module=importlib.import_module(name)
    file=pathlib.Path(module.__file__).resolve()
    assert file.is_relative_to(prefix.resolve()), (name,str(file))
    locations[name]=str(file)
import resource, zlib
assert zlib.decompress(zlib.compress(b'candidate compression'))==b'candidate compression'
import matplotlib
matplotlib.use('Agg')
from matplotlib import pyplot
figure=pyplot.figure(); pyplot.close(figure)
print(json.dumps({'python':sys.version,'executable':sys.executable,'prefix':sys.prefix,
 'basePrefix':sys.base_prefix,'platform':platform.platform(),'versions':versions,
 'moduleFiles':locations,'matplotlibBackend':matplotlib.get_backend()},indent=2))
PY
```

Inspect module paths and package readback before proceeding. Do not accept an import exception, other interpreter, missing native extension, font/backend error or extra user-site resolution. Installed bootstrap pip is not an artifact runtime dependency and does not justify shipping it. This check does not inspect every bundled native component; inventory/ELF/license/security review remains a separate gate.

## Existing real artifact regressions — sequential core gate

These unchanged tests exercise actual TXT/DOCX/XLSX/PPTX/typed-analysis bytes through the fixed executor, matplotlib Word/analysis charts, pandas joins/arithmetic/numeric refusal, valid/CRC-invalid PNG handling, selected workbook/Word revisions, literal/formula distinctions, immutable replay/current authorization, failure/deadline/accounting and owned cleanup. They do not require native LibreOffice or fitz for this core gate. They are not provider/SQL-server/cloud tests.

Run one Node test file at a time. An external owner must enforce the entire session deadline and retire the disposable environment on a hang; detached descendants cannot be assumed absent merely because timeout killed the top-level Node process. Test cleanup receipts/assertions and positive environment teardown must both be retained.

```bash
export MERI_REVIEW_SOURCE_ROOT=/validation/source
core_files=(
  apps/artifacts/test/artifact-execution.test.mjs
  apps/artifacts/test/artifact-adapters-independent.test.mjs
  apps/artifacts/test/document-replay.test.mjs
  apps/artifacts/independent/document-replay-independent.test.mjs
)
for file in "${core_files[@]}"; do
  test -f "$file"
  log="/validation/evidence/$(basename "$file").tap"
  timeout --kill-after=10s 300s node --test --test-concurrency=1 \
    --test-reporter=tap "$file" 2>&1 | tee "$log"
  grep -Eq '^# tests [1-9][0-9]*$' "$log"
  for counter in fail cancelled skipped todo; do
    grep -Eq "^# ${counter} 0$" "$log"
    if grep -Eq "^# ${counter} [1-9][0-9]*$" "$log"; then
      printf 'Incomplete artifact gate (%s): %s\n' "$counter" "$file" >&2
      exit 1
    fi
  done
done
timeout --kill-after=10s 60s "$candidate_python" -I -B \
  apps/artifacts/test/test_word_revision.py -v \
  2>&1 | tee /validation/evidence/test_word_revision.log
```

Require exit0, a complete TAP summary with nonzero executed tests and zero failures/cancellations/skips/todos for every file, plus the full unittest success summary. No name-pattern selection, rewritten fixtures, skipped dependency failures or substituted synthetic executor is permitted. Keep failed logs and explain any future rerun. This is a source/dependency core gate, not all artifact-service tests, arbitrary-program sandbox, visual quality or image acceptance.

## Separate renderer/native gate — currently prerequisite-blocked

Do not add PyMuPDF ad hoc to the reviewed21-wheel closure to run rendering tests. `office-columns.test.mjs` and `workbook-columns-independent.test.mjs` import `fitz` in their Python render scripts; that library is not adopted by this candidate lock. They also require the exact supported LibreOffice executable at `/opt/codex/runtimes/codex-primary-runtime/dependencies/bin/override/soffice`. Only `office-recalc-independent.test.mjs` offers MERI_DOCUMENT_PYTHON/MERI_SOFFICE overrides; changing those variables cannot redirect the other suites.

Before that separate gate, obtain a reviewed exact renderer profile with its own hashed dependencies/attribution/security disposition, LibreOffice launchers/native/resources/fonts, and isolation admission. Bind it in a **fresh** disposable environment with the same candidate CPython3.13 lock retained and explicitly recorded additional renderer dependencies. An executable alias to actual qualified LibreOffice may occupy the literal test path only in that private environment; a fake shell script or canned PDF/XLSX never qualifies rendering. Keep the distinction between the21-wheel core result and the extended renderer profile. Preserve fixture binaries and their hashes; both `office-author/original.xlsx` and `office-review/original.xlsx` under `docs/qualification/candidates/workbook-drafting-20261013/` are required by recalculation tests.

After those prerequisites, run the same bounded sequential Node command (no skips or assertion changes) for each of:

```text
apps/artifacts/test/office-recalc.test.mjs
apps/artifacts/test/office-recalc-independent.test.mjs
apps/artifacts/test/office-columns.test.mjs
apps/artifacts/test/workbook-columns-independent.test.mjs
```

Retain actual converted originals/revisions and page images, formula/reference totals, fonts/layout/human inspection and process teardown. Missing renderer, fitz or reference file is a blocked gate, not a pass or excluded test. These controls still do not replace every-page/slide native/human quality, browser AND renderer sandbox/egress/watchdog, full editable-file scope or product-placement acceptance.

## Completion record and cleanup

Record exact environment/source/tree/lock/inventory/wheel hashes, installed readback, commands/timeouts/exit codes/full logs, failing and blocked checks, per-file test counts, emitted artifact/inspection hashes and physical cleanup. Export only scrubbed evidence through the approved owner. Compare source files and historical evidence fixtures against their input hashes; distinguish allowed new evidence from a changed assertion/fixture. Do not silently update source proofs or historical ledgers.

Close every owned process/listener; require test receipts' group absence/temp cleanup and the external owner's positive disposable-environment teardown. Do not clean another owner's paths/processes or recursively remove a computed host directory. Leave a failed environment under owner control until its evidence and teardown are accounted for. A clean core result establishes bounded CPython3.13 source behavior only; it does not resolve lxml bundled-parser findings, complete notices/source materials, full image scan, native rendering, browser isolation, cloud resources or release acceptance.
