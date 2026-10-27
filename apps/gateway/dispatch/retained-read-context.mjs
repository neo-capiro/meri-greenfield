/** Plain selectors for the existing research portfolio Core owner. */
export const retainedReadGroup=entry=>entry.contract.binding?.group==='research-portfolio';
export async function prepareRetainedReadContext({authority}){
 const context={binding:authority.binding,subject:authority.subject};
 return Object.freeze({authority,handlerNormalization:true,options:()=>context,observeAuthority(){},async retain(){}});
}
