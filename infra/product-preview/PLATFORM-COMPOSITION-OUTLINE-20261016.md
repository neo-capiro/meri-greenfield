# Product preview platform source outline

Source pin before this increment: `7a8a8aab260668917ae72e5c856339868a8b59a3`. This is a bounded source implementation plan. It grants no authority to create a credential, database, service, listener, task, image or model request. The disabled Meri manifest keeps both application services at desired count zero.

## Canonical owners and paths

| Responsibility | Existing owner and source increment | Dependency direction |
| --- | --- | --- |
| Durable conversation, original, capability and admission | Existing `apps/runtime/prepared-run-*`, initial journal, native allocation and task router authority | New poststart HTTP owner borrows read ports; it does not create a new run/grant ledger. |
| Task and peer identity | Existing ECS task/ENI readback and private listener ingress marker | Poststart may resolve a claimed task ARN only through fresh ECS `startedBy`/tags and durable original, then compare the private ALB-appended peer IP with that task's ENI. Header text or task metadata alone grants nothing. |
| Task-bound certificate and material | New `apps/runtime/native-authority/runner-poststart-*` and runner-side `apps/runtime/runner-poststart-*`; existing bootstrap material and TLS compilers | A private challenge and possession proof precede release. The certificate issuer and capability/material readers are injected named ports; absent ports refuse. Root mounts only the reviewed private route and pre-CLI runner boot. |
| Temporal server | New `infra/product-preview/temporal-*`; existing accepted five-role fixture and runtime `temporal` configuration | Disabled deployment source requires exact image, separate durable store, role/network, issuer/JWKS and TLS references. Control/poller connect only to the authenticated frontend. |
| Product model proxy | Existing `apps/proxy/product` admission/host observation/settlement and one canonical product budget; new private composition and `infra/product-preview/model-proxy-*` | Trusted ingress independently observes peer and final request, borrows the current run/grant and one budget reservation, then permits one provider send. Missing host capture or owner ports refuse. |
| Final binding and deployment review | Root-owned `infra/product-preview/manifest.mjs`, runtime CLI/control route entry points, and exact change-set document | Source inputs are closed, immutable and disabled. Network, role, issuer, DB and provider authorities require separately reviewed resource bindings. |

## Failure and qualification boundaries

No raw task capability, TLS private key, provider credential, database password or Temporal token enters Git, ECS overrides, an ordinary application response or a build archive as a value. The runner's `/run/meri/task.json` must be created by its task-local pre-CLI bootstrap after authenticated poststart delivery; the static task definition cannot assume it exists. A cancelled, expired, changed-task, revoked-admission, wrong-peer, lost-issuer or incomplete material exchange refuses before the runner listens or dispatches a model call. Resource cleanup belongs to the creating owner, including failed initialization.

During implementation, run focused changed-behavior checks for private/public route separation, exact task/ENI proof, possession and replay, owner-only material, proxy reserve-before-send and settlement, closed Temporal/proxy template bindings, and startup failure cleanup. At the coherent integration pin, batch broader source checks and an independent read-only diff review. Linux/Fargate physical file ownership, live issuer/auth, Temporal durability, provider wire behavior, migration/restore, image scan and deployment remain separate gates.
