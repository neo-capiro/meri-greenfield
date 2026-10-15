# Offline evaluation targets

Scripted loopback compositions of canonical product owners, shared by `evals/isolation`, `evals/performance` and `evals/promptfoo`. Each target composes the real module (session owner, conversation store adapter, service, Fetch mount; artifact service; gateway authority and dispatch) over scripted ports only. No Temporal, PostgreSQL server, S3, model, browser or network is opened, and importing opens nothing.

- `conversation-application.mjs`: `createScriptedConversationApplication({principals,now,ttlMs})` issues one opaque session per `syntheticPrincipal` and serves `/api/conversations/*` through `app.handle(Request)`. Identity and context facts come from the scripted owner keyed by the principal's identity credential; the canonical session owner, service and HTTP boundary are unchanged.
- `artifact-service.mjs`: `createScriptedArtifactService()` runs the unchanged artifact service with in-memory object/version ports and a plain-text executor.
- `gateway-dispatch.mjs`: `createScriptedGatewayDispatch({principals,now})` runs the canonical current-tool authority and tool dispatch with one synthetic catalog entry; `executeWith(handler,…)` substitutes the source handler so leak controls can test result-lineage enforcement.

Every result is a LOCAL_FIXTURE observation. It proves source behaviour of the composed owners, not live policy, durability, Fargate placement, browser isolation or release acceptance.
