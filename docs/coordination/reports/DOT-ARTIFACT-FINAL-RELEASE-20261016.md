# Artifact final release suppression repair

Exact base: `2cba7e425d7c00c904451f78f8d7577320431950`; independent branch `dot/meri-artifact-final-release-20261016`. Parent assigned the reviewer's adjacent inherited final-release finding. The canonical durable-head architecture remains in its separate source review.

Proportionate outline: change only the generator service's final retention subject from optional revision base to the actual ACK-validated committed version. Preserve fresh authorization, caller/conversation scope, original effects and UNKNOWN accounting. Add focused synthetic suppression-during-settlement controls for a new artifact, its conversation and a revision using the existing canonical storage fixture; retain an exact-old-source negative control. No new publication behavior, contract, migration, resource, live binding or broad audit.

Result: final `servable(life,context,{version})` now checks the committed artifact after budget settlement and the existing fresh authorization. For creation the old `readBase` was null, so only conversation suppression was checked at release. The earlier precommit check did not cover suppression arriving during settlement. The committed version preserves the actual artifact identity on revision as well, even when its unused new allocation names another artifact.

This is a metadata-success refusal repair. Neither the reviewer's counterexample nor these controls demonstrate raw-byte leakage. The original object and durable version remain committed; refusal reports `ARTIFACT_EFFECT_UNKNOWN` with `RETENTION_SUPPRESSED`, original version/budget identity and completed settlement. No generation, object upload, allocation or settlement is repeated.

The independent reviewer probe is retained byte-identically at `apps/artifacts/storage/test/review-final-retention-race.test.mjs`: SHA256 `88e039bad00c0f8b3aebf606c249d91bd07d85ca57027567450b7080b9f2b01c`. It fails the unchanged old2cba service blob `26e131fff3a99286087e7fb63501b5fcf8b03d69` with `Missing expected rejection`, then passes the fix. The stronger local control separately fails that same old blob and, on fixed source, verifies one generation/put/settlement, committed record/head retained, no metadata delivery, exact fresh authority/scope ordering and no fabricated accounting uncertainty. Conversation and revision controls also pass.

Bounded synthetic evidence in task9/evidence, one process per batch,128MiB V8 heap,120000ms hard wall, fresh available-memory/pressure checks, no children:

| Label | Result | Controlled wall ms | Sampled Windows peak working-set bytes | Fresh available bytes |
| --- | --- | ---: | ---: | ---: |
| artifact-release-negative |0/1 expected failure on exact old service|711|90021888|11043041280|
| artifact-release-review-negative |0/1 expected failure, byte-identical reviewer probe|681|102801408|11305594880|
| artifact-release-fixed |31/31|845|108695552|11283030016|

Exact argv/output/exits are retained in corresponding `.tap`, `.stderr`, `-process.json` files. Each used `node --max-old-space-size=128 --import file:///C:/Users/neoma/AppData/Local/Temp/meri-preview-sdk-reuse.mjs --test --test-isolation=none ...`; negative controls explicitly selected the exact old local module through the test-only environment override. The fixed batch selected the3 focused cases, exact reviewer case, existing service/publication binding case and26 existing independent service/output cases. These are synthetic source controls over scripted SQL and memory object/accounting ports; no native DB/S3/provider/browser/renderer/compiler/install was used. The preload only resolves already installed read-only dependencies and is not dependency/image/native qualification. Working-set sampling is not a measured-RSS claim. Both negative failures remain visible; no assertions were relaxed. Old source was copied outside Git and its temporary in-tree module removed; all owned test processes exited and were disposed.

Parent independently SOURCE ACCEPTED2cba's publication architecture before this successor. Only `service.mjs` changes production behavior here; the other3 paths are the focused regression, unchanged reviewer probe and this report. `git diff --check` passed. Historical manifests, frozen contracts, lockfiles, migrations and accepted publication/retention modules remain unchanged. Exact h proof-row delta is retained in the handoff, h remains HOLD; no repinning or activation.

This successor requires independent exact-source review. Protected evidence-root facts and explicit human preview execution approval still gate activation. The separately authorized retention pre-enable callback is coordinated with Qualification/Startup on its own exact joint source pin; it is not included in this repair. Source commit/tree and remote verification accompany the final handoff without editing this report's own future pin.
