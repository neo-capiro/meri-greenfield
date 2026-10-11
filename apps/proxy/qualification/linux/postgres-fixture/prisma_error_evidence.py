"""Pure Prisma diagnostic DATA for the fixed TLS fixture.

Typed exceptions and one complete native startup KnownError are distinct
representations. Neither authenticates origin. Exception decoding reads only
explicit causes, ordinary DataError data and buffered HTTP bytes; native
decoding reads only caller-supplied complete bytes and trusted synthetic scope.
"""
import json
import math
import types

__all__ = ('classify_exception', 'classify_native_output')
CASES = frozenset(('positive', 'wrong-ca', 'wrong-san', 'plaintext', 'wrong-password'))
MAX_BYTES = 65536
MAX_CAUSES = 8
MAX_DEPTH = 12
MAX_VALUES = 2048


class _Refusal(Exception):
    pass


def _deny(reason):
    raise _Refusal(reason)


def _namespace(value):
    # Use the concrete built-in dictionary descriptor, never a caller property.
    descriptor = None
    for cls in type.__getattribute__(type(value), '__mro__'):
        candidate = type.__getattribute__(cls, '__dict__').get('__dict__')
        if candidate is not None:
            if type(candidate) is not types.GetSetDescriptorType:
                _deny('UNKNOWN_OBJECT_LAYOUT')
            descriptor = candidate
            break
    if descriptor is None:
        return {}
    result = descriptor.__get__(value, type(value))
    if type(result) is not dict:
        _deny('MALFORMED_EVIDENCE')
    return result


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            _deny('DUPLICATE_JSON')
        result[key] = value
    return result


def _tree(value, budget, depth=0):
    budget['values'] += 1
    if depth > MAX_DEPTH or budget['values'] > MAX_VALUES:
        _deny('STRUCTURE_BOUND')
    if type(value) is str:
        if len(value) > MAX_BYTES:
            _deny('BYTE_BOUND')
        try:
            budget['bytes'] += len(value.encode('utf-8', 'strict'))
        except UnicodeError:
            _deny('MALFORMED_EVIDENCE')
    elif type(value) is dict:
        if len(value) > MAX_VALUES:
            _deny('STRUCTURE_BOUND')
        for key, child in value.items():
            if type(key) is not str:
                _deny('MALFORMED_EVIDENCE')
            _tree(key, budget, depth + 1)
            _tree(child, budget, depth + 1)
    elif type(value) is list:
        if len(value) > MAX_VALUES:
            _deny('STRUCTURE_BOUND')
        for child in value:
            _tree(child, budget, depth + 1)
    elif value is not None and type(value) not in (bool, int, float):
        _deny('MALFORMED_EVIDENCE')
    elif type(value) is float and not math.isfinite(value):
        _deny('NONFINITE_JSON')
    if budget['bytes'] > MAX_BYTES:
        _deny('BYTE_BOUND')


def _record(value):
    if type(value) is not dict or set(value) - {'error', 'user_facing_error'}:
        _deny('UNKNOWN_SHAPE')
    user = value.get('user_facing_error')
    if type(user) is not dict or set(user) - {'is_panic', 'message', 'meta', 'error_code'}:
        _deny('UNKNOWN_SHAPE')
    if (type(user.get('error_code')) is not str or type(user.get('message')) is not str
            or ('error' in value and type(value['error']) is not str)
            or ('is_panic' in user and user['is_panic'] is not False)
            or ('meta' in user and type(user['meta']) is not dict and user['meta'] is not None)):
        _deny('MALFORMED_EVIDENCE')
    return user['error_code'], user['message'].lower()


def _buffered_records(response, budget):
    # Prisma's AbstractResponse wraps the httpx response in .original. Reading
    # the stored _content avoids .content properties and all read/json methods.
    if _identity(response) not in {('prisma._async_http', 'Response'), ('prisma._sync_http', 'Response')}:
        _deny('UNKNOWN_RESPONSE_CLASS')
    original = None
    for cls in type.__getattribute__(type(response), '__mro__'):
        candidate = type.__getattribute__(cls, '__dict__').get('original')
        if candidate is not None:
            if (_identity_type(cls) != ('prisma.http_abstract', 'AbstractResponse')
                    or type(candidate) is not types.MemberDescriptorType):
                _deny('UNKNOWN_OBJECT_LAYOUT')
            original = candidate.__get__(response, type(response))
            break
    if _identity(original) != ('httpx', 'Response'):
        _deny('UNKNOWN_RESPONSE_CLASS')
    raw = _namespace(original).get('_content') if original is not None else None
    if type(raw) is not bytes or not raw:
        _deny('UNBUFFERED_RESPONSE')
    budget['bytes'] += len(raw)
    if budget['bytes'] > MAX_BYTES:
        _deny('BYTE_BOUND')
    try:
        payload = json.loads(raw.decode('utf-8', 'strict'), object_pairs_hook=_pairs,
                             parse_constant=lambda _: _deny('NONFINITE_JSON'))
    except (ValueError, UnicodeError, RecursionError):
        _deny('MALFORMED_JSON')
    # Use the lower-case GraphQL errors shape consumed by pinned HTTPEngine.
    # No speculative startup-log/direct-native-error shape is accepted.
    _tree(payload, budget)
    if (type(payload) is not dict or set(payload) - {'errors', 'data'}
            or ('data' in payload and payload['data'] is not None)
            or type(payload.get('errors')) is not list or not payload['errors']):
        _deny('UNKNOWN_SHAPE')
    return [_record(value) for value in payload['errors']]


def _reason(code, message):
    if code == 'P1011':
        # Missing/unreadable CA or generic TLS failures must not qualify.
        if any(text in message for text in ('cert file not found', 'no such file', 'permission denied')):
            return None
        # Certificate validity/purpose/algorithm failures are not evidence of
        # hostname mismatch or a server refusing TLS. Mixed reasons refuse.
        if any(text in message for text in ('expired', 'not yet valid', 'not valid yet',
                'not valid for', 'invalid certificate', 'certificate invalid', 'certificate is invalid',
                'invalid purpose', 'unsuitable certificate purpose',
                'unsupported certificate', 'certificate algorithm', 'signature algorithm')):
            return None
        hostname = any(text in message for text in ('hostname mismatch', 'ip address mismatch'))
        no_tls = ('server does not support tls', 'server does not support ssl',
                  'ssl is not enabled on the server')
        mentions = sum(message.count(text) for text in no_tls)
        # Only a complete final clause qualifies; TLSv1.1/extensions are other
        # failures. A malformed mention cannot fall through to another reason.
        unsupported = mentions == 1 and message.rsplit(':', 1)[-1].strip() in no_tls
        certificate = any(text in message for text in ('certificate verify failed', 'unknown issuer',
                                                       'unable to get local issuer', 'self-signed certificate'))
        if mentions and (not unsupported or hostname or certificate or 'certificate' in message):
            return None
        if hostname:
            return 'HOSTNAME_REJECTED'
        if unsupported:
            return 'TLS_UNSUPPORTED'
        if certificate:
            return 'CERTIFICATE_REJECTED'
    elif code == 'P1000' and any(text in message for text in (
            'password authentication failed', 'authentication failed against database server')):
        return 'PASSWORD_REJECTED'
    return None


def _identity(value):
    return _identity_type(type(value))


def _identity_type(cls):
    module = type.__getattribute__(cls, '__module__')
    name = type.__getattribute__(cls, '__name__')
    return (module, name) if type(module) is str and type(name) is str else ('', '')


def _class(error):
    return {('prisma.engine.errors', 'EngineConnectionError'): 'ENGINE_CONNECTION',
            ('prisma.engine.errors', 'EngineRequestError'): 'ENGINE_REQUEST',
            ('prisma.errors', 'DataError'): 'PRISMA_DATA',
            ('httpx', 'ConnectError'): 'CONNECT_ERROR',
            ('httpx', 'ConnectTimeout'): 'TIMEOUT',
            ('builtins', 'TimeoutError'): 'TIMEOUT'}.get(_identity(error), 'OTHER')


def classify_exception(case, error, *, evidence_complete=True):
    """Return fixed, secret-free evidence enums; never perform I/O or retries.

    Caller must supply the actual caught exception and complete evidence. These
    values are diagnostic DATA, never authenticated runtime or TLS authority.
    """
    result = {'case': case if type(case) is str and case in CASES else 'INVALID',
              'specificRejection': False, 'reason': 'NO_SPECIFIC_EVIDENCE',
              'source': 'NONE', 'classes': [], 'complete': False}
    budget = {'bytes': 0, 'values': 0}
    try:
        if (type(case) is not str or case not in CASES
                or BaseException not in type.__getattribute__(type(error), '__mro__')):
            _deny('INVALID_INPUT')
        if type(evidence_complete) is not bool or not evidence_complete:
            _deny('INCOMPLETE_EVIDENCE')
        seen, records, sources = set(), [], set()
        current = error
        while current is not None:
            if id(current) in seen:
                _deny('CAUSE_CYCLE')
            if len(seen) >= MAX_CAUSES:
                _deny('CAUSE_BOUND')
            seen.add(id(current))
            kind = _class(current)
            result['classes'].append(kind)
            if kind == 'OTHER':
                _deny('UNKNOWN_EXCEPTION_CLASS')
            args = BaseException.args.__get__(current)
            if len(args) > 1 or any(type(value) is not str for value in args):
                _deny('UNKNOWN_SHAPE')
            for value in args:
                if type(value) is str:
                    _tree(value, budget)
            fields = _namespace(current)
            if kind == 'PRISMA_DATA':
                if set(fields) != {'data', 'code', 'meta'}:
                    _deny('UNKNOWN_SHAPE')
                _tree(fields['data'], budget)
                record = _record(fields['data'])
                if type(fields['code']) is not str or fields['code'] != record[0]:
                    _deny('CONFLICTING_EVIDENCE')
                if fields['meta'] is not fields['data']['user_facing_error'].get('meta'):
                    _deny('CONFLICTING_EVIDENCE')
                records.append(record)
                sources.add('EXCEPTION_DATA')
            elif kind == 'ENGINE_REQUEST':
                if set(fields) != {'response'}:
                    _deny('UNKNOWN_SHAPE')
                records.extend(_buffered_records(fields['response'], budget))
                sources.add('BUFFERED_RESPONSE')
            elif kind == 'ENGINE_CONNECTION' and fields:
                _deny('UNKNOWN_SHAPE')
            current = BaseException.__cause__.__get__(current)
        expected = {'wrong-ca': 'CERTIFICATE_REJECTED', 'wrong-san': 'HOSTNAME_REJECTED',
                    'plaintext': 'TLS_UNSUPPORTED', 'wrong-password': 'PASSWORD_REJECTED'}
        reasons = [_reason(*record) for record in records]
        if records and (None in reasons or len(set(reasons)) != 1):
            _deny('CONFLICTING_OR_UNSPECIFIC_EVIDENCE')
        if reasons and reasons[0] != expected.get(case):
            _deny('CASE_MISMATCH')
        result['complete'] = True
        if reasons:
            result.update(specificRejection=True, reason=reasons[0],
                          source=next(iter(sources)) if len(sources) == 1 else 'MULTIPLE_STRUCTURED')
    except _Refusal as error:
        result['reason'] = error.args[0]
    except (AttributeError, TypeError, OverflowError, RecursionError):
        result['reason'] = 'MALFORMED_EVIDENCE'
    return result


def classify_native_output(case, stderr_bytes, *, expected_user, expected_host,
                           evidence_complete=True):
    """Decode one complete pinned-engine startup KnownError, without I/O.

    Origin, process/config ownership and capture completeness belong to the
    caller. CA/name candidates are observations, never qualified rejections.
    No native text, metadata, paths or byte hashes leave this boundary.
    """
    result = {'case': case if type(case) is str and case in CASES else 'INVALID',
              'specificRejection': False, 'reason': 'NO_SPECIFIC_EVIDENCE',
              'tlsCandidate': 'UNRECOGNIZED', 'source': 'NONE',
              'recordCount': 0, 'complete': False}
    try:
        if type(case) is not str or case not in CASES or type(stderr_bytes) is not bytes:
            _deny('INVALID_INPUT')
        for value in (expected_user, expected_host):
            if (type(value) is not str or not value or len(value) > 256
                    or any(ord(char) < 33 or ord(char) == 127 or char == '`' for char in value)):
                _deny('INVALID_EXPECTED_IDENTITY')
            if len(value.encode('utf-8', 'strict')) > 256:
                _deny('INVALID_EXPECTED_IDENTITY')
        if type(evidence_complete) is not bool or not evidence_complete:
            _deny('INCOMPLETE_EVIDENCE')
        if len(stderr_bytes) > MAX_BYTES:
            _deny('BYTE_BOUND')
        if (not stderr_bytes.endswith(b'\n') or stderr_bytes.count(b'\n') != 1
                or b'\r' in stderr_bytes or not stderr_bytes.startswith(b'{')
                or not stderr_bytes.endswith(b'}\n')):
            _deny('NATIVE_FRAMING_REFUSED')
        try:
            payload = json.loads(stderr_bytes[:-1].decode('utf-8', 'strict'),
                                 object_pairs_hook=_pairs,
                                 parse_constant=lambda _: _deny('NONFINITE_JSON'))
        except (ValueError, UnicodeError, RecursionError):
            _deny('MALFORMED_JSON')
        _tree(payload, {'bytes': len(stderr_bytes), 'values': 0})
        if (type(payload) is not dict or set(payload) != {'is_panic', 'message', 'meta', 'error_code'}
                or payload['is_panic'] is not False or type(payload['message']) is not str
                or type(payload['error_code']) is not str or type(payload['meta']) is not dict):
            _deny('NATIVE_KNOWN_SHAPE_REFUSED')
        code, message, meta = payload['error_code'], payload['message'], payload['meta']
        if code == 'P1000':
            if (set(meta) != {'database_user', 'database_host'}
                    or type(meta['database_user']) is not str or type(meta['database_host']) is not str):
                _deny('NATIVE_META_REFUSED')
            if meta['database_user'] != expected_user or meta['database_host'] != expected_host:
                _deny('NATIVE_IDENTITY_MISMATCH')
            formatted = (
                f'Authentication failed against database server at `{expected_host}`, '
                f'the provided database credentials for `{expected_user}` are not valid.\n\n'
                f'Please make sure to provide valid database credentials for the database server at `{expected_host}`.')
            if message != formatted:
                _deny('NATIVE_FORMATTER_MISMATCH')
            qualified = 'PASSWORD_REJECTED'
        elif code == 'P1011':
            if set(meta) != {'message'} or type(meta['message']) is not str or not meta['message']:
                _deny('NATIVE_META_REFUSED')
            if message != 'Error opening a TLS connection: ' + meta['message']:
                _deny('NATIVE_FORMATTER_MISMATCH')
            if meta['message'] == 'error performing TLS handshake: server does not support TLS':
                qualified = 'TLS_UNSUPPORTED'
            else:
                candidate = _reason(code, meta['message'].lower())
                if candidate in ('CERTIFICATE_REJECTED', 'HOSTNAME_REJECTED'):
                    result['tlsCandidate'] = candidate
                result.update(source='NATIVE_KNOWN_ERROR', recordCount=1,
                              complete=True, reason='TLS_REASON_UNQUALIFIED')
                return result
        else:
            _deny('NATIVE_UNKNOWN_CODE')
        result.update(source='NATIVE_KNOWN_ERROR', recordCount=1, complete=True)
        if (case == 'wrong-password' and qualified == 'PASSWORD_REJECTED'
                or case == 'plaintext' and qualified == 'TLS_UNSUPPORTED'):
            result.update(specificRejection=True, reason=qualified)
        else:
            result['reason'] = 'CASE_MISMATCH'
    except _Refusal as error:
        result['reason'] = error.args[0]
    except (AttributeError, TypeError, OverflowError, RecursionError, UnicodeError):
        result['reason'] = 'MALFORMED_EVIDENCE'
    return result
