"""Author-owned private report wire DTOs derived from pinned projections."""
from pathlib import Path
import json
D={}
s={'type':'string'}
def null(t):return {'anyOf':[t,{'type':'null'}]}
def ref(n):return {'$ref':'#/$defs/'+n}
def obj(p,optional=()):return {'type':'object','additionalProperties':False,'properties':p,'required':[k for k in p if k not in optional]}
def array(t,max=None):return {'type':'array','items':t,**({} if max is None else {'maxItems':max})}
count={'type':'integer','minimum':0,'maximum':9007199254740991}
int32={'type':'integer','minimum':-2147483648,'maximum':2147483647}
D['PublicReportInstant']={'type':'string','format':'date-time'}
D['PublicReportDate']=ref('PublicReportInstant')
D['CboCostEstimateSearchInput']=obj({'billId':s,'query':s,'congress':int32,'limit':{'type':'integer','minimum':1,'maximum':25,'default':10}},['billId','query','congress','limit'])
D['GaoReportSearchInput']=obj({'query':s,'reportType':s,'limit':{'type':'integer','minimum':1,'maximum':50,'default':20}},['query','reportType','limit'])
D['CrsReportSearchInput']=obj({'query':s,'limit':{'type':'integer','minimum':1,'maximum':50,'default':20}},['query','limit'])
D['CboCostEstimate']=obj({'id':s,'billId':null(s),'congress':int32,'billType':s,'billNumber':s,'title':s,'description':null(s),'pubDate':ref('PublicReportInstant'),'cboUrl':s})
D['GaoReportExcerpt']=obj({'id':s,'title':s,'url':null(s),'publishDate':null(ref('PublicReportDate')),'reportType':null(s),'topics':array(s),'agencies':array(s),'summary':s,'recommendations':null(int32)})
D['CrsReportExcerpt']=obj({'id':s,'title':s,'date':null(ref('PublicReportDate')),'authors':array(s),'topics':array(s),'summary':s,'pdfUrl':null(s),'htmlUrl':null(s)})
D['CboCostEstimateSearchOutput']=obj({'tool':{'const':'search_cbo_cost_estimates'},'generatedAt':ref('PublicReportInstant'),'estimatesFound':count,'estimates':array(ref('CboCostEstimate'),25),'note':s},['note'])
D['GaoReportSearchOutput']=obj({'tool':{'const':'search_gao_reports'},'generatedAt':ref('PublicReportInstant'),'total':count,'data':array(ref('GaoReportExcerpt'),50)})
D['CrsReportSearchOutput']=obj({'tool':{'const':'search_crs_reports'},'generatedAt':ref('PublicReportInstant'),'total':count,'data':array(ref('CrsReportExcerpt'),50)})
Path('packages/contracts/retrieval-0.2/public-reports.schema.json').write_text(json.dumps({'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:meri:retrieval:public-reports:0.2.0','title':'Private unavailable stored-public-report search projections','$defs':D},indent=2)+'\n')
