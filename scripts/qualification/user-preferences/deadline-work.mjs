/** Normal PostgreSQL work only. No driver, connection, timer or I/O is acquired on import/construction. */
const ownedErrors=new WeakSet();
function failure(code,operation,started){
 const error=Error(code);error.name='DeadlineWorkError';error.code=code;error.operation=operation;error.started=started;error.cancelled=false;
 if(code==='PG_NORMAL_WORK_UNKNOWN')error.outcome='UNKNOWN';ownedErrors.add(error);return error;
}
export const isDeadlineWorkError=error=>error!==null&&typeof error==='object'&&ownedErrors.has(error);
export function createDeadlineWork({deadlineMs,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
 if(!Number.isSafeInteger(deadlineMs)||deadlineMs<0||![now,setTimer,clearTimer].every(value=>typeof value==='function'))throw Error('PG_NORMAL_WORK_CONFIGURATION');
 let uncertain=false;
 const instant=()=>{const at=now();if(!Number.isSafeInteger(at)||at<0)throw Error('PG_NORMAL_WORK_CLOCK');return at;};
 function invoke(operation,maxMs,dispatch){
  if(uncertain)return Promise.reject(failure('PG_NORMAL_WORK_UNKNOWN',operation,false));
  const at=instant(),callDeadline=Math.min(deadlineMs,at+maxMs);
  if(at>=callDeadline)return Promise.reject(failure('PG_NORMAL_WORK_DEADLINE',operation,false));
  return new Promise((resolve,reject)=>{
   let started=false,settled=false,timer;
   const settle=(accept,value)=>{if(settled)return;settled=true;clearTimer(timer);(accept?resolve:reject)(value);};
   const unknown=()=>{if(settled)return;uncertain=true;settle(false,failure('PG_NORMAL_WORK_UNKNOWN',operation,started));};
   const inTime=()=>{try{return instant()<callDeadline;}catch{return false;}};
   timer=setTimer(unknown,callDeadline-at);
   try{
    // A factory may allocate an owned client, but only start() may invoke its driver operation.
    const remaining=callDeadline-instant();
    if(remaining<=0){settle(false,failure('PG_NORMAL_WORK_DEADLINE',operation,false));return;}
    const start=call=>{
     if(uncertain)throw failure('PG_NORMAL_WORK_UNKNOWN',operation,false);
     const allowance=callDeadline-instant();if(allowance<=0)throw failure('PG_NORMAL_WORK_DEADLINE',operation,false);
     started=true;return call(allowance);
    };
    Promise.resolve(dispatch(remaining,start)).then(
     value=>{if(!inTime()){unknown();return;}settle(true,value);},
     error=>{if(!inTime()){unknown();return;}settle(false,error);},
    );
   }catch(error){if(!started)settle(false,error);else if(!inTime())unknown();else settle(false,error);}
  });
 }
 return Object.freeze({
  /** The caller registers its new owned client inside the factory, before connect can remain in flight. */
  connect(createClient){
   if(typeof createClient!=='function')throw Error('PG_NORMAL_WORK_CONFIGURATION');
   let client;
   return invoke('connect',3000,(timeoutMs,start)=>{client=createClient(timeoutMs);return start(()=>client.connect());}).then(()=>client);
  },
  query(client,text,values){
   if(typeof text!=='string'||values!==undefined&&!Array.isArray(values))throw Error('PG_NORMAL_WORK_CONFIGURATION');
   return invoke('query',7000,(_,start)=>start(timeoutMs=>client.query({text,values,query_timeout:timeoutMs})));
  },
 });
}
