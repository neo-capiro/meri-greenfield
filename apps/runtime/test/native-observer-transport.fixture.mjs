/** Throwaway, in-memory certificates; no live material or credentials. */
import {execFileSync} from 'node:child_process';
import {python} from '../../../infra/product-preview/first-chat/render-material.fixture.mjs';
export function observerTransportPki(){
 return JSON.parse(execFileSync(python,['-I','-c',String.raw`
import json,datetime
from cryptography import x509
from cryptography.hazmat.primitives import hashes,serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID,ExtendedKeyUsageOID
n=datetime.datetime.now(datetime.timezone.utc)
def pem(c): return c.public_bytes(serialization.Encoding.PEM).decode()
def key(): return rsa.generate_private_key(public_exponent=65537,key_size=2048)
def ca(name):
 k=key(); subject=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,name)])
 c=x509.CertificateBuilder().subject_name(subject).issuer_name(subject).public_key(k.public_key()).serial_number(x509.random_serial_number()).not_valid_before(n-datetime.timedelta(days=3)).not_valid_after(n+datetime.timedelta(days=3)).add_extension(x509.BasicConstraints(ca=True,path_length=None),True).add_extension(x509.KeyUsage(False,False,False,False,False,True,True,False,False),True).sign(k,hashes.SHA256())
 return k,c
k,c=ca('case'); _,other=ca('production')
def leaf(name,expired=False):
 lk=key(); cert=x509.CertificateBuilder().subject_name(x509.Name([])).issuer_name(c.subject).public_key(lk.public_key()).serial_number(x509.random_serial_number()).not_valid_before(n-datetime.timedelta(days=2)).not_valid_after(n+datetime.timedelta(days=-1 if expired else 1)).add_extension(x509.BasicConstraints(ca=False,path_length=None),True).add_extension(x509.SubjectAlternativeName([x509.DNSName(name)]),False).add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]),False).sign(k,hashes.SHA256())
 return {'cert':pem(cert),'key':lk.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()).decode()}
print(json.dumps({'ca':pem(c),'otherCa':pem(other),'good':leaf('control.meri-preview.internal'),'wrongName':leaf('other.example'),'expired':leaf('control.meri-preview.internal',True)}))
`],{timeout:30000,windowsHide:true}));
}
