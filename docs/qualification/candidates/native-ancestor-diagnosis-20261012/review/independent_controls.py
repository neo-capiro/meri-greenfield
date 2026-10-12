"""Independent synthetic Windows metadata controls. No native filesystem access."""
import ast
from contextlib import ExitStack
import ctypes
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path, PureWindowsPath
import stat
import types
import unittest
from unittest.mock import patch

SOURCE = Path(os.environ.get('ANCESTOR_SOURCE', '/workspace/meri-native-ancestor-diagnosis-20261012/docs/qualification/candidates/native-ancestor-diagnosis-20261012/inspect-ancestor-metadata.py'))
source_bytes = SOURCE.read_bytes()
spec = importlib.util.spec_from_file_location('candidate_diagnostic', SOURCE)
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)
REPO = PureWindowsPath(r'C:\private-receipt\repository')
OUTPUT = REPO / '.task-inputs' / 'worker-runner-capture-test'
BASE = PureWindowsPath(r'C:\runtime')
DIR = stat.S_IFDIR | 0o755

def info(mode=DIR, attrs=0x10, tag=0):
    return types.SimpleNamespace(st_mode=mode, st_file_attributes=attrs, st_reparse_tag=tag)

class Controls(unittest.TestCase):
    def observed_role(self, values, path=REPO):
        calls=[]
        def observed(p):
            calls.append(str(p))
            value=values[len(calls)-1]
            if isinstance(value, BaseException): raise value
            return value
        with patch.object(d, 'fixed_drive'), patch.object(d.time,'monotonic',return_value=0), patch.object(d.os,'lstat',side_effect=observed):
            try: return d.inspect_role('repository',path,10), calls
            except d.Refusal as error: return error,calls

    def main_result(self,args):
        output=io.BytesIO()
        with patch.object(d.sys,'stdout',types.SimpleNamespace(buffer=output)):
            code=d.main(args)
        raw=output.getvalue()
        self.assertLessEqual(len(raw),32768)
        result=json.loads(raw)
        for field in ['runnerQualified','buildAuthorized','runtimeAccepted','collectorExecuted']:
            self.assertIs(result[field],False)
        return code,result,raw

    def test_root_first_order(self):
        result,calls=self.observed_role([info(),info(),info()])
        self.assertEqual(calls,['C:\\',r'C:\private-receipt',str(REPO)])
        self.assertEqual(result,{'role':'repository','ancestorCount':3,'status':'plain_directory_metadata_observed'})

    def test_separate_and_combined_predicates(self):
        cases=[(info(stat.S_IFLNK|0o777,0x400,0xA000000C),(True,True,True)),
               (info(DIR,0x410,0xA0000003),(False,True,False)),
               (info(stat.S_IFREG|0o600,0,0),(False,False,True)),
               (info(stat.S_IFLNK|0o777,0,0),(True,False,True))]
        for record,expected in cases:
            with self.subTest(expected=expected):
                result,calls=self.observed_role([info(),record])
                self.assertIsInstance(result,d.Refusal)
                self.assertEqual(len(calls),2)
                self.assertEqual(result.reason,'plain_local_directory_ancestors_required')
                observed=result.observation
                self.assertEqual((observed['role'],observed['ancestorOrdinal'],observed['ancestorCount']),('repository',2,3))
                self.assertEqual(tuple(observed['predicates'].values()),expected)
                self.assertEqual((observed['mode'],observed['fileAttributes'],observed['reparseTag']),(record.st_mode,record.st_file_attributes,record.st_reparse_tag))
                self.assertNotIn('private-receipt',json.dumps(observed))

    def test_root_rejection_stops_descendants(self):
        result,calls=self.observed_role([info(DIR,0x410,0xA0000003)])
        self.assertEqual(calls,['C:\\'])
        self.assertEqual(result.observation['ancestorOrdinal'],1)

    def test_metadata_errors_safe_and_located(self):
        for error in [FileNotFoundError(2,'private-secret',str(REPO)),PermissionError(13,'private-secret',str(REPO))]:
            error.winerror=5
            result,calls=self.observed_role([info(),error])
            self.assertEqual(len(calls),2)
            self.assertEqual(result.reason,'filesystem_or_native_api_error')
            self.assertEqual((result.observation['ancestorOrdinal'],result.observation['errno'],result.observation['winerror']),(2,error.errno,5))
            self.assertNotIn('private-secret',json.dumps(result.observation))
            self.assertNotIn('private-receipt',json.dumps(result.observation))

    def test_expired_before_drive_or_metadata(self):
        with patch.object(d,'fixed_drive') as drive, patch.object(d.os,'lstat') as ls, patch.object(d.time,'monotonic',return_value=10):
            with self.assertRaises(d.Refusal) as caught:d.inspect_role('repository',REPO,10)
            self.assertEqual(caught.exception.reason,'diagnostic_deadline')
            drive.assert_not_called();ls.assert_not_called()

    def test_late_stat_completion_stops_next(self):
        with patch.object(d,'fixed_drive'),patch.object(d.os,'lstat',return_value=info()) as ls,patch.object(d.time,'monotonic',side_effect=[0,0,0,11]):
            with self.assertRaises(d.Refusal) as caught:d.inspect_role('repository',REPO,10)
            self.assertEqual(caught.exception.reason,'diagnostic_deadline')
            self.assertEqual(ls.call_count,1)
            self.assertEqual(caught.exception.observation['ancestorOrdinal'],1)

    def test_unsafe_syntax_no_native_metadata(self):
        values=[r'\\server\share\x',r'\\?\C:\x',r'\\.\PhysicalDrive0',r'C:relative',r'\rootrelative',r'C:\x\..\y','C:\\x\x00y', 'C:\\'+'x'*1024,'C:\\'+'\\'.join('a' for _ in range(65))]
        for value in values:
            with self.subTest(value=value),patch.object(d,'fixed_drive') as drive,patch.object(d.os,'lstat') as ls:
                with self.assertRaises(d.Refusal):d.inspect_role('repository',PureWindowsPath(value),10)
                drive.assert_not_called();ls.assert_not_called()

    def test_drive_type_metadata_only_and_fail_closed(self):
        for value in range(7):
            function=types.SimpleNamespace()
            class Native:
                def __call__(self,root):
                    self.root=root;return value
            call=Native()
            with patch.object(ctypes,'WinDLL',return_value=types.SimpleNamespace(GetDriveTypeW=call),create=True):
                if value==3:d.fixed_drive(REPO)
                else:
                    with self.assertRaises(d.Refusal) as caught:d.fixed_drive(REPO)
                    self.assertEqual(caught.exception.observation,{'driveType':value})
                self.assertEqual(call.root,'C:\\')
                self.assertEqual(call.argtypes,[ctypes.c_wchar_p])
                self.assertIs(call.restype,ctypes.c_uint)

    def windows(self):
        stack=ExitStack()
        stack.enter_context(patch.object(d.sys,'platform','win32'))
        stack.enter_context(patch.object(d.sys,'version_info',(3,11,15)))
        stack.enter_context(patch.object(d.sys,'base_prefix',str(BASE)))
        stack.enter_context(patch.object(d,'Path',PureWindowsPath))
        stack.enter_context(patch.object(d.time,'monotonic',return_value=0))
        return stack

    def test_all_five_roles_and_output_slot_unread(self):
        calls=[]
        with self.windows(),patch.object(d,'fixed_drive'),patch.object(d.os,'lstat',side_effect=lambda p:(calls.append(str(p)) or info())):
            result=d.metadata(REPO,OUTPUT,10)
        self.assertEqual([r['role'] for r in result['completedRoles']],['repository','output-parent','basePrefix','Lib','DLLs'])
        self.assertIsNone(result['rejected'])
        self.assertNotIn(str(OUTPUT),calls)
        self.assertEqual(calls[-3:],['C:\\',str(BASE),str(BASE/'DLLs')])
        self.assertNotIn('private-receipt',json.dumps(result))

    def test_failure_retains_completed_roles_and_stops_later(self):
        def observed(p):
            return info(DIR,0x410,0xA0000003) if p==BASE else info()
        with self.windows(),patch.object(d,'fixed_drive'),patch.object(d.os,'lstat',side_effect=observed) as ls:
            with self.assertRaises(d.Refusal) as caught:d.metadata(REPO,OUTPUT,10)
        result=caught.exception.observation
        self.assertEqual([r['role'] for r in result['completedRoles']],['repository','output-parent'])
        self.assertEqual(result['rejected']['role'],'basePrefix')
        self.assertEqual(result['rejected']['ancestorOrdinal'],2)
        self.assertNotIn(BASE/'Lib',[c.args[0] for c in ls.call_args_list])

    def test_all_role_syntax_before_any_io(self):
        with self.windows(),patch.object(d.sys,'base_prefix',r'\\server\share\python'),patch.object(d,'fixed_drive') as drive,patch.object(d.os,'lstat') as ls:
            with self.assertRaises(d.Refusal):d.metadata(REPO,OUTPUT,10)
            drive.assert_not_called();ls.assert_not_called()

    def test_runtime_guard_precedes_io(self):
        with patch.object(d.sys,'platform','linux'),patch.object(d,'local_syntax') as syntax,patch.object(d.os,'lstat') as ls:
            with self.assertRaises(d.Refusal) as caught:d.metadata(REPO,OUTPUT,10)
            self.assertEqual(caught.exception.reason,'actual_windows_python_3_11_15_required')
            syntax.assert_not_called();ls.assert_not_called()
        with self.windows(),patch.object(d.sys,'version_info',(3,11,14)),patch.object(d.os,'lstat') as ls:
            with self.assertRaises(d.Refusal):d.metadata(REPO,OUTPUT,10)
            ls.assert_not_called()

    def test_cli_errors_no_private_paths(self):
        for args in [[],['--repository','private-secret'],['--unknown','private-secret']]:
            code,result,raw=self.main_result(args)
            self.assertEqual(code,2)
            self.assertEqual(result['reason'],'invalid_arguments')
            self.assertNotIn(b'private-secret',raw)

    def test_unexpected_exception_scrubbed(self):
        with patch.object(d,'metadata',side_effect=ValueError('private-secret')):
            code,result,raw=self.main_result(['--repository','private-secret','--original-output','private-secret'])
        self.assertEqual((code,result['reason']),(2,'unexpected_diagnostic_error'))
        self.assertNotIn(b'private-secret',raw)

    def test_success_admission_false(self):
        with patch.object(d,'metadata',return_value={'completedRoles':[],'rejected':None}):
            code,result,raw=self.main_result(['--repository','private-secret','--original-output','private-secret'])
        self.assertEqual((code,result['status']),(0,'DIAGNOSTIC_ONLY_NO_ADMISSION'))
        self.assertNotIn(b'private-secret',raw)
        self.assertEqual((result['fileBodiesRead'],result['filesystemWrites'],result['childProcesses']),(0,0,0))

    def test_no_body_write_enumeration_subprocess_network_or_collector_source(self):
        tree=ast.parse(source_bytes)
        imports=set()
        for node in ast.walk(tree):
            if isinstance(node,ast.Import):imports.update(n.name for n in node.names)
            if isinstance(node,ast.ImportFrom):imports.add(node.module)
        self.assertEqual(imports,{'argparse','json','os','pathlib','re','stat','sys','time','ctypes'})
        forbidden={'open','read','read_bytes','read_text','scandir','listdir','walk','mkdir','unlink','remove','system','popen','spawn','run','exec','eval','__import__','write_text','write_bytes'}
        for node in ast.walk(tree):
            if isinstance(node,ast.Call):
                name=node.func.id if isinstance(node.func,ast.Name) else node.func.attr if isinstance(node.func,ast.Attribute) else ''
                self.assertNotIn(name,forbidden)
        self.assertNotIn(b'worker_image_collect',source_bytes)

if __name__=='__main__':
    print(json.dumps({'sourceSha256':hashlib.sha256(source_bytes).hexdigest(),'nativeExecution':False}))
    unittest.main(verbosity=2)
