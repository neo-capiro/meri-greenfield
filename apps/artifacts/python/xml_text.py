"""Safe UTF-8 XML inspection; original bytes are never reserialized or fetched."""
import io


def validate_xml(raw):
    from lxml import etree
    raw.decode('utf-8', errors='strict')
    parser = etree.XMLParser(resolve_entities=False, load_dtd=False, no_network=True,
                             recover=False, huge_tree=False, collect_ids=False)
    document = etree.parse(io.BytesIO(raw), parser)
    if document.docinfo.doctype:
        raise ValueError('XML document types are not supported')
    if document.docinfo.encoding.upper() != 'UTF-8':
        raise ValueError('XML must declare UTF-8')
    if document.docinfo.xml_version != '1.0':
        raise ValueError('Only XML 1.0 is supported')
    depth = 0
    for event, _ in etree.iterwalk(document, events=('start', 'end')):
        depth += 1 if event == 'start' else -1
        if depth > 256:
            raise ValueError('XML nesting limit')
    return {'encoding': 'UTF-8', 'whitespace': 'unchanged', 'wellFormed': True}
