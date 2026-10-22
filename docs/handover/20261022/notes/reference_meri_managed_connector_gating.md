---
name: meri-managed-connector-gating
description: "Meri's connected apps (HubSpot/Airtable/monday/Google Drive) are gated by MERI_MCP_* env vars that are NOT set on the live capiro-dev-api task def — only Airtable is available; the others render a DISABLED button, which is why clicking them opens no login window"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 7d8b708c-c499-4965-86f8-e8f05d85850e
  modified: 2026-09-12T21:06:36.276Z
---

**As of 2026-09-12 the live `capiro-dev-api` task definition (rev 328) has NO `MERI_MCP_*` environment variables or secrets at all.** Verified with `aws ecs describe-task-definition --task-definition capiro-dev-api:328 --query "taskDefinition.containerDefinitions[0].{envNames:environment[?starts_with(name,'MERI_MCP')],secretNames:secrets[?starts_with(name,'MERI_MCP')].name}"`.

Availability is `globalMcpEnabled() && oauth.isConfigured() && managedAppConfigured(id)`:
- `globalMcpEnabled()` — reads `CLIO_MCP_ENABLED`, **defaults to true** when unset, so it is not the blocker.
- `oauth.isConfigured()` — needs `CLIO_MCP_OAUTH_REDIRECT_URI` + `OAUTH_STATE_SECRET` + `OAUTH_TOKEN_ENCRYPTION_KEY`. All three ARE present live (redirect URI points at `https://app.capiro.ai/api/clio/mcp-oauth/callback` — the deprecated surface, worth questioning separately).
- `managedAppConfigured(id)` — the actual blocker, per-app.

| App | `enabledByDefault` | Also requires | Live state |
|---|---|---|---|
| Airtable | true | nothing | **available** |
| HubSpot | true | `MERI_MCP_HUBSPOT_CLIENT_ID` + `_SECRET` | unavailable |
| monday.com | **false** | `MERI_MCP_MONDAY_ENABLED=true` | unavailable |
| Google Drive | **false** | `MERI_MCP_GOOGLE_DRIVE_ENABLED=true` + client ID/secret | unavailable |

**Why:** monday and Google Drive are deliberately operator-gated in code (monday awaits "public integration registration and live checks"; Google Drive needs Workspace Developer Preview access). HubSpot is enabled-by-default but its credentials were never provisioned.

**How to apply:** when the user reports a connector saying "Temporarily unavailable", or that clicking Google/monday shows no login window, this is CONFIGURATION, not a bug — do not go hunting for a popup/OAuth defect in the web code. The add-menu item is rendered `disabled={... || !app.available}`, so the click is genuinely inert by design. Fixing it requires OAuth app registrations in the user's own HubSpot/Google/monday accounts, then secrets + task-def env wiring. Re-verify the task def before repeating these claims — the point-in-time env snapshot above goes stale the moment someone provisions credentials.

Related: [[reference_capiro_feature_flags]], [[project_pr1607_1611_merge_and_deploy]] (the PR that added the monday/Google Drive connectors).
