/** Concrete durable-budget composition around the existing single-call dispatcher. */
import { createHash } from 'node:crypto';
import { createDispatchLifetime } from '../dispatch/dispatch-lifetime.mjs';
import { createToolDispatch } from '../dispatch/tool-dispatch.mjs';
import { deny } from '../dispatch/operation-result.mjs';
import { createPostgresToolBudget } from './postgres-tool-budget.mjs';
import { deliveryRecord } from './tool-invocation-record.mjs';
import { allocation, invocation, assertAuthority } from './tool-budget-binding.mjs';

export function createDurableToolDispatch({ pool, allocationJson, ...options }) {
  if (Object.hasOwn(options, 'budget')) deny('GATEWAY_CONFIGURATION');
  const a = allocation(allocationJson);
  const owner = createPostgresToolBudget({ pool, allocationJson, now: options.now });
  async function execute(requestJson, credential, trustedInvocationJson, signal, produced) {
      // Raw trusted JSON is copied and deeply frozen before the first await.
      const i = invocation(trustedInvocationJson, a);
      if (typeof credential !== 'string') deny('ACCESS_DENIED');
      const credentialSha256 = createHash('sha256').update(credential).digest('hex');
      const bound = produced ?? owner.forInvocation(trustedInvocationJson); let current; let limitDeadline;
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
  }
  async function owned(requestJson, credential, deliveryJson, signal, dispatch) {
    const delivery=deliveryRecord(deliveryJson,requestJson,a);
    if(dispatch&&(typeof credential!=='string'||createHash('sha256').update(credential).digest('hex')!==delivery.context.capabilitySha256))deny('ACCESS_DENIED');
    const deadlineMs = Math.min(options.now()+options.limits.maxRequestMs,Date.parse(a.schedule.expiresAt));
    const lifetime = createDispatchLifetime({ deadlineMs, now: options.now, signal });
    try {
      const prepared = await lifetime.run(signal => owner.prepareInvocation(deliveryJson,requestJson,{signal,deadlineMs}));
      lifetime.check();
      if (!dispatch) return prepared;
      lifetime.limitDeadline(prepared.deadlineMs);
      const bound = owner.forOwnedInvocation(prepared.invocationJson,deliveryJson,requestJson);
      return await lifetime.run(signal => execute(requestJson,credential,prepared.invocationJson,signal,bound));
    } finally { lifetime.close(); }
  }
  return Object.freeze({
    bindTrustedGrant: owner.bindTrustedGrant, readInvocationOutcome: owner.readInvocationOutcome,
    execute: (requestJson,credential,invocationJson,signal) => execute(requestJson,credential,invocationJson,signal),
    prepareInvocation: (deliveryJson,requestJson,signal) => owned(requestJson,null,deliveryJson,signal,false),
    executeOwned: (requestJson,credential,deliveryJson,signal) => owned(requestJson,credential,deliveryJson,signal,true),
    reconcileInvocation: (deliveryJson,requestJson) => owner.reconcileInvocation(deliveryJson,requestJson),
    async discover() { return []; },
  });
}
