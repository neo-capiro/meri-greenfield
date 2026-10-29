import test from 'node:test';
import assert from 'node:assert/strict';
import {synthesizeWebSearchGateway,targetProvisioningRequest,WEB_SEARCH_TOOL,WEB_SEARCH_TOOL_ARN,WEB_SEARCH_CONNECTOR_VERSION,WEB_SEARCH_PROTOCOL_VERSION}
 from './web-search-gateway.mjs';

const binding = () => ({gatewayName: 'meri-preview-web-search', runtimeRoleName: 'MeriPreview-agentcore-runtime',
 connectorVersion: WEB_SEARCH_CONNECTOR_VERSION, protocolVersion: WEB_SEARCH_PROTOCOL_VERSION, toolName: WEB_SEARCH_TOOL});

test('gateway is IAM-authorized MCP with one pinned protocol version and no provider key', () => {
 const {Resources: resources} = synthesizeWebSearchGateway(binding());
 const gateway = Object.values(resources).find(r => r.Type === 'AWS::BedrockAgentCore::Gateway').Properties;
 assert.equal(gateway.AuthorizerType, 'AWS_IAM');
 assert.equal(gateway.ProtocolType, 'MCP');
 assert.deepEqual(gateway.ProtocolConfiguration, {Mcp: {SupportedVersions: [WEB_SEARCH_PROTOCOL_VERSION]}});
 assert.equal(gateway.AuthorizerConfiguration, undefined, 'IAM inbound authorization carries no JWT configuration');
 const json = JSON.stringify(resources);
 assert(!/apikey|ApiKey|apiKey/iu.test(json), 'no provider key is introduced');
 assert(!/AWS::BedrockAgentCore::(?:Runtime|Memory|Harness)/u.test(json), 'no model loop or memory is added');
});

test('service role is scoped to the documented gateway and service-owned tool ARNs', () => {
 const {Resources: resources} = synthesizeWebSearchGateway(binding());
 const policy = Object.values(resources).find(r => r.Type === 'AWS::IAM::Policy' && r.Properties.PolicyName !== 'MeriWebSearchGatewayInvocation').Properties;
 const statements = policy.PolicyDocument.Statement;
 const resourcesOf = statement => Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource];
 const invokeGateway = statements.find(s => s.Action.includes('bedrock-agentcore:InvokeGateway'));
 const invokeSearch = statements.find(s => s.Action.includes('bedrock-agentcore:InvokeWebSearch'));
 assert.deepEqual(resourcesOf(invokeGateway), ['arn:aws:bedrock-agentcore:us-east-1:967807252336:gateway/*']);
 assert.deepEqual(resourcesOf(invokeSearch), [WEB_SEARCH_TOOL_ARN]);
 // The service-owned ARN carries the literal `aws` account segment, never the customer account.
 assert.equal(WEB_SEARCH_TOOL_ARN, 'arn:aws:bedrock-agentcore:us-east-1:aws:tool/web-search.v1');
 assert(!JSON.stringify(statements).includes('967807252336:aws:tool'));
 assert(!JSON.stringify(statements).includes('"*"'), 'no wildcard action');
});

test('only the runtime role may invoke this gateway, on its exact ARN', () => {
 const {Resources: resources} = synthesizeWebSearchGateway(binding());
 const caller = Object.values(resources).find(r => r.Type === 'AWS::IAM::Policy' && r.Properties.PolicyName === 'MeriWebSearchGatewayInvocation').Properties;
 assert.deepEqual(caller.Roles, ['MeriPreview-agentcore-runtime']);
 assert.deepEqual(caller.PolicyDocument.Statement, [{Effect: 'Allow', Action: ['bedrock-agentcore:InvokeGateway'],
  Resource: [{'Fn::GetAtt': ['Gateway', 'GatewayArn']}]}]);
 assert(!JSON.stringify(caller.PolicyDocument).includes('"*"'));
});

test('the target request pins the connector version and binds the same tool name the runtime uses', () => {
 const request = targetProvisioningRequest(binding());
 assert.deepEqual(request.targetConfiguration.mcp.connector.source, {connectorId: 'web-search', version: '1.2.0'});
 assert.deepEqual(request.targetConfiguration.mcp.connector.configurations, [{name: 'WebSearch', parameterValues: {}}]);
 assert.deepEqual(request.credentialProviderConfigurations, [{credentialProviderType: 'GATEWAY_IAM_ROLE'}]);
 // One constant, so a renamed tool cannot drift between infrastructure and the calling process.
 assert.equal(request.targetConfiguration.mcp.connector.configurations[0].name, WEB_SEARCH_TOOL);
 const outputs = synthesizeWebSearchGateway(binding()).Outputs;
 assert.equal(outputs.ToolName.Value, WEB_SEARCH_TOOL);
 assert.equal(outputs.ConnectorVersion.Value, '1.2.0');
 assert.equal(outputs.ProtocolVersion.Value, '2025-11-25');
 assert(outputs.GatewayUrl.Value['Fn::GetAtt']);
});

test('the template creates no target, because CloudFormation cannot pin the connector version', () => {
 const {Resources: resources} = synthesizeWebSearchGateway(binding());
 // The official ConnectorSource has only ConnectorId; a version there would be invented.
 assert(!Object.values(resources).some(r => r.Type === 'AWS::BedrockAgentCore::GatewayTarget'));
});

test('rejects a floating version, foreign tool name, missing caller and unvalidated input', () => {
 for (const edit of [b => b.connectorVersion = 'latest', b => b.toolName = 'web_search', b => b.gatewayName = '-bad',
  b => b.runtimeRoleName = '', b => b.protocolVersion = '2026-07-28', b => b.extra = 'must-not-enter-template']) {
  const value = binding(); edit(value);
  assert.throws(() => synthesizeWebSearchGateway(value));
  assert.throws(() => targetProvisioningRequest(value));
 }
});
