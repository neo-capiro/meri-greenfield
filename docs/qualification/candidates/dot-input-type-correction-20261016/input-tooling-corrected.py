"""Same approved bounded supervisor; corrected input source, separate receipts/archive, strict no-skip declaration check."""
import pathlib
root=pathlib.Path(__file__).resolve().parent
source=(root/'input-tooling.py').read_text(encoding='utf-8')
source=source.replace("OUT=ROOT/'input-tooling'","OUT=ROOT/'input-tooling-corrected'").replace("ROOT/'input-tooling-profile.json'","ROOT/'input-tooling-corrected-profile.json'")
source=source.replace("!=26:raise RuntimeError('Expected exactly26 existing artifacts before generation')","!=30:raise RuntimeError('Expected exactly30 existing artifacts before corrected generation')")
source=source.replace("ROOT/'input-package'","ROOT/'input-package-corrected'")
exec(compile(source,str(root/'input-tooling.py'),'exec'),{'__file__':str(root/'input-tooling.py'),'__name__':'__main__'})
