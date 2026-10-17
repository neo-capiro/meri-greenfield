import {createTemporalIssuerAwsTaskProof} from './task-authority.mjs';

/**
 * Pre-certificate, post-placement task proof. The task ARN is only a selector;
 * currentness comes from service-scoped ECS and the direct TLS peer's ENI.
 * This proves the task, not an actor, certificate, or durable registration.
 */
export function createTemporalIssuerBootstrapTaskProof({configuration, ecs, ec2, now = Date.now}) {
  return createTemporalIssuerAwsTaskProof({configuration, ecs, ec2, now});
}
