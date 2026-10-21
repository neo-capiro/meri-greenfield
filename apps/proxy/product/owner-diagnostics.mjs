/** Bounded refusal lines for the model budget owner. Every proxied refusal so far was silent (20 Oct 12:16Z: the
 * owner's placement read was denied by PostgreSQL and only Aurora's own log said why).
 *
 * A line holds fixed words, a constant refusal code, a five-character SQLSTATE and the first relation our own constant
 * SQL names. Never an error message, SQL parameter, row value, identifier of a tenant/conversation, header or credential.
 * At most `burst` lines per window; the first suppressed line in a window says so once. */
import {currentTurnTelemetry} from '../../runtime/telemetry/turn-context.mjs';

/** Additive telemetry never shares the bounded legacy refusal budget. */
export function health(component,transition,code,telemetry=currentTurnTelemetry()){
 try{telemetry?.health(component,transition,code);}catch{}
}
export function budgetQuarantined(binding,reason,telemetry=currentTurnTelemetry()){
 try{telemetry?.budgetQuarantined(binding,reason);}catch{}
}

const SQLSTATE=/^[0-9A-Z]{5}$/u,CODE=/^[A-Z][A-Z0-9_]{2,63}$/u,STEP=/^[a-z][a-z-]{0,31}$/u;
const RELATION=/\b(?:FROM|INTO|UPDATE|JOIN)\s+(meri_[a-z_]{1,48}\.[a-z_]{1,64})\b/u;

/** The statement's first relation, only from SQL text (never a parameter); `unknown` otherwise. */
export function statementRelation(text){
 if(typeof text!=='string')return 'unknown';
 const m=RELATION.exec(text.slice(0,4096));return m?m[1]:'unknown';
}
/** A constant refusal code from an error, or `REFUSED`. `DEADLINE` means the owner's request lifetime ran out (the exchange
 * budget), not that a check refused. */
export function refusalCode(error){
 const code=error?.code;return typeof code==='string'&&CODE.test(code)&&!SQLSTATE.test(code)?code:'REFUSED';
}

export function createOwnerDiagnostics({write=line=>process.stderr.write(line),now=Date.now,burst=20,windowMs=60000,telemetry=currentTurnTelemetry()}={}){
 if(typeof write!=='function'||typeof now!=='function'||!Number.isSafeInteger(burst)||burst<1||!Number.isSafeInteger(windowMs)||windowMs<1)
  throw Error('PRODUCT_OWNER_DIAGNOSTICS_CONFIGURATION');
 let windowStart=-Infinity,count=0,suppressed=false;
 function emit(line){
  try{
   const at=now();if(at-windowStart>=windowMs){windowStart=at;count=0;suppressed=false;}
   if(count<burst){count++;write(line+'\n');}
   else if(!suppressed){suppressed=true;write('PRODUCT_OWNER_DIAGNOSTICS_SUPPRESSED\n');}
  }catch{}
 }
 return Object.freeze({
  health:(component,transition,code)=>health(component,transition,code,telemetry),
  budgetQuarantined:(binding,reason)=>budgetQuarantined(binding,reason,telemetry),
  /** One refused statement: `sqlstate` only when PostgreSQL supplied one. */
  database(error,text){const state=error?.code;if(typeof state!=='string'||!SQLSTATE.test(state))return;
   emit(`PRODUCT_OWNER_DB_REFUSED sqlstate=${state} relation=${statementRelation(text)}`);},
  /** One refused owner decision: which owner, the step it reached and a constant code. */
  refused(owner,step,error){if(!STEP.test(owner)||!STEP.test(step))return;
   emit(`PRODUCT_OWNER_REFUSED owner=${owner} step=${step} code=${refusalCode(error)}`);},
 });
}

/** The owner's one pool (it uses only connect, query and end), reporting every refused statement. Results, rows and
 * errors pass through unchanged; each pooled client is wrapped once. */
export function createDiagnosticPool(pool,diagnostics){
 if(typeof pool?.connect!=='function'||typeof pool?.end!=='function'||typeof diagnostics?.database!=='function')
  throw Error('PRODUCT_OWNER_DIAGNOSTICS_CONFIGURATION');
 const wrapped=new WeakSet();
 const observe=query=>async(...args)=>{try{return await query(...args);}
  catch(error){diagnostics.database(error,typeof args[0]==='string'?args[0]:args[0]?.text);throw error;}};
 return Object.freeze({
  async connect(){const client=await pool.connect();
   if(client&&typeof client.query==='function'&&!wrapped.has(client)){wrapped.add(client);client.query=observe(client.query.bind(client));}
   return client;},
  ...(typeof pool.query==='function'?{query:observe(pool.query.bind(pool))}:{}),
  end:()=>pool.end(),
 });
}
