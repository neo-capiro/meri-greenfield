/** Offline verification of Release's existing one-attempt native-read files. No AWS client or collector. */
import {dirname,resolve} from 'node:path';import {realpathSync} from 'node:fs';
import {privateRead,closed,sha,commitment,buildBinding,fail} from './plan.mjs';
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),time=v=>Number.isSafeInteger(v)&&v>=0;
const equalPath=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
function argvFacts(argv){
 if(!Array.isArray(argv)||argv.length>40||argv.some(v=>typeof v!=='string')||argv[1]!=='logs'||argv[2]!=='filter-log-events')fail('QUALIFICATION_LOG_COMMAND');
 const flags=new Set(['--no-paginate','--no-cli-pager','--no-cli-auto-prompt']),values=new Set(['--log-group-name','--start-time','--end-time','--filter-pattern','--limit','--next-token','--profile','--region','--output','--cli-connect-timeout','--cli-read-timeout']),out={};
 for(let i=3;i<argv.length;i++){const key=argv[i];if(Object.hasOwn(out,key)||!flags.has(key)&&!values.has(key))fail('QUALIFICATION_LOG_COMMAND');out[key]=flags.has(key)?true:argv[++i];if(out[key]===undefined)fail('QUALIFICATION_LOG_COMMAND');}
 if([...flags].some(k=>out[k]!==true)||out['--region']!=='us-east-1'||out['--output']!=='json'||out['--profile']!=='default'||out['--limit']!=='200'||['--cli-connect-timeout','--cli-read-timeout'].some(k=>! /^[1-5]$/.test(out[k]??'')))fail('QUALIFICATION_LOG_COMMAND');return out;
}
/** A missing exclusive final receipt is pending. Any malformed/failed/incomplete published receipt stops. */
export function readNativeReceipt(path,{plan,c,deadline,submitAtMs}){
 let encoded;try{encoded=privateRead(path,131072);}catch(error){if(error.code==='ENOENT')return null;throw error;}
 const value=closed(JSON.parse(encoded),['schema','allocationSha256','caseId','binding','requestId','buildBindingSha256','releaseBindingSha256','collectorSha256','logGroupName','runtimeSessionId','startedAtMs','finishedAtMs','passes','extractionFile','extractionSha256']);
 if(value.schema!=='meri.model-qualification-native-receipt/1'||value.allocationSha256!==plan.allocationSha256||value.caseId!==c.id||commitment(value.binding)!==commitment(c.binding)||value.requestId!==c.requestId||value.buildBindingSha256!==commitment(buildBinding(plan))||value.releaseBindingSha256!==plan.releaseBindingSha256||value.collectorSha256!==plan.collectorSha256||value.logGroupName!==plan.candidateLogGroup||typeof value.runtimeSessionId!=='string'||! /^[A-Za-z0-9][A-Za-z0-9_-]{32,255}$/.test(value.runtimeSessionId))fail('QUALIFICATION_LOG_BINDING');
 if(!time(value.startedAtMs)||!time(value.finishedAtMs)||value.startedAtMs<submitAtMs||value.finishedAtMs<value.startedAtMs||value.finishedAtMs-value.startedAtMs>60000||value.finishedAtMs>deadline||!Array.isArray(value.passes)||value.passes.length<1||value.passes.length>6)fail('QUALIFICATION_LOG_BOUNDS');
 const parent=resolve(dirname(path));if(!equalPath(realpathSync(parent),parent))fail('QUALIFICATION_LOG_CUSTODY');const used=new Set();
 const file=(name,expected,max)=>{if(typeof name!=='string'||! /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(name)||used.has(name)||!digest(expected))fail('QUALIFICATION_LOG_FILE');used.add(name);const target=resolve(parent,name),bytes=privateRead(target,max);if(!equalPath(realpathSync(target),target)||sha(bytes)!==expected)fail('QUALIFICATION_LOG_HASH');return bytes;};
 const events=[],seen=new Map();let calls=0,lastEnd=value.startedAtMs,firstStart=null,lastPassEnd=submitAtMs;
 for(const pass of value.passes){
  closed(pass,['startTime','endTime','pages']);if(pass.startTime!==submitAtMs||!time(pass.endTime)||pass.endTime<lastPassEnd||pass.endTime>deadline||!Array.isArray(pass.pages)||pass.pages.length<1||pass.pages.length>4)fail('QUALIFICATION_LOG_PASS');lastPassEnd=pass.endTime;let next=null;const tokens=new Set();
  for(const [index,page]of pass.pages.entries()){
   closed(page,['requestFile','requestSha256','receiptFile','receiptSha256','stdoutFile','stderrFile']);if(++calls>24)fail('QUALIFICATION_LOG_BOUNDS');
   const request=closed(JSON.parse(file(page.requestFile,page.requestSha256,16384)),['atUtc','argv','attempt']),receipt=closed(JSON.parse(file(page.receiptFile,page.receiptSha256,16384)),['endUtc','nativeExitCode','stdoutSha256','stdoutBytes','stderrSha256','stderrBytes','outcomeUnknown','invocationConsumed','retries']);
   const start=Date.parse(request.atUtc),end=Date.parse(receipt.endUtc);if(!time(start)||!time(end)||start<lastEnd||end<start||end-start>5000||end>deadline||pass.endTime>start||request.attempt!==1||receipt.nativeExitCode!==0||receipt.outcomeUnknown!==false||receipt.invocationConsumed!==true||receipt.retries!==0)fail('QUALIFICATION_LOG_NATIVE_OUTCOME');
   if(index===0&&firstStart!==null&&start-lastEnd>2000)fail('QUALIFICATION_LOG_PAUSE');firstStart??=start;lastEnd=end;
   const args=argvFacts(request.argv),pattern=['meri-model-qualification/1',plan.allocationSha256,c.id].map(s=>'"'+s+'"').sort().join(' ');
   if(args['--log-group-name']!==plan.candidateLogGroup||args['--start-time']!==String(pass.startTime)||args['--end-time']!==String(pass.endTime)||(args['--next-token']??null)!==next||args['--filter-pattern']?.trim().split(/\s+/).sort().join(' ')!==pattern)fail('QUALIFICATION_LOG_REQUEST');
   const stdout=file(page.stdoutFile,receipt.stdoutSha256,4194304),stderr=file(page.stderrFile,receipt.stderrSha256,8192);if(stdout.length!==receipt.stdoutBytes||stderr.length!==receipt.stderrBytes||stderr.length!==0)fail('QUALIFICATION_LOG_BYTES');
   const body=JSON.parse(stdout);if(!Array.isArray(body.events)||body.events.length>200)fail('QUALIFICATION_LOG_PAGE');
   for(const event of body.events){if(typeof event.eventId!=='string'||!event.eventId||event.eventId.length>200||typeof event.logStreamName!=='string'||!event.logStreamName||event.logStreamName.length>512||!time(event.timestamp)||event.timestamp<pass.startTime||event.timestamp>pass.endTime||typeof event.message!=='string')fail('QUALIFICATION_LOG_EVENT');
    const key=event.logStreamName+'\0'+event.eventId,hash=commitment(event);if(seen.has(key)){if(seen.get(key)!==hash)fail('QUALIFICATION_LOG_EVENT_CONFLICT');continue;}seen.set(key,hash);
    const row=JSON.parse(event.message);if(row?.eventNamespace!=='meri-model-qualification/1'||row.allocationSha256!==plan.allocationSha256||row.caseId!==c.id)fail('QUALIFICATION_LOG_EVENT_BINDING');events.push(row);
   }
   next=body.nextToken??null;if(next!==null&&(typeof next!=='string'||next.length<1||next.length>4096||tokens.has(next)))fail('QUALIFICATION_LOG_PAGINATION');if(next!==null)tokens.add(next);
   if((index===pass.pages.length-1)!==(next===null))fail('QUALIFICATION_LOG_INCOMPLETE');
  }
 }
 if(firstStart!==value.startedAtMs||lastEnd!==value.finishedAtMs)fail('QUALIFICATION_LOG_TIME');
 const extracted=file(value.extractionFile,value.extractionSha256,4194304).toString('utf8'),expected=events.map(e=>JSON.stringify(e)+'\n').join('');if(extracted!==expected)fail('QUALIFICATION_LOG_EXTRACTION');
 const terminal=events.filter(e=>e.event==='settled');if(terminal.length!==1||terminal[0].receipt?.execution?.runtimeSessionId!==value.runtimeSessionId)fail('QUALIFICATION_LOG_TERMINAL');
 return {events,receiptSha256:sha(encoded),collectionComplete:true};
}
