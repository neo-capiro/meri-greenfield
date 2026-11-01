"""Pinned local USLM 2.1.0 schema validation. Schema validity is not legal validity."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from lxml import etree

ROOT = Path(__file__).resolve().parent
MANIFEST_SHA256 = 'c68c058345f99689144c183c99d47552f3d56aa365ff1380127a9180fe18ce44'
PIN = '100338992150c276aae5544d01d9b821a27eb383'
PROFILE = 'uslm-2.1.0'
NAMESPACE = 'http://schemas.gpo.gov/xml/uslm'
MAX_BYTES = 128 * 1024
BASE = 'https://pinned.invalid/uslm/'
SENATE_ALIAS = 'https://www.senate.gov/schemas/uslm-meta-senate.xsd'
XSD_NAMES = frozenset(('uslm-2.1.0.xsd', 'xml.xsd', 'dc.xsd', 'uslm-table-module-2.1.0.xsd',
    'mathml3.xsd', 'mathml3-content.xsd', 'mathml3-presentation.xsd', 'mathml3-common.xsd',
    'mathml3-strict-content.xsd', 'uslm-meta-senate.xsd', 'uslm-components-2.1.0.xsd',
    'xhtml-datatypes-1.xsd'))


class ValidationFailure(ValueError):
    def __init__(self, code: str, detail: str = ''):
        self.code = code
        super().__init__(code + (': ' + detail[:500] if detail else ''))


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def pinned_assets(root: Path) -> dict[str, bytes]:
    """Authenticate the canonical asset manifest, then snapshot exact pinned bytes."""
    with (root / 'manifest.json').open('rb') as source:
        manifest_raw = source.read(16 * 1024)
    if digest(manifest_raw) != MANIFEST_SHA256:
        raise ValidationFailure('MANIFEST_HASH_MISMATCH')
    manifest = json.loads(manifest_raw)
    if manifest['commit'] != PIN:
        raise ValidationFailure('MANIFEST_PIN_MISMATCH')
    entries = manifest['assets']
    expected = XSD_NAMES | {'LICENSE.md'}
    if len(entries) != len(expected) or {entry['path'] for entry in entries} != expected:
        raise ValidationFailure('MANIFEST_ASSET_SET_MISMATCH')
    assets = {}
    for entry in entries:
        with (root / entry['path']).open('rb') as source:
            raw = source.read(entry['bytes'] + 1)
        if len(raw) != entry['bytes'] or digest(raw) != entry['sha256']:
            raise ValidationFailure('ASSET_HASH_OR_LENGTH_MISMATCH', entry['path'])
        blob = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
        if blob != entry['gitBlob']:
            raise ValidationFailure('ASSET_GIT_BLOB_MISMATCH', entry['path'])
        assets[entry['path']] = raw
    return assets


class PinnedResolver(etree.Resolver):
    def __init__(self, assets: dict[str, bytes]):
        self.assets = {BASE + name: assets[name] for name in XSD_NAMES}
        self.assets[SENATE_ALIAS] = assets['uslm-meta-senate.xsd']
        self.requests: list[str] = []

    def resolve(self, url, public_id, context):
        self.requests.append(url)
        if public_id or url not in self.assets:
            raise ValidationFailure('UNPINNED_SCHEMA_REFERENCE', url)
        # Resolve from already verified memory, never reopen files or delegate to libxml.
        return self.resolve_string(self.assets[url], context, base_url=url)


class DenyResolver(etree.Resolver):
    def __init__(self):
        self.requests: list[str] = []

    def resolve(self, url, public_id, context):
        self.requests.append(url)
        raise ValidationFailure('DOCUMENT_EXTERNAL_REFERENCE', url)


def parser(resolver):
    result = etree.XMLParser(resolve_entities=False, load_dtd=False, no_network=True,
                             huge_tree=False, recover=False, remove_blank_text=False)
    result.resolvers.add(resolver)
    return result


class PinnedValidator:
    """One offline compiled closure; instantiate per bounded worker (not shared threads)."""
    def __init__(self, root: Path = ROOT):
        self.assets = pinned_assets(root)
        self.resolver = PinnedResolver(self.assets)
        schema_doc = etree.fromstring(self.assets['uslm-2.1.0.xsd'],
            parser(self.resolver), base_url=BASE + 'uslm-2.1.0.xsd')
        self.schema = etree.XMLSchema(schema_doc)

    def validate(self, raw: bytes, profile: str = PROFILE) -> dict:
        if profile != PROFILE:
            raise ValidationFailure('UNSUPPORTED_PROFILE')
        if not isinstance(raw, bytes) or not 0 < len(raw) <= MAX_BYTES:
            raise ValidationFailure('INPUT_BYTE_BOUND')
        try:
            text = raw.decode('utf-8', errors='strict')
        except UnicodeDecodeError as error:
            raise ValidationFailure('INVALID_UTF8') from error
        if '\x00' in text:
            raise ValidationFailure('INVALID_XML_ENCODING')
        declaration = re.match(r'^\ufeff?<\?xml\s+[^?]*\?>', text)
        if declaration:
            encoding = re.search(r'\bencoding\s*=\s*[\"\x27]([^\"\x27]+)', declaration[0])
            if encoding and encoding[1].lower() != 'utf-8':
                raise ValidationFailure('UNSUPPORTED_ENCODING')
        # Deliberately conservative policy rejects declaration tokens even in comments.
        if '<!DOCTYPE' in text or '<!ENTITY' in text:
            raise ValidationFailure('DTD_OR_ENTITY_FORBIDDEN')
        deny = DenyResolver()
        try:
            doc = etree.fromstring(raw, parser(deny))
        except etree.XMLSyntaxError as error:
            raise ValidationFailure('MALFORMED_XML', str(error)) from error
        if doc.getroottree().docinfo.doctype or any(isinstance(node, etree._Entity) for node in doc.iter()):
            raise ValidationFailure('DTD_OR_ENTITY_FORBIDDEN')
        if doc.tag not in {f'{{{NAMESPACE}}}bill', f'{{{NAMESPACE}}}resolution'}:
            raise ValidationFailure('UNSUPPORTED_ROOT_NAMESPACE_OR_PROFILE')
        # xsi:schemaLocation is data only, never a resolver or schema selection authority.
        if not self.schema.validate(doc):
            raise ValidationFailure('SCHEMA_INVALID', str(self.schema.error_log.last_error))
        return {'profile': PROFILE, 'schemaSha256': MANIFEST_SHA256,
                'sourceSha256': digest(raw), 'bytes': len(raw), 'valid': True}


def strict_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValidationFailure('INVALID_REQUEST')
        result[key] = value
    return result


def validate_request(payload: bytes) -> dict:
    """No caller supplied path, URL, namespace, schema or profile selects authority."""
    if len(payload) > MAX_BYTES * 6 + 512:
        raise ValidationFailure('INPUT_BYTE_BOUND')
    try:
        request = json.loads(payload.decode('utf-8', errors='strict'), object_pairs_hook=strict_object)
    except (ValueError, UnicodeError) as error:
        raise ValidationFailure('INVALID_REQUEST') from error
    if (not isinstance(request, dict) or set(request) != {'text', 'sha256'}
            or not isinstance(request['text'], str) or not isinstance(request['sha256'], str)
            or not re.fullmatch(r'[0-9a-f]{64}', request['sha256'])):
        raise ValidationFailure('INVALID_REQUEST')
    try:
        raw = request['text'].encode('utf-8', errors='strict')
    except UnicodeError as error:
        raise ValidationFailure('INVALID_UTF8_SCALARS') from error
    if digest(raw) != request['sha256']:
        raise ValidationFailure('SOURCE_HASH_MISMATCH')
    if not 0 < len(raw) <= MAX_BYTES:
        raise ValidationFailure('INPUT_BYTE_BOUND')
    return PinnedValidator().validate(raw)


def main() -> int:
    import sys
    if sys.argv[1:] == ['--help']:
        print('Validate pinned USLM 2.1.0 bill/resolution. JSON stdin: {text,sha256}. '
              'JSON stdout receipt on success (exit 0), content-free {valid:false,code} on refusal (exit 1). '
              'No caller paths or URLs. UTF-8 source limit 128 KiB.')
        return 0
    try:
        if sys.argv[1:]:
            raise ValidationFailure('INVALID_REQUEST')
        payload = sys.stdin.buffer.read(MAX_BYTES * 6 + 513)
        result = validate_request(payload)
    except ValidationFailure as error:
        result = {'valid': False, 'code': error.code}
    except Exception:
        # Do not expose source content, filesystem details or parser diagnostics.
        result = {'valid': False, 'code': 'VALIDATOR_FAILURE'}
    print(json.dumps(result, separators=(',', ':')))
    return 0 if result['valid'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
