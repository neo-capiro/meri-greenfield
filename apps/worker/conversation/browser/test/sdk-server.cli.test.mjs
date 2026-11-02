/** The actual Claude Code CLI behind the pinned Agent SDK `query()` re-lists the in-process browser server's tools when the
 * server announces `tools/list_changed` after first-use preparation: before it, the CLI holds only `browser_navigate`;
 * after it, the host's own tool definitions. No prompt is sent and no model is contacted (the prompt stream never yields,
 * the configuration directory is a fresh temporary one and the key is a placeholder). Skips when the SDK's platform
 * executable is not installed on this host. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {query} from '@anthropic-ai/claude-agent-sdk';
import {createBrowserSdkServer,FIRST_BROWSER_TOOL} from '../sdk-server.mjs';
import {validateBrowserPolicy} from '../policy.mjs';
import {binding} from '../../../../control/conversations/test/store-fixture.mjs';

const descriptor={name:'browser_snapshot',description:'Pinned upstream snapshot',inputSchema:{type:'object',properties:{},additionalProperties:false}};
const METADATA=Object.freeze({policy:validateBrowserPolicy({enabled:true,tools:['browser_navigate','browser_snapshot']}),approvalDeadlineMs:120000});
const within=(promise,ms)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('CLI did not answer in time')),ms).unref())]);

test('the actual CLI re-lists the browser tools after the first-use list_changed notification',{timeout:120000},async t=>{
 const config=await mkdtemp(join(tmpdir(),'meri-cli-config-'));t.after(()=>rm(config,{recursive:true,force:true}));
 let metadata=null;
 const owner=createBrowserSdkServer({binding,prepared:()=>metadata,ensure:async()=>metadata,deadlineMs:Date.now()+120000,
  tools:async()=>[structuredClone(FIRST_BROWSER_TOOL),descriptor],call:async()=>({content:[{type:'text',text:'ok'}]})});
 let release;const held=new Promise(resolve=>{release=resolve;});
 async function* prompt(){await held;}
 const env={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP,HOME:config,USERPROFILE:config,
  CLAUDE_CONFIG_DIR:config,ANTHROPIC_API_KEY:'placeholder-never-used',DISABLE_AUTOUPDATER:'1',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1'};
 let q;
 try{q=query({prompt:prompt(),options:{mcpServers:{meri_browser:owner.server},settingSources:[],env,maxTurns:1}});}
 catch(error){t.skip(`Agent SDK executable unavailable: ${error?.code??error?.message}`);release();await owner.close();return;}
 t.after(async()=>{release();q.close?.();await owner.close();});
 const names=async()=>{const status=await within(q.mcpServerStatus(),30000),server=status.find(s=>s.name==='meri_browser');
  return server?.status==='connected'?(server.tools??[]).map(tool=>tool.name).sort():null;};
 let before;
 try{for(let n=0;n<60&&(before=await names())===null;n++)await new Promise(resolve=>setTimeout(resolve,500));}
 catch(error){if(/spawn|ENOENT|executable/iu.test(String(error?.message))){t.skip(`Agent SDK executable unavailable: ${error.message}`);return;}throw error;}
 assert.deepEqual(before,['browser_navigate'],'before first use the CLI holds only the first browser tool');
 metadata=METADATA;await owner.toolsChanged();
 let after;
 for(let n=0;n<40;n++){after=await names();if(after?.length===2)break;await new Promise(resolve=>setTimeout(resolve,250));}
 assert.deepEqual(after,['browser_navigate','browser_snapshot'],'the CLI re-listed the host tools after list_changed');
});
