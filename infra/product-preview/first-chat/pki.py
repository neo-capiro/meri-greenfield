"""Generate the Meri first-chat preview PKI (D4: self-managed CAs). Run once, offline.

Writes PEM files (keys PKCS#8, certs X.509) into a NEW private directory that must stay outside Git,
plus pins.json with the hash dialects each consumer pins: sha256 of raw PEM bytes ("pem"), of the DER
certificate ("der"). Keys never leave that directory except as exact-version Secrets Manager values.
Usage: python -I pki.py <new-private-dir> [--days N]
"""
import datetime
import hashlib
import json
import os
import sys
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

# Names are fixed by the deployment: Cloud Map meri.internal / temporal.meri.internal and the private
# control origin behind the internal ALB.
NAMES = {
    "control_private": "control.meri-preview.internal",
    "temporal_frontend": "frontend.temporal.meri.internal",
    "temporal_internode": "internode.temporal.meri.internal",
}
TEMPORAL_CLIENTS = {"control": "meri-temporal-control", "worker": "meri-temporal-worker", "schedule": "meri-temporal-schedule"}


def key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def name(cn):
    return x509.Name([x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Capiro Meri preview"), x509.NameAttribute(NameOID.COMMON_NAME, cn)])


def ca(cn, days):
    k, now = key(), datetime.datetime.now(datetime.timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(name(cn)).issuer_name(name(cn)).public_key(k.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(now - datetime.timedelta(minutes=5))
            .not_valid_after(now + datetime.timedelta(days=days))
            .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
            .add_extension(x509.KeyUsage(digital_signature=False, content_commitment=False, key_encipherment=False, data_encipherment=False,
                                         key_agreement=False, key_cert_sign=True, crl_sign=True, encipher_only=False, decipher_only=False), critical=True)
            .add_extension(x509.SubjectKeyIdentifier.from_public_key(k.public_key()), critical=False)
            .sign(k, hashes.SHA256()))
    return k, cert


def leaf(issuer_key, issuer_cert, cn, days, *, dns=(), server=False, client=False):
    k, now = key(), datetime.datetime.now(datetime.timezone.utc)
    usages = ([ExtendedKeyUsageOID.SERVER_AUTH] if server else []) + ([ExtendedKeyUsageOID.CLIENT_AUTH] if client else [])
    b = (x509.CertificateBuilder().subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])).issuer_name(issuer_cert.subject)
         .public_key(k.public_key()).serial_number(x509.random_serial_number())
         .not_valid_before(now - datetime.timedelta(minutes=5)).not_valid_after(now + datetime.timedelta(days=days))
         .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
         .add_extension(x509.KeyUsage(digital_signature=True, content_commitment=False, key_encipherment=True, data_encipherment=False,
                                      key_agreement=False, key_cert_sign=False, crl_sign=False, encipher_only=False, decipher_only=False), critical=True)
         .add_extension(x509.ExtendedKeyUsage(usages), critical=False)
         .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(issuer_key.public_key()), critical=False))
    if dns:
        b = b.add_extension(x509.SubjectAlternativeName([x509.DNSName(d) for d in dns]), critical=False)
    return k, b.sign(issuer_key, hashes.SHA256())


def main(out, days):
    out = Path(out)
    out.mkdir(mode=0o700, parents=False, exist_ok=False)
    files, pins = {}, {}

    def put(stem, k=None, cert=None):
        if k is not None:
            files[f"{stem}.key.pem"] = k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
        if cert is not None:
            pem = cert.public_bytes(serialization.Encoding.PEM)
            files[f"{stem}.pem"] = pem
            pins[stem] = {"pem": hashlib.sha256(pem).hexdigest(), "der": hashlib.sha256(cert.public_bytes(serialization.Encoding.DER)).hexdigest(),
                          "subject": cert.subject.rfc4514_string(), "notAfter": cert.not_valid_after_utc.isoformat()}

    # Private control ALB trust remains independent of Temporal client authentication.
    server_k, server = ca("Meri preview server CA", days); put("server-ca", server_k, server)
    put("control-private", *leaf(server_k, server, NAMES["control_private"], days,
                                dns=[NAMES["control_private"]], server=True))
    # Temporal: frontend, client and internode CAs.
    fk, fca = ca("Meri preview Temporal frontend CA", days); put("temporal-frontend-ca", fk, fca)
    put("temporal-frontend", *leaf(fk, fca, NAMES["temporal_frontend"], days, dns=[NAMES["temporal_frontend"]], server=True))
    ck, cca = ca("Meri preview Temporal client CA", days); put("temporal-client-ca", ck, cca)
    for role, cn in TEMPORAL_CLIENTS.items():
        put(f"temporal-client-{role}", *leaf(ck, cca, cn, days, client=True))
    ik, ica = ca("Meri preview Temporal internode CA", days); put("temporal-internode-ca", ik, ica)
    put("temporal-internode", *leaf(ik, ica, NAMES["temporal_internode"], days, dns=[NAMES["temporal_internode"]], server=True, client=True))

    for rel, data in sorted(files.items()):
        p = out / rel
        fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as f:
            f.write(data)
    (out / "pins.json").write_text(json.dumps({"schemaVersion": 1, "names": NAMES,
                                               "temporalClients": TEMPORAL_CLIENTS, "certificates": pins}, indent=1, sort_keys=True) + "\n")
    print(json.dumps({"status": "MERI_PREVIEW_PKI_WRITTEN", "files": len(files), "certificates": len(pins), "days": days}))


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) not in (1, 3) or (len(args) == 3 and args[1] != "--days"):
        sys.exit("usage: pki.py <new-private-dir> [--days N]")
    main(args[0], int(args[2]) if len(args) == 3 else 90)
