"""Same existing bounded supervisor, one new assembled-input integration file only."""
from pathlib import Path
root=Path(__file__).parent
source=(root/'run_combined_loading.py').read_text()
source=source.replace("'audit-evidence/combined-loading.test.mjs'", "'apps/runtime/test/input-admission-mount.test.mjs'")
source=source.replace("combined-loading.tap", "input-mount.tap").replace("combined-loading.stderr", "input-mount.stderr").replace("combined-loading.receipt.json", "input-mount.receipt.json")
source=source.replace('Actual integrated module loading and inert composition with real canonical validators and third-party packages reused read-only; synthetic refusing SQL/store inputs; no socket/service/material/provider/DB or child test processes',
 'Actual integrated assembled lifecycle/input route with real canonical validators and read-only third-party reuse; scripted SQL/current identity/Temporal resources, no real socket/service/material/provider/DB or child test processes')
exec(compile(source,str(root/'run_combined_loading.py'),'exec'),{'__file__':str(root/'run_combined_loading.py'),'__name__':'__main__'})
