/** The browser egress proxy as its own unprivileged process (`proxy-process.mjs` spawns it with a dedicated uid). It
 * owns only the loopback listener and the dials to the addresses the supervisor decided: every admission question
 * travels over the IPC channel to the root supervisor, which runs the real egress control (policy, denied hosts, DNS,
 * resolved-address limits, currentness) and answers with the exact connect target. The host nft guard confines this uid
 * to public TCP 80/443 on the ENI, so a wrong or forged decision still cannot reach private ranges or metadata. */
import {startEgressProxy} from './proxy-server.mjs';

const EXIT_REFUSED=111;
if(typeof process.send!=='function'||typeof process.getuid!=='function'||process.getuid()===0||process.geteuid()!==process.getuid()){process.exit(EXIT_REFUSED);}
const pending=new Map();let sequence=0,proxy=null,starting=false;
const send=message=>{try{process.send(message);}catch{process.exit(EXIT_REFUSED);}};
const control=Object.freeze({
 admitProxyRequest(request,{signal}={}){
  return new Promise((resolve,reject)=>{
   const id=++sequence;
   const abort=()=>{pending.delete(id);reject(Object.assign(Error('EGRESS_ADMISSION_TIMEOUT'),{code:'EGRESS_ADMISSION_TIMEOUT'}));};
   pending.set(id,decision=>{signal?.removeEventListener('abort',abort);resolve(decision);});
   signal?.addEventListener('abort',abort,{once:true});
   send({type:'admit',id,request:{method:request.method,target:request.target,headers:request.headers}});
  });
 },
 revoke(){},
});
process.on('message',async message=>{
 if(message?.type==='decision'){const settle=pending.get(message.id);if(settle){pending.delete(message.id);settle(message.decision);}return;}
 if(message?.type==='go'&&proxy===null&&!starting){
  starting=true;
  try{proxy=await startEgressProxy({control,httpPort:0,onDecision:decision=>send({type:'record',decision})});send({type:'ready',port:proxy.ports.http});}
  catch{process.exit(EXIT_REFUSED);}
  return;
 }
 if(message?.type==='close'){try{await proxy?.close();}catch{}send({type:'closed'});process.exit(0);}
});
process.on('disconnect',()=>process.exit(0));
