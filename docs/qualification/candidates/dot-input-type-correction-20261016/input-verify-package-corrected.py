"""Same stdlib byte/digest/provenance verifier over the corrected actual archive."""
import pathlib
root=pathlib.Path(__file__).resolve().parent
source=(root/'input-verify-package.py').read_text(encoding='utf-8').replace("root/'input-package/","root/'input-package-corrected/").replace("root/'input-tooling/","root/'input-tooling-corrected/")
exec(compile(source,str(root/'input-verify-package.py'),'exec'),{'__file__':str(root/'input-verify-package.py'),'__name__':'__main__'})
