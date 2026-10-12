/** Concrete durable-budget composition around the existing single-call dispatcher. */
import { createHash } from 'node:crypto';
import { createToolDispatch } from '../dispatch/tool-dispatch.mjs';
import { deny } from '../dispatch/operation-result.mjs';
import { createPostgresToolBudget } from './postgres-tool-budget.mjs';
import { allocation, invocation, assertAuthority } from './tool-budget-binding.mjs';

export function createDurableToolDispatch({ pool, allocationJson, ...options }) {
  if (Object.hasOwn(options, 'budget')) deny('GATEWAY_CONFIGURATION');
  const a = allocation(allocationJson);
  const owner = createPostgresToolBudget({ pool, allocationJson });
  return Object.freeze({
    bindTrustedGrant: owner.bindTrustedGrant,
    readInvocationOutcome: owner.readInvocationOutcome,
    async execute(requestJson, credential, trustedInvocationJson, signal) {
      // Raw trusted JSON is copied and deeply frozen before the first await.
      const i = invocation(trustedInvocationJson, a);
      if (typeof credential !== 'string') deny('ACCESS_DENIED');
      const credentialSha256 = createHash('sha256').update(credential).digest('hex');
      const bound = owner.forInvocation(trustedInvocationJson); let current; let limitDeadline;
      const verify = value => { if (bound.deadlineMs() !== undefined && options.now() >= bound.deadlineMs()) deny('DEADLINE'); try { assertAuthority(i, value.claims, credentialSha256); } catch { deny('ACCESS_DENIED'); } return value; };
      const authority = {
        async identify(call) {
          // The trusted schedule is already validated: publish it before the
          // first capability/authority port can park. Later facts only shorten.
          call.limitDeadline(Date.parse(a.schedule.expiresAt));
          return verify(await options.authority.identify(call)); },
        async check(call) { limitDeadline = call.limitDeadline;
          if (bound.deadlineMs() !== undefined) limitDeadline(bound.deadlineMs());
          current = verify(await options.authority.check(call)); return current; },
      };
      const protect = action => async call => { try { return await action(call); } catch { deny('BUDGET_UNCERTAIN'); } };
      const budget = {
        reserve: protect(async call => { const receipt = await bound.reserve({ ...call, claims: current.claims, limitDeadline });
          // Publish the stricter private/public runtime ceiling before handler admission.
          return receipt; }),
        settle: protect(bound.settle), markUncertain: protect(bound.markUncertain),
      };
      const dispatcher = createToolDispatch({ ...options, authority, budget });
      return dispatcher.execute(requestJson, credential, signal);
    },
    async discover() { return []; },
  });
}
