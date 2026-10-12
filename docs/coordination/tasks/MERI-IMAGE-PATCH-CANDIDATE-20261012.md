# Image source and build-context candidate outline

Author gateway_author, independent reviewer gateway_reviewer, integration owner
root. Exact base `90b4dc8472da13cdee9f49cdc0b4c8306ecbdc73`, dedicated branch
`task/meri-image-patch-author-20261012`. Soft author deadline 35 minutes.

Before recipe or dependency mutation, inspect the entire canonical context from
`scripts/qualification/worker_context.py`, the existing image manifest/build/
binding guards, nested npm closure, Python wheel lock, component pins and static
tests. Reuse the existing offline context assembler and verifier; do not create a
parallel registry, runner, manifest format or bypass an old guard. Assemble the
unchanged base twice into fresh retained task-owned directories, compare exact
manifest hashes and preserve source records. Those source identities prove no
image build, installed resolution, scan, license acceptance or runtime property.

Root owns the held-image finding map; readiness_author owns current primary OS
and CVE evidence; memory_author owns current dependency/license evidence. Propose
the smallest coherent supported version set only after those dependencies arrive
and obtain root approval before changing recipe, pins or locks. No package may
be dropped to quiet a finding, no unstable distribution mixed in to claim a fix,
and no copied or relabeled historical scan may count for this candidate.

Provisional source paths, subject to approval: worker qualification Dockerfile,
component-pins.json, requirements.lock.txt, package.json, package-lock.json and
probes/static.test.mjs. New helper/guard paths require a separate concrete
proposal. Preserve historical pins, raw failures, source gates and original test
assertions. Docs and author evidence remain in the assigned image-patch paths.

Verification: offline context assembly+verification repeated; exact source and
generated member identities; package/pin/lock consistency; context and build
guard unit tests; relevant static dependency checks after any necessary bounded
read-only dependency preparation is approved. Retain real failures and limitations.
No Docker invocation/build/push, old image launch, cloud, paid model, provider,
customer data, frontend, capirov2 write or Hermes action is authorized. G1 remains
open until a separately authorized immutable build, installed inventory, fresh
scan and runtime qualification satisfy the existing gates.
