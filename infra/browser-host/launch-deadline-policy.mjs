// @ts-check
/** Exact out-of-stack CloudFormation service-role deny required before host creation. */

export const LAUNCH_DENY_POLICY_NAME='MeriD005OriginalCutoff';
export function launchDeadlinePolicy(deadlineMs){
 if(!Number.isSafeInteger(deadlineMs)||deadlineMs<1700000000000||deadlineMs>4102444800000)
  throw Object.assign(new Error('LAUNCH_DEADLINE_REFUSED'),{code:'LAUNCH_DEADLINE_REFUSED'});
 return Object.freeze({Version:'2012-10-17',Statement:[Object.freeze({
  Sid:'DenyD005LateHostLaunch',Effect:'Deny',
  Action:Object.freeze(['ec2:RunInstances','ec2:StartInstances','ec2:CreateFleet','ec2:RequestSpotInstances']),
  Resource:'*',Condition:Object.freeze({DateGreaterThanEquals:Object.freeze({'aws:CurrentTime':new Date(deadlineMs).toISOString()})}),
 })]});
}
