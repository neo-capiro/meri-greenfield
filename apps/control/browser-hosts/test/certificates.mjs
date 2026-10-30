/** Ephemeral qualification public certificates only; keys never leave the child process. */
import {execFileSync} from 'node:child_process';
const script=String.raw`
import json,sys,base64
from datetime import datetime,timedelta,timezone
from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization
from cryptography.x509.oid import NameOID
names=json.loads(sys.stdin.read());now=datetime.now(timezone.utc);out={}
for kind,name in names.items():
 key=ed25519.Ed25519PrivateKey.generate();subject=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,name)])
 cert=x509.CertificateBuilder().subject_name(subject).issuer_name(subject).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(seconds=5)).not_valid_after(now+timedelta(minutes=5)).add_extension(x509.SubjectAlternativeName([x509.DNSName(name)]),critical=False).sign(key,algorithm=None)
 out[kind]=base64.b64encode(cert.public_bytes(serialization.Encoding.PEM)).decode()
print(json.dumps(out))
`;
export function publicCertificates(names){
 const result=JSON.parse(execFileSync(process.platform==='win32'?'python':'python3',['-c',script],{input:JSON.stringify(names),encoding:'utf8',stdio:['pipe','pipe','pipe']}));
 return Object.fromEntries(Object.entries(result).map(([key,value])=>[key,Buffer.from(value,'base64')]));
}
