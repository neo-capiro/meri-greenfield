import test from 'node:test';import assert from 'node:assert/strict';
import {createModelBoundFilter,isCredentialField,reduceUrl,REDACTED} from '../confidentiality.mjs';
import {PLAYWRIGHT_MCP_VERSION,BROWSER_TOOLS} from '../../policy.mjs';
/** Synthetic JSON parser standing in for the version-pinned Playwright MCP parser (not yet written). Canary values are
 * unique strings that must never appear in any filtered output. */
const parser={version:PLAYWRIGHT_MCP_VERSION,parse:r=>JSON.parse(r.text),render:d=>({text:JSON.stringify(d)})};
const C=Object.freeze({password:'CANARY-pw-7f3a',otp:'CANARY-otp-118204',answer:'CANARY-answer-maiden',card:'CANARY-card-4111',plain:'CANARY-plain-typed',token:'CANARY-token-qs'});
const code=c=>e=>e.code===c;
const page=(over={})=>({text:JSON.stringify({pageUrl:`https://records.example/search?session=${C.token}#frag`,dialogText:null,image:false,blocks:[
 {kind:'text',text:`Results for https://records.example/item?sig=${C.token}`},
 {kind:'field',label:'Password',type:'password',autocomplete:null,selectorMatch:false,value:''},
 {kind:'field',label:'Search',type:'text',autocomplete:null,selectorMatch:false,value:'filings 2026'},
],...over})});
const signIn=()=>({text:JSON.stringify({pageUrl:'https://records.example/login?next=/x',dialogText:null,image:false,blocks:[
 {kind:'field',label:'Password',type:'password',autocomplete:'current-password',selectorMatch:false,value:C.password},
 {kind:'field',label:'Code',type:'text',autocomplete:'one-time-code',selectorMatch:false,value:C.otp},
 {kind:'field',label:'Security answer',type:'text',autocomplete:null,selectorMatch:true,value:C.answer},
 {kind:'field',label:'Card',type:'text',autocomplete:'section-pay cc-number',selectorMatch:false,value:C.card},
 {kind:'field',label:'Notes',type:'text',autocomplete:null,selectorMatch:false,value:C.plain},
]})});
const noCanary=out=>{const s=JSON.stringify(out);for(const v of Object.values(C))assert.ok(!s.includes(v),`canary ${v} leaked`);};

test('without a parser pinned to the exact Playwright MCP version every response is refused (the shipped default)',()=>{
 for(const p of [null,{...parser,version:'0.0.84'},{version:PLAYWRIGHT_MCP_VERSION,parse:parser.parse}])
  assert.throws(()=>createModelBoundFilter({parser:p}).filter({fenceState:'agent',tool:'browser_snapshot',response:page()}),code('BROWSER_OUTPUT_UNFILTERABLE'));
});

test('rule 1: no model-bound output at all while the browser is fenced or leased',()=>{
 const f=createModelBoundFilter({parser});
 for(const fenceState of ['fencing','drained','user','returning','drain-unknown'])
  assert.throws(()=>f.filter({fenceState,tool:'browser_snapshot',response:page()}),code('BROWSER_USER_IN_CONTROL'));
});

test('rules 2 and 5 for every bounded tool: credential fields redacted, URLs reduced to origin plus path',()=>{
 const f=createModelBoundFilter({parser});
 const withCard=page({blocks:[{kind:'field',label:'Card',type:'text',autocomplete:'cc-number',selectorMatch:false,value:''},{kind:'field',label:'Pw',type:'password',autocomplete:null,selectorMatch:false,value:''}]});
 for(const tool of BROWSER_TOOLS.filter(t=>t!=='browser_take_screenshot')){
  const d=JSON.parse(f.filter({fenceState:'agent',tool,response:page()}).text);
  assert.equal(d.pageUrl,'https://records.example/search');
  assert.equal(d.blocks[0].text,'Results for https://records.example/item');
  assert.equal(d.blocks[1].value,REDACTED,'an empty password field is still redacted');assert.equal(d.blocks[2].value,'filings 2026');
  noCanary(d);
  assert.ok(JSON.parse(f.filter({fenceState:'agent',tool,response:withCard}).text).blocks.every(b=>b.value===REDACTED));
 }
});

test('rule 4: a sign-in page with credential values is withheld for snapshots and refused for screenshots; canaries never leak',()=>{
 const f=createModelBoundFilter({parser});
 const out=f.filter({fenceState:'agent',tool:'browser_snapshot',response:signIn()});
 assert.deepEqual(JSON.parse(out.text).blocks,[{kind:'text',text:'sign-in page; content withheld (records.example)'}]);noCanary(out);
 assert.throws(()=>f.filter({fenceState:'agent',tool:'browser_take_screenshot',response:signIn()}),code('BROWSER_SENSITIVE_PAGE'));
 const m=createModelBoundFilter({parser,manifest:{signInUrl:'https://records.example/search',idpOrigins:['https://idp.example']}});
 assert.match(JSON.parse(m.filter({fenceState:'agent',tool:'browser_snapshot',response:page()}).text).blocks[0].text,/content withheld/u,'the manifest sign-in URL is sensitive even before anything is typed');
 assert.throws(()=>m.filter({fenceState:'agent',tool:'browser_take_screenshot',response:page({pageUrl:'https://idp.example/authorize?x=1',image:true})}),code('BROWSER_SENSITIVE_PAGE'));
 const dialog=f.filter({fenceState:'agent',tool:'browser_handle_dialog',response:signIn()});noCanary(dialog);
});

test('rule 3: the first snapshot after a lease redacts every form-control value, including plain text fields',()=>{
 const f=createModelBoundFilter({parser});
 const typed=page({blocks:[{kind:'field',label:'Notes',type:'text',autocomplete:null,selectorMatch:false,value:C.plain},{kind:'field',label:'Body',type:'contenteditable',autocomplete:null,selectorMatch:false,value:C.answer}]});
 const out=f.filter({fenceState:'agent',tool:'browser_snapshot',response:typed,postLease:true});
 assert.ok(JSON.parse(out.text).blocks.every(b=>b.value===REDACTED));noCanary(out);
 assert.equal(JSON.parse(f.filter({fenceState:'agent',tool:'browser_snapshot',response:typed}).text).blocks[0].value,C.plain,'later snapshots return to rule 2');
});

test('rule 6: unparseable or malformed documents and renderer failures are blocked, never passed through',()=>{
 const f=createModelBoundFilter({parser});
 assert.throws(()=>f.filter({fenceState:'agent',tool:'browser_snapshot',response:{text:'not json'}}),code('BROWSER_OUTPUT_UNFILTERABLE'));
 assert.throws(()=>f.filter({fenceState:'agent',tool:'browser_snapshot',response:{text:JSON.stringify({pageUrl:null,image:false,blocks:[{kind:'blob'}]})}}),code('BROWSER_OUTPUT_UNFILTERABLE'));
 const broken=createModelBoundFilter({parser:{...parser,render:()=>{throw new Error('x');}}});
 assert.throws(()=>broken.filter({fenceState:'agent',tool:'browser_snapshot',response:page()}),code('BROWSER_OUTPUT_UNFILTERABLE'));
});

test('helpers: credential classification and URL reduction',()=>{
 assert.equal(isCredentialField({type:'PASSWORD'}),true);assert.equal(isCredentialField({autocomplete:'shipping new-password'}),true);
 assert.equal(isCredentialField({type:'text',autocomplete:'email'}),false);
 assert.equal(reduceUrl('https://a.example:8443/p/q?x=1#y'),'https://a.example:8443/p/q');assert.equal(reduceUrl('javascript:alert(1)'),null);
});
