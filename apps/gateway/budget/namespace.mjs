/** Trusted fixed SQL identities, never request/model-controlled schema names. */
const names=['budget','runs','grants','requests','budget_liabilities','tool_run_allocations','tool_grant_bindings','tool_reservations','tool_invocations'];
const tables=schema=>Object.freeze(Object.fromEntries(names.map(name=>[name,`${schema}.${name}`])));
const qualification=tables('meri_qualification'),product=tables('meri_product_budget');
export function budgetTables(namespace='qualification'){
 if(namespace==='qualification')return qualification;
 if(namespace==='product')return product;
 return undefined;
}
