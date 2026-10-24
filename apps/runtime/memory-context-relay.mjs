/** The reads composer is constructed before control owns its conversation
 * store. Bind only that store's execution-scoped page continuation journal at
 * startup; an unbound or closed relay refuses every task. */
import {types} from 'node:util';

const refuse=()=>{throw Object.assign(Error('MEMORY_CONTEXT_UNAVAILABLE'),{code:'MEMORY_CONTEXT_UNAVAILABLE'});};

export function createMemoryContextRelay(){
 let owner=null,mailOwner=null,closed=false;
 const capture=(task,selected)=>{
  if(closed||selected===null)refuse();
  const ports=selected(task);
  if(typeof ports?.loadPrevious!=='function'||typeof ports?.retain!=='function'||
     types.isProxy(ports)||types.isProxy(ports.loadPrevious)||types.isProxy(ports.retain))refuse();
  const call=async(name,request)=>{
   if(closed)refuse();
   const result=await Reflect.apply(ports[name],ports,[request]);
   if(closed)refuse();
   return result;
  };
  return Object.freeze({loadPrevious:request=>call('loadPrevious',request),
   retain:request=>call('retain',request)});
 };
 return Object.freeze({
  forTask:task=>capture(task,owner),
  forMail:task=>capture(task,mailOwner),
  bind(store){
   if(closed||owner!==null)refuse();
   const fn=store?.forTask;
   if(typeof fn!=='function'||types.isProxy(store)||types.isProxy(fn))refuse();
   const mail=store?.forMail;if(mail!==undefined&&(typeof mail!=='function'||types.isProxy(mail)))refuse();
   owner=task=>Reflect.apply(fn,store,[task]);
   mailOwner=mail===undefined?null:task=>Reflect.apply(mail,store,[task]);
  },
  close(){closed=true;owner=null;mailOwner=null;},
  state:()=>closed?'closed':owner===null?'unbound':'bound',
 });
}
