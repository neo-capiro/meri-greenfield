/** Feature-specific infrastructure for SCRUM-237 primary discovery: one AgentCore Gateway whose only
 * target is the AWS managed web-search MCP connector, its service role, and the caller grant the Meri
 * runtime role needs. No provider key, no new network path and no second model loop.
 *
 * Documented (verified 29 October 2026):
 *  target/role  https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-add-target-api-target-config.html
 *  tool/schema  https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-web-search-tool.html
 *  IAM inbound  https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-inbound-auth.html
 *  CFN shape    https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-bedrockagentcore-gateway.html
 *               https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-bedrockagentcore-gatewaytarget-connectorsource.html
 *
 * CloudFormation's `ConnectorSource` carries only `ConnectorId`, so the pinned connector version is not
 * expressible in the template; `targetProvisioningRequest` emits the documented Control API request that
 * pins it. The gateway, service role and caller grant stay in the template. */
import assert from 'node:assert/strict';
import {App, Stack, CfnOutput, BootstraplessSynthesizer, aws_bedrockagentcore as agentcore, aws_iam as iam} from 'aws-cdk-lib';
import {Template} from 'aws-cdk-lib/assertions';

const ACCOUNT = '967807252336', REGION = 'us-east-1';
/** One tool name feeds the provisioned target and the runtime binding; the gateway exposes the
 * connector's `configurations[].name` as the MCP tool name, so the two can never disagree. */
export const WEB_SEARCH_TOOL = 'WebSearch';
/** Pinned connector version: 1.2.0 is the documented version that adds request-level filters. */
export const WEB_SEARCH_CONNECTOR_VERSION = '1.2.0';
/** One MCP protocol version, supported by the gateway and used by the calling process. */
export const WEB_SEARCH_PROTOCOL_VERSION = '2025-11-25';
/** Service-owned ARN of the AWS connector, authorized by the gateway service role per request. */
export const WEB_SEARCH_TOOL_ARN = `arn:aws:bedrock-agentcore:${REGION}:aws:tool/web-search.v1`;
const GATEWAY_ARN_PATTERN = `arn:aws:bedrock-agentcore:${REGION}:${ACCOUNT}:gateway/*`;
const KEYS = ['gatewayName', 'runtimeRoleName', 'connectorVersion', 'protocolVersion', 'toolName'];

function validate(value) {
  assert(value && Object.getPrototypeOf(value) === Object.prototype, 'web search gateway binding required');
  assert.deepEqual(Object.keys(value).sort(), [...KEYS].sort(), 'unknown or missing web search binding field');
  assert.match(value.gatewayName, /^[0-9A-Za-z][-0-9A-Za-z]{1,47}$/u, 'gateway name must match the documented pattern');
  assert.match(value.runtimeRoleName, /^[A-Za-z0-9+=,.@_-]{1,64}$/u, 'caller role name');
  assert.equal(value.connectorVersion, WEB_SEARCH_CONNECTOR_VERSION, 'the connector version is pinned, not floating');
  assert.equal(value.protocolVersion, WEB_SEARCH_PROTOCOL_VERSION, 'one supported MCP protocol version');
  assert.equal(value.toolName, WEB_SEARCH_TOOL, 'the tool name is bound from the provisioned target');
  return value;
}

/** The documented Control API request that creates the target with a pinned connector version. */
export function targetProvisioningRequest(binding) {
  const b = validate(binding);
  return Object.freeze({
    gatewayIdentifier: '<GATEWAY_ID>',
    name: `${b.gatewayName}-web-search`,
    targetConfiguration: {mcp: {connector: {source: {connectorId: 'web-search', version: b.connectorVersion},
      configurations: [{name: b.toolName, parameterValues: {}}]}}},
    credentialProviderConfigurations: [{credentialProviderType: 'GATEWAY_IAM_ROLE'}],
  });
}

/** Offline template synthesis only; provisioning and version pinning run in the release window. */
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
  // The Meri runtime role is the only caller; it may invoke this gateway and nothing broader.
  new iam.CfnPolicy(stack, 'CallerInvocationPolicy', {
    policyName: 'MeriWebSearchGatewayInvocation', roles: [b.runtimeRoleName],
    policyDocument: {Version: '2012-10-17', Statement: [{Effect: 'Allow', Action: ['bedrock-agentcore:InvokeGateway'],
      Resource: [gateway.attrGatewayArn]}]},
  });
  new CfnOutput(stack, 'GatewayArn', {value: gateway.attrGatewayArn});
  new CfnOutput(stack, 'GatewayUrl', {value: gateway.attrGatewayUrl});
  new CfnOutput(stack, 'GatewayId', {value: gateway.attrGatewayIdentifier});
  new CfnOutput(stack, 'ToolName', {value: b.toolName});
  new CfnOutput(stack, 'ConnectorVersion', {value: b.connectorVersion});
  new CfnOutput(stack, 'ProtocolVersion', {value: b.protocolVersion});
  return Template.fromStack(stack).toJSON();
}
