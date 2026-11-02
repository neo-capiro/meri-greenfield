/** Interaction classification over a scripted page: structural facts only, fail toward asking. */
import test from 'node:test';import assert from 'node:assert/strict';
import {classifyInteraction,INTERACTION_CLASSES} from '../interaction-classifier.mjs';

/** A page whose frames answer `aria-ref=<ref>` with the given element facts (already in utility-world shape). */
function page(refs,{frames=1,throwing=false,focused=[]}={}){
 const frame={locator(selector){const ref=selector===':focus'?null:selector.replace(/^aria-ref=/u,'');return {async evaluateAll(fn,selectors,options){
  if(throwing)throw Error('frame detached');
  assert.equal(options?.world,'utility','inspection runs in the pristine utility world');
  const nodes=ref===null?focused:refs[ref]??[];return fn(nodes.map(describe),selectors);}};}};
 return {frames:()=>Array.from({length:frames},()=>frame)};
}
/** Builds a DOM-like node from a terse description: {tag,type?,autocomplete?,form?:{fields:[...]},owner?:{fields:[...]}}
 * `form` is the enclosing form (closest), `owner` the IDL form owner (a control outside its form that names it via form=). */
function describe(d){
 const attrs={type:d.type,autocomplete:d.autocomplete,name:d.name,id:d.id,inputmode:d.inputmode,maxlength:d.maxlength,placeholder:d.placeholder,'aria-label':d.label};
 const node={tagName:d.tag.toUpperCase(),getAttribute:name=>attrs[name]??null,matches:selector=>d.matches===selector,closest:selector=>selector==='form'&&d.form?form(d.form):null,
  ...(['button','input','textarea','select'].includes(d.tag)?{form:d.owner?form(d.owner):d.form?form(d.form):null}:{})};
 return node;
}
function form(f){return {querySelectorAll:()=>f.fields.map(describe)};}
const pw={tag:'input',type:'password'},user={tag:'input',type:'text',autocomplete:'username'},cc={tag:'input',type:'text',autocomplete:'cc-number'};
const loginForm={fields:[user,pw]},searchForm={fields:[{tag:'input',type:'search'}]};

test('typing: credential fields refuse, submit flag asks, ordinary text is routine',async()=>{
 assert.deepEqual(INTERACTION_CLASSES,['routine','submission','credential']);
 const p=page({e1:[{...pw,form:loginForm}],e2:[{tag:'input',type:'text',form:searchForm}],e3:[cc],e4:[{tag:'input',type:'text',matches:'#secret'}]});
 assert.equal(await classifyInteraction({tool:'browser_type',input:{ref:'e1',text:'x'},pages:[p]}),'credential');
 assert.equal(await classifyInteraction({tool:'browser_type',input:{ref:'e3',text:'4111'},pages:[p]}),'credential');
 assert.equal(await classifyInteraction({tool:'browser_type',input:{ref:'e4',text:'x'},pages:[p],sensitiveSelectors:['#secret']}),'credential','manifest-sensitive selectors count as credentials');
 assert.equal(await classifyInteraction({tool:'browser_type',input:{ref:'e2',text:'budget'},pages:[p]}),'routine');
 assert.equal(await classifyInteraction({tool:'browser_type',input:{ref:'e2',text:'budget',submit:true},pages:[p]}),'submission');
 assert.equal(await classifyInteraction({tool:'browser_fill_form',input:{fields:[{ref:'e2',value:'a'},{ref:'e1',value:'b'}]},pages:[p]}),'credential','one credential field in a form fill refuses the whole call');
 assert.equal(await classifyInteraction({tool:'browser_fill_form',input:{fields:[{ref:'e2',value:'a'}]},pages:[p]}),'routine');
});
test('clicks: submit controls ask, links and buttons outside forms are routine; keys and dialogs by their effect',async()=>{
 const p=page({b1:[{tag:'button',form:searchForm}],b2:[{tag:'button',type:'button',form:searchForm}],b3:[{tag:'button'}],i1:[{tag:'input',type:'submit',form:loginForm}],a1:[{tag:'a'}],i2:[{tag:'input',type:'image'}],
  b4:[{tag:'button',owner:searchForm}],b5:[{tag:'button',type:'sumbit',form:searchForm}],b6:[{tag:'button',type:'reset',form:searchForm}],i3:[{tag:'input',type:'text',owner:loginForm}]});
 assert.equal(await classifyInteraction({tool:'browser_click',input:{ref:'b1'},pages:[p]}),'submission','a default-type button inside a form submits it');
 assert.equal(await classifyInteraction({tool:'browser_click',input:{ref:'b2'},pages:[p]}),'routine');
 assert.equal(await classifyInteraction({tool:'browser_click',input:{ref:'b3'},pages:[p]}),'routine','a button outside any form submits nothing');
 assert.equal(await classifyInteraction({tool:'browser_click',input:{ref:'b4'},pages:[p]}),'submission','a button outside its form that names it via form= still submits it');
 assert.equal(await classifyInteraction({tool:'browser_click',input:{ref:'b5'},pages:[p]}),'submission','an invalid type defaults to submit');
 assert.equal(await classifyInteraction({tool:'browser_click',input:{ref:'b6'},pages:[p]}),'routine','reset is not a submission');
 assert.equal(await classifyInteraction({tool:'browser_type',input:{ref:'i3',text:'x'},pages:[p]}),'routine','typing a non-credential field of a login form is routine; only the credential field itself refuses');
 assert.equal(await classifyInteraction({tool:'browser_click',input:{ref:'i1'},pages:[p]}),'submission');
 assert.equal(await classifyInteraction({tool:'browser_click',input:{ref:'i2'},pages:[p]}),'submission');
 assert.equal(await classifyInteraction({tool:'browser_click',input:{ref:'a1'},pages:[p]}),'routine');
 for(const key of ['Enter','NumpadEnter','Control+Enter','Meta+Enter','Shift+Enter','Space',' '])
  assert.equal(await classifyInteraction({tool:'browser_press_key',input:{key},pages:[p]}),'submission',key);
 for(const key of ['ArrowDown','Tab','Escape','Control+a','PageDown'])
  assert.equal(await classifyInteraction({tool:'browser_press_key',input:{key},pages:[p]}),'routine',key);
 assert.equal(await classifyInteraction({tool:'browser_handle_dialog',input:{accept:true},pages:[p]}),'submission');
 assert.equal(await classifyInteraction({tool:'browser_handle_dialog',input:{accept:false},pages:[p]}),'routine');
 assert.equal(await classifyInteraction({tool:'browser_hover',input:{ref:'a1'},pages:[p]}),'routine');
 assert.equal(await classifyInteraction({tool:'browser_select_option',input:{ref:'a1',values:['x']},pages:[p]}),'routine');
});
test('anything that cannot be inspected asks: unknown ref, duplicate ref across frames, malformed ref, no pages, evaluation error, unknown tool',async()=>{
 const p=page({a1:[{tag:'a'}]});
 assert.equal(await classifyInteraction({tool:'browser_click',input:{ref:'zz9'},pages:[p]}),'submission');
 assert.equal(await classifyInteraction({tool:'browser_click',input:{ref:'a1'},pages:[page({a1:[{tag:'a'}]},{frames:2})]}),'submission','a ref matching in two frames is ambiguous');
 assert.equal(await classifyInteraction({tool:'browser_click',input:{ref:'../x'},pages:[p]}),'submission');
 assert.equal(await classifyInteraction({tool:'browser_click',input:{},pages:[p]}),'submission');
 assert.equal(await classifyInteraction({tool:'browser_click',input:{ref:'a1'},pages:[]}),'submission');
 assert.equal(await classifyInteraction({tool:'browser_click',input:{ref:'a1'},pages:[page({a1:[{tag:'a'}]},{throwing:true})]}),'submission');
 assert.equal(await classifyInteraction({tool:'browser_navigate',input:{url:'https://x.example'},pages:[p]}),'submission','non-interaction tools never reach the classifier; a stray call asks');
 const aborted=new AbortController();aborted.abort();
 await assert.rejects(classifyInteraction({tool:'browser_click',input:{ref:'a1'},pages:[p],signal:aborted.signal}));
});

test('Enter aliases and line breaks submit: "\\n" and "\\r" keys, and typed or filled text containing a line break',async()=>{
 const p=page({e2:[{tag:'input',type:'text',form:searchForm}]});
 for(const key of ['\n','\r','Control+\n'])
  assert.equal(await classifyInteraction({tool:'browser_press_key',input:{key},pages:[p]}),'submission',JSON.stringify(key));
 for(const text of ['budget\n','a\rb','line one\r\nline two'])
  assert.equal(await classifyInteraction({tool:'browser_type',input:{ref:'e2',text},pages:[p]}),'submission',JSON.stringify(text));
 assert.equal(await classifyInteraction({tool:'browser_fill_form',input:{fields:[{ref:'e2',value:'x\n'}]},pages:[p]}),'submission');
 assert.equal(await classifyInteraction({tool:'browser_type',input:{ref:'e2',text:'no break'},pages:[p]}),'routine');
});
test('a key pressed while a credential field is focused is refused like typing into it, in any frame; an uninspectable focus asks',async()=>{
 for(const field of [pw,{tag:'input',type:'text',autocomplete:'one-time-code'}]){
  for(const key of ['a','1','Enter','Tab'])
   assert.equal(await classifyInteraction({tool:'browser_press_key',input:{key},pages:[page({},{focused:[field],frames:2})]}),'credential',`${JSON.stringify(field)} ${key}`);
 }
 assert.equal(await classifyInteraction({tool:'browser_press_key',input:{key:'a'},pages:[page({},{focused:[{tag:'input',type:'search'}]})]}),'routine');
 assert.equal(await classifyInteraction({tool:'browser_press_key',input:{key:'Enter'},pages:[page({},{focused:[{tag:'input',type:'search'}]})]}),'submission');
 assert.equal(await classifyInteraction({tool:'browser_press_key',input:{key:'a'},pages:[page({},{throwing:true})]}),'submission');
});
test('one-time-code fields without autocomplete are credentials by name, id, label or a short numeric "code" field',async()=>{
 const p=page({o1:[{tag:'input',type:'text',name:'otp'}],o2:[{tag:'input',type:'text',id:'verification-code'}],o3:[{tag:'input',type:'text',inputmode:'numeric',maxlength:'6',placeholder:'Enter code'}],
  o4:[{tag:'input',type:'tel',label:'Authentication code'}],n1:[{tag:'input',type:'text',inputmode:'numeric',maxlength:'5',name:'zip'}],n2:[{tag:'input',type:'text',name:'promo-code'}]});
 for(const ref of ['o1','o2','o3','o4'])assert.equal(await classifyInteraction({tool:'browser_type',input:{ref,text:'123456'},pages:[p]}),'credential',ref);
 for(const ref of ['n1','n2'])assert.equal(await classifyInteraction({tool:'browser_type',input:{ref,text:'12345'},pages:[p]}),'routine',ref);
});
