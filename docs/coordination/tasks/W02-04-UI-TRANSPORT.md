# W02-04 AI SDK custom transport compatibility

Codex owns acceptance. One bounded real Hermes implementation session, exact launcher-supplied integration base containing this brief; branch `hermes/w02-ui`, worktree `C:\dev\main\meri-greenfield-worktrees\w02-ui`. Dependency: frozen contracts `7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3`, LF Git-blob schema SHA256 `e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b`, accepted H00. Independent G1 compatibility preparation only; no W03 promotion or website deployment. The earlier0bf7d88 hash was the identical root checkout with CRLF line endings; the frozen Git blob has50043bytes/LF and is authoritative. No schema definition changed.

Owned exact paths:

- `apps/ui/qualification/package.json`
- `apps/ui/qualification/package-lock.json`
- `apps/ui/qualification/.gitignore`
- `apps/ui/qualification/tsconfig.json`
- `apps/ui/qualification/types.ts`
- `apps/ui/qualification/producer.ts`
- `apps/ui/qualification/guarded-transport.ts`
- `apps/ui/qualification/projection.ts`
- `apps/ui/qualification/client-facade.tsx`
- `apps/ui/qualification/qualification.test.mjs`
- `apps/ui/qualification/component-pins.json`
- `apps/ui/qualification/README.md`
- `docs/qualification/UI-TRANSPORT-CANDIDATE.md` (exclusive temporary documentation ownership)
- `docs/coordination/reports/W02-04-UI-TRANSPORT.md`

No root/shared-lock/contract/infra/task/launcher/worker/proxy/Temporal/other-report changes. Scratch/build/cache only nested `.runtime`, ignored. Scripts-disabled nested npm installs, compiler and offline tests permitted. Public narrow registry/exact upstream source and existing configured Hermes inference permitted. No model/provider/AI gateway calls, socket/server/browser/React mounting, credentials/cloud/private-source access, native binary/service execution, deployment/push, recursive delegation/global settings/approval bypass. One attempt<=3600seconds/40turns; partial honest if bounded incomplete, no self-resume/retry.

Pin `@ai-sdk/react4.0.140`, `ai7.0.137`, `react19.3.0`, `zod4.6.5`; independently inspect primary npm metadata/SRI and source. Exact React tarSHA256 `6e1718e0627724b24ff0baffd8bdfcbb8e2dbf814a8803b716d399191d40e39f`, ai tar `d40be3e407ebde2fa74ad895a0384bc4b582494d4781cad0f877561ef734f931`; Apache LICENSE both `b4f9adb7c568904834d0dd6cc98d16c390d21ca32fc17ae7a267715269bd5529`. Pin compiler/types as appropriate; preserve notices, don't claim full transitive security/license audit.

Use upstream `createUIMessageStream`/`createUIMessageStreamResponse` for already-authorized frozen Meri events. Emit stable start, `data-meri-event` with `id=event.eventId`, `transient:true`, finish/outcome for the subscription only. Initially no native text/tool/reasoning chunks: projection handles each frozen event exactly once; Claude Agent SDK remains the sole model loop. No streamText/generateText/agent APIs or AI gateway key.

Client: exported `Chat` comes from `@ai-sdk/react` (extends ai.AbstractChat), not `ai`. Construct one external Chat per conversation/authorized view with guarded public DefaultChatTransport/ChatTransport, `sendAutomaticallyWhen:()=>false`; compile `useChat({chat,resume:false})` facade without mounting. Explicitly exercise chat.resumeStream/dispose using mock fetch/WebResponse/ReadableStream only. `useChat({chat})` preserves transport flags; inline useChat({transport}) at this exact pin drops resumeStreamIsReplay and close. Choose incremental replay with flagfalse; reconnect sends last accepted contiguous conversation sequence through prepareReconnectToStreamRequest, not SSE Last-Event-ID. Subscriber detach/abort/dispose MUST NOT issue durable cancellation; only separate authorized command may cancel a run. No asynchronous onData persistence assumption: callback is unawaited void. Keep projection synchronous and cursor acceptance explicit in this offline reference; durable browser storage later.

Guard decoded lifecycle/custom frames before projection: reject malformed/unexpected native reasoning/tool/text frames, validate each frozen UIEvent with an injected validator and require chunk.id equality. Current root validator imports node:fs/node:crypto and has no exported UIEvent TS declaration; do not import it into browser facade. Offline Node tests may inject the unchanged root validator; local types must accurately match/schema-hash-bind the frozen definitions, not invent new fields. Real browser-safe schema compilation/generated validator remains explicit later work.

Exact ai7.0.137 mismatch: dataPartSchemas TYPE expects unprefixed `meri-event`, runtime looks up `data-meri-event`. Reproduce this limitation with malformed custom data and do NOT rely on dataPartSchemas alone; explicit guard must reject. No unexplained casts concealing unsupported APIs. Stream helper/typed transport adopted directly; don't build a replacement SSE/parser framework.

Projection invariants: conversation-wide durable sequence across runs/attempts, immutableeventId+canonicalpayload dedup, duplicateID with changedcontent or duplicate sequencewithdifferentevent fails, gap/out-of-order pauses without advancing cursor and allows authoritative missing-event recovery. Preserve legitimate historical prior-fence events; stale publication is rejected at broker before persistence, not by discarding all history from older attempts. Validate expected tenant/actor/conversation for authorized view, but offline fixture is not authentication. Current attach/replay/publication/reference authorization stays server-owned. HTTP finish/[DONE]/ready/204 do not prove run completion. Render run.error safely by approved code/generic message, never raw transport errors/secret-shaped exception text.

Meaningful offline fixtures: all10frozenvariants, actual upstream writer+DefaultChatTransport+externalChat roundtrip, splitSSE/UTF8, duplicate replay/id-content/sequenceconflicts, gaprepair, multiple runs/attempts, malformedcustomdata, unexpectedreasoning/toolframes, errorredaction,204,disconnect/reconnect, abort/dispose without cancellation. Test actual composed path rather than isolated unused helpers; prohibit network by injecting mockfetch and making accidental globalfetch fail. Compile types; default tests start no server/browser/model. Report Reactmounting/browserpersistence/ALB/auth/revocation/durablestorage NOT RUN.

AI Elements follows transport qualification: `ai-elements1.9.0` is a four-file Apache scaffolding CLI, tarSHA256 `6a931fe5ba313de50b94a66b6205cdbf66fee1a8ac2def1808b5c6c2ef079df7`; it invokes shadcn@latest/versionless registry URLs. Do not execute it or claim its pin freezes component source. Record later requirement to freeze selected component source commit/hashes/transitive lock/notices and Tailwind/shadcn setup. Its AI gateway README suggestion is not required for display components.

Update owned candidate document to correct dataPartSchemas/replay/source/types assumptions and honest compiled evidence. Run root npm run check, nested typecheck/tests, git diff --check; separate outcomes/counts. Commit only owned paths/noamend/push. Return fullSHA/sessionID/checks/source/hash/scope/processstate and allNOTRUN, ready-for-review only. Codex and a separate real Hermes exact-commit review own acceptance.
