// Fixed PptxGenJS entry; this file's import does not generate or spawn work.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {layoutSlide} from './slide-layout.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Internal fixed entry: local-executor verifies the exact PNG bytes through
// the shared Pillow adapter before invoking this generator. Not a public API.
async function generatePresentation({request,assets,maxBytes},modulePath){
  const require=createRequire(import.meta.url),packageData=JSON.parse(await readFile(new URL('package.json',pathToFileURL(modulePath.endsWith('/')?modulePath:modulePath+'/')),'utf8'));
  if(packageData.name!=='pptxgenjs'||packageData.version!=='4.0.1')throw new Error('PptxGenJS version mismatch');
  const PptxGenJS=require(modulePath),pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.title=request.title;pptx.subject='Meri immutable generated artifact';pptx.author='Meri';
  const pictures=new Map(assets.map(asset=>{const bytes=Buffer.from(asset.base64,'base64');if(bytes.length>2097152||!bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))throw new Error('PNG asset required');return [asset.id,'image/png;base64,'+asset.base64];}));
  for(const spec of request.content.slides){
    // Each present element gets its own cell from the fixed layout; frames never overlap.
    const slide=pptx.addSlide(),layout=layoutSlide(spec),{title,bullets,table,chart,image}=layout;
    slide.addText(spec.title,{x:title.x,y:title.y,w:title.w,h:title.h,fontSize:title.fontSize,bold:true,breakLine:false,valign:'top',fit:'shrink'});
    if(bullets)slide.addText(spec.bullets.map(text=>({text,options:{bullet:true,breakLine:true}})),{x:bullets.x,y:bullets.y,w:bullets.w,h:bullets.h,fontSize:bullets.fontSize,paraSpaceAfterPt:bullets.paraSpaceAfter,valign:'top',fit:'shrink'});
    if(table)slide.addTable(spec.table,{x:table.x,y:table.y,w:table.w,h:table.h,colW:table.colW,rowH:table.rowH,margin:table.margin,autoPage:false,border:{type:'solid',pt:1,color:'888888'},fontSize:table.fontSize});
    if(chart)slide.addChart(spec.chart.kind==='bar'?pptx.ChartType.bar:pptx.ChartType.line,spec.chart.series.map(s=>({name:s.name,labels:spec.chart.categories,values:s.values})),{x:chart.x,y:chart.y,w:chart.w,h:chart.h,showTitle:true,title:spec.chart.title,showLegend:true});
    if(image){const data=pictures.get(spec.image.assetId);if(!data)throw new Error('Missing asset');slide.addImage({data,x:image.x,y:image.y,w:image.w,h:image.h});}
    if(spec.notes)slide.addNotes(spec.notes);
  }
  const bytes=Buffer.from(await pptx.write({outputType:'nodebuffer',compression:true}));if(bytes.length>maxBytes)throw new Error('Output limit');
  await writeFile('artifact.pptx',bytes,{flag:'wx',mode:0o600});
  return {sha256:sha(bytes),bytes:bytes.length,format:'pptx',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{slides:request.content.slides.length,editable:true,visualInspection:'pending'}};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  if(process.argv[2]==='--help'){process.stdout.write('Fixed typed presentation entry: trusted package path argument; JSON stdin; artifact.pptx. Exit0 success,2 failure.\n');}
  else try{
    if(process.argv.length!==3)throw new Error('Trusted module path required');
    const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>16777216)throw new Error('Input limit');chunks.push(chunk);}
    const result=await generatePresentation(JSON.parse(Buffer.concat(chunks)),process.argv[2]);process.stdout.write(JSON.stringify(result)+'\n');
  }catch{process.stderr.write('{"error":"ARTIFACT_GENERATION_FAILED"}\n');process.exitCode=2;}
}
