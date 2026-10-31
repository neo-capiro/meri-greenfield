/** Synthetic application byte-preservation cases, not an engine fidelity corpus. */
import {ooxmlEntries,zip,relationshipsXml} from '../../structure/test/fixtures.mjs';
import {chart} from './embedded-chart-fixture.mjs';
export function preservationBytes(format,value='before'){
 if(format==='docx'){
  const e=ooxmlEntries('docx',{mainXml:`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${value} — Ω</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p/></w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>`});
  e['word/styles.xml']='<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:styleId="Retained"/></w:styles>';
  return zip(e);
 }
 const book=number=>{
  const e=ooxmlEntries('xlsx',{mainXml:'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Data" sheetId="1"/></sheets></workbook>'});
  e['xl/worksheets/sheet1.xml']=`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="2"><c r="B2"><v>${number}</v></c><c r="C2" s="1"><f>B2*2</f><v>${number*2}</v></c></row></sheetData></worksheet>`;
  e['xl/styles.xml']='<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/></numFmts></styleSheet>';
  e['xl/_rels/workbook.xml.rels']=relationshipsXml('<Relationship Id="sheet" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>');
  return e;
 };
 const first=value==='before'?4:9,second=value==='before'?5:11;
 if(format==='xlsx')return zip(book(first));
 const e=chart(book(first));
 e['ppt/charts/chart2.xml']=e['ppt/charts/chart1.xml'];
 e['ppt/charts/_rels/chart2.xml.rels']=e['ppt/charts/_rels/chart1.xml.rels'].replace('data.xlsx','data2.xlsx');
 e['ppt/embeddings/data2.xlsx']=zip(book(second));
 e['[Content_Types].xml']=e['[Content_Types].xml'].replace('</Types>','<Override PartName="/ppt/charts/chart2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>');
 e['ppt/notesSlides/notesSlide1.xml']='<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="Retained speaker notes"/></p:notes>';
 return zip(e);
}
