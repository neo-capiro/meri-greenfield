# Runtime SDK controls: test follow-up

Commit: `e305da993979db0770f31c9cfb050d5600a55744` on `fix/sdk-proxy-beta-observation-20261019`. Only three runtime test files changed, 27 additions and 6 deletions. Production options are root's `d2fb6003abf0950bffdccb404cf87cb238891066` (local equivalent cherry-pick `4e4e7d701`). No production, image, receipt, runtime-values, generated provenance, lock or dependency edits.

The intended SDK configuration changes invalidate the historical no-profile pin. The three original failures were stale current-versus-historical assertions introduced by that production change:

| Original test | Cause | Final verification |
| --- | --- | --- |
| without a capability profile the measured template is unchanged: the committed receipt hash | Historical hash is no longer the current template. | Literal historical hash preserved; exact supported current options asserted; actual probe matches fresh measurement; current pin admits and historical pin refuses. |
| a capability-bearing run hashes to the one measured pin whatever its availability; the gate refuses another profile | Its actual no-policy activity was compared with the historical pin. | Actual activity matches fresh no-profile pin and admits; historical pin and wrong-profile pin refuse. Existing availability invariance retained. |
| without a capability profile the launch template, its run launch and every hash are unchanged | Exact launch now includes disabled thinking, model override, cache and effort controls. | Strict old-to-current delta: `--thinking=disabled`, exact `--settings` override, and exactly two environment additions. Historical launch behavior assertions retained; two newly measured probe hashes agree. |

The descriptor test also verifies exact emitted model override and `DISABLE_PROMPT_CACHING=1`, `CLAUDE_CODE_EFFORT_LEVEL=unset`, output=8192 and thinking=0. The existing dynamic run gate now additionally refuses six mutations: cache enabled, effort high, model override altered or omitted, and thinking adaptive or omitted. Existing dynamic first/second-turn, authority, restoration, capability, plugin, workspace and launch assertions remain.

Exact focused command:

```sh
node --experimental-test-module-mocks --test --test-reporter=tap apps/runtime/test/capability-sdk-pin.test.mjs apps/runtime/test/dynamic-sdk-options.test.mjs apps/runtime/build/first-chat-launch-measurement.test.mjs
```

Node v24.19.0, Linux x64, UID 0; installed SDK 0.3.295/CLI 2.1.295. Before edits: **25 pass, 3 fail, 0 skip**. Intermediate: **27 pass, 1 fail, 0 skip** because this test edit initially omitted the actual SDK's new thinking CLI argument from the expected delta; preserved and corrected. Final: **28 pass, 0 fail, 0 skip**. `git diff --check` passed. Full scrubbed TAP logs and their hashes are listed in `EVIDENCE.json`.

For the immutable historical receipt's exact input values (including its historical model string), historical SDK options hash is `af7f07b8f784884eae32e14e0b697d434d1668b0d68f55d203bf873c7af5431b`; fresh source hash is `0f1f8bf276b4baf0310852c917174a0952cd1b655df160888c825242a9fe57e9`. This is a source measurement for those fixture inputs, not an accepted deployment pin. Receipt SHA256 remains `859b0842c9ea6e25166f2c18a035c4dbef0f7a97928d30ee2d60feab3e7e538b`; runtime-values SHA256 remains `7c5fa1b073671e8307b6ca46c5d99972a47d4aaa08d06cbfd62fad832019b6eb`; both byte-identical to task base `9f54238c84dc03f0505ccac99be5652dbb2d16db`.

This verifies the source option/template gate and captured SDK descriptor only. It performs no real SDK/provider execution, provider/network/AWS/database call, build or live activation. Exact in-image regeneration and source/image/receipt acceptance remain shipping blockers. No push, merge or deployment.
