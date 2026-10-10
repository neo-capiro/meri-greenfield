// Consumer compile witness: public exports only, no private source paths.
import { validateUIEvent, type UIEvent, type Scope, type RunBinding } from '@capiro/meri-contracts';
import { metadata } from '@capiro/meri-contracts/metadata';
const value: unknown = {};
if (validateUIEvent(value)) {
  const event: UIEvent = value;
  const scope: Scope = event.scopes[0];
  const binding: RunBinding = event.binding;
  void scope; void binding;
}
// Runtime metadata is immutable; TypeScript must agree.
// @ts-expect-error generated metadata vocabulary cannot be changed
metadata.uiEventVariants.push('run.status');
// @ts-expect-error the wire has no invented status
const invalid: Extract<UIEvent, { type: 'run.status' }>['data']['state'] = 'ready';
void invalid;
