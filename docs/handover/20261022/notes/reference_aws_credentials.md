---
name: reference-aws-credentials
description: How AWS CLI/MCP auth is configured on this machine for Capiro AWS access
metadata: 
  node_type: memory
  type: reference
  originSessionId: af66714a-ee05-405b-b558-f13a1d3aef5f
  modified: 2026-08-07T00:35:10.439Z
---

AWS access from this machine uses the `capiro-dev` profile, not `[default]`. Credentials for `capiro-dev` live in `C:\Users\neoma\.aws\credentials`, region/output config in `C:\Users\neoma\.aws\config`. There is no `[default]` profile — only `[capiro-dev]`.

`AWS_PROFILE=capiro-dev` has been set as a persistent user environment variable (via `setx`), so `aws` CLI calls and the AWS MCP server (`mcp__AWS_API_MCP_Server__call_aws`) resolve credentials automatically without needing `--profile` flags.

Verified working identity: IAM user `capirocli`, account `967807252336`.

**How to apply:** When pushing to or querying AWS for Capiro (via CLI or the AWS MCP tool), assume `capiro-dev` credentials are already active — don't suggest running `aws configure` or creating a `[default]` profile unless this setup breaks. If a fresh session shows "No AWS credentials found," first check whether `AWS_PROFILE` is set in that shell before assuming credentials are missing.
