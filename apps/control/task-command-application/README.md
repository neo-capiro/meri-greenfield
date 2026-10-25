# Standalone task updates

`POST /api/task-commands/prepare` receives `{requestId, arguments}` under an existing opaque action session. The native runtime composition uses current Core access and either the exact live, unstarted initial binding or the current accepted run. Preparation never submits a prompt or starts a model.

The existing intent journal binds requestId to the full original binding and input. Exact replay returns the same immutable proposal; changed input conflicts, and uncertain preparation is never redispatched. The ordinary approval-metadata owner still normalizes the task update and retains proposal custody.

The reviewed UI's explicit **Approve and execute** action sends `{proposal}` to `/execute`. The adapter first reads the canonical Core outcome, including after proposal expiry. Only an absent outcome and a live proposal may reach the existing intent approval owner. That owner records the user's approval and invokes Core's native task receiver. An uncertain result remains indeterminate. Preparation and hydration cannot approve or execute.

The existing tasks product family mounts this application when source access, intents, Core approval and membership owners are composed. Session/current-access and retention checks guard each release; the retention lock encloses response serialization. The replaced allocation/grant/capability adapters are removed. Public consumers use `@capiro/meri-contracts/task-command-application`.
