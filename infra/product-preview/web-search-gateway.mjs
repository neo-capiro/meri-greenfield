/** Feature-specific infrastructure for SCRUM-237 primary discovery: one AgentCore Gateway whose only
 * target is the AWS managed web-search MCP connector, its service role, and the caller grant the Meri
 * **control** task role needs (the paid search runs in the control read composer, not in the AgentCore
 * runtime). No provider key, no new network path and no second model loop.
 *
 * Documented (verified 29 October 2026):
 *  target/role  https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-add-target-api-target-config.html
 *  tool/schema  https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-web-search-tool.html
 *  IAM inbound  https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-inbound-auth.html
 *  lifecycle    https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-using.html
 *  gatewayUrl   https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-create-api.html
 *  CFN shape    https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-bedrockagentcore-gateway.html
 *               https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-bedrockagentcore-gatewaytarget-connectorsource.html
 *
 * Two names are deliberately kept apart: the connector operation configured inside the target
 * (`WebSearch`, from the connector documentation) and the tool name the gateway actually exposes, which is
 * only established by a `tools/list` discovery receipt and may legitimately be prefixed. This module never
 * asserts they are equal.
 *
 * CloudFormation's `ConnectorSource` carries only `ConnectorId`, so the pinned connector version is not
 * expressible in the template; `targetProvisioningRequest` emits the documented Control API request that
 * pins it. The gateway, service role and caller grant stay in the template. */
import assert from 'node:assert/strict';
import {App, Stack, CfnOutput, BootstraplessSynthesizer, aws_bedrockagentcore as agentcore, aws_iam as iam} from 'aws-cdk-lib';
import {Template} from 'aws-cdk-lib/assertions';

const ACCOUNT = '967807252336', REGION = 'us-east-1';
/** Connector operation name configured inside the target (connector documentation). */
export const WEB_SEARCH_CONNECTOR_OPERATION = 'WebSearch';
/** Pinned connector version: 1.2.0 is the documented version that adds request-level filters. */
export const WEB_SEARCH_CONNECTOR_VERSION = '1.2.0';
/** One complete documented protocol path: the stateless 2026-07-28 MCP revision. It needs no
 * `initialize` handshake, so one tools/call is one gateway invocation. */
export const WEB_SEARCH_PROTOCOL_VERSION = '2026-07-28';
/** Service-owned ARN of the AWS connector, authorized by the gateway service role per request. */
export const WEB_SEARCH_TOOL_ARN = `arn:aws:bedrock-agentcore:${REGION}:aws:tool/web-search.v1`;
/** The caller is the control task role that composes the public-web read family. */
export const WEB_SEARCH_CALLER_ROLE = 'MeriPreview-control-task';
const GATEWAY_ARN_PATTERN = `arn:aws:bedrock-agentcore:${REGION}:${ACCOUNT}:gateway/*`;
const KEYS = ['gatewayName', 'callerRoleName', 'connectorVersion', 'protocolVersion', 'connectorOperation', 'targetToolName'];
const TOOL_NAME = /^[A-Za-z0-9_-]{1,64}$/u;

function validate(value) {
  assert(value && Object.getPrototypeOf(value) === Object.prototype, 'web search gateway binding required');
  assert.deepEqual(Object.keys(value).sort(), [...KEYS].sort(), 'unknown or missing web search binding field');
  assert.match(value.gatewayName, /^[0-9A-Za-z][-0-9A-Za-z]{1,47}$/u, 'gateway name must match the documented pattern');
  assert.equal(value.callerRoleName, WEB_SEARCH_CALLER_ROLE,
    'the paid search runs in the control task role; the AgentCore runtime role cannot be the caller');
  assert.equal(value.connectorVersion, WEB_SEARCH_CONNECTOR_VERSION, 'the connector version is pinned, not floating');
  assert.equal(value.protocolVersion, WEB_SEARCH_PROTOCOL_VERSION, 'one complete documented protocol path');
  assert.equal(value.connectorOperation, WEB_SEARCH_CONNECTOR_OPERATION, 'connector operation name from the connector docs');
  // The exposed tool name is selected, not derived: a prefixed gateway name is a valid outcome.
  assert.match(value.targetToolName, TOOL_NAME, 'target tool name must be a 1..64 identifier');
  return value;
}

/** The documented Control API request that creates the target with a pinned connector version. */
export function targetProvisioningRequest(binding) {
  const b = validate(binding);
  return Object.freeze({
    gatewayIdentifier: '<GATEWAY_ID>',
    name: `${b.gatewayName}-web-search`,
    targetConfiguration: {mcp: {connector: {source: {connectorId: 'web-search', version: b.connectorVersion},
      configurations: [{name: b.connectorOperation, parameterValues: {}}]}}},
    credentialProviderConfigurations: [{credentialProviderType: 'GATEWAY_IAM_ROLE'}],
  });
}

/** Offline template synthesis only; provisioning, discovery and version pinning run in the release window. */
export function synthesizeWebSearchGateway(binding) {
  const b = validate(binding), app = new App({context: {'aws:cdk:version-reporting': false}});
  const stack = new Stack(app, 'MeriWebSearchGateway', {env: {account: ACCOUNT, region: REGION}, synthesizer: new BootstraplessSynthesizer()});
  // The Gateway assumes this role to reach the AWS-owned connector; the trust is scoped to this account
  // and to gateway resources, and the policy resources are the documented ones (no wildcard action).
  const serviceRole = new iam.Role(stack, 'GatewayServiceRole', {
    roleName: `${b.gatewayName}-service-role`,
    assumedBy: new iam.PrincipalWithConditions(new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'), {
      StringEquals: {'aws:SourceAccount': ACCOUNT}, ArnLike: {'aws:SourceArn': GATEWAY_ARN_PATTERN}}),
    description: 'AgentCore Gateway service role for the AWS managed web search connector',
  });
  serviceRole.addToPolicy(new iam.PolicyStatement({actions: ['bedrock-agentcore:InvokeGateway'], resources: [GATEWAY_ARN_PATTERN]}));
  serviceRole.addToPolicy(new iam.PolicyStatement({actions: ['bedrock-agentcore:InvokeWebSearch'], resources: [WEB_SEARCH_TOOL_ARN]}));
  const gateway = new agentcore.CfnGateway(stack, 'Gateway', {
    name: b.gatewayName, description: 'Meri primary web search gateway (AWS managed connector only)',
    // IAM inbound authorization: callers sign with SigV4 and need InvokeGateway on this gateway.
    authorizerType: 'AWS_IAM', protocolType: 'MCP',
    protocolConfiguration: {mcp: {supportedVersions: [b.protocolVersion]}},
    roleArn: serviceRole.roleArn,
    tags: {Application: 'meri', Environment: 'preview', Capability: 'primary-web-search'},
  });
  gateway.node.addDependency(serviceRole);
  // Only the control task role may invoke this gateway, on its exact ARN.
  new iam.CfnPolicy(stack, 'CallerInvocationPolicy', {
    policyName: 'MeriWebSearchGatewayInvocation', roles: [b.callerRoleName],
    policyDocument: {Version: '2012-10-17', Statement: [{Effect: 'Allow', Action: ['bedrock-agentcore:InvokeGateway'],
      Resource: [gateway.attrGatewayArn]}]},
  });
  new CfnOutput(stack, 'GatewayArn', {value: gateway.attrGatewayArn});
  // The documented gatewayUrl is the MCP invocation endpoint (…/mcp); it is bound unchanged.
  new CfnOutput(stack, 'GatewayUrl', {value: gateway.attrGatewayUrl});
  new CfnOutput(stack, 'GatewayId', {value: gateway.attrGatewayIdentifier});
  new CfnOutput(stack, 'TargetToolName',{value:b.targetToolName});
  new CfnOutput(stack, 'ConnectorOperation',{value:b.connectorOperation});
  new CfnOutput(stack, 'ConnectorVersion', {value: b.connectorVersion});
  new CfnOutput(stack, 'ProtocolVersion', {value: b.protocolVersion});
  return Template.fromStack(stack).toJSON();
}
