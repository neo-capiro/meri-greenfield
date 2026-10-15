// Synthetic Temporal schedule service behind the REAL SDK 1.24 ScheduleClient and its protobuf WorkflowService: every request and
// response crosses protobuf encode/decode, so describe() returns exactly the SDK's decoded shape (wire defaults, Long counters,
// Durations, data-converter payloads). The "server" stores the request's Schedule message verbatim: it does not apply the real
// server's spec canonicalization (cron compilation, defaults), which remains a live-Temporal qualification.
import {ScheduleClient,WorkflowService} from './scheduled-dispatch-harness.mjs';

const grpcError=(code,details)=>Object.assign(new Error(`${code} ${details}`),{code,details,metadata:{get:()=>[]}});
export function temporalScheduleService() {
 const schedules=new Map(),faults={describe:[]},calls={describe:0,create:0,update:0,patch:0,delete:0};
 function handle(name,request) {
  const id=request.scheduleId;
  if(name==='CreateSchedule'){calls.create++;if(schedules.has(id))throw grpcError(6,'schedule already exists');schedules.set(id,request.schedule);return {conflictToken:Buffer.from('1')};}
  if(name==='DescribeSchedule'){calls.describe++;if(faults.describe.shift()==='error')throw Error('synthetic transport failure');
   if(!schedules.has(id))throw grpcError(5,'schedule not found');return {schedule:schedules.get(id),info:{createTime:{seconds:1760529600}},conflictToken:Buffer.from('1')};}
  if(!schedules.has(id))throw grpcError(5,'schedule not found');
  if(name==='UpdateSchedule'){calls.update++;schedules.set(id,request.schedule);return {};}
  if(name==='PatchSchedule'){calls.patch++;const s=schedules.get(id),p=request.patch;s.state??={};
   if(p.pause){s.state.paused=true;s.state.notes=p.pause;}if(p.unpause){s.state.paused=false;s.state.notes=p.unpause;}return {};}
  if(name==='DeleteSchedule'){calls.delete++;schedules.delete(id);return {};}
  throw grpcError(12,`unscripted ${name}`);
 }
 const workflowService=WorkflowService.create((method,data,callback)=>{
  let bytes;try{bytes=method.resolvedResponseType.encode(method.resolvedResponseType.create(handle(method.name,method.resolvedRequestType.decode(data)))).finish();}catch(error){callback(error);return;}
  callback(null,bytes);
 },false,false);
 const connection={workflowService,withDeadline:(_deadline,fn)=>fn(),withAbortSignal:(_signal,fn)=>fn(),withMetadata:(_metadata,fn)=>fn()};
 const scheduleClient=new ScheduleClient({connection,namespace:'default'});
 /** The decoded Schedule message the server holds, for simulating server-side drift (e.g. pause-on-failure, defaults). */
 const stored=id=>schedules.get(id);
 return {scheduleClient,schedules,stored,faults,calls};
}
