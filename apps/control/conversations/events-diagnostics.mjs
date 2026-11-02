/** One terminal line per refused event-stream open (`events`) or reconnect (`reconnect`): its public status and closed code only,
 * never an identifier, credential, cursor, message or body. History's diagnostic names a stage but not the code; a refused window
 * needs its code, because SESSION_REFUSED, SCOPE_REFUSED, SESSION_CHANGED and CONVERSATION_SELECTOR_REFUSED all answer 403.
 * At most 20 lines plus one suppression marker per minute per process. */
const ROUTES=['events','reconnect'];
const CODE=/^[A-Z][A-Z0-9_]{0,63}$/u;
export function createEventsDiagnostics({write=line=>process.stderr.write(line+'\n'),now=()=>performance.now()}={}){
 let windowStart=-Infinity,count=0;
 return (route,status,code)=>{
  try{
   if(!ROUTES.includes(route)||!Number.isInteger(status)||status<400||status>499)return;
   const at=now();if(at-windowStart>=60000){windowStart=at;count=0;}
   if(count>20)return;
   if(count++===20){write('MERI_EVENTS_CONTROL_SUPPRESSED');return;}
   write(JSON.stringify({event:'MERI_EVENTS_CONTROL',route,outcome:'refused',status,code:typeof code==='string'&&CODE.test(code)?code:'UNNAMED'}));
  }catch{/* Observability cannot change the public response. */}
 };
}
export const reportEventsRefusal=createEventsDiagnostics();
