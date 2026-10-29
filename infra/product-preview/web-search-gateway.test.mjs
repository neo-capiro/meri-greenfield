import test from 'node:test';
import assert from 'node:assert/strict';
import {synthesizeWebSearchGateway,targetProvisioningRequest,WEB_SEARCH_CALLER_ROLE,WEB_SEARCH_CONNECTOR_OPERATION,
 WEB_SEARCH_TOOL_ARN,WEB_SEARCH_CONNECTOR_VERSION,WEB_SEARCH_PROTOCOL_VERSION} from './web-search-gateway.mjs';

const binding = extra => ({gatewayName: 'meri-preview-web-search', callerRoleName: WEB_SEARCH_CALLER_ROLE,
 connectorVersion: WEB_SEARCH_CONNECTOR_VERSION, protocolVersion: WEB_SEARCH_PROTOCOL_VERSION,
 connectorOperation: WEB_SEARCH_CONNECTOR_OPERATION, targetToolName: 'WebSearch-tool-abc123', ...extra});

test('gateway is IAM-authorized MCP on the stateless 2026-07-28 protocol with no provider key', () => {
 const {Resources: resources} = synthesizeWebSearchGateway(binding());
 const gateway = Object.values(resources).find(r => r.Type === 'AWS::BedrockAgentCore::Gateway').Properties;
 assert.equal(gateway.AuthorizerType, 'AWS_IAM');
 assert.equal(gateway.ProtocolType, 'MCP');
 assert.deepEqual(gateway.ProtocolConfiguration, {Mcp: {SupportedVersions: ['2026-07-28']}});
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

test('only the control task role may invoke this gateway, on its exact ARN', () => {
 const {Resources: resources} = synthesizeWebSearchGateway(binding());
 const caller = Object.values(resources).find(r => r.Type === 'AWS::IAM::Policy' && r.Properties.PolicyName === 'MeriWebSearchGatewayInvocation').Properties;
 assert.deepEqual(caller.Roles, ['MeriPreview-control-task']);
 assert.deepEqual(caller.PolicyDocument.Statement, [{Effect: 'Allow', Action: ['bedrock-agentcore:InvokeGateway'],
  Resource: [{'Fn::GetAtt': ['Gateway', 'GatewayArn']}]}]);
 assert(!JSON.stringify(caller.PolicyDocument).includes('"*"'));
 // The AgentCore runtime role is never the caller: the paid search runs in the control read composer.
 assert.throws(() => synthesizeWebSearchGateway(binding({callerRoleName: 'MeriPreview-agentcore-runtime'})));
});

test('connector operation and exposed tool name are independent; a prefixed name is valid', () => {
 const request = targetProvisioningRequest(binding());
 assert.deepEqual(request.targetConfiguration.mcp.connector.source, {connectorId: 'web-search', version: '1.2.0'});
 assert.deepEqual(request.targetConfiguration.mcp.connector.configurations, [{name: 'WebSearch', parameterValues: {}}]);
 assert.deepEqual(request.credentialProviderConfigurations, [{credentialProviderType: 'GATEWAY_IAM_ROLE'}]);
 const outputs = synthesizeWebSearchGateway(binding()).Outputs;
 assert.equal(outputs.ConnectorOperation.Value, 'WebSearch');
 assert.notEqual(outputs.ConnectorOperation.Value, outputs.TargetToolName.Value,
  'the connector operation is not published as proof of the exposed tool name');
 assert.equal(outputs.TargetToolName.Value, 'WebSearch-tool-abc123');
 assert.equal(outputs.ConnectorVersion.Value, '1.2.0');
 assert.equal(outputs.ProtocolVersion.Value, '2026-07-28');
 // The documented gatewayUrl output is the MCP invocation endpoint, bound unchanged by the caller.
 assert(outputs.GatewayUrl.Value['Fn::GetAtt']);
});

test('the template creates no target, because CloudFormation cannot pin the connector version', () => {
 const {Resources: resources} = synthesizeWebSearchGateway(binding());
 // The official ConnectorSource has only ConnectorId; a version there would be invented.
 assert(!Object.values(resources).some(r => r.Type === 'AWS::BedrockAgentCore::GatewayTarget'));
});

test('rejects a floating version, wrong protocol, bad tool name, foreign caller and extra fields', () => {
 for (const edit of [b => b.connectorVersion = 'latest', b => b.targetToolName = 'web search', b => b.targetToolName = '',
  b => b.gatewayName = '-bad', b => b.callerRoleName = '', b => b.protocolVersion = '2025-11-25',
  b => b.connectorOperation = 'web_search', b => b.extra = 'must-not-enter-template']) {
  const value = binding(); edit(value);
  assert.throws(() => synthesizeWebSearchGateway(value));
  assert.throws(() => targetProvisioningRequest(value));
 }
});
