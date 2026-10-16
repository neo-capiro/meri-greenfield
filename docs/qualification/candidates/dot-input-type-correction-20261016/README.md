# Corrected input0.1.7 declaration and artifact

Parent HOLD on published43142561/SHA53497d94 identified a real defect: `receiveConversationInputResponse` referenced `ConversationInputErrorResponse`, but that name was not declared or exported. The earlier skipLibCheck fixture did not check the new declaration body. Its runtime/archive passes and type-command exit0 were insufficient; that artifact remains HOLD and is archived at `packages/contracts/conversation-input/evidence/held-43142561/capiro-meri-contracts-0.1.7.tgz`. Prior receipts, outputs and original SHA remain preserved.

Narrow generator/consumer correction source `5fb3309ccaeeed3742ef1927ec9892d4c0fe49bd`, tree `594aafd73952bb061e5b007cfa6f6a0dc666e078`. The generator imports the existing canonical public `ConversationErrorResponse` and explicitly exports `ConversationInputErrorResponse` as its alias. No generated private-name hardcoding, schema, wire, runtime receiver, authority or frozen contract changes. The public type fixture imports the alias, checks canonical assignability, checks the response union and rejects an invalid canonical error code.

Corrected actual artifact source `618db545b15b5c4bab58f0cd5d12cfb022232402`, tree `1df5f7a94eb3f5658a45a7dd87e1a4a81b5fb5d8`. Later evidence changes do not alter those bytes.

- Path: `packages/contracts/conversation-input/evidence/capiro-meri-contracts-0.1.7.tgz`.
- SHA256: `8f0c2e1435122c22f2a1ed7427dd744f361bc598e178f2ef842acd6f91b78daa`.
- SRI: `sha512-GAbmH0ZshRDUAiyhuEImdlIyFAhUqwWUudHRYNPLL9WitFjc5cERyidP9Yhe9jOPHKC5lJGF3pF9yVgZeWfKlw==`.
- 510639 packed bytes,6069884 unpacked bytes,35 regular entries. Every actual archive member matches the source package, all15 new metadata source rows and all29 preserved baseline files match. Browser/schema input output bytes are unchanged; only input d.ts, input provenance metadata and tarball differ from431. Old26 dist, history0.1.6, frozen schema, locks and historical manifests are unchanged.

Qualification released one bounded materially corrected sequence after confirming no competing heavy process. The original431 consumer was copied byte-for-byte to an owned temporary test path, compiled against the still-broken actual declaration WITHOUT skipLibCheck, then removed after capturing its bytes/hash. It produced exactly `TS2552: Cannot find name 'ConversationInputErrorResponse'. Did you mean 'ConversationHistoryResponse'?`; the suggested-name diagnostic is the same missing-alias defect, not another failure. Primary2/cleanup0,1031ms, sampled owned-treeRSS312147968bytes, no residual/pressure/timeout, all33 then-existing dist/frozen/lock hashes equal. `before/` preserves the real failed compiler receipt/stdout and original consumer. The supervising conditional process intentionally exited on that expected failure; no passed stage was repeated without a material source change.

The corrected sequence on5fb completed:

| Stage | Result | Heap/hardwall | Wallms | Sampled owned-tree RSSbytes |
| --- | --- | --- | --- | --- |
| input-only generation |PASS|384MiB/90s|625|122605568|
| deterministic input check |PASS|384MiB/90s|531|126402560|
| actual generated declaration + public consumer, strict WITHOUT skipLibCheck |PASS|256MiB/60s|1031|311877632|
| actual generated public receiver controls |21/21 SYNTHETIC PASS|128MiB/45s|438|76218368|
| offline pack, scripts disabled |PASS|128MiB/30s|1390|105574400|

Each primary0/cleanup0, preserved hashes equal, owned Node/esbuild/OS-conhost processes exited, no pressure/timeouts/residual PIDs. Native GlobalMemoryStatusEx guards enforce fresh aggregate reserve+1GiB start margin and1GiB remaining commit floor throughout. RSS is sampled, not guaranteed peak. No install, broad build, browser, DB, provider, real material or cloud action. The slot was released immediately after the sequence.

All four input outputs were regenerated through the focused generator; `four-output-deltas.json` records both old/new hashes. Only d.ts and metadata changed in Git. The stdlib archive verifier compared all35 members to actual package bytes, all15 current provenance sources, all29 preserved files, SHA1/SHA256/SHA512 and npm pack's declared size/integrity. No actual archive code is executed by that verifier. The old26 dist files were not regenerated. Independent artifact acceptance and adoption remain pending; never adopt held SHA53497. Shared readiness/recovery and genuine first-chat/native authorities remain separate work.
