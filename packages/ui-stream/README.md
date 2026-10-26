# Trusted UI stream adapter

The backend owns trusted event publication. This package projects already-authorized, ordered frozen Meri events onto AI SDK7.0.137's standard UI stream. It does not authorize, fetch, mutate or call a provider. Consumers must validate untrusted inputs and recheck current authority before supplying events.

The root export provides `createMeriEventStream`, `meriEventStreamResponse` and `MeriStreamOptions`. The deliberately separate `/protocol` export contains only browser-safe transport constants and `MeriUIMessage`, derived from `@capiro/meri-contracts` public types. Importing the protocol does not load the server producer or Node builtins. No internal source path is part of the public interface.

Run `npm ci --ignore-scripts` and `npm run build` in this directory. TypeScript emits actual JavaScript/declarations; `npm pack --ignore-scripts` includes only compiled modules and this README. Contracts0.1.15 and ai7.0.137 are exact peers supplied by the consuming application. Local development resolves the public canonical contracts package as a dev dependency; packed consumers do not import a sibling repository path.

All events use transient `data-meri-event` chunks with id equal to eventId. Stream completion describes a subscription; it never proves the durable run completed. Only authoritative run.status events do that. The preserved19 composed transport checks live in the frontend qualification package after migration. Live authentication, revocation, hydration and durable resume remain deployment gates.

The compatible `createMeriLiveEventStream`/`meriLiveEventStreamResponse` extension accepts a `ReadableStream<MeriUIEvent>` whose owner performs fresh authorization and durable cursor reads. Upstream `writer.merge` owns reader cancellation; cancellation reaches the supplied event source asynchronously through the standard stream pipeline. The producer scrubs source error details. It makes no model calls and defines no replacement SSE protocol. A finite subscription may finish while a durable run remains active.

Package0.1.5 widens only the declared event union: `MeriUIEvent` includes the frozen legacy `UIEvent` and the explicit native bill-text event from `@capiro/meri-contracts/conversation-sources`. Transport bytes and AI SDK ownership are unchanged. Current conversation/history receivers validate the new variant; the frozen root UIEvent receiver still validates only its original contract.
