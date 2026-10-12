"""Generate only the new closed pinned projection schema, with no source bodies."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[5]
def obj(properties,required=None):return {'type':'object','additionalProperties':False,'properties':properties,'required':list(properties) if required is None else required}
def ref(name):return {'$ref':'#/$defs/'+name}
def nullable(value):return {'anyOf':[value,{'type':'null'}]}
def array(value,**kw):return {'type':'array','items':value,**kw}
s={'type':'string'};ns=nullable(s);integer={'type':'integer','minimum':0,'maximum':9007199254740991}
uuid={'type':'string','pattern':'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'}
stamp={'type':'string','format':'date-time'}
shared={'id':ref('AcquisitionUuid'),'fullName':s,'service':ns,'organization':ns,'title':ns,'role':ns,'pePrimary':ns,'peSecondary':array(s),'emailDomain':ns,'publicProfileUrl':ns,'confidence':{'type':'number'},'status':s,'firstSeenAt':ref('AcquisitionInstant'),'lastSeenAt':ref('AcquisitionInstant')}
defs={
 'AcquisitionUuid':uuid,'AcquisitionInstant':stamp,
 'AcquisitionSearchContext':obj({'actorRole':{'enum':['capiro_admin','user_admin','standard_user','client_portal_user']}}),
 'AcquisitionDetailContext':obj({'actorRole':{'enum':['capiro_admin','user_admin','standard_user','client_portal_user']}}),
 'AcquisitionPersonnelSearchInput':obj({'query':ns,'q':ns,'service':s,'organization':s,'role':s,'peCode':s,'limit':{'type':'integer','minimum':1,'maximum':50,'default':20},'page':{'type':'integer','minimum':1,'maximum':100,'default':1}},[]),
 'AcquisitionPersonDetailInput':obj({'id':{'type':'string','minLength':1}}),
 'AcquisitionPersonnelRow':obj({**shared,'email':ns,'phone':ns,'parentOffice':ns,'department':ns,'headshotUrl':{},'sourceCount':integer}),
 'AcquisitionSourceMention':obj({'id':ref('AcquisitionUuid'),'source':s,'sourceUrl':ns,'snippet':ns,'observedAt':ref('AcquisitionInstant'),'confidence':{'type':'number'},'metadata':{}}),
 'AcquisitionPerson':obj({**shared,'nameKey':s,'programOfRecord':ns,'email':ns,'phone':ns,'parentOffice':ns,'department':ns,'metadata':{},'sources':array(ref('AcquisitionSourceMention'))}),
 'AcquisitionPersonnelSearchOutput':obj({'tool':{'const':'search_acquisition_personnel'},'generatedAt':ref('AcquisitionInstant'),'data':array(ref('AcquisitionPersonnelRow'),maxItems=50),'total':integer,'page':{'type':'integer','minimum':1,'maximum':100},'limit':{'type':'integer','minimum':1,'maximum':50}}),
 'AcquisitionPersonDetailOutput':obj({'tool':{'const':'get_acquisition_person'},'generatedAt':ref('AcquisitionInstant'),'person':ref('AcquisitionPerson')})
}
schema={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:meri:retrieval:acquisition-personnel:0.2.0','title':'Pinned acquisition personnel read projections; no live source or policy authority','$defs':defs}
(root/'packages/contracts/retrieval-0.2/acquisition-personnel.schema.json').write_text(json.dumps(schema,indent=2)+'\n')
