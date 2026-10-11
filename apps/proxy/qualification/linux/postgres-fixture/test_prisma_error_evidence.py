"""Inert synthetic controls; class labels model pinned Prisma/httpx shapes only."""
import json
import unittest

from prisma_error_evidence import classify_exception


DataError = type('DataError', (Exception,), {'__module__': 'prisma.errors'})
EngineConnectionError = type('EngineConnectionError', (Exception,), {'__module__': 'prisma.engine.errors'})
EngineRequestError = type('EngineRequestError', (Exception,), {'__module__': 'prisma.engine.errors'})
ConnectError = type('ConnectError', (Exception,), {'__module__': 'httpx'})
AbstractResponse = type('AbstractResponse', (), {
    '__module__': 'prisma.http_abstract', '__slots__': ('original',)})
Response = type('Response', (AbstractResponse,), {'__module__': 'prisma._async_http', '__slots__': ()})
HTTPResponse = type('Response', (), {'__module__': 'httpx'})


def record(message='TLS certificate verify failed', code='P1011'):
    return {'error': 'internal error', 'user_facing_error': {
        'error_code': code, 'message': message, 'is_panic': False, 'meta': None}}


def data_error(message='TLS certificate verify failed', code='P1011'):
    error = DataError(message)
    error.data = record(message, code)
    error.code = code
    error.meta = None
    return error


def buffered(raw):
    original = HTTPResponse()
    original._content = raw
    response = Response()
    response.original = original
    error = EngineRequestError('503: private diagnostic')
    error.response = response
    return error


class EvidenceTests(unittest.TestCase):
    def rejected(self, error, case='wrong-ca', reason=None, **kwargs):
        result = classify_exception(case, error, **kwargs)
        self.assertFalse(result['specificRejection'], result)
        if reason:
            self.assertEqual(reason, result['reason'])
        return result

    def test_explicit_nested_data_error_is_specific(self):
        error = EngineConnectionError('Could not connect to the query engine')
        error.__cause__ = data_error()
        result = classify_exception('wrong-ca', error)
        self.assertEqual(result, {'case': 'wrong-ca', 'specificRejection': True,
            'reason': 'CERTIFICATE_REJECTED', 'source': 'EXCEPTION_DATA',
            'classes': ['ENGINE_CONNECTION', 'PRISMA_DATA'], 'complete': True})

    def test_buffered_http_error_is_specific(self):
        error = buffered(json.dumps({'errors': [record()]}).encode())
        result = classify_exception('wrong-ca', error)
        self.assertTrue(result['specificRejection'])
        self.assertEqual('BUFFERED_RESPONSE', result['source'])

    def test_four_cases_require_distinct_reasons(self):
        cases = [('wrong-ca', 'P1011', 'TLS unknown issuer', 'CERTIFICATE_REJECTED'),
                 ('wrong-san', 'P1011', 'TLS hostname mismatch: certificate verify failed', 'HOSTNAME_REJECTED'),
                 ('plaintext', 'P1011', 'server does not support TLS', 'TLS_UNSUPPORTED'),
                 ('wrong-password', 'P1000', 'password authentication failed', 'PASSWORD_REJECTED')]
        for case, code, message, expected in cases:
            with self.subTest(case=case):
                result = classify_exception(case, data_error(message, code))
                self.assertTrue(result['specificRejection'])
                self.assertEqual(expected, result['reason'])
        self.rejected(data_error(), case='wrong-san', reason='CASE_MISMATCH')
        self.rejected(data_error(), case='positive', reason='CASE_MISMATCH')

    def test_generic_connection_and_cause_never_qualify(self):
        error = EngineConnectionError('P1011 TLS certificate verify failed')
        error.__cause__ = ConnectError('certificate verify failed')
        self.rejected(error, reason='NO_SPECIFIC_EVIDENCE')
        self.rejected(TimeoutError('TLS certificate verify failed'), reason='NO_SPECIFIC_EVIDENCE')

    def test_unrelated_exception_attributes_are_not_evidence(self):
        error = ValueError('TLS certificate verify failed')
        error.data, error.code, error.meta = record(), 'P1011', None
        self.rejected(error, reason='UNKNOWN_EXCEPTION_CLASS')

    def test_bare_code_generic_tls_missing_ca_and_unknown_code_refuse(self):
        for code, message in [('P1011', ''), ('P1011', 'TLS error'),
                ('P1011', 'cert file not found: certificate verify failed'),
                ('P1011', 'permission denied: unknown issuer'),
                ('P9999', 'TLS certificate verify failed'), ('P1000', 'authentication failed')]:
            with self.subTest(code=code, message=message):
                self.rejected(data_error(message, code), reason='CONFLICTING_OR_UNSPECIFIC_EVIDENCE')

    def test_cycle_and_chain_bound(self):
        error = EngineConnectionError('generic')
        error.__cause__ = error
        self.rejected(error, reason='CAUSE_CYCLE')
        chain = data_error()
        for _ in range(8):
            outer = EngineConnectionError('generic')
            outer.__cause__ = chain
            chain = outer
        self.rejected(chain, reason='CAUSE_BOUND')

    def test_context_is_not_an_explicit_cause(self):
        error = EngineConnectionError('generic')
        error.__context__ = data_error()
        self.rejected(error, reason='NO_SPECIFIC_EVIDENCE')

    def test_duplicate_and_nonfinite_json_refuse(self):
        self.rejected(buffered(b'{"errors":[],"errors":[]}'), reason='DUPLICATE_JSON')
        self.rejected(buffered(b'{"errors":[],"data":NaN}'), reason='NONFINITE_JSON')
        self.rejected(buffered(b'{"errors":[],"data":1e999}'), reason='NONFINITE_JSON')

    def test_malformed_unknown_and_unbuffered_shapes_refuse(self):
        for raw in (b'{', b'\xff', b'{"errors":[]}', b'{"Errors":[]}',
                    b'{"errors":[],"extra":true}', b'{"errors":[],"data":{"x":1}}'):
            with self.subTest(raw=raw):
                self.rejected(buffered(raw))
        error = buffered(b'x')
        del error.response.original._content
        self.rejected(error, reason='UNBUFFERED_RESPONSE')
        error = buffered(b'x')
        error.response = object()
        self.rejected(error, reason='UNKNOWN_RESPONSE_CLASS')

    def test_panic_unknown_fields_and_code_disagreement_refuse(self):
        error = data_error()
        error.data['user_facing_error']['is_panic'] = True
        self.rejected(error, reason='MALFORMED_EVIDENCE')
        error = data_error()
        error.data['unknown'] = 1
        self.rejected(error, reason='UNKNOWN_SHAPE')
        error = data_error()
        error.code = 'P1000'
        self.rejected(error, reason='CONFLICTING_EVIDENCE')
        error = data_error()
        error.meta = {'different': True}
        self.rejected(error, reason='CONFLICTING_EVIDENCE')

    def test_exception_arguments_are_bounded_and_ordinary(self):
        self.rejected(EngineConnectionError(*(['x'] * 2049)), reason='UNKNOWN_SHAPE')
        self.rejected(EngineConnectionError(object()), reason='UNKNOWN_SHAPE')

    def test_aggregate_bytes_depth_and_values_refuse(self):
        self.rejected(data_error('x' * 65537), reason='BYTE_BOUND')
        error = data_error()
        error.data['user_facing_error']['meta'] = {'large': 'x' * 65500}
        self.rejected(error, reason='BYTE_BOUND')
        nested = None
        for _ in range(13):
            nested = [nested]
        error = data_error()
        error.data['user_facing_error']['meta'] = {'nested': nested}
        self.rejected(error, reason='STRUCTURE_BOUND')
        error = data_error()
        error.data['user_facing_error']['meta'] = {'values': [None] * 2049}
        self.rejected(error, reason='STRUCTURE_BOUND')

    def test_conflicting_structured_sources_refuse(self):
        error = data_error()
        error.__cause__ = buffered(json.dumps({'errors': [record('TLS hostname mismatch')]}).encode())
        self.rejected(error, reason='CONFLICTING_OR_UNSPECIFIC_EVIDENCE')
        self.rejected(data_error('TLS hostname mismatch; server does not support TLS'),
                      reason='CONFLICTING_OR_UNSPECIFIC_EVIDENCE')

    def test_two_consistent_structured_sources_are_marked(self):
        error = data_error()
        error.__cause__ = buffered(json.dumps({'errors': [record()]}).encode())
        result = classify_exception('wrong-ca', error)
        self.assertTrue(result['specificRejection'])
        self.assertEqual('MULTIPLE_STRUCTURED', result['source'])

    def test_incomplete_and_invalid_input_fail_closed(self):
        self.rejected(data_error(), evidence_complete=False, reason='INCOMPLETE_EVIDENCE')
        self.rejected(data_error(), evidence_complete=1, reason='INCOMPLETE_EVIDENCE')
        self.rejected(data_error(), case='other', reason='INVALID_INPUT')
        self.rejected(object(), reason='INVALID_INPUT')

    def test_secret_messages_return_only_fixed_enums(self):
        secret = 'postgresql://user:SECRET_PASSWORD@private-host/db?sslcert=/private/file'
        error = data_error('TLS certificate verify failed; ' + secret)
        error.data['user_facing_error']['meta'] = {'private': secret}
        error.meta = error.data['user_facing_error']['meta']
        result = classify_exception('wrong-ca', error)
        self.assertTrue(result['specificRejection'])
        encoded = json.dumps(result)
        for value in ('SECRET_PASSWORD', 'private-host', 'postgresql', '/private/file'):
            self.assertNotIn(value, encoded)

    def test_response_methods_and_exception_string_are_never_called(self):
        class ForbiddenResponse(HTTPResponse):
            __module__ = 'httpx'
            __name__ = 'Response'
            @property
            def content(self):
                raise AssertionError('content accessor called')
            def json(self):
                raise AssertionError('json method called')
        ForbiddenResponse.__name__ = 'Response'
        original = ForbiddenResponse()
        original._content = json.dumps({'errors': [record()]}).encode()
        error = buffered(b'x')
        error.response.original = original
        result = classify_exception('wrong-ca', error)
        self.assertTrue(result['specificRejection'])
        NoString = type('DataError', (Exception,), {'__module__': 'prisma.errors',
            '__str__': lambda _: (_ for _ in ()).throw(AssertionError('str called'))})
        other = NoString('private')
        other.data, other.code, other.meta = record(), 'P1011', None
        self.assertTrue(classify_exception('wrong-ca', other)['specificRejection'])

    def test_descriptor_properties_are_refused_without_invocation(self):
        class Forged(HTTPResponse):
            __module__ = 'httpx'
            @property
            def __dict__(self):
                raise AssertionError('dictionary property called')
        Forged.__name__ = 'Response'
        error = buffered(b'x')
        error.response.original = Forged()
        self.rejected(error, reason='UNKNOWN_OBJECT_LAYOUT')
        class ForgedWrapper(AbstractResponse):
            __module__ = 'prisma._async_http'
            @property
            def original(self):
                raise AssertionError('original property called')
        ForgedWrapper.__name__ = 'Response'
        error = buffered(b'x')
        error.response = ForgedWrapper()
        self.rejected(error, reason='UNKNOWN_OBJECT_LAYOUT')

    def test_unknown_input_class_accessor_is_not_invoked(self):
        class Unknown:
            @property
            def __class__(self):
                raise AssertionError('class accessor called')
        self.rejected(Unknown(), reason='INVALID_INPUT')

    def test_certificate_validity_purpose_algorithm_are_not_san_or_plaintext(self):
        messages = ('certificate is not valid for the current date',
                    'certificate is invalid', 'invalid certificate', 'certificate invalid',
                    'certificate has expired', 'certificate is not yet valid',
                    'certificate is not valid yet', 'certificate is not valid for server purpose',
                    'unsuitable certificate purpose', 'invalid purpose',
                    'server does not support this certificate algorithm',
                    'server does not support TLS certificate algorithm',
                    'unsupported certificate signature algorithm')
        for message in messages:
            for case in ('wrong-san', 'plaintext'):
                with self.subTest(case=case, message=message):
                    self.rejected(data_error('TLS: ' + message), case=case)

    def test_generic_server_support_or_certificate_wording_does_not_qualify(self):
        for message in ('server does not support this feature', 'does not support TLS',
                        'SSL is not enabled for this certificate',
                        'certificate is not valid for host.example',
                        'server does not support this certificate algorithm'):
            for case in ('wrong-san', 'plaintext'):
                with self.subTest(case=case, message=message):
                    self.rejected(data_error(message), case=case)

    def test_mixed_validity_and_specific_reason_refuse(self):
        for message in ('hostname mismatch; certificate has expired',
                        'hostname mismatch; invalid certificate',
                        'server does not support TLS; certificate is invalid',
                        'hostname mismatch; certificate is not yet valid',
                        'IP address mismatch; unsuitable certificate purpose',
                        'server does not support TLS; signature algorithm unsupported',
                        'server does not support SSL; certificate is not valid for current date',
                        'hostname mismatch; server does not support TLS'):
            for case in ('wrong-san', 'plaintext'):
                with self.subTest(case=case, message=message):
                    self.rejected(data_error(message), case=case,
                                  reason='CONFLICTING_OR_UNSPECIFIC_EVIDENCE')

    def test_specific_hostname_ip_and_server_refusals_still_match_exact_cases(self):
        for case, message, reason in (
                ('wrong-san', 'TLS hostname mismatch', 'HOSTNAME_REJECTED'),
                ('wrong-san', 'TLS IP address mismatch', 'HOSTNAME_REJECTED'),
                ('plaintext', 'server does not support TLS', 'TLS_UNSUPPORTED'),
                ('plaintext', 'server does not support SSL', 'TLS_UNSUPPORTED'),
                ('plaintext', 'SSL is not enabled on the server', 'TLS_UNSUPPORTED')):
            with self.subTest(case=case, message=message):
                result = classify_exception(case, data_error(message))
                self.assertTrue(result['specificRejection'])
                self.assertEqual(reason, result['reason'])
        self.rejected(data_error('hostname mismatch', 'P9999'), case='wrong-san')
        self.rejected(data_error('server does not support TLS', 'P9999'), case='plaintext')


    def test_no_tls_terminal_clause_suffix_collisions_refuse(self):
        for ending in ('TLSv1.1', 'TLS extensions', 'SSLv3', 'SSL extensions'):
            message = 'error performing TLS handshake: server does not support ' + ending
            for case in ('plaintext', 'wrong-san', 'wrong-ca'):
                with self.subTest(case=case, ending=ending):
                    self.rejected(data_error(message), case=case)
        for message in ('SSL is not enabled on the server extension',
                        'server does not support TLSv1.1: server does not support TLS',
                        'server does not support TLS; hostname mismatch',
                        'hostname mismatch: server does not support TLSv1.1',
                        'certificate verify failed: server does not support TLS extensions',
                        'certificate detail: server does not support TLS'):
            for case in ('plaintext', 'wrong-san', 'wrong-ca'):
                with self.subTest(case=case, message=message):
                    self.rejected(data_error(message), case=case)

    def test_pinned_handshake_terminal_clause_is_specific(self):
        result = classify_exception('plaintext', data_error(
            'error performing TLS handshake: server does not support TLS'))
        self.assertTrue(result['specificRejection'])
        self.assertEqual('TLS_UNSUPPORTED', result['reason'])
        self.rejected(data_error('error performing TLS handshake: server does not support TLS',
                                 'P9999'), case='plaintext')


if __name__ == '__main__':
    unittest.main(verbosity=2)
