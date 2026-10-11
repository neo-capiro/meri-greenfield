"""Inert synthetic controls; class labels model pinned Prisma/httpx shapes only."""
import json
import unittest

from prisma_error_evidence import classify_exception, classify_native_output


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


    def test_no_tls_terminal_clause_with_issuer_reason_refuses(self):
        for issuer in ('unknown issuer', 'unable to get local issuer', 'self-signed certificate'):
            for case in ('plaintext', 'wrong-ca', 'wrong-san'):
                with self.subTest(issuer=issuer, case=case):
                    self.rejected(data_error(issuer + ': server does not support TLS'), case=case)


class NativeEvidenceTests(unittest.TestCase):
    USER = 'fixture_user'
    HOST = 'fixture-db'
    PASSWORD = ('Authentication failed against database server at `fixture-db`, '
                'the provided database credentials for `fixture_user` are not valid.\n\n'
                'Please make sure to provide valid database credentials for the database server at `fixture-db`.')
    NO_TLS = 'error performing TLS handshake: server does not support TLS'

    def native(self, text=None, code='P1011'):
        text = self.NO_TLS if text is None else text
        return {'is_panic': False, 'message': 'Error opening a TLS connection: ' + text,
                'meta': {'message': text}, 'error_code': code}

    def password(self):
        return {'is_panic': False, 'message': self.PASSWORD, 'error_code': 'P1000',
                'meta': {'database_user': self.USER, 'database_host': self.HOST}}

    def encoded(self, value):
        return (json.dumps(value, ensure_ascii=False) + '\n').encode()

    def classify(self, raw, case='plaintext', **kwargs):
        return classify_native_output(case, raw, expected_user=kwargs.pop('expected_user', self.USER),
                                      expected_host=kwargs.pop('expected_host', self.HOST), **kwargs)

    def refused(self, raw, case='plaintext', reason=None, **kwargs):
        result = self.classify(raw, case, **kwargs)
        self.assertFalse(result['specificRejection'], result)
        if reason:
            self.assertEqual(reason, result['reason'])
        return result

    def test_exact_native_no_tls_is_specific_only_for_plaintext(self):
        raw = self.encoded(self.native())
        self.assertEqual(self.classify(raw), {'case': 'plaintext', 'specificRejection': True,
            'reason': 'TLS_UNSUPPORTED', 'tlsCandidate': 'UNRECOGNIZED',
            'source': 'NATIVE_KNOWN_ERROR', 'recordCount': 1, 'complete': True})
        for case in ('positive', 'wrong-ca', 'wrong-san', 'wrong-password'):
            self.refused(raw, case, 'CASE_MISMATCH')

    def test_exact_password_formatter_and_identity_are_required(self):
        raw = self.encoded(self.password())
        result = self.classify(raw, 'wrong-password')
        self.assertTrue(result['specificRejection'])
        self.assertEqual('PASSWORD_REJECTED', result['reason'])
        for case in ('positive', 'wrong-ca', 'wrong-san', 'plaintext'):
            self.refused(raw, case, 'CASE_MISMATCH')
        self.refused(raw, 'wrong-password', 'NATIVE_IDENTITY_MISMATCH', expected_user='other')
        self.refused(raw, 'wrong-password', 'NATIVE_IDENTITY_MISMATCH', expected_host='other')
        payload = self.password()
        payload['message'] = self.PASSWORD.replace('\n\n', '\n')
        self.refused(self.encoded(payload), 'wrong-password', 'NATIVE_FORMATTER_MISMATCH')

    def test_ca_and_name_remain_observational_even_for_matching_case(self):
        for case, text, candidate in (
                ('wrong-ca', 'certificate verify failed: SECRET_PASSWORD /private/ca.pem', 'CERTIFICATE_REJECTED'),
                ('wrong-san', 'hostname mismatch: SECRET_HOST', 'HOSTNAME_REJECTED')):
            result = self.refused(self.encoded(self.native(text)), case, 'TLS_REASON_UNQUALIFIED')
            self.assertTrue(result['complete'])
            self.assertEqual(candidate, result['tlsCandidate'])
            public = json.dumps(result)
            for private in ('SECRET_PASSWORD', 'SECRET_HOST', '/private/', 'fixture_user', 'fixture-db'):
                self.assertNotIn(private, public)

    def test_native_reason_vocabulary_is_not_broadened(self):
        for text in ('server does not support TLS', 'server does not support SSL',
                     'error performing TLS handshake: server does not support TLSv1.1',
                     'error performing TLS handshake: server does not support TLS extensions',
                     'unknown issuer: server does not support TLS',
                     'certificate expired', 'generic TLS error', 'cert file not found'):
            result = self.refused(self.encoded(self.native(text)), reason='TLS_REASON_UNQUALIFIED')
            self.assertEqual('UNRECOGNIZED', result['tlsCandidate'])

    def test_native_requires_one_complete_lf_json_line(self):
        raw = self.encoded(self.native())
        for invalid in (b'', raw[:-1], raw.replace(b'\n', b'\r\n'), raw + raw,
                        b'warning\n' + raw, b' ' + raw, raw[:-1] + b' \n', b'{}\n\n'):
            self.refused(invalid, reason='NATIVE_FRAMING_REFUSED')
        self.refused(b'{"message":"\xff"}\n', reason='MALFORMED_JSON')

    def test_native_duplicates_and_nonfinite_refuse(self):
        raw = self.encoded(self.native())
        self.refused(raw.replace(b'"is_panic": false', b'"is_panic": false, "is_panic": false'), reason='DUPLICATE_JSON')
        self.refused(raw.replace(b'"meta": {', b'"meta": {"message": "private", '), reason='DUPLICATE_JSON')
        self.refused(raw.replace(b'"is_panic": false', b'"is_panic": NaN'), reason='NONFINITE_JSON')

    def test_native_unknown_and_nonstartup_shapes_refuse(self):
        values = [{'is_panic': False, 'message': 'private', 'backtrace': None},
                  {'fields': {'error_code': 'P1011'}, 'level': 'ERROR'},
                  {'errors': [record()]}, self.native(code='P9999')]
        for value in values:
            self.refused(self.encoded(value))
        for key, replacement in (('is_panic', True), ('is_panic', 0), ('meta', None),
                                 ('message', None), ('error_code', 1011)):
            value = self.native()
            value[key] = replacement
            self.refused(self.encoded(value), reason='NATIVE_KNOWN_SHAPE_REFUSED')
        value = self.native()
        value['batch_request_idx'] = 0
        self.refused(self.encoded(value), reason='NATIVE_KNOWN_SHAPE_REFUSED')

    def test_native_meta_and_outer_formatter_agreement(self):
        for meta in ({}, {'message': self.NO_TLS, 'extra': 'private'}, {'message': None}, {'message': ''}):
            value = self.native()
            value['meta'] = meta
            self.refused(self.encoded(value), reason='NATIVE_META_REFUSED')
        value = self.native()
        value['message'] += ' extra'
        self.refused(self.encoded(value), reason='NATIVE_FORMATTER_MISMATCH')
        value = self.password()
        value['meta']['extra'] = 'private'
        self.refused(self.encoded(value), 'wrong-password', 'NATIVE_META_REFUSED')

    def test_native_incomplete_invalid_expected_and_byte_bounds(self):
        raw = self.encoded(self.native())
        for complete in (False, 1, None):
            self.refused(raw, reason='INCOMPLETE_EVIDENCE', evidence_complete=complete)
        for identity in ('', 'host with spaces', '`host`', '\n', 'a' * 257, ['host']):
            self.refused(raw, reason='INVALID_EXPECTED_IDENTITY', expected_host=identity)
        self.refused(bytearray(raw), reason='INVALID_INPUT')
        self.refused(raw, 'caller-secret', 'INVALID_INPUT')
        self.refused(b'{' + b'x' * 65536 + b'}\n', reason='BYTE_BOUND')
        deep = {'nested': 'private'}
        for _ in range(13):
            deep = {'nested': deep}
        value = self.native()
        value['meta'] = deep
        self.refused(self.encoded(value), reason='STRUCTURE_BOUND')

    def test_native_public_results_contain_only_fixed_sanitized_values(self):
        for raw in (self.encoded(self.native('private postgresql://secret:password@host')),
                    self.encoded(self.password()), b'private garbage\n'):
            result = self.classify(raw, 'wrong-password')
            self.assertEqual(set(result), {'case', 'specificRejection', 'reason', 'tlsCandidate',
                                           'source', 'recordCount', 'complete'})
            self.assertTrue(all(type(value) in (str, bool, int) for value in result.values()))
            self.assertNotIn('private', json.dumps(result))
            self.assertNotIn('password@host', json.dumps(result))


class TransportCauseTests(unittest.TestCase):
    def chain(self):
        network = type('NetworkError', (Exception,), {'__module__': 'httpcore'})
        core = type('ConnectError', (network,), {'__module__': 'httpcore'})
        refused = ConnectionRefusedError(111, 'PRIVATE connection refused')
        aggregate = OSError('All connection attempts failed')
        aggregate.__cause__ = refused
        wrapped = core(aggregate)
        wrapped.__cause__ = aggregate
        http = ConnectError('PRIVATE mapped message')
        http.__cause__ = wrapped
        engine = EngineConnectionError('Could not connect to the query engine')
        engine.__cause__ = http
        return engine, wrapped, aggregate, refused

    def test_pinned_full_chain_is_complete_nonpositive_for_every_case(self):
        engine, _, _, _ = self.chain()
        for case in ('positive', 'wrong-ca', 'wrong-san', 'plaintext', 'wrong-password'):
            value = classify_exception(case, engine)
            self.assertEqual(value, {'case': case, 'specificRejection': False,
                'reason': 'NO_SPECIFIC_EVIDENCE', 'source': 'NONE',
                'classes': ['ENGINE_CONNECTION', 'CONNECT_ERROR', 'HTTPCORE_CONNECT',
                            'OS_ERROR', 'CONNECTION_REFUSED'], 'complete': True})

    def test_httpcore_argument_must_be_identical_to_explicit_cause(self):
        for change in ('different', 'missing', 'text', 'extra'):
            engine, core, aggregate, _ = self.chain()
            if change == 'different':
                core.args = (OSError('All connection attempts failed'),)
            elif change == 'missing':
                core.__cause__ = None
                core.__suppress_context__ = False
            elif change == 'text':
                core.args = ('private',)
            else:
                core.args = (aggregate, aggregate)
            value = classify_exception('wrong-ca', engine)
            self.assertFalse(value['complete'], value)
            self.assertFalse(value['specificRejection'])

    def test_opaque_text_cannot_produce_native_or_structured_positivity(self):
        engine, _, aggregate, _ = self.chain()
        aggregate.args = ('P1011 certificate verify failed PASSWORD',)
        self.assertFalse(classify_exception('wrong-ca', engine)['specificRejection'])
        structured = data_error()
        structured.__cause__ = engine
        value = classify_exception('wrong-ca', structured)
        self.assertEqual('OPAQUE_TRANSPORT_WITH_STRUCTURED_EVIDENCE', value['reason'])
        self.assertFalse(value['specificRejection'])

    def test_custom_namespaces_and_wrong_mro_refuse(self):
        engine, core, _, _ = self.chain()
        core.private = 'secret'
        self.assertEqual('UNKNOWN_SHAPE', classify_exception('wrong-ca', engine)['reason'])
        forged = type('ConnectError', (Exception,), {'__module__': 'httpcore'})
        error = forged(OSError('private'))
        error.__cause__ = error.args[0]
        self.assertEqual('UNKNOWN_OBJECT_LAYOUT', classify_exception('wrong-ca', error)['reason'])

    def test_builtin_exact_type_slots_and_filename_are_checked(self):
        class Derived(ConnectionRefusedError):
            pass
        for error in (Derived(111, 'private'), ConnectionRefusedError(True, 'private'),
                      ConnectionRefusedError(0, 'private'), ConnectionRefusedError(65536, 'private'),
                      ConnectionRefusedError(111, 'private', '/secret'), OSError()):
            value = classify_exception('wrong-ca', error)
            self.assertFalse(value['complete'], value)
            self.assertFalse(value['specificRejection'])
        error = ConnectionRefusedError(111, 'private')
        error.errno = 112
        self.assertEqual('CONFLICTING_EVIDENCE', classify_exception('wrong-ca', error)['reason'])
        error = OSError('private')
        error.custom = 1
        self.assertEqual('UNKNOWN_SHAPE', classify_exception('wrong-ca', error)['reason'])

    def test_unknown_group_cycle_and_bound_still_refuse(self):
        engine, core, aggregate, _ = self.chain()
        group = ExceptionGroup('private', [OSError('private')])
        core.args, core.__cause__ = (group,), group
        self.assertEqual('UNKNOWN_EXCEPTION_CLASS', classify_exception('wrong-ca', engine)['reason'])
        engine, _, aggregate, _ = self.chain()
        aggregate.__cause__ = engine
        self.assertEqual('CAUSE_CYCLE', classify_exception('wrong-ca', engine)['reason'])
        engine, _, _, _ = self.chain()
        for _ in range(4):
            outer = EngineConnectionError('private')
            outer.__cause__ = engine
            engine = outer
        self.assertEqual('CAUSE_BOUND', classify_exception('wrong-ca', engine)['reason'])

    def test_byte_bound_and_no_exception_string_calls(self):
        engine, core, aggregate, _ = self.chain()
        aggregate.args = ('x' * 65537,)
        self.assertEqual('BYTE_BOUND', classify_exception('wrong-ca', engine)['reason'])
        engine, core, _, _ = self.chain()
        type(core).__str__ = lambda _: (_ for _ in ()).throw(AssertionError('str called'))
        result = classify_exception('wrong-ca', engine)
        self.assertTrue(result['complete'])
        self.assertNotIn('PRIVATE', json.dumps(result))

    def test_incomplete_evidence_never_accepts_recognized_transport(self):
        engine, _, _, _ = self.chain()
        value = classify_exception('wrong-ca', engine, evidence_complete=False)
        self.assertEqual('INCOMPLETE_EVIDENCE', value['reason'])
        self.assertFalse(value['specificRejection'])


class OpenSSLVerificationTests(unittest.TestCase):
    PREFIX = ('error performing TLS handshake: error:0A000086:SSL routines:'
              'tls_post_process_server_certificate:certificate verify failed:')

    def message(self, terminal='hostname mismatch', path='../ssl/statem/statem_clnt.c', line='2125'):
        return self.PREFIX + path + ':' + line + ': (' + terminal + ')'

    def result(self, text, case='wrong-san'):
        payload = {'is_panic': False, 'error_code': 'P1011', 'meta': {'message': text},
                   'message': 'Error opening a TLS connection: ' + text}
        return classify_native_output(case, (json.dumps(payload) + '\n').encode(),
                                      expected_user='fixture_user', expected_host='fixture-db')

    def test_whole_source_backed_grammar_is_case_specific(self):
        for terminal, case, reason in (
                ('unable to get local issuer certificate', 'wrong-ca', 'OPENSSL_X509_CA_UNTRUSTED'),
                ('self-signed certificate', 'wrong-ca', 'OPENSSL_X509_CA_UNTRUSTED'),
                ('self-signed certificate in certificate chain', 'wrong-ca', 'OPENSSL_X509_CA_UNTRUSTED'),
                ('hostname mismatch', 'wrong-san', 'OPENSSL_X509_NAME_MISMATCH'),
                ('IP address mismatch', 'wrong-san', 'OPENSSL_X509_NAME_MISMATCH')):
            for path in ('ssl/statem/statem_clnt.c', './ssl/statem/statem_clnt.c', '../ssl/statem/statem_clnt.c'):
                for line in ('2124', '2125'):
                    value = self.result(self.message(terminal, path, line), case)
                    self.assertTrue(value['specificRejection'], value)
                    self.assertTrue(value['complete'])
                    self.assertEqual(reason, value['reason'])

    def test_other_cases_cannot_relabel_specific_terminal(self):
        for terminal, correct in (('hostname mismatch', 'wrong-san'),
                                  ('unable to get local issuer certificate', 'wrong-ca')):
            for case in ('positive', 'plaintext', 'wrong-password', 'wrong-ca', 'wrong-san'):
                if case != correct:
                    value = self.result(self.message(terminal), case)
                    self.assertFalse(value['specificRejection'])
                    self.assertEqual('CASE_MISMATCH', value['reason'])

    def test_every_fixed_stack_field_and_error_data_is_required(self):
        text = self.message()
        for old, new in (('0A000086', '0A000085'), ('0A000086', '0a000086'),
                ('SSL routines', 'x509 certificate routines'),
                ('tls_post_process_server_certificate', 'ssl_verify_cert_chain'),
                ('certificate verify failed', 'certificate expired'),
                ('2125', '02125'), ('2125', '2126'), ('2125', '-1'),
                ('../ssl/', '/private/ssl/'), ('../ssl/', '../../ssl/'),
                (': (hostname', ':private (hostname')):
            value = self.result(text.replace(old, new))
            self.assertFalse(value['specificRejection'], (old, new, value))

    def test_extra_stack_entries_prefix_suffix_or_mixed_reasons_refuse(self):
        text = self.message()
        for altered in ('warning: ' + text, text + ' ', text + '; certificate expired',
                text + ', ' + text, text + ' (self-signed certificate)',
                text.replace('hostname mismatch', 'hostname mismatch; certificate expired'),
                text.replace('hostname mismatch', 'unable to get local issuer certificate; hostname mismatch'),
                text.replace('hostname mismatch', 'server does not support TLS'),
                text + '\nprivate', text.replace(': (', ':: (')):
            for case in ('wrong-ca', 'wrong-san', 'plaintext'):
                self.assertFalse(self.result(altered, case)['specificRejection'], altered)

    def test_expiry_validity_purpose_algorithm_missing_files_and_unknown_outcomes_refuse(self):
        for terminal in ('certificate has expired', 'certificate is not yet valid',
                'unsuitable certificate purpose', 'certificate signature failure',
                'CA signature digest algorithm too weak', 'unsupported signature algorithm',
                'unable to verify the first certificate', 'cert file not found',
                'no such file', 'permission denied', 'ok', 'Hostname mismatch',
                'IP Address mismatch', 'hostname mismatch (private)'):
            for case in ('wrong-ca', 'wrong-san'):
                self.assertFalse(self.result(self.message(terminal), case)['specificRejection'], terminal)

    def test_broad_candidate_is_never_upgraded_without_whole_grammar(self):
        for text, case in (('certificate verify failed (self-signed certificate)', 'wrong-ca'),
                           ('hostname mismatch', 'wrong-san'),
                           (self.message().replace(self.PREFIX, ''), 'wrong-san')):
            value = self.result(text, case)
            self.assertFalse(value['specificRejection'])
            self.assertEqual('TLS_REASON_UNQUALIFIED', value['reason'])

    def test_result_exports_no_source_path_line_or_native_text(self):
        value = self.result(self.message())
        self.assertEqual(set(value), {'case', 'specificRejection', 'reason', 'tlsCandidate',
                                      'source', 'recordCount', 'complete'})
        self.assertTrue(all(type(item) in (str, bool, int) for item in value.values()))
        for private in ('statem', '2125', '0A000086', 'fixture-db', 'fixture_user', 'hostname mismatch'):
            self.assertNotIn(private, json.dumps(value))


class PoolClearedCauseTests(unittest.TestCase):
    def pooled(self):
        engine, core, aggregate, refused = TransportCauseTests().chain()
        # Exact pinned pool cleanup statement, using harmless synthetic errors.
        try:
            try:
                raise core
            except BaseException as error:
                raise error from None
        except Exception as error:
            self.assertIs(error, core)
        self.assertIsNone(core.__cause__)
        self.assertTrue(core.__suppress_context__)
        self.assertIs(core.args[0], aggregate)
        return engine, core, aggregate, refused

    def test_pool_raise_from_none_is_complete_and_nonpositive_in_every_case(self):
        engine, _, _, _ = self.pooled()
        for case in ('positive', 'wrong-ca', 'wrong-san', 'plaintext', 'wrong-password'):
            value = classify_exception(case, engine)
            self.assertEqual(value, {'case': case, 'specificRejection': False,
                'reason': 'NO_SPECIFIC_EVIDENCE', 'source': 'NONE',
                'classes': ['ENGINE_CONNECTION', 'CONNECT_ERROR', 'HTTPCORE_CONNECT',
                            'OS_ERROR', 'CONNECTION_REFUSED'], 'complete': True})

    def test_exact_direct_refused_argument_is_checked_without_stringification(self):
        engine, core, _, refused = self.pooled()
        core.args = (refused,)
        type(core).__str__ = lambda _: (_ for _ in ()).throw(AssertionError('str called'))
        value = classify_exception('wrong-password', engine)
        self.assertTrue(value['complete'])
        self.assertFalse(value['specificRejection'])
        self.assertEqual('CONNECTION_REFUSED', value['classes'][-1])

    def test_false_suppression_or_contradictory_explicit_cause_refuses(self):
        for change in ('unsuppressed', 'different-cause'):
            engine, core, _, _ = self.pooled()
            if change == 'unsuppressed':
                core.__suppress_context__ = False
            else:
                core.__cause__ = OSError('different opaque cause')
            value = classify_exception('wrong-ca', engine)
            self.assertEqual('CONFLICTING_EVIDENCE', value['reason'])
            self.assertFalse(value['complete'])
            self.assertFalse(value['specificRejection'])

    def test_cleared_argument_requires_exact_builtin_and_valid_slots(self):
        class Derived(OSError):
            pass
        for argument in ('opaque text', Exception('opaque'), Derived('opaque'),
                         ExceptionGroup('opaque', [OSError('opaque')]),
                         ConnectionRefusedError(111, 'opaque', '/private')):
            engine, core, _, _ = self.pooled()
            core.args = (argument,)
            value = classify_exception('wrong-ca', engine)
            self.assertFalse(value['complete'])
            self.assertFalse(value['specificRejection'])

    def test_cleared_traversal_preserves_cycle_byte_and_cause_bounds(self):
        for change, reason in (('cycle', 'CAUSE_CYCLE'), ('bytes', 'BYTE_BOUND'),
                               ('depth', 'CAUSE_BOUND')):
            engine, _, aggregate, _ = self.pooled()
            if change == 'cycle':
                aggregate.__cause__ = engine
            elif change == 'bytes':
                aggregate.args = ('x' * 65537,)
            else:
                for _ in range(4):
                    outer = EngineConnectionError('opaque')
                    outer.__cause__ = engine
                    engine = outer
            value = classify_exception('wrong-ca', engine)
            self.assertEqual(reason, value['reason'])
            self.assertFalse(value['complete'])

    def test_cleared_transport_cannot_mix_with_structured_positive_evidence(self):
        engine, _, aggregate, _ = self.pooled()
        aggregate.args = ('P1011 certificate verify failed password authentication failed',)
        self.assertFalse(classify_exception('wrong-ca', engine)['specificRejection'])
        structured = data_error()
        structured.__cause__ = engine
        value = classify_exception('wrong-ca', structured)
        self.assertEqual('OPAQUE_TRANSPORT_WITH_STRUCTURED_EVIDENCE', value['reason'])
        self.assertFalse(value['specificRejection'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
