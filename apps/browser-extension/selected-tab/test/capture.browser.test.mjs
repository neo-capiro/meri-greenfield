import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {captureRenderedText} from '../capture.mjs';
const {chromium}=await import(process.env.SELECTED_TAB_PLAYWRIGHT_MODULE??'playwright');
test('real rendered DOM capture excludes forms, editables, frames and hidden content; rejects overlarge pages',async()=>{
 const server=createServer((_request,response)=>{response.writeHead(200,{'content-type':'text/html; charset=utf-8'});response.end('<title>Fixture</title><body>Fixture</body>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/page?private=fixture#secret`);
  await page.setContent(`<title>Selected fixture</title><style>.concealed{display:none}</style><body>
   <h1>Visible heading</h1><p>Café 日本語</p><form>FORM SECRET<input value="INPUT SECRET"></form>
   <input type="password" value="PASSWORD SECRET"><textarea>TEXTAREA SECRET</textarea><select><option>OPTION SECRET</option></select>
   <div contenteditable>EDITABLE SECRET</div><div role="textbox">TEXTBOX SECRET</div>
   <div hidden>HIDDEN SECRET</div><div aria-hidden="true">ARIA SECRET</div><div class="concealed">STYLE SECRET</div>
   <div style="visibility:hidden">VISIBILITY SECRET</div><div style="opacity:0">OPACITY SECRET</div>
   <iframe srcdoc="<p>FRAME SECRET</p>"></iframe><script>/* SCRIPT SECRET */</script><div id="shadow"></div></body>`);
  await page.evaluate(()=>{document.getElementById('shadow').attachShadow({mode:'open'}).innerHTML='<p>SHADOW SECRET</p>';document.cookie='fixture=COOKIE_SECRET';});
  const result=await page.evaluate(captureRenderedText);
  assert.equal(result.text,'Visible heading\nCafé 日本語');assert.equal(result.title,'Selected fixture');
  assert.equal(result.url,`http://127.0.0.1:${server.address().port}/page`);assert.doesNotMatch(JSON.stringify(result),/SECRET|private=|#secret/u);
  await page.evaluate(()=>{document.body.textContent='x'.repeat(131073);});await assert.rejects(page.evaluate(captureRenderedText),/PAGE_LIMIT/u);
  await page.evaluate(()=>{document.body.textContent='';const fragment=document.createDocumentFragment();for(let i=0;i<20001;i++)fragment.append(document.createElement('span'));document.body.append(fragment);});
  await assert.rejects(page.evaluate(captureRenderedText),/PAGE_LIMIT/u);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
