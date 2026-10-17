"""Cross-runtime agreement: the Node material-init model-proxy plan and the Python
startup parser accept the same existing configuration() fixture. Synthetic inert
bytes only; no key, credential, listener or material filesystem write."""
import base64
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import unittest

from apps.proxy.product.startup_config import parse_product_proxy_startup
from apps.proxy.product.test.test_startup_config import configuration

_ROOT = Path(__file__).resolve().parents[4]
_NODE = shutil.which("node")
_SCRIPT = r"""
import {pathToFileURL} from 'node:url';
const root=process.argv[1],load=path=>import(pathToFileURL(root+'/'+path).href);
const {canonicalSha256}=await load('packages/contracts/validate.mjs');
const {validateStaticProductDelivery}=await load('apps/runtime/material-init.mjs');
let text='';for await(const chunk of process.stdin)text+=chunk;
const input=JSON.parse(text),sha256ByPath={},files=[];
for(const [path,b64] of Object.entries(input.files)){files.push({path,base64:b64});
 sha256ByPath[path]=(await import('node:crypto')).createHash('sha256').update(Buffer.from(b64,'base64')).digest('hex');}
const expected={schemaVersion:1,role:'model-proxy',runtimeUser:'10001:10001',sourceCommit:'c'.repeat(40),imageDigest:'sha256:'+'d'.repeat(64),sha256ByPath};
expected.materialContractSha256=canonicalSha256(expected);
try{process.stdout.write(JSON.stringify(validateStaticProductDelivery({expected,bundle:{files}})));}
catch(error){process.stdout.write(JSON.stringify({code:error.code}));}
"""


def _inert(path):
    return ("SYNTHETIC INERT MATERIAL " + path).encode()


def _delivery(mutate=None):
    value = configuration()
    for section in ("serverTls", "ownerTls"):
        for key, ref in value[section].items():
            if key.endswith("File"):
                ref["sha256"] = hashlib.sha256(_inert(ref["path"])).hexdigest()
    if mutate:
        mutate(value)
    raw = json.dumps(value).encode()
    files = {"/run/meri/proxy.json": raw}
    for section in ("serverTls", "ownerTls"):
        for key, ref in value[section].items():
            if key.endswith("File"):
                files[ref["path"]] = _inert(ref["path"])
    return raw, files


def _node(files):
    payload = json.dumps({"files": {p: base64.b64encode(b).decode() for p, b in files.items()}})
    result = subprocess.run([_NODE, "--input-type=module", "-e", _SCRIPT, str(_ROOT)], input=payload,
                            capture_output=True, text=True, timeout=60, check=False)
    if result.returncode != 0:
        raise AssertionError(result.stderr[-2000:])
    return json.loads(result.stdout)


@unittest.skipUnless(_NODE and (_ROOT/"node_modules").is_dir(), "UNRUN: requires node and installed repository node_modules")
class ModelProxyMaterialAgreement(unittest.TestCase):
    def test_python_startup_and_node_material_plan_accept_the_same_configuration(self):
        raw, files = _delivery()
        parse_product_proxy_startup(raw, hashlib.sha256(raw).hexdigest())
        receipt = _node(files)
        self.assertEqual((receipt.get("role"), receipt.get("runtimeUser"), receipt.get("fileCount"), receipt.get("configurationPath")),
                         ("model-proxy", "10001:10001", 6, "/run/meri/proxy.json"))

    def test_python_refusals_are_also_material_plan_refusals(self):
        for mutate in (lambda v: v.update(enabled=False), lambda v: v.update(pricingRevision="f"*64),
                       lambda v: v["ownerPeer"].update(max_exchange_ms=3001),
                       lambda v: v["serviceTasks"].update(deploymentRevision="foreign"),
                       lambda v: v["ownerTls"].update(password="secret")):
            raw, files = _delivery(mutate)
            with self.assertRaises(Exception):
                parse_product_proxy_startup(raw, hashlib.sha256(raw).hexdigest())
            self.assertEqual(_node(files), {"code": "STATIC_INIT_REFUSED"})


if __name__ == "__main__":
    unittest.main()
