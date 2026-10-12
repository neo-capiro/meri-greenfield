# Explicit current-policy criteria revision

Root explicitly revised the task before candidate/source acceptance: use observed
4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace projection/privacy, keeping the original
fd8765 inventory identity and earlier11172f7 criteria as versioned history.
Both operations require trusted current actorRole. This supersedes the earlier
detail-no-role and opaque-detail-unchanged assumptions, not the original audit
or scalar/UUID/count findings.

- Both list/detail have email, phone, parentOffice, department. Only exact
  capiro_admin admits stored email or uploaded contact fields; every other
  TenantRole requires all four top-level fields null. Personnel role input is
  unrelated. Missing/unknown/spoofed trusted role must refuse without hooks.
- Phone/parentOffice/department are trimmed nonempty strings from object
  metadata.uploadedDirectoryContact only; non-object metadata/contact, absent,
  blank or non-string value maps null. Admin detail metadata permits checking
  exact field correspondence; list has no source metadata to prove provenance.
- Non-admin detail metadata excludes exactly top-level uploadedDirectoryContact
  and uploadedDirectoryPrevious keys when metadata is a non-null non-array
  object, regardless of their values. The current helper preserves arrays,
  scalars/null and nested same-name keys. Source metadata is unchanged. This is
  shallow established privacy behavior, not recursive anonymization or a promise
  that no contact information exists elsewhere. Do not broaden or waive it.
- List headshotUrl still admits actual opaque metadata-derived inert JSON; no
  universal string/URL/privacy guarantee. Detail has no top-level headshot.
- Preserve original criteria for count modes/filters/dates/identity/audit
  side effects, strict input admission and disabled/runtime boundaries.
