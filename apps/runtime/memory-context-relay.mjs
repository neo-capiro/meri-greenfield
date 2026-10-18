/** The reads composer is constructed before control owns its conversation
 * store. Bind only that store's task-scoped proposal continuation journal at
 * startup; an unbound or closed relay refuses every task. */
import {types} from 'node:util';

const refuse=()=>{throw Object.assign(Error('MEMORY_CONTEXT_UNAVAILABLE'),{code:'MEMORY_CONTEXT_UNAVAILABLE'});};

export function createMemoryContextRelay(){
 let owner=null,closed=false;
 const forTask=task=>{
  if(closed||owner===null)refuse();
  const ports=owner(task);
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
  forTask,
  bind(store){
   if(closed||owner!==null)refuse();
   const fn=store?.forTask;
   if(typeof fn!=='function'||types.isProxy(store)||types.isProxy(fn))refuse();
   owner=task=>Reflect.apply(fn,store,[task]);
  },
  close(){closed=true;owner=null;},
  state:()=>closed?'closed':owner===null?'unbound':'bound',
 });
}
