# Primary-owned receiving proposal — NOT APPLIED

Read-only baseline verification: PR121, branch `codex/meri-first-chat-runtime-integration-20261017`, head `0d6ba1590b41e3bc911e8c50f7c7407632101832`.

| File | Exact baseline Git blob |
|---|---|
| `apps/runtime/config.mjs` | `1411091074af0277d4f28a77c459e16de689613f` |
| `apps/runtime/cli.mjs` | `b2e5819c334ae385666f6715a3b8c822dadeb6ed` |
| `apps/runtime/package.json` | `6f4bb8574be99cb7ad76028a28c42647344a6db6` |

These files remain owned by the first-chat owner. This document proposes only additive source receiving; it is not permission to activate a worker, edit the shipping candidate, read credentials, apply SQL or deploy. Recheck the primary head before applying. The feature service exports `startScheduleWorker(configuration,{runtimePorts,signal})` from `schedule-service.mjs`; its mandatory compiled `runtimePorts.authority.authorize` and `runtimePorts.runAdmission.admit` have no default implementation. Missing owners refuse before secret reads/connections. Bare `node cli.mjs schedule-worker …` remains unavailable until trusted startup supplies genuine owners.

## Config edits

Add the canonical new-role helper import:

```js
import {compileScheduleServiceConfiguration} from './schedule-service-configuration.mjs';
```

Replace only the first three statements in `validateConfiguration` with:

```js
 requireValue(['control','temporal-worker','conversation-runner','schedule-worker'].includes(role));const c=data(raw);
 const common=['version','profile','sourceEnabled','limits',...(role==='schedule-worker'?[]:['native'])];
 own(c,[...common,...(role==='control'?['http','database','temporal','sessions','versions']:role==='temporal-worker'?['http','temporal']:role==='schedule-worker'?['http','temporal','versions','scheduledDispatch']:['binding','versions','workspace','proxyOrigin'])],role==='conversation-runner'?['bootstrap','captureOwnsClose','remoteTask']:role==='control'?['nativeCandidate','retention','telemetry','downloadLinks','privateHttp','taskRouter']:role==='schedule-worker'?['database']:[]);
```

Preserve the primary's strict `version/profile/sourceEnabled===false`, limits, Temporal TLS/authorization, private routing and runner validation. Wrap only the existing contiguous native validation block in `if(role!=='schedule-worker'){…}`; all three existing role behaviors are unchanged. In the shared HTTP check, replace `c.native.loopback` with `c.native?.loopback??false` so this separate health-only role does not require a fabricated native credential.

After common HTTP/Temporal validation, add:

```js
 if(role==='schedule-worker'){
  validateShape('RuntimeVersions',c.versions);
  compileScheduleServiceConfiguration(c);
 }
```

The shared helper owns closed `scheduledDispatch`, queue separation/concurrency bounds and optional database file shape. Common validation remains in `config.mjs`. The service additionally requires `database.connectionFile` when its pool is not borrowed.

PR120's separate `userPreferences` config addition is not in this primary baseline. Preserve it when integrating the feature stack; this proposal does not replace either file wholesale.

## CLI edits

Extend only the trusted JavaScript options signature and advertised role:

```js
export async function main(argv=process.argv.slice(2),{poststartTls,nativeFetch,scheduleRuntimePorts}={}){
```

Use the existing usage line with `|schedule-worker` added. Immediately after `loadConfiguration(path,role)`, inside its existing handled configuration block, add:

```js
  if(scheduleRuntimePorts!==undefined&&role!=='schedule-worker')throw Error('SCHEDULE_SERVICE_CONFIGURATION');
```

Preserve all poststart pairing, preview listener/worker/runner guards and runner measurement checks unchanged. Replace only the final two-role dispatch expression:

```js
  const module=await import(role==='control'?'./control.mjs':role==='schedule-worker'?'./schedule-service.mjs':'./temporal-worker.mjs');
  runtime=await (role==='control'?module.startControl:role==='schedule-worker'?module.startScheduleWorker:module.startTemporalWorker)(c,{signal:controller.signal,...(role==='schedule-worker'?{runtimePorts:scheduleRuntimePorts}:{})});
```

Keep the existing startup timer, runtime listening output, completion/abort wait, close and signal cleanup immediately afterward. `scheduleRuntimePorts` is a trusted in-process object, never a JSON field, environment module selector, browser field or policy shortcut. The eventual production bootstrap must supply actual policy/admission owners.

## Package edit

Add one script, without changing dependency versions or locks:

```json
"start:schedules": "node cli.mjs schedule-worker"
```

## Required primary receiving checks

- Existing first-chat config, runner measurement/poststart, router and CLI controls stay passing against the exact primary candidate.
- Schedule role rejects `sourceEnabled:true`, native/provider fields, disabled/extra schedule flags, equal queues, invalid concurrency and unsupported database selectors before allocation.
- No compiled owners: new CLI branch returns handled unavailable with zero secret/connection/poller calls.
- Explicit trusted owners: startup reaches the actual service module, registers only the canonical schedule workflow/two activities, keeps HTTP health-only and closes owned resources after the poller.
- Common config tests use the real primary validator after this patch; feature service tests currently cover its actual role-specific helper and source composition only. They do not claim this unapplied CLI path is reachable.
