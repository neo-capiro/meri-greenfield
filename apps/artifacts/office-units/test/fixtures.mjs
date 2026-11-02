/** Synthetic retained packages that carry a manual edit beside the units Meri may touch: the tests assert that
 * every untouched part and every untouched span survives an applied proposal byte for byte. */
import {ooxmlEntries,zip,relationshipsXml} from '../../structure/test/fixtures.mjs';
const XML='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
export const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
/** Three body paragraphs (styled heading, a manually edited body paragraph with a tab, a hyperlink paragraph the editor
 * must leave alone), one table cell paragraph, a bookmark, a section-ending paragraph and a paragraph split by a manual
 * page break; plus retained styles and settings. */
export function docxEntries(){
 const e=ooxmlEntries('docx',{mainXml:`<w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>`+
  `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Quarterly report — Ω</w:t></w:r></w:p>`+
  `<w:p><w:r><w:t xml:space="preserve">Manual edit: </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>revenue</w:t></w:r><w:r><w:tab/><w:t>grew &amp; held</w:t></w:r></w:p>`+
  `<w:p><w:hyperlink r:id="link1"><w:r><w:t>See the site</w:t></w:r></w:hyperlink></w:p>`+
  `<w:tbl><w:tr><w:tc><w:p><w:bookmarkStart w:id="0" w:name="cell"/><w:r><w:t>Cell text</w:t></w:r><w:bookmarkEnd w:id="0"/></w:p></w:tc></w:tr></w:tbl>`+
  `<w:p><w:pPr><w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:pPr><w:r><w:t>Section paragraph</w:t></w:r></w:p>`+
  `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Page one</w:t></w:r><w:r><w:br w:type="page"/></w:r><w:r><w:t>Page two</w:t></w:r></w:p>`+
  `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>`});
 e['word/_rels/document.xml.rels']=relationshipsXml('<Relationship Id="link1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.test/" TargetMode="External"/><Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>');
 e['word/styles.xml']=`${XML}<w:styles xmlns:w="${W}"><w:style w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`;
 e['word/settings.xml']=`${XML}<w:settings xmlns:w="${W}"><w:zoom w:percent="110"/></w:settings>`;
 e['[Content_Types].xml']=e['[Content_Types].xml'].replace('</Types>','<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>');
 return e;
}
export const docx=()=>zip(docxEntries());
const S='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
/** Two sheets: Data (a shared-string label, a manually typed number, a formula with its cache, a styled empty cell)
 * and Notes (an inline string); shared strings and styles retained. `workbookTail` follows the sheet list, so a test
 * can place an existing `calcPr` or later workbook children there. */
export function xlsxEntries(workbookTail=''){
 const e=ooxmlEntries('xlsx',{mainXml:`<workbook xmlns="${S}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/><sheet name="Notes" sheetId="2" r:id="rId2"/></sheets>${workbookTail}</workbook>`});
 e['xl/_rels/workbook.xml.rels']=relationshipsXml('<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>');
 e['xl/worksheets/sheet1.xml']=`${XML}<worksheet xmlns="${S}"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" s="1"><v>1250.5</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>7</v></c><c r="C2" s="1"><f>B1*B2</f><v>8753.5</v></c><c r="D2" s="2"/></row></sheetData></worksheet>`;
 e['xl/worksheets/sheet2.xml']=`${XML}<worksheet xmlns="${S}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Manual note — keep</t></is></c></row></sheetData></worksheet>`;
 e['xl/sharedStrings.xml']=`${XML}<sst xmlns="${S}" count="2" uniqueCount="2"><si><t>Revenue</t></si><si><r><t>Units </t></r><r><rPr><b/></rPr><t>sold</t></r></si></sst>`;
 e['xl/styles.xml']=`${XML}<styleSheet xmlns="${S}"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/></numFmts></styleSheet>`;
 e['[Content_Types].xml']=e['[Content_Types].xml'].replace('</Types>','<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
 return e;
}
export const xlsx=()=>zip(xlsxEntries());
const P='http://schemas.openxmlformats.org/presentationml/2006/main',A='http://schemas.openxmlformats.org/drawingml/2006/main';
/** Two slides: a title shape plus a two-paragraph body shape with a manual bold run, and a slide-number field shape;
 * slide 2 holds a closing shape, a picture-only shape, a callout kept in both branches of `mc:AlternateContent`, a
 * fallback-only shape that mirrors a non-text Choice, and a notes part that must be left alone. */
export function pptxEntries(){
 const e=ooxmlEntries('pptx',{mainXml:`<p:presentation xmlns:p="${P}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`});
 e['ppt/_rels/presentation.xml.rels']=relationshipsXml('<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>');
 const sp=(id,name,body)=>`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody>${body}</p:txBody></p:sp>`;
 e['ppt/slides/slide1.xml']=`${XML}<p:sld xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree>`+
  sp(2,'Title','<a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" b="1"/><a:t>Agenda</a:t></a:r></a:p>')+
  sp(3,'Body','<a:bodyPr/><a:p><a:pPr lvl="0"/><a:r><a:rPr lang="en-US"/><a:t>First point</a:t></a:r></a:p><a:p><a:r><a:rPr lang="en-US" b="1"/><a:t>Manual </a:t></a:r><a:r><a:rPr lang="en-US"/><a:t>second point</a:t></a:r></a:p>')+
  sp(4,'Number','<a:bodyPr/><a:p><a:fld id="{B6F3}" type="slidenum"><a:rPr lang="en-US"/><a:t>1</a:t></a:fld></a:p>')+
  `</p:spTree></p:cSld></p:sld>`;
 const callout=sp(6,'Callout','<a:bodyPr/><a:p><a:r><a:rPr lang="en-US"/><a:t>Call us</a:t></a:r></a:p>');
 e['ppt/slides/slide2.xml']=`${XML}<p:sld xmlns:p="${P}" xmlns:a="${A}" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><p:cSld><p:spTree>`+sp(2,'Closing','<a:bodyPr/><a:p><a:r><a:rPr lang="en-US"/><a:t>Thank you</a:t></a:r></a:p>')+`<p:pic><p:nvPicPr><p:cNvPr id="5" name="Logo"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:spPr/></p:pic>`+
  `<mc:AlternateContent><mc:Choice Requires="a">${callout}</mc:Choice><mc:Fallback>${callout}</mc:Fallback></mc:AlternateContent>`+
  `<mc:AlternateContent><mc:Choice Requires="a"><p:pic><p:nvPicPr><p:cNvPr id="7" name="Diagram"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:spPr/></p:pic></mc:Choice><mc:Fallback>${sp(7,'Diagram','<a:bodyPr/><a:p><a:r><a:rPr lang="en-US"/><a:t>Diagram text</a:t></a:r></a:p>')}</mc:Fallback></mc:AlternateContent>`+
  `</p:spTree></p:cSld></p:sld>`;
 e['ppt/notesSlides/notesSlide1.xml']=`${XML}<p:notes xmlns:p="${P}"><p:cSld name="Retained speaker notes"/></p:notes>`;
 e['[Content_Types].xml']=e['[Content_Types].xml'].replace('</Types>','<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/notesSlides/notesSlide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/></Types>');
 return e;
}
export const pptx=()=>zip(pptxEntries());
export const retained=Object.freeze({docx,xlsx,pptx});
