/** Shared helpers for the composed rehearsals in this directory: a loopback HTTP listener over an in-process
 * handler, Git pins, directory trees and the receipt writer. No product behavior lives here. */
import {createServer} from 'node:http';
import {once} from 'node:events';
import {execFileSync} from 'node:child_process';
import {writeFileSync,readdirSync,statSync} from 'node:fs';
import {join,resolve,dirname,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
export const load=p=>import(pathToFileURL(join(root,p)).href);
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Serves an in-process Request handler on 127.0.0.1 and returns a fetch-shaped transport that keeps only the path. */
export async function listener(t,handle){const server=createServer(async(req,res)=>{try{const body=await Array.fromAsync(req).then(parts=>Buffer.concat(parts));const reply=await handle(new Request('https://logical.invalid'+req.url,{method:req.method,headers:req.headers,body}));res.writeHead(reply?.status??404,Object.fromEntries(reply?.headers??[]));res.end(reply?Buffer.from(await reply.arrayBuffer()):'');}catch{res.writeHead(500);res.end();}});server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port,transport=(url,options)=>fetch('http://127.0.0.1:'+port+new URL(url).pathname,options);transport.close=()=>new Promise(resolve=>server.close(resolve));return transport;}
export function git(...args){try{return execFileSync('git',['-c','safe.directory=*','-C',root,...args],{encoding:'utf8'}).trim();}catch{return null;}}
export function tree(directory){const rows=[];const walk=d=>{for(const name of readdirSync(d).sort()){const p=join(d,name),s=statSync(p);if(s.isDirectory()){rows.push({path:relative(directory,p)+'/',mode:(s.mode&0o777).toString(8)});walk(p);}else rows.push({path:relative(directory,p),bytes:s.size,mode:(s.mode&0o777).toString(8)});}};walk(directory);return rows;}
/** A receipt records the repository pin, timed steps and an outcome; `write()` publishes it to MERI_REHEARSAL_RECEIPT (or stdout). */
export function makeReceipt(name,{schema,scope}){
 const receipt={schema,rehearsal:name,startedAt:new Date().toISOString(),repository:{root,head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),uncommittedPaths:(git('status','--porcelain')??'').split('\n').filter(Boolean).length},outcome:'FAILED',steps:[]};
 const t0=Date.now();receipt.step=(name,facts={})=>{receipt.steps.push({name,atMs:Date.now()-t0,...facts});};receipt.collectFacts=async()=>{};
 receipt.write=suffix=>{receipt.finishedAt=new Date().toISOString();receipt.durationMs=Date.now()-t0;receipt.scope=scope;const {step,collectFacts,write,...data}=receipt;const out=process.env.MERI_REHEARSAL_RECEIPT;if(out){const target=suffix?out.replace(/\.json$/u,'')+'-'+suffix+'.json':out;writeFileSync(target,JSON.stringify(data,null,1)+'\n');process.stdout.write('receipt written: '+target+'\n');}else process.stdout.write(JSON.stringify(data,null,1)+'\n');};
 return receipt;
}
