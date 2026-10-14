# Assembled runtime image qualification

The approved PR85 Linux diagnostic established the SWC cache failure and proved the
exact promoted build helpers. The integrated new source/image remains unqualified.
This PR starts no paid attempt and admits or deploys no image.

`apps/runtime/build/materialize-swc.mjs` uses the pinned upstream loader, observes its
exact loaded raw addon, validates target/format/containment, atomically installs the
same hashed bytes, removes its private build cache and requires a fresh independent
load. Docker runs it with network disabled after source COPY, before USER node.
Readonly/noexec/runtime/user/capability restrictions and dependency versions are unchanged.

`apps/runtime/build/swc-diagnostic.mjs` is the canonical diagnostic module, shared by
the build helper, image probe and tests. Known native causes have bounded scrubbed
messages; package/libc/ELF and mount observations omit credentials, environment dumps,
mount sources and raw source. Symptom classes alone do not establish root cause.

All 45 proof-source paths remain mandatory. Dockerignore now allows only the 16 exact
previously excluded test-source files (118,586 bytes), while excluding their siblings.
They are hashed as provenance and never executed by application startup. All 44
non-Dockerfile hashes remain unchanged; the Dockerfile row binds the new recipe.
Actual Docker COPY verification checks all 45 hashes plus both exact build helpers.
Native CLI resolution and actual upstream Temporal bundling remain mandatory gates.

## Fresh source packet

Use a new task-owned staging directory; preserve all failed packets/intents. Copy the
producer/probe, native-cli, temporal-binding and source manifest from this directory.
Canonical SWC helpers come from the Git-bound archive, not a second implementation.

SOURCE, CODE and QUALIFICATION_SOURCE must bind the same new reviewed commit. CODE
and qualification pin intentionally remain None here. Wrong, stale PR84/85 or unsealed
pins hold before packet creation/AWS requests. Generate that exact commit's archive
and Git-bound input manifest; refreeze archive/manifest SHA, file-count and byte-total
pins. Rebind proof sourceHead/publicationSource without dropping rows, then seal its
new external-packet hash. Canonical helper hashes must match the archive manifest.
Historical pins record history and do not qualify the new build recipe.

`python -I -B -S meri_image_build.py --help` describes options. No option prepares a
packet locally after all guards pass. `--producer` is Linux-only in the approved
builder. `--start` uploads and starts a paid attempt: separate attempt approval is
required. Exit 0 means the requested operation completed; exit 1 means HOLD. Fresh
IDs and existing-intent guards prevent duplicate submissions. No mode deploys.

## Checks

Run the Node tests in this directory and test_producer.py. The real Temporal test
requires frozen lock installations plus the canonical contracts link. The actual
apps/runtime/test/image-closure.test.mjs requires an approved Docker engine. Windows
supporting evidence does not qualify Linux. Never change ACLs/global cache settings
or weaken isolation to compensate for a blocked host check.

## Candidate manifest with explicitly changed proof rows

`candidate-manifest-fable-20261014.json` is the Fable source candidate after dot's 14 October review: it preserves `source-manifest.json` (hash recorded under `historicalManifest`), lists all 45 rows with their current hashes, and enumerates every row whose bytes changed in `changedRows` with the historical hash, the current hash, the reason and the recorded decision. `source-proof.test.mjs` keeps the historical pins on the historical manifest, proves every unenumerated row equal to its historical bytes, requires each changed row to carry both hashes and a decision, and refuses a changed recipe. It is a source-review artifact: nothing in it is built, scanned or admitted.
