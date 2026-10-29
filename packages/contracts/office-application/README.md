# Office application receiving boundary v1

This additive browser distribution receives authenticated Office control
requests and responses. It conveys no authorization. The source generator is
`node packages/contracts/generate-office.mjs`; `--check` verifies deterministic
output. Application/image builds are not required. The owning integration
exports `@capiro/meri-contracts/office-application` from package 0.1.29.
Its declarations reuse the existing document-access public types. Consumer pins
identify the exact packed source and bytes.

All requests are POST JSON at `/api/meri/office/{route}` with schema
`meri.office-application/1`. The public browser request has no credentials or
authority fields. Its authenticated server proxy supplies the existing opaque
native action-session receipt in Authorization. Requests are at most 8 KiB,
metadata responses at most 2 MiB, and every response is no-store/no-referrer.

| Route | Selected fields besides schema | Successful result |
|---|---|---|
| open, read | versionId, draftId | Draft and editor metadata; launch null |
| launch | versionId, draftId, editorId, expectedEpoch, mode, operation | Metadata and CODE POST form |
| renew | versionId, draftId, editorId, expectedEpoch, mode | Same editor epoch and refreshed POST fields |
| release | versionId, draftId, editorId, expectedEpoch | Cleared editor; retained private Save |
| discard | versionId, draftId | Explicit discard receipt |
| publish | versionId, draftId, sequence, sha256 | Exact saved revision and current inspection |
| inspect | versionId | Current-authorized Office version and inspection |

`mode` is edit/view. Launch operation is acquire/explicit takeover. Read/recovery
never contains private bytes or launch tokens. A private Save has no control
route: CODE PutFile goes through WOPI, and only the distinct Publish operation
can create an immutable artifact revision. An uncertain write remains UNKNOWN;
recover using the same selection instead of assuming it did not commit.

The receiver reuses the existing all-format document-access inspection and
download boundary. It admits the native-edited XLSX cache label only through
this new export, checks the shared shape without rewriting the returned label,
and refuses invented recalculation/rendering claims. Frozen artifact schemas,
catalog and legacy document receivers remain unchanged. Publish has no internal
execution receipt; its inspection comes from a fresh canonical artifact read.

Only launch/renew responses can contain the short-lived form token. Never persist
or log form fields. Submit to the exact returned editor origin and frame target.
The WOPI host supplies the configured application HTTPS origin as
PostMessageOrigin. Frame messages must match both that editor origin and the
actual frame window. CODE's Reset_Access_Token requires token and TTL; an issued
renewal response does not prove a live frame accepted it. Save acknowledgement
must be followed by current draft metadata before selecting a Publish hash.

Remaining integration: frontend consumer pins,
transport and frame UI, runtime routing/configuration, retention inventory/purge
and representative live CODE fidelity. No deployment or live editor acceptance
is implied by this source distribution.
