/** Plain selectors for the existing research and Florida Core owners. */
export const retainedReadGroup=entry=>['research-portfolio','florida-budget'].includes(entry.contract.binding?.group);
export async function prepareRetainedReadContext({entry,authority,now}){
 const context=entry.contract.binding.group==='florida-budget'?{asOf:new Date(now()).toISOString()}:
  {binding:authority.binding,subject:authority.subject};
 return Object.freeze({authority,handlerNormalization:true,options:()=>context,observeAuthority(){},async retain(){}});
}
