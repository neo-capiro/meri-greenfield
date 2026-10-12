"""Run the public data verifier with a private path kept out of capture argv."""
import os
import runpy
import sys

source = 'docs/qualification/candidates/native-helper-20261012/author/helper-observation.py'
try:
    sys.argv = [source, os.environ['MERI_PRIVATE_HELPER_INPUT']]
    runpy.run_path(source, run_name='__main__')
except SystemExit:
    raise
except BaseException as error:
    # Never publish a private path from a failed file read or traceback.
    print('PRIVATE_DATA_REPLAY_FAILED:' + type(error).__name__, file=sys.stderr)
    raise SystemExit(1) from None
