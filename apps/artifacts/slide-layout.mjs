// Deterministic, non-overlapping placement for one typed slide on the 16:9
// LAYOUT_WIDE page. Pure geometry: no PptxGenJS, I/O or rendering. Geometry is
// computed in integer EMUs (914400 per inch) so every frame, table grid and row
// sum stays exactly inside its cell after PptxGenJS converts inches back.
const EMU=914400,inch=emu=>emu/EMU,at=inches=>Math.round(inches*EMU);
const SLIDE={w:12192000,h:6858000};
const TITLE={x:at(.5),y:at(.3),w:SLIDE.w-at(1),h:at(.7)};
const CONTENT={x:at(.5),y:at(1.2),w:SLIDE.w-at(1),h:SLIDE.h-at(1.2)-at(.5)};
const GAP=at(.3),MAX_ROW=at(.45),TABLE_MARGIN_PT=2;
const ORDER=['bullets','table','chart','image'];

// Split an area into k equal parts along one axis, separated by GAP.
function split(area,k,axis){
  const size=axis==='x'?'w':'h',part=Math.floor((area[size]-(k-1)*GAP)/k);
  return Array.from({length:k},(_,i)=>({...area,[axis]:area[axis]+i*(part+GAP),[size]:part}));
}
// One cell per present element: 1 full, 2 side by side, 3 = full-height left
// column plus a right column of two rows, 4 = a 2x2 grid.
function cells(n){
  if(n===0)return [];
  if(n<=2)return split(CONTENT,n,'x');
  const [left,right]=split(CONTENT,2,'x');
  if(n===3)return [left,...split(right,2,'y')];
  return [...split(left,2,'y'),...split(right,2,'y')];
}
// Largest font (pt) whose estimated wrapped lines fit the box height; the
// estimate uses an average glyph width of 0.55em. Floor size when nothing fits.
function textSize(texts,box,{max,min,lineGap}){
  const widthPt=box.w/EMU*72,heightPt=box.h/EMU*72;
  for(let size=max;size>min;size--){
    const lines=texts.reduce((sum,text)=>sum+Math.max(1,Math.ceil(text.length*size*.55/widthPt)),0);
    if(lines*size*1.2+Math.max(0,texts.length-1)*lineGap(size)<=heightPt)return size;
  }
  return min;
}
const frame=box=>({x:inch(box.x),y:inch(box.y),w:inch(box.w),h:inch(box.h)});

export function layoutSlide(spec){
  const present=ORDER.filter(key=>key==='bullets'?spec.bullets?.length>0:spec[key]!==undefined),slots=cells(present.length),out={};
  out.title={...frame(TITLE),fontSize:textSize([spec.title],TITLE,{max:26,min:14,lineGap:()=>0})};
  for(const [index,key] of present.entries()){
    const cell=slots[index];
    if(key==='bullets'){const paraSpaceAfter=size=>Math.round(size*.4);const fontSize=textSize(spec.bullets,cell,{max:18,min:8,lineGap:paraSpaceAfter});out.bullets={...frame(cell),fontSize,paraSpaceAfter:paraSpaceAfter(fontSize)};}
    else if(key==='table'){
      const rows=spec.table.length,cols=spec.table[0].length,row=Math.min(MAX_ROW,Math.floor(cell.h/rows)),col=Math.floor(cell.w/cols);
      const fontSize=Math.max(6,Math.min(14,Math.floor((row/EMU*72-2*TABLE_MARGIN_PT)/1.2)));
      out.table={...frame({x:cell.x,y:cell.y,w:col*cols,h:row*rows}),colW:Array(cols).fill(inch(col)),rowH:Array(rows).fill(inch(row)),fontSize,margin:TABLE_MARGIN_PT};
    }else if(key==='chart')out.chart=frame(cell);
    else{
      // Contain without enlarging or cropping; centre in the cell, keeping the aspect ratio.
      const want={w:at(spec.image.widthInches),h:at(spec.image.heightInches)},scale=Math.min(1,cell.w/want.w,cell.h/want.h);
      const w=Math.floor(want.w*scale),h=Math.floor(want.h*scale);
      out.image=frame({x:cell.x+Math.floor((cell.w-w)/2),y:cell.y+Math.floor((cell.h-h)/2),w,h});
    }
  }
  return out;
}
