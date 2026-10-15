// DA-3 regression: every permitted slide element combination is placed without
// overlap inside the slide. Geometry is read back from the generated OOXML; this
// is package inspection, not native PowerPoint/LibreOffice rendering.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createLocalArtifactExecutor} from '../local-executor.mjs';

const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const pptxModulePath=process.env.MERI_PPTXGENJS??fileURLToPath(new URL('../../worker/qualification/node_modules/pptxgenjs',import.meta.url));
const JSZip=createRequire(pptxModulePath+'/package.json')('jszip');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNkcGhgYGBgYmBgYGBgAAAIqgDETgW9lQAAAABJRU5ErkJggg==','base64');
const EMU=914400;

async function generate(slides,assets=[]){
  const root=await mkdtemp(join(tmpdir(),'meri-slide-layout-'));
  try{
    const executor=createLocalArtifactExecutor({pythonExecutable:python,nodeExecutable:process.execPath,pptxModulePath,tempRoot:root,timeoutMs:60000});
    const result=await executor.execute({request:{operation:'create_powerpoint',format:'pptx',title:'Layout',content:{slides}},assets,base:null,deadlineMs:Date.now()+60000,maxBytes:8388608});
    assert.deepEqual(await readdir(root),[]);return JSZip.loadAsync(result.bytes);
  }finally{await rm(root,{recursive:true,force:true});}
}
const attr=(xml,name)=>{const m=xml.match(new RegExp(`\\b${name}="(-?\\d+)"`));assert.ok(m,`missing ${name}`);return Number(m[1]);};
// Every drawable on the slide: text shapes, graphic frames (tables/charts) and pictures.
function shapes(xml){
  const out=[];
  for(const m of xml.matchAll(/<(p:sp|p:graphicFrame|p:pic)>([\s\S]*?)<\/\1>/g)){
    const body=m[2],off=body.match(/<a:off [^>]*\/>/)[0],ext=body.match(/<a:ext [^>]*\/>/)[0];
    const kind=m[1]==='p:pic'?'image':m[1]==='p:sp'?'text':/<a:tbl>/.test(body)?'table':/<c:chart /.test(body)?'chart':'other';
    const box={kind,x:attr(off,'x'),y:attr(off,'y'),w:attr(ext,'cx'),h:attr(ext,'cy'),body};
    if(kind==='table'){box.gridW=[...body.matchAll(/<a:gridCol w="(\d+)"/g)].reduce((s,g)=>s+Number(g[1]),0);box.rowsH=[...body.matchAll(/<a:tr h="(\d+)"/g)].reduce((s,g)=>s+Number(g[1]),0);}
    out.push(box);
  }
  return out;
}
const overlaps=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
async function assertLayout(zip,specs){
  const size=(await zip.file('ppt/presentation.xml').async('string')).match(/<p:sldSz [^>]*\/>/)[0],W=attr(size,'cx'),H=attr(size,'cy');
  const all=[];
  for(const [index,spec] of specs.entries()){
    const placed=shapes(await zip.file(`ppt/slides/slide${index+1}.xml`).async('string')),label=`slide ${index+1} (${spec.title})`;
    const expected=['text',...(spec.bullets?.length?['text']:[]),...(spec.table?['table']:[]),...(spec.chart?['chart']:[]),...(spec.image?['image']:[])].sort();
    assert.deepEqual(placed.map(s=>s.kind).sort(),expected,`${label}: every element is drawn exactly once`);
    for(const s of placed){
      assert.ok(s.w>0&&s.h>0,`${label}: ${s.kind} has area`);
      assert.ok(s.x>=0&&s.y>=0&&s.x+s.w<=W&&s.y+s.h<=H,`${label}: ${s.kind} (${s.x},${s.y},${s.w},${s.h}) inside slide ${W}x${H}`);
      if(s.kind==='table'){assert.ok(s.gridW<=s.w+1,`${label}: table columns fit their frame`);assert.ok(s.rowsH<=s.h+1,`${label}: table rows fit their frame`);}
      if(s.kind==='image'){
        assert.doesNotMatch(s.body,/<a:srcRect [^>]*[lrtb]="[1-9]/,`${label}: image is not cropped`);
        const ratio=spec.image.widthInches/spec.image.heightInches;assert.ok(Math.abs(s.w/s.h-ratio)/ratio<0.01,`${label}: image keeps its aspect ratio`);
        assert.ok(s.w<=spec.image.widthInches*EMU+1&&s.h<=spec.image.heightInches*EMU+1,`${label}: image is never enlarged`);
      }
    }
    for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++)assert.equal(overlaps(placed[i],placed[j]),false,`${label}: ${placed[i].kind} overlaps ${placed[j].kind}`);
    all.push(placed.map(({kind,x,y,w,h})=>({kind,x,y,w,h})));
  }
  return all;
}

const chart={kind:'bar',title:'Totals',categories:['A','B','C'],series:[{name:'Value',values:[2,3,4]}]};
const table=[['Name','Value'],['A','2'],['B','3']];
const image={kind:'image',assetId:'logo',widthInches:4,heightInches:3};
const parts={bullets:['First point','Second point'],table,chart,image};
// All 16 subsets of the four placeable elements; title (and notes) are always permitted.
const combinations=Array.from({length:16},(_,mask)=>{
  const keys=Object.keys(parts).filter((_,bit)=>mask&(1<<bit)),slide={title:keys.length?keys.join(' + '):'title only'};
  for(const key of keys)slide[key]=parts[key];if(mask%3===0)slide.notes='Speaker notes';return slide;
});

test('every permitted element combination is laid out without overlap, in bounds and deterministically',async()=>{
  const first=await assertLayout(await generate(combinations,[{id:'logo',bytes:png}]),combinations);
  const second=await assertLayout(await generate(combinations,[{id:'logo',bytes:png}]),combinations);
  assert.deepEqual(second,first,'identical requests produce identical geometry');
});

test('dense, long and extreme-size content stays separated and inside the slide',async()=>{
  const long='x'.repeat(400);
  const dense=[
    {title:'T'.repeat(200),bullets:Array.from({length:30},(_,i)=>`Bullet ${i} ${long}`),table:Array.from({length:30},(_,r)=>Array.from({length:12},(_,c)=>`r${r}c${c}`)),chart:{kind:'line',title:'C'.repeat(200),categories:Array.from({length:100},(_,i)=>'k'+i),series:Array.from({length:10},(_,s)=>({name:'S'+s,values:Array.from({length:100},(_,i)=>i*s)}))},image:{kind:'image',assetId:'logo',widthInches:12,heightInches:12}},
    {title:'Wide image and table',table:[['only']],image:{kind:'image',assetId:'logo',widthInches:12,heightInches:0.5}},
    {title:'Tall image and chart',chart,image:{kind:'image',assetId:'logo',widthInches:0.5,heightInches:12}},
    {title:'Tall image alone',image:{kind:'image',assetId:'logo',widthInches:2,heightInches:12}},
    {title:'Empty bullets with table',bullets:[],table},
  ];
  await assertLayout(await generate(dense,[{id:'logo',bytes:png}]),dense);
});
