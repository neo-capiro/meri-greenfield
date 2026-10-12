"""Additional independent final role-specific syntax control; original16 unchanged."""
from contextlib import ExitStack
import json
from pathlib import PureWindowsPath
import unittest
from unittest.mock import patch
from independent_controls import d, REPO, OUTPUT, BASE

class SyntaxControl(unittest.TestCase):
    def test_rejected_syntax_role_before_native_io(self):
        bad=PureWindowsPath(r'\\remote\private-share\secret')
        for role,repo,output,base in [('repository',bad,OUTPUT,BASE),('original-output',REPO,bad,BASE),('basePrefix',REPO,OUTPUT,bad)]:
            with self.subTest(role=role),ExitStack() as stack:
                stack.enter_context(patch.object(d.sys,'platform','win32'))
                stack.enter_context(patch.object(d.sys,'version_info',(3,11,15)))
                stack.enter_context(patch.object(d.sys,'base_prefix',str(base)))
                stack.enter_context(patch.object(d,'Path',PureWindowsPath))
                drive=stack.enter_context(patch.object(d,'fixed_drive'))
                ls=stack.enter_context(patch.object(d.os,'lstat'))
                with self.assertRaises(d.Refusal) as caught:d.metadata(repo,output,10)
                self.assertEqual(caught.exception.observation,{'completedRoles':[],'rejected':{'role':role,'stage':'syntax','ancestorOrdinal':None,'ancestorCount':None}})
                self.assertNotIn('private-share',json.dumps(caught.exception.observation))
                drive.assert_not_called();ls.assert_not_called()

if __name__=='__main__':unittest.main(verbosity=2)
