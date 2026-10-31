import {ooxmlEntries,zip,relationshipsXml} from '../../structure/test/fixtures.mjs';
const packageType='http://schemas.openxmlformats.org/officeDocument/2006/relationships/package';
export function chart(workbook=ooxmlEntries('xlsx')){
 const entries=ooxmlEntries('pptx');
 entries['[Content_Types].xml']=entries['[Content_Types].xml'].replace('</Types>','<Default Extension="xlsx" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/></Types>');
 entries['ppt/charts/chart1.xml']='<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/>';
 entries['ppt/charts/_rels/chart1.xml.rels']=relationshipsXml('<Relationship Id="rId1" Type="'+packageType+'" Target="../embeddings/data.xlsx"/>');
 entries['ppt/embeddings/']='';entries['ppt/embeddings/data.xlsx']=zip(workbook);
 return entries;
}
