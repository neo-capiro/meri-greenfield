/** Actual mail handler family; canonical dispatch owns policy, budgets, continuation and release. */
import {deny, safeFailure} from '../../dispatch/operation-result.mjs';
import {assertMailPage, frozenData, mailContract, ownFields, readContext} from './request-context.mjs';

export function createMailReadHandler(options) {
  const {operation: reference, adapter, now} = ownFields(options, ['operation', 'adapter', 'now']);
  const {operation} = mailContract(reference), {read} = ownFields(adapter, ['read']);
  if (typeof read !== 'function' || typeof now !== 'function') deny('GATEWAY_CONFIGURATION');
  return async function execute(call) {
    try {
      const fields = ownFields(call, ['input', 'request', 'authority', 'argumentsSha256'], ['signal', 'invocationId']);
      const context = readContext({operation, input: fields.input, request: fields.request,
        authority: fields.authority, signal: fields.signal,
        ...(fields.invocationId === undefined ? {} : {invocationId: fields.invocationId})}, now);
      if (fields.argumentsSha256 !== context.argumentsSha256) deny('INVALID_ARGUMENTS');
      context.active();
      const page = frozenData(await read.call(adapter, {operation, input: context.input, request: context.request,
        authority: context.authority, signal: context.signal,
        ...(context.invocationId === undefined ? {} : {invocationId: context.invocationId})}));
      context.active(); assertMailPage(page, context, context.request); context.active();
      const output = JSON.stringify(page); context.active(); return output;
    } catch (error) { throw safeFailure(error); }
  };
}
