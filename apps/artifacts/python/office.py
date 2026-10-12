"""Original data-only Office builders over adopted upstream libraries."""
import io

def word(spec,assets,path):
    from docx import Document
    from docx.shared import Inches
    document=Document()
    for block in spec['blocks']:
        if block['kind']=='paragraph':
            p=document.add_paragraph(style=block.get('style','Normal'))
            for item in block['runs']:
                r=p.add_run(item['text']);r.bold=item.get('bold',False);r.italic=item.get('italic',False)
        elif block['kind']=='table':
            table=document.add_table(rows=len(block['rows']),cols=len(block['rows'][0]));table.style='Table Grid'
            for row,values in zip(table.rows,block['rows']):
                for cell,value in zip(row.cells,values):cell.text=value
        elif block['kind']=='image':document.add_picture(io.BytesIO(assets[block['assetId']]),width=Inches(block['widthInches']),height=Inches(block['heightInches']))
        elif block['kind']=='chart':
            document.add_picture(io.BytesIO(chart_png(block['chart'])),width=Inches(6))
        else:raise ValueError('Unsupported Word block')
    document.save(path)
    # Reopening checks package readability, not Office rendering or visual quality.
    opened=Document(path)
    return {'paragraphs':len(opened.paragraphs),'tables':len(opened.tables),'pictures':len(opened.inline_shapes)}

def chart_png(chart):
    import matplotlib
    matplotlib.use('Agg')
    from matplotlib import pyplot as plt
    fig,ax=plt.subplots(figsize=(8,4))
    try:
        for series in chart['series']:
            if chart['kind']=='line':ax.plot(chart['categories'],series['values'],label=series['name'])
            else:ax.bar(chart['categories'],series['values'],label=series['name'],alpha=.7)
        ax.set_title(chart['title']);ax.legend();fig.tight_layout();out=io.BytesIO();fig.savefig(out,format='png',dpi=100);return out.getvalue()
    finally:plt.close(fig)

def excel(spec,assets,path):
    import xlsxwriter,openpyxl
    with xlsxwriter.Workbook(path,{'strings_to_urls':False,'strings_to_formulas':False,'strings_to_numbers':False}) as book:
        for sheet in spec['sheets']:
            page=book.add_worksheet(sheet['name'])
            for y,row in enumerate(sheet['rows']):
                for x,cell in enumerate(row):
                    fmt=book.add_format({'num_format':cell['numberFormat']}) if cell.get('numberFormat') else None
                    if 'formula' in cell:page.write_formula(y,x,cell['formula'],fmt,0)
                    elif isinstance(cell.get('value'),str):page.write_string(y,x,cell['value'],fmt)
                    elif cell.get('value') is not None:page.write(y,x,cell['value'],fmt)
            chart_row=len(sheet['rows'])+2
            for chart in sheet.get('charts',[]):
                output=book.add_chart({'type':'column' if chart['kind']=='bar' else 'line'});output.set_title({'name':chart['title']})
                for i,cat in enumerate(chart['categories']):page.write_string(chart_row+i,0,cat)
                for j,series in enumerate(chart['series']):
                    for i,val in enumerate(series['values']):page.write_number(chart_row+i,j+1,val)
                    output.add_series({'name':series['name'],'categories':[sheet['name'],chart_row,0,chart_row+len(chart['categories'])-1,0],'values':[sheet['name'],chart_row,j+1,chart_row+len(chart['categories'])-1,j+1]})
                page.insert_chart(chart_row,12,output);chart_row+=max(len(chart['categories'])+2,16)
            for i,image in enumerate(sheet.get('images',[])):
                page.insert_image(i*15,26,'image.png',{'image_data':io.BytesIO(assets[image['assetId']]),'x_scale':1,'y_scale':1})
    book=openpyxl.load_workbook(path,read_only=True,data_only=False)
    try:return {'sheets':book.sheetnames,'formulas':sum(1 for page in book for row in page for cell in row if cell.data_type=='f'),'formulaCache':'unverified-zero-placeholder; recalculation required'}
    finally:book.close()
