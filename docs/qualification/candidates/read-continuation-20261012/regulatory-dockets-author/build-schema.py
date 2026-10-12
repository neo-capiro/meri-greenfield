"""Build the owned closed docket wire projection; no private source import."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[5]
string={'type':'string'}
nullable_string={'type':['string','null']}
date={'type':'string','format':'date-time','pattern':r'^\d{4}-'}
nullable_date={**date,'type':['string','null']}
def closed(properties,required=None):
 return {'type':'object','properties':properties,'required':list(properties) if required is None else required,'additionalProperties':False}
fields={
 'id':string,'documentId':string,'agencyId':string,'docketId':nullable_string,
 'documentType':string,'title':string,'postedDate':nullable_date,
 'commentStartDate':nullable_date,'commentEndDate':nullable_date,'frDocNum':nullable_string,
 'subtype':nullable_string,'withdrawn':{'type':'boolean'},'lastModified':nullable_date,'syncedAt':date}
input_fields={
 'upcomingOnly':{'type':['boolean','null']},'limit':{'type':'integer','minimum':1,'maximum':50},
 'days':{'type':'integer','minimum':1,'maximum':365},'agencyId':nullable_string,'documentType':nullable_string}
output_fields={
 'tool':{'const':'query_regulatory_dockets'},'generatedAt':date,
 'total':{'type':'integer','minimum':0,'maximum':9007199254740991},
 'results':{'type':'array','maxItems':50,'items':{'$ref':'#/$defs/RegulatoryDocketRow'}},
 'windowDays':{'type':'integer','minimum':1,'maximum':365}}
schema={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:meri:retrieval:regulatory-dockets:0.2.0','$defs':{
 'RegulatoryDocketsQueryInput':closed(input_fields,[]),'RegulatoryDocketRow':closed(fields),
 'RegulatoryDocketsQueryOutput':closed(output_fields,['tool','generatedAt','total','results'])}}
(ROOT/'packages/contracts/retrieval-0.2/regulatory-dockets.schema.json').write_text(json.dumps(schema,indent=2)+'\n')
