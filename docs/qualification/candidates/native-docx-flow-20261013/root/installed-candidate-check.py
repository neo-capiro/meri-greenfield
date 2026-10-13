"""Offline installed public tarball check; invoke under the owned subreaper capture."""
from pathlib import Path
import hashlib, json, subprocess, tarfile, tempfile

root = Path(__file__).resolve().parents[5]
evidence = Path(__file__).resolve().parent
archive = evidence / 'capiro-meri-contracts-0.1.5.tgz'
consumer_source = """import assert from 'node:assert/strict';
import pkg from './node_modules/@capiro/meri-contracts/package.json' with {type:'json'};
import {receiveDocumentRequest} from '@capiro/meri-contracts/document-application';
import {receiveConversationRequest} from '@capiro/meri-contracts/conversation-application';
import {receiveConversationLifecycleRequest} from '@capiro/meri-contracts/conversation-lifecycle';
const utf8=v=>new TextEncoder().encode(JSON.stringify(v)),id='11111111-1111-4111-8111-111111111111';
assert.equal(pkg.version,'0.1.5');
const request={operation:'create_excel',format:'xlsx',title:'Editable',content:{sheets:[{name:'Data',rows:[[{value:2}]]}]}};
assert.equal(receiveDocumentRequest('create',utf8({deliveryId:'create',request})).request.operation,'create_excel');
assert.equal(receiveDocumentRequest('revise',utf8({deliveryId:'revision',baseVersionId:id,request})).baseVersionId,id);
for(const route of ['inspect','download'])assert.equal(receiveDocumentRequest(route,utf8({versionId:id})).versionId,id);
assert.equal(receiveConversationRequest('events',utf8({command:{conversationId:id,intent:'view.subscribe'}})).command.conversationId,id);
receiveConversationLifecycleRequest('inspect',utf8({checkpointId:id}));
await assert.rejects(import('@capiro/meri-contracts/runtime-0.2/session.mjs'));
console.log(JSON.stringify({installedVersion:pkg.version,documentRoutes:4,canonicalExcel:true,exactBasePreserved:true,subscriptionCompatible:true,privateRuntimeDenied:true}));
"""
with tempfile.TemporaryDirectory(prefix='meri-native-contract-consumer-', dir='/tmp') as temporary:
    base = Path(temporary)
    package = base / 'node_modules/@capiro/meri-contracts'
    package.mkdir(parents=True)
    with tarfile.open(archive, 'r:gz') as tar:
        members = tar.getmembers()
        for member in members:
            assert member.name.startswith('package/') and '..' not in Path(member.name).parts and member.isfile()
            target = package / Path(member.name).relative_to('package')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(tar.extractfile(member).read())
    consumer = base / 'consumer.mjs'
    consumer.write_text(consumer_source)
    result = subprocess.run(['node', str(consumer)], cwd=base, capture_output=True, text=True, timeout=20)
    record = {'scope': 'OFFLINE_PUBLIC_PACKAGE_NOT_AUTHORIZATION', 'sourceHead': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
              'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'archiveBytes': archive.stat().st_size,
              'files': len(members), 'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr,
              'consumerSha256': hashlib.sha256(consumer_source.encode()).hexdigest()}
assert not base.exists()
record['temporaryConsumerRemoved'] = True
with (evidence / 'installed-candidate-captured.json').open('x') as output:
    output.write(json.dumps(record, indent=2) + '\n')
print(json.dumps(record))
assert result.returncode == 0, result.stderr
