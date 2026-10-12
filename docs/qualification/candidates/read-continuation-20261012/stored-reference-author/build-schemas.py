"""Author schema construction; no external or private source reads."""
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[5]
S = {'type': 'string'}
B = {'type': 'boolean'}
N = {'type': ['string', 'null']}
I = {'type': 'integer', 'minimum': 0, 'maximum': 9007199254740991}
D = {'type': 'string', 'format': 'date-time', 'pattern': '^\\d{4}-'}
def obj(properties, required=None):
    return {'type': 'object', 'properties': properties, 'required': list(properties) if required is None else required, 'additionalProperties': False}
def arr(items, **kw):
    return {'type': 'array', 'items': items, **kw}
def ref(name):
    return {'$ref': '#/$defs/' + name}
def schema(name, defs):
    return {'$schema': 'https://json-schema.org/draft/2020-12/schema', '$id': 'urn:meri:retrieval:' + name + ':0.2.0', '$defs': defs}
stored = schema('stored-intelligence', {
    'StoredIntelligenceSearchInput': obj({'query': N, 'source': N, 'limit': {'type': 'integer', 'minimum': 1, 'maximum': 50, 'default': 20}}, []),
    'StoredIntelligenceArticle': obj({'id': S, 'source': S, 'title': dict(S, maxLength=240), 'url': S, 'author': N, 'publishedAt': D, 'summary': dict(S, maxLength=400), 'categories': arr(S), 'topics': arr(S)}),
    'StoredIntelligenceSearchOutput': obj({'tool': {'const': 'search_intel_articles'}, 'generatedAt': D, 'total': I, 'data': arr(ref('StoredIntelligenceArticle'), maxItems=50)}),
})
datasets = schema('dataset-metadata', {
    'DatasetMetadataListInput': obj({}),
    'DatasetMetadataField': obj({'name': S, 'type': {'enum': ['string', 'number', 'boolean', 'date', 'timestamp', 'string[]']}, 'description': S, 'filterable': B, 'groupable': B, 'aggregatable': B}),
    'DatasetMetadataSummary': obj({'key': S, 'description': S, 'supportsAsOf': B, 'fields': arr(ref('DatasetMetadataField'))}),
    'DatasetMetadataListOutput': obj({'tool': {'const': 'list_global_datasets'}, 'generatedAt': D, 'datasets': arr(ref('DatasetMetadataSummary'))}),
})
for name, value in [('stored-intelligence', stored), ('dataset-metadata', datasets)]:
    (ROOT / 'packages/contracts/retrieval-0.2' / (name + '.schema.json')).write_text(json.dumps(value, indent=2) + '\n')
