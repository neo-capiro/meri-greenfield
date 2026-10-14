"""Receipt rejection checks; never invokes AWS, Docker or a build."""
import copy
import hashlib
import importlib.util
from pathlib import Path
import unittest

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('assembled_image_build',HERE/'meri_image_build.py')
producer=importlib.util.module_from_spec(spec)
spec.loader.exec_module(producer)

def receipt():
    native={'sdkVersion':'0.3.295','packageVersion':'0.3.295','package':'@anthropic-ai/claude-agent-sdk-linux-x64','packageRoot':'/opt/meri/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64','libc':'glibc','path':'/opt/meri/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude','sha256':'a'*64,'version':'2.1.295 (Claude Code)'}
    return {'node':'v24.21.0','uid':1000,'platform':'linux','architecture':'x64','sdk':'0.3.295','nativeCli':native,'sdkCliPath':native['path'],'sdkCliSha256':native['sha256'],'cli':native['version'],'workflowBundle':{'nativeTemporalBundling':True,'networkAttempts':0,'temporalVersion':'1.24.0','temporalPackage':'@temporalio/worker','temporalPackageRoot':'/opt/meri/node_modules/@temporalio/worker','temporalEntry':'/opt/meri/node_modules/@temporalio/worker/lib/index.js','temporalEntrySha256':'d'*64,'bytes':123,'sha256':'b'*64},'qualifiedManifestFilesMatched':45,'restoredSourceModulesMatched':6,'ordinaryRuntimeImports':True,'providerRequests':0,'modelTurns':0,'network':'none','liveAcceptance':False}

class ProducerTests(unittest.TestCase):
    def test_valid_receipt_and_rejections(self):
        producer.validate_proof(receipt())
        for key,value in [('sdkCliPath','/other/claude'),('sdkCliSha256','c'*64),('architecture','arm64'),('providerRequests',1),('qualifiedManifestFilesMatched',44),('network','default'),('liveAcceptance',True)]:
            with self.subTest(key=key):
                proof=receipt();proof[key]=value
                with self.assertRaises(RuntimeError):producer.validate_proof(proof)
        for key,value in [('packageVersion','0.3.294'),('libc','musl'),('sha256','z'*64)]:
            with self.subTest(native=key):
                proof=receipt();proof['nativeCli'][key]=value
                with self.assertRaises(RuntimeError):producer.validate_proof(proof)
        for key,value in [('nativeTemporalBundling',False),('networkAttempts',1),('temporalVersion','1.23.0'),('bytes',0),('temporalEntry','/outside/index.js'),('temporalEntrySha256','g'*64)]:
            with self.subTest(bundle=key):
                proof=receipt();proof['workflowBundle'][key]=value
                with self.assertRaises(RuntimeError):producer.validate_proof(proof)

    def test_sealed_probe_and_helper_hashes_match_files(self):
        source=(HERE/'meri_image_build.py').read_text()
        for name in ['image_probe.mjs','native-cli.mjs','temporal-binding.mjs','source-manifest.json']:
            self.assertIn(hashlib.sha256((HERE/name).read_bytes()).hexdigest(),source,name)

if __name__=='__main__':unittest.main()
