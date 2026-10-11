// Source-only registration adapter. Factories, Zod and authority are borrowed.
import { validateShape, contractVersion } from '@capiro/meri-contracts/node';
import { DISCOVERY_FIXTURE } from './sdk-discovery-options.mjs';
import { WIRE_TOOL_TIMEOUT_MS } from './sdk-capture-options.mjs';

function dataRecord(value, label, keys) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) throw new Error(`${label}: ordinary record required`);
  const names = Reflect.ownKeys(value);
  if (names.some((key) => typeof key !== 'string') ||
      (keys && (names.length !== keys.length || names.some((key) => !keys.includes(key))))) {
    throw new Error(`${label}: exact data fields required`);
  }
  for (const name of names) {
    const d = Object.getOwnPropertyDescriptor(value, name);
    if (!d.enumerable || !('value' in d)) throw new Error(`${label}: accessors forbidden`);
  }
}

function contextCopy(context) {
  dataRecord(context, 'context', ['runBinding', 'contractVersion', 'sessionId']);
  dataRecord(context.runBinding, 'RunBinding');
  validateShape('RunBinding', context.runBinding);
  if (context.contractVersion !== contractVersion) throw new Error('contract version mismatch');
  validateShape('RunBinding', { ...context.runBinding, conversationId: context.sessionId });
  return Object.freeze({ contractVersion, sessionId: context.sessionId,
    runBinding: Object.freeze({ ...context.runBinding }) });
}

const refused = () => ({ isError: true,
  content: [{ type: 'text', text: 'Synthetic discovery tool unavailable or not authorized.' }] });

/**
 * Register the two fixed synthetic tools. No query, transport or lifecycle starts.
 * gateway.authorize(request) must resolve literal true only for current authority;
 * false/malformed/rejection denies. This boolean is not an authorization receipt.
 * gateway.execute(request) owns the final current-authority check and side effects.
 * A prior canUseTool allow is never accepted here. No raw SDK extra is authority.
 */
export function createDiscoveryServer({ sdkTool, createSdkMcpServer, z, gateway, context }) {
  const bound = contextCopy(context);
  if (typeof sdkTool !== 'function' || typeof createSdkMcpServer !== 'function' ||
      !z || typeof z.literal !== 'function' || typeof z.object !== 'function') {
    throw new Error('trusted SDK factories and Zod required');
  }
  dataRecord(gateway, 'gateway', ['authorize', 'execute']);
  if (typeof gateway.authorize !== 'function' || typeof gateway.execute !== 'function') {
    throw new Error('gateway callbacks required');
  }
  // Retain the receiver and callback identities without freezing/disposal of them.
  const authorize = gateway.authorize;
  const execute = gateway.execute;
  const shapes = [
    { messageId: z.literal('fixture-message-7') },
    { subject: z.literal('orchard meeting') },
  ];
  const tools = DISCOVERY_FIXTURE.tools.map((descriptor, index) => {
    const shape = shapes[index];
    const schema = z.object(shape).strict();
    const keys = Object.keys(shape);
    const handler = async (input) => {
      let request;
      try {
        dataRecord(input, 'tool input', keys);
        const parsed = schema.parse(input);
        request = Object.freeze({ ...bound, operation: descriptor.name,
          arguments: Object.freeze({ ...parsed }) });
      } catch {
        return refused();
      }
      try {
        if (await authorize.call(gateway, request) !== true) return refused();
        return await execute.call(gateway, request);
      } catch {
        // Never return gateway exceptions, raw arguments or binding to the model.
        return refused();
      }
    };
    return sdkTool(descriptor.name, descriptor.description, shape, handler,
      { searchHint: descriptor.searchHint, alwaysLoad: descriptor.alwaysLoad });
  });
  return createSdkMcpServer({ ...DISCOVERY_FIXTURE.server, tools,
    timeout: WIRE_TOOL_TIMEOUT_MS });
}
