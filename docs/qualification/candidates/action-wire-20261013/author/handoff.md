# Installation handoff

Source3a6e3391, package @capiro/meri-contracts0.1.1. Run `npm pack ./packages/contracts --ignore-scripts --pack-destination <owned-output-directory>` from the reviewed checkout; the expected exact tarball SHA/integrity/size and packed-file listing are in install-verification.json and pack.stdout.txt. Install that tarball into the consuming frontend's isolated branch using its package owner. No npm publish or frontend change is performed here.

Consumer:

```ts
import {receiveActionResponse} from '@capiro/meri-contracts/action-application';
const result = await receiveActionResponse('query', response.status, await response.text());
if ('error' in result) {
  // Present uncertainty; do not infer retry or rollback permission.
} else {
  // result.acceptedTasks is false. Render recommendations and preserved coverage.
}
```

Routes are query/draft/prepare/execute. Require a browser WebCrypto secure context. Keep the originating immutable proposal for execute receipt correlation; this receiving schema grants no approval or authorization.

Tooling donor: /workspace/meri-read-continuation-20261012/packages/contracts/node_modules (esbuild0.28.2, json-schema-to-typescript16.0.0, TypeScript5.9.3). Build reproduction requires physical local ajv, ajv-formats, canonicalize, fast-uri, fast-deep-equal, json-schema-traverse, require-from-string at packages/contracts/node_modules; otherwise esbuild's source labels differ. Other installed tool packages can be borrowed by symlink. No versions or dependency resolutions changed. The author-owned local tool layout is retained pending root integration check; no donor files were modified.
